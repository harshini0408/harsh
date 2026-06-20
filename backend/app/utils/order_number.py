from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.order import Order


async def generate_order_number(db: AsyncSession) -> str:
    """Generate a unique order number in format ORD-YYYYMMDD-NNNN."""
    today = datetime.now(timezone.utc)
    date_str = today.strftime("%Y%m%d")
    prefix = f"ORD-{date_str}-"

    # Count today's orders to determine the next sequence number
    result = await db.execute(
        select(func.count(Order.id)).where(
            Order.order_number.like(f"{prefix}%")
        )
    )
    count = result.scalar() or 0
    sequence = count + 1

    return f"{prefix}{sequence:04d}"
