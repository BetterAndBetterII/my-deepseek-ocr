import base64
import io
import json
from typing import AsyncGenerator, Optional
import asyncio

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from asgiref.sync import sync_to_async

from app.core.config import settings
from app.db import get_db
from app.models import UsageEvent, User
from app.ocr_client import get_client
from app.routers.auth import get_current_user
from app.metrics import approx_tokens_from_chars, ocr_metrics_span


router = APIRouter(prefix="/ocr", tags=["ocr"])


async def _stream_openai_chat(messages, extra_body=None, usage_ref: dict | None = None) -> AsyncGenerator[str, None]:
    """Async generator yielding content deltas via OpenAI streaming.
    Attempts to fill usage_ref with real token usage from the SDK.
    """
    client = get_client()
    stream = await client.chat.completions.create(
        model=settings.LLM_MODEL,
        messages=messages,
        stream=True,
        temperature=0.0,
        stream_options={"include_usage": True},
        extra_body=extra_body or {},
    )
    async for chunk in stream:
        if not chunk.choices:
            continue
        delta = chunk.choices[0].delta  # type: ignore[attr-defined]
        if hasattr(delta, "content") and delta.content:
            yield delta.content
        # If usage is present on the chunk (when include_usage enabled), capture it
        if usage_ref is not None and hasattr(chunk, "usage") and getattr(chunk, "usage") is not None:  # type: ignore[attr-defined]
            try:
                u = getattr(chunk, "usage")
                pt = int(getattr(u, "prompt_tokens", 0) or 0)
                ct = int(getattr(u, "completion_tokens", 0) or 0)
                usage_ref["prompt_tokens"] = pt
                usage_ref["completion_tokens"] = ct
            except Exception:
                pass
    # After stream ends, try to get final response usage if SDK supports it
    if usage_ref is not None and hasattr(stream, "get_final_response"):
        try:
            final = await stream.get_final_response()  # type: ignore[attr-defined]
            if final is not None and getattr(final, "usage", None) is not None:
                u = final.usage
                usage_ref["prompt_tokens"] = int(getattr(u, "prompt_tokens", 0) or 0)
                usage_ref["completion_tokens"] = int(getattr(u, "completion_tokens", 0) or 0)
        except Exception:
            pass


async def _record_usage(
    db: AsyncSession,
    user: User,
    kind: str,
    prompt_chars: int,
    completion_chars: int,
    prompt_tokens: int = 0,
    completion_tokens: int = 0,
    input_bytes: int = 0,
    meta: Optional[str] = None,
):
    evt = UsageEvent(
        user_id=user.id,
        kind=kind,
        prompt_chars=prompt_chars,
        completion_chars=completion_chars,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        input_bytes=input_bytes,
        meta=meta,
    )
    db.add(evt)
    await db.commit()


@router.post("/image")
async def ocr_image(
    file: UploadFile = File(...),
    prompt: str | None = Form(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if file.content_type not in ("image/png", "image/jpeg", "image/jpg", "image/webp"):
        raise HTTPException(status_code=400, detail="Only PNG/JPEG/WEBP images are supported")
    content = await file.read()
    input_b64 = base64.b64encode(content).decode("utf-8")
    media_type = file.content_type
    prompt_text = (prompt or "").strip() or settings.LLM_PROMPT

    messages = [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": prompt_text},
                {"type": "image_url", "image_url": {"url": f"data:{media_type};base64,{input_b64}"}},
            ],
        }
    ]

    extra_body = {
        "vllm_xargs": {"ngram_size": 30, "window_size": 90},
        "skip_special_tokens": False,
    }

    prompt_chars = len(prompt_text)
    completion_chars_acc = 0

    span = ocr_metrics_span("image")

    async def generator_ndjson():
        nonlocal completion_chars_acc
        usage: dict = {}
        yield json.dumps({"type": "start", "kind": "image"}) + "\n"
        async for piece in _stream_openai_chat(messages, extra_body=extra_body, usage_ref=usage):
            completion_chars_acc += len(piece)
            yield json.dumps({"type": "delta", "delta": piece}) + "\n"
        prompt_tokens = int(usage.get("prompt_tokens") or 0) or approx_tokens_from_chars(prompt_chars)
        completion_tokens = int(usage.get("completion_tokens") or 0) or approx_tokens_from_chars(completion_chars_acc)
        await _record_usage(
            db,
            current_user,
            kind="image",
            prompt_chars=prompt_chars,
            completion_chars=completion_chars_acc,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            input_bytes=len(content),
        )
        span.finish(
            input_bytes=len(content),
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
        )
        yield json.dumps({
            "type": "end",
            "usage": {
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "prompt_chars": prompt_chars,
                "completion_chars": completion_chars_acc,
                "input_bytes": len(content),
            },
        }) + "\n"

    return StreamingResponse(generator_ndjson(), media_type="application/x-ndjson; charset=utf-8")


