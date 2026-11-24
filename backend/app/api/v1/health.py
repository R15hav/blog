"""Readiness probe: confirms the app can reach its database.

Unauthenticated by design. The response body never carries exception text,
hosts or credentials; only the exception class name is logged.
"""
import asyncio
import logging

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.db import get_async_session

logger = logging.getLogger(__name__)

HEALTH_DB_TIMEOUT_SECONDS = 3

router = APIRouter()


@router.get("/health")
async def health(session: AsyncSession = Depends(get_async_session)):
    try:
        await asyncio.wait_for(session.execute(text("SELECT 1")), timeout=HEALTH_DB_TIMEOUT_SECONDS)
    except Exception as exc:  # includes the timeout; never leak details
        logger.warning("Health check failed: database unavailable (%s)", type(exc).__name__)
        return JSONResponse(status_code=503, content={"status": "unavailable"})
    return {"status": "ok"}
