from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.customer import Customer, LoyaltyLedger
from app.models.order import Order, OrderItem
from app.models.catalog import Product
from app.core.exceptions import (
    InsufficientLoyaltyError, GuestLoyaltyError, NotFoundError
)


async def get_loyalty_balance(db: AsyncSession, customer_id: int) -> dict:
    """Get a customer's loyalty balance and ledger history."""
    result = await db.execute(
        select(Customer).where(Customer.id == customer_id)
    )
    customer = result.scalar_one_or_none()
    if customer is None:
        raise NotFoundError("Customer")

    # Get ledger entries
    ledger_result = await db.execute(
        select(LoyaltyLedger).where(LoyaltyLedger.customer_id == customer_id)
        .order_by(LoyaltyLedger.created_at.desc())
    )
    ledger_entries = ledger_result.scalars().all()

    return {
        "customer_id": customer.id,
        "customer_name": customer.name,
        "loyalty_credits": customer.loyalty_credits,
        "is_guest": customer.is_guest,
        "ledger": [
            {
                "id": entry.id,
                "order_id": entry.order_id,
                "entry_type": entry.entry_type,
                "credits_delta": entry.credits_delta,
                "balance_after": entry.balance_after,
                "note": entry.note,
                "created_at": entry.created_at,
            }
            for entry in ledger_entries
        ],
    }


async def redeem_loyalty(
    db: AsyncSession, order_id: int, customer_id: int, cashier_id: int | None = None
) -> dict:
    """
    Redeem loyalty credits for a free drink.
    All steps in one transaction:
    1. Re-read customer loyalty balance
    2. Verify >= 50 credits and not a guest
    3. Find the loyalty reward product
    4. Insert order item with is_loyalty_redemption=True, price=0
    5. Deduct 50 credits
    6. Insert loyalty_ledger row
    7. Update order.loyalty_credits_redeemed
    """
    # Step 1: Re-read balance inside transaction
    customer_result = await db.execute(
        select(Customer).where(Customer.id == customer_id)
    )
    customer = customer_result.scalar_one_or_none()
    if customer is None:
        raise NotFoundError("Customer")

    # Step 2: Verify eligibility
    if customer.is_guest:
        raise GuestLoyaltyError()
    if customer.loyalty_credits < 50:
        raise InsufficientLoyaltyError(required=50, available=customer.loyalty_credits)

    # Step 3: Find the loyalty reward product
    product_result = await db.execute(
        select(Product).where(Product.is_loyalty_reward == True, Product.is_active == True)
    )
    reward_product = product_result.scalar_one_or_none()
    if reward_product is None:
        raise NotFoundError("Loyalty reward product")

    # Verify order exists and is valid
    order_result = await db.execute(
        select(Order).where(Order.id == order_id)
    )
    order = order_result.scalar_one_or_none()
    if order is None:
        raise NotFoundError("Order")

    # Step 4: Insert the free drink line item
    reward_item = OrderItem(
        order_id=order.id,
        product_id=reward_product.id,
        quantity=Decimal("1"),
        unit_price=Decimal("0"),
        line_total=Decimal("0"),
        is_loyalty_redemption=True,
        notes="Loyalty reward redemption",
    )
    db.add(reward_item)

    # Step 5: Deduct 50 credits
    customer.loyalty_credits -= 50
    new_balance = customer.loyalty_credits

    # Step 6: Insert loyalty_ledger row
    ledger_entry = LoyaltyLedger(
        customer_id=customer.id,
        order_id=order.id,
        entry_type="redeem",
        credits_delta=-50,
        balance_after=new_balance,
        created_by=cashier_id,
        note=f"Redeemed for {reward_product.name} on order {order.order_number}",
    )
    db.add(ledger_entry)

    # Step 7: Update order
    order.loyalty_credits_redeemed = 50

    await db.commit()

    return {
        "message": f"Redeemed 50 credits for {reward_product.name}",
        "new_balance": new_balance,
        "reward_product": reward_product.name,
    }


async def manual_loyalty_adjustment(
    db: AsyncSession, customer_id: int, credits_delta: int, note: str, admin_id: int
) -> dict:
    """Manual loyalty adjustment by admin (goodwill credits, corrections)."""
    customer_result = await db.execute(
        select(Customer).where(Customer.id == customer_id)
    )
    customer = customer_result.scalar_one_or_none()
    if customer is None:
        raise NotFoundError("Customer")

    if customer.is_guest:
        raise GuestLoyaltyError()

    # Update balance
    customer.loyalty_credits = max(0, customer.loyalty_credits + credits_delta)
    new_balance = customer.loyalty_credits

    # Insert ledger row
    ledger_entry = LoyaltyLedger(
        customer_id=customer.id,
        order_id=None,
        entry_type="adjustment",
        credits_delta=credits_delta,
        balance_after=new_balance,
        created_by=admin_id,
        note=note,
    )
    db.add(ledger_entry)

    await db.commit()

    return {
        "customer_id": customer.id,
        "new_balance": new_balance,
        "credits_delta": credits_delta,
    }
