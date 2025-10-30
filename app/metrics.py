import math
import time
from typing import Optional

from prometheus_client import (
    Counter,
    Histogram,
    Gauge,
    CONTENT_TYPE_LATEST,
    generate_latest,
)


# HTTP level metrics
HTTP_IN_FLIGHT = Gauge("http_in_flight_requests", "Current in-flight HTTP requests")
HTTP_REQUESTS_TOTAL = Counter(
    "http_requests_total", "Total HTTP requests", labelnames=("method", "path", "status")
)
HTTP_REQUEST_DURATION_SECONDS = Histogram(
    "http_request_duration_seconds",
    "HTTP request duration in seconds (handler time)",
    labelnames=("method", "path"),
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10),
)


# OCR-specific metrics
OCR_IN_PROGRESS = Gauge("ocr_in_progress", "In-progress OCR operations", labelnames=("kind",))
OCR_REQUESTS_TOTAL = Counter("ocr_requests_total", "Total OCR requests", labelnames=("kind",))
IMAGE_REQUESTS_TOTAL = Counter("image_requests_total", "Total image OCR requests")
PDF_REQUESTS_TOTAL = Counter("pdf_requests_total", "Total PDF OCR requests")
OCR_PROCESSING_SECONDS = Histogram(
    "ocr_processing_seconds",
    "Total OCR processing duration including streaming",
    labelnames=("kind",),
    buckets=(0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 60, 120, 300),
)
OCR_INPUT_BYTES_TOTAL = Counter(
    "ocr_input_bytes_total", "Total input bytes received for OCR", labelnames=("kind",)
)


# Users + tokens
USERS_TOTAL = Gauge("users_total", "Total registered users")
PROMPT_TOKENS_TOTAL = Counter("prompt_tokens_total", "Total prompt tokens (approx)")
COMPLETION_TOKENS_TOTAL = Counter(
    "completion_tokens_total", "Total completion tokens (approx)"
)
TOTAL_TOKENS_TOTAL = Counter("tokens_total", "Total tokens (prompt+completion, approx)")


def approx_tokens_from_chars(chars: int) -> int:
    # Naive heuristic: ~4 chars per token (depends on text)
    return max(0, math.ceil(chars / 4))


def metrics_response_bytes() -> bytes:
    return generate_latest()


def http_metrics_start() -> float:
    HTTP_IN_FLIGHT.inc()
    return time.perf_counter()


def http_metrics_end(method: str, path: str, status_code: int, start_time: float) -> None:
    try:
        duration = max(0.0, time.perf_counter() - start_time)
        HTTP_REQUESTS_TOTAL.labels(method=method, path=path, status=str(status_code)).inc()
        HTTP_REQUEST_DURATION_SECONDS.labels(method=method, path=path).observe(duration)
    finally:
        HTTP_IN_FLIGHT.dec()


class _OcrSpan:
    def __init__(self, kind: str):
        self.kind = kind
        self.start = time.perf_counter()
        OCR_IN_PROGRESS.labels(kind=kind).inc()
        OCR_REQUESTS_TOTAL.labels(kind=kind).inc()
        if kind == "image":
            IMAGE_REQUESTS_TOTAL.inc()
        elif kind == "pdf":
            PDF_REQUESTS_TOTAL.inc()

    def finish(
        self,
        input_bytes: int,
        prompt_tokens: int,
        completion_tokens: int,
    ) -> None:
        duration = max(0.0, time.perf_counter() - self.start)
        OCR_PROCESSING_SECONDS.labels(kind=self.kind).observe(duration)
        OCR_INPUT_BYTES_TOTAL.labels(kind=self.kind).inc(input_bytes)
        if prompt_tokens:
            PROMPT_TOKENS_TOTAL.inc(prompt_tokens)
        if completion_tokens:
            COMPLETION_TOKENS_TOTAL.inc(completion_tokens)
        TOTAL_TOKENS_TOTAL.inc(prompt_tokens + completion_tokens)
        OCR_IN_PROGRESS.labels(kind=self.kind).dec()


def ocr_metrics_span(kind: str) -> _OcrSpan:
    return _OcrSpan(kind)


def set_users_total(value: int) -> None:
    USERS_TOTAL.set(value)

