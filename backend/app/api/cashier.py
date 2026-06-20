from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.venue import SessionCreateResponse
from app.services.table_service import open_cashier_session, get_all_tables_with_status
from app.core.dependencies import role_required

router = APIRouter(prefix="/cashier", tags=["Cashier"])


@router.post("/tables/{table_id}/session", response_model=SessionCreateResponse)
async def cashier_open_table(
    table_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required("cashier", "superadmin")),
):
    """Cashier opens a table session (walk-in seating)."""
    return await open_cashier_session(db, table_id, current_user.id)


@router.get("/tables")
async def cashier_get_tables(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required("cashier", "superadmin")),
):
    """Get all tables with their current session status for the floor view."""
    return await get_all_tables_with_status(db)
