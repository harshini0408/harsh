from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.order import Order, Payment
from app.models.venue import PaymentMethod
from app.services.table_service import close_session
from app.core.exceptions import NotFoundError, OrderNotSentError


async def process_payment(
    db: AsyncSession,
    order_id: int,
    payment_method_id: int,
    amount: float,
    received_by: int,
    amount_received: float | None = None,
    reference_code: str | None = None,
) -> dict:
    """Process a payment for an order, transitioning it to 'paid'."""
    # Verify order
    order_result = await db.execute(
        select(Order).where(Order.id == order_id)
    )
    order = order_result.scalar_one_or_none()
    if order is None:
        raise NotFoundError("Order")
    if order.status != "sent_to_kitchen":
        raise OrderNotSentError()

    # Verify payment method
    pm_result = await db.execute(
        select(PaymentMethod).where(PaymentMethod.id == payment_method_id)
    )
    payment_method = pm_result.scalar_one_or_none()
    if payment_method is None:
        raise NotFoundError("Payment method")

    # Calculate change due for cash
    change_due = None
    if payment_method.type == "cash" and amount_received is not None:
        change_due = float(Decimal(str(amount_received)) - Decimal(str(amount)))
        if change_due < 0:
            change_due = 0

    # Create payment record
    payment = Payment(
        order_id=order.id,
        payment_method_id=payment_method_id,
        amount=Decimal(str(amount)),
        amount_received=Decimal(str(amount_received)) if amount_received else None,
        change_due=Decimal(str(change_due)) if change_due is not None else None,
        reference_code=reference_code,
        status="success",
        received_by=received_by,
    )
    db.add(payment)

    # Transition order to paid — this fires trg_orders_earn_loyalty_on_paid
    order.status = "paid"
    await db.commit()

    # Close the table session if one exists
    if order.table_session_id:
        await close_session(db, order.table_session_id)

    await db.refresh(payment)

    return {
        "id": payment.id,
        "order_id": order.id,
        "order_number": order.order_number,
        "payment_method": payment_method.display_name or payment_method.type,
        "amount": float(payment.amount),
        "amount_received": float(payment.amount_received) if payment.amount_received else None,
        "change_due": float(payment.change_due) if payment.change_due else None,
        "status": payment.status,
        "loyalty_credits_earned": order.loyalty_credits_earned,
    }
