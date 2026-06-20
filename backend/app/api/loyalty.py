from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.customer import LoyaltyBalanceResponse, LoyaltyAdjustmentRequest
from app.services.loyalty_service import get_loyalty_balance, redeem_loyalty, manual_loyalty_adjustment
from app.core.dependencies import get_current_user, role_required

router = APIRouter(tags=["Loyalty"])


@router.get("/customers/{customer_id}/loyalty", response_model=LoyaltyBalanceResponse)
async def get_customer_loyalty(
    customer_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get customer loyalty balance and ledger history."""
    return await get_loyalty_balance(db, customer_id)


@router.post("/orders/{order_id}/redeem-loyalty")
async def redeem_loyalty_credits(
    order_id: int,
    customer_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required("cashier", "superadmin")),
):
    """
    Redeem 50 loyalty credits for the fixed reward product.
    Validates balance >= 50, inserts free line item, decrements balance.
    """
    return await redeem_loyalty(db, order_id, customer_id, current_user.id)


@router.post("/customers/{customer_id}/loyalty/adjust")
async def adjust_loyalty(
    customer_id: int,
    request: LoyaltyAdjustmentRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required("superadmin")),
):
    """Manual loyalty adjustment (goodwill credits, corrections). Superadmin only."""
    return await manual_loyalty_adjustment(
        db, customer_id, request.credits_delta, request.note, current_user.id
    )
