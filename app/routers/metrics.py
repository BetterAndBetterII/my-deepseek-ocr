from fastapi import APIRouter, Response
from prometheus_client import CONTENT_TYPE_LATEST

from app.metrics import metrics_response_bytes


router = APIRouter(tags=["metrics"])


@router.get("/metrics")
async def metrics():
    data = metrics_response_bytes()
    return Response(content=data, media_type=CONTENT_TYPE_LATEST)

