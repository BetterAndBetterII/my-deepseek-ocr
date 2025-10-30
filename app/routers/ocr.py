import base64
import io
from typing import AsyncGenerator, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
import anyio

from app.core.config import settings
from app.db import get_db
from app.models import UsageEvent, User
from app.ocr_client import get_client
from app.routers.auth import get_current_user


router = APIRouter(prefix="/ocr", tags=["ocr"])


async def _stream_openai_chat(messages, extra_body=None) -> AsyncGenerator[str, None]:
    """Async generator yielding content deltas via OpenAI streaming."""
    client = get_client()
    stream = await client.chat.completions.create(
        model=settings.LLM_MODEL,
        messages=messages,
        stream=True,
        extra_body=extra_body or {},
    )
    async for chunk in stream:
        if not chunk.choices:
            continue
        delta = chunk.choices[0].delta  # type: ignore[attr-defined]
        if hasattr(delta, "content") and delta.content:
            yield delta.content


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
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if file.content_type not in ("image/png", "image/jpeg", "image/jpg", "image/webp"):
        raise HTTPException(status_code=400, detail="Only PNG/JPEG/WEBP images are supported")
    content = await file.read()
    input_b64 = base64.b64encode(content).decode("utf-8")
    media_type = file.content_type
    prompt_text = settings.LLM_PROMPT

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

    async def generator():
        nonlocal completion_chars_acc
        async for piece in _stream_openai_chat(messages, extra_body=extra_body):
            completion_chars_acc += len(piece)
            yield piece
        await _record_usage(
            db,
            current_user,
            kind="image",
            prompt_chars=prompt_chars,
            completion_chars=completion_chars_acc,
            input_bytes=len(content),
        )

    return StreamingResponse(generator(), media_type="text/plain; charset=utf-8")


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
        pil_image = page.render(scale=2).to_pil()
        images.append(pil_image)
        page.close()
    pdf.close()
    return images


async def _pdf_to_images(file_bytes: bytes):
    return await anyio.to_thread.run_sync(_pdf_to_images_sync, file_bytes)


@router.post("/pdf")
async def ocr_pdf(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if file.content_type not in ("application/pdf",):
        raise HTTPException(status_code=400, detail="Only PDF is supported")

    content = await file.read()
    images = await _pdf_to_images(content)
    if not images:
        # Fallback: try direct PDF as data URL (may or may not be supported by backend)
        prompt_text = settings.LLM_PROMPT + "\nDocument is PDF; extract all text in reading order."
        input_b64 = base64.b64encode(content).decode("utf-8")
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt_text},
                    {"type": "image_url", "image_url": {"url": f"data:application/pdf;base64,{input_b64}"}},
                ],
            }
        ]
        extra_body = {
            "vllm_xargs": {"ngram_size": 30, "window_size": 90},
            "skip_special_tokens": False,
        }

        prompt_chars = len(prompt_text)
        completion_chars_acc = 0

        async def gen_single_pdf():
            nonlocal completion_chars_acc
            async for piece in _stream_openai_chat(messages, extra_body=extra_body):
                completion_chars_acc += len(piece)
                yield piece
            await _record_usage(
                db,
                current_user,
                kind="pdf",
                prompt_chars=prompt_chars,
                completion_chars=completion_chars_acc,
                input_bytes=len(content),
                meta="direct_pdf_data_url",
            )

        return StreamingResponse(gen_single_pdf(), media_type="text/plain; charset=utf-8")

    prompt_base = settings.LLM_PROMPT + "\nYou will receive pages one by one."
    extra_body = {
        "vllm_xargs": {"ngram_size": 30, "window_size": 90},
        "skip_special_tokens": False,
    }

    async def generator_pages():
        total_completion = 0
        for idx, img in enumerate(images, start=1):
            yield f"\n\n# Page {idx}\n\n"
            buf = io.BytesIO()
            await anyio.to_thread.run_sync(img.save, buf, "PNG")
            b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
            messages = [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt_base},
                        {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}},
                    ],
                }
            ]
            async for piece in _stream_openai_chat(messages, extra_body=extra_body):
                total_completion += len(piece)
                yield piece
        await _record_usage(
            db,
            current_user,
            kind="pdf",
            prompt_chars=len(prompt_base) * max(1, len(images)),
            completion_chars=total_completion,
            input_bytes=len(content),
            meta=f"pages={len(images)}",
        )

    return StreamingResponse(generator_pages(), media_type="text/plain; charset=utf-8")
