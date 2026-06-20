from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.venue import TableStatusResponse, SessionCreateResponse
from app.services.table_service import check_table_status, open_customer_session, close_session

router = APIRouter(prefix="/tables", tags=["Tables & Sessions"])


@router.get("/{qr_token}/status", response_model=TableStatusResponse)
async def get_table_status(qr_token: str, db: AsyncSession = Depends(get_db)):
    """Check if a table is occupied by QR token."""
    return await check_table_status(db, qr_token)


@router.post("/{qr_token}/session", response_model=SessionCreateResponse)
async def create_customer_session(qr_token: str, db: AsyncSession = Depends(get_db)):
    """
    Open a customer QR session.
    Returns 409 if table already has an active session.
    """
    return await open_customer_session(db, qr_token)


@router.post("/sessions/{session_id}/close")
async def close_table_session(session_id: int, db: AsyncSession = Depends(get_db)):
    """Close a table session."""
    await close_session(db, session_id)
    return {"message": "Session closed successfully."}
