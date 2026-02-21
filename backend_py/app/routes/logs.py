"""프론트엔드 로깅 엔드포인트"""
import logging
from fastapi import APIRouter, Request
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/api/logs", tags=["logs"])
logger = logging.getLogger("nursesch.frontend")


class PageViewLog(BaseModel):
    path: str
    timestamp: Optional[str] = None


@router.post("/page-view")
def log_page_view(body: PageViewLog, request: Request):
    client_ip = request.client.host if request.client else "unknown"
    logger.info(f"PAGE_VIEW path={body.path} ip={client_ip}")
    return {"status": "ok"}
