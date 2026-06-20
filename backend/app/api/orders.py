from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.order import (
    OrderCreateRequest, OrderResponse, OrderItemsUpdateRequest,
    PaymentRequest, PaymentResponse
)
from app.services.order_service import (
    create_order, update_order_items, send_to_kitchen, get_order_detail
)
from app.services.payment_service import process_payment
from app.core.dependencies import get_current_user, role_required

router = APIRouter(prefix="/orders", tags=["Orders"])


@router.post("", response_model=OrderResponse)
async def create_new_order(
    request: OrderCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new draft order."""
    placed_by = current_user.id if request.source == "cashier" else None

    order = await create_order(
        db=db,
        source=request.source,
        table_id=request.table_id,
        table_session_id=request.table_session_id,
        customer_id=request.customer_id,
        pos_session_id=request.pos_session_id,
        placed_by_user_id=placed_by,
        items=[item.model_dump() for item in request.items] if request.items else None,
        notes=request.notes,
    )
    return _order_to_response(order)


@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(order_id: int, db: AsyncSession = Depends(get_db)):
    """Get order details with items."""
    order = await get_order_detail(db, order_id)
    return _order_to_response(order)


@router.patch("/{order_id}/items", response_model=OrderResponse)
async def patch_order_items(
    order_id: int,
    request: OrderItemsUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add, update, or remove items on a draft order."""
    order = await update_order_items(
        db, order_id, [item.model_dump() for item in request.items]
    )
    return _order_to_response(order)


@router.post("/{order_id}/send-to-kitchen", response_model=OrderResponse)
async def send_order_to_kitchen(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Send order to kitchen. IRREVERSIBLE.
    Transitions draft → sent_to_kitchen.
    Triggers stock deduction via DB trigger.
    """
    order = await send_to_kitchen(db, order_id)
    return _order_to_response(order)


@router.post("/{order_id}/pay", response_model=PaymentResponse)
async def pay_order(
    order_id: int,
    request: PaymentRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required("cashier", "superadmin")),
):
    """
    Process payment for an order.
    Transitions sent_to_kitchen → paid.
    Triggers loyalty credit earning via DB trigger.
    """
    result = await process_payment(
        db=db,
        order_id=order_id,
        payment_method_id=request.payment_method_id,
        amount=request.amount,
        received_by=current_user.id,
        amount_received=request.amount_received,
        reference_code=request.reference_code,
    )
    return result


def _order_to_response(order) -> dict:
    """Convert an Order ORM object to a response dict."""
    return {
        "id": order.id,
        "order_number": order.order_number,
        "source": order.source,
        "table_id": order.table_id,
        "table_number": order.table.table_number if order.table else None,
        "table_session_id": order.table_session_id,
        "customer_id": order.customer_id,
        "customer_name": order.customer.name if order.customer else None,
        "pos_session_id": order.pos_session_id,
        "placed_by_user_id": order.placed_by_user_id,
        "status": order.status,
        "coupon_id": order.coupon_id,
        "subtotal": float(order.subtotal),
        "tax_total": float(order.tax_total),
        "discount_total": float(order.discount_total),
        "total": float(order.total),
        "loyalty_credits_earned": order.loyalty_credits_earned,
        "loyalty_credits_redeemed": order.loyalty_credits_redeemed,
        "notes": order.notes,
        "created_at": order.created_at,
        "items": [
            {
                "id": item.id,
                "product_id": item.product_id,
                "product_name": item.product.name if item.product else None,
                "quantity": float(item.quantity),
                "unit_price": float(item.unit_price),
                "line_discount": float(item.line_discount),
                "line_total": float(item.line_total),
                "kitchen_status": item.kitchen_status,
                "is_loyalty_redemption": item.is_loyalty_redemption,
                "notes": item.notes,
            }
            for item in (order.items or [])
        ],
    }
