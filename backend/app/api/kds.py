from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.order import KDSTicket, KitchenStatusUpdate
from app.services.order_service import get_kds_tickets, update_kitchen_status
from app.core.dependencies import get_current_user

router = APIRouter(prefix="/kds", tags=["Kitchen Display System"])


@router.get("/tickets", response_model=list[KDSTicket])
async def get_tickets(db: AsyncSession = Depends(get_db)):
    """Get all sent_to_kitchen orders for the KDS display."""
    return await get_kds_tickets(db)


@router.patch("/items/{item_id}/status")
async def update_item_status(
    item_id: int,
    request: KitchenStatusUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Advance kitchen status: to_cook → preparing → completed."""
    return await update_kitchen_status(db, item_id, request.kitchen_status)