def _pdf_to_images_sync(file_bytes: bytes):
    """Sync conversion: PDF bytes -> list of PIL Images via pypdfium2. Returns [] if not available."""
    try:
        import pypdfium2 as pdfium  # type: ignore
    except Exception:
        return []

    pdf = pdfium.PdfDocument(io.BytesIO(file_bytes))
    images = []
    for page_index in range(len(pdf)):
        page = pdf.get_page(page_index)
        pil_image = page.render(scale=8).to_pil()
        images.append(pil_image)
        page.close()
    pdf.close()
    return images


async def _pdf_to_images(file_bytes: bytes):
    return await sync_to_async(_pdf_to_images_sync, thread_sensitive=False)(file_bytes)


@router.post("/pdf")
async def ocr_pdf(
    file: UploadFile = File(...),
    prompt: str | None = Form(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if file.content_type not in ("application/pdf",):
        raise HTTPException(status_code=400, detail="Only PDF is supported")

    content = await file.read()
    images = await _pdf_to_images(content)
    if not images:
        # Backend does not support direct PDF input; conversion failed
        raise HTTPException(status_code=400, detail="PDF parsing failed: pypdfium2 not available or could not render pages.")

    prompt_text = (prompt or "").strip() or settings.LLM_PROMPT
    extra_body = {
        "vllm_xargs": {"ngram_size": 30, "window_size": 90},
        "skip_special_tokens": False,
    }

    span = ocr_metrics_span("pdf")

    async def generator_pages_parallel_ndjson():
        queue: asyncio.Queue = asyncio.Queue(maxsize=64)
        pages = list(enumerate(images, start=1))
        total_completion_chars = 0
        total_prompt_tokens = 0
        total_completion_tokens = 0

        async def worker(idx: int, img):
            nonlocal total_completion_chars, total_prompt_tokens, total_completion_tokens
            await queue.put({"type": "page_start", "page": idx})
            buf = io.BytesIO()
            await sync_to_async(img.save, thread_sensitive=False)(buf, "PNG")
            b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
            messages = [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt_text},
                        {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}},
                    ],
                }
            ]
            usage: dict = {}
            local_completion = 0
            async for piece in _stream_openai_chat(messages, extra_body=extra_body, usage_ref=usage):
                local_completion += len(piece)
                await queue.put({"type": "page_delta", "page": idx, "delta": piece})
            pt = int(usage.get("prompt_tokens") or 0) or approx_tokens_from_chars(len(prompt_text))
            ct = int(usage.get("completion_tokens") or 0) or approx_tokens_from_chars(local_completion)
            total_prompt_tokens += pt
            total_completion_tokens += ct
            total_completion_chars += local_completion
            await queue.put({"type": "page_end", "page": idx, "usage": {"prompt_tokens": pt, "completion_tokens": ct, "completion_chars": local_completion}})

        tasks = [asyncio.create_task(worker(idx, img)) for idx, img in pages]

        done_pages = 0
        yield json.dumps({"type": "start", "kind": "pdf", "pages": len(pages)}) + "\n"
        try:
            while done_pages < len(pages):
                item = await queue.get()
                if isinstance(item, dict):
                    yield json.dumps(item) + "\n"
                    if item.get("type") == "page_end":
                        done_pages += 1
        finally:
            for t in tasks:
                if not t.done():
                    t.cancel()
            await asyncio.gather(*tasks, return_exceptions=True)

        prompt_chars_total = len(prompt_text) * max(1, len(images))
        prompt_tokens = total_prompt_tokens or approx_tokens_from_chars(prompt_chars_total)
        completion_tokens = total_completion_tokens or approx_tokens_from_chars(total_completion_chars)
        await _record_usage(
            db,
            current_user,
            kind="pdf",
            prompt_chars=prompt_chars_total,
            completion_chars=total_completion_chars,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            input_bytes=len(content),
            meta=f"pages={len(images)}",
        )
        span.finish(
            input_bytes=len(content),
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
        )
        yield json.dumps({
            "type": "end",
            "usage": {
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "prompt_chars": prompt_chars_total,
                "completion_chars": total_completion_chars,
                "input_bytes": len(content),
                "pages": len(pages),
            },
        }) + "\n"

    return StreamingResponse(
        generator_pages_parallel_ndjson(),
        media_type="application/x-ndjson; charset=utf-8",
    )
