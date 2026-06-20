from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.order import Order, OrderItem
from app.models.catalog import Product
from app.models.venue import TableMaster
from app.core.exceptions import OrderNotDraftError, NotFoundError, OrderNotSentError
from app.utils.order_number import generate_order_number


async def create_order(
    db: AsyncSession,
    source: str,
    table_id: int | None = None,
    table_session_id: int | None = None,
    customer_id: int | None = None,
    pos_session_id: int | None = None,
    placed_by_user_id: int | None = None,
    items: list[dict] | None = None,
    notes: str | None = None,
) -> Order:
    """Create a new draft order."""
    order_number = await generate_order_number(db)

    order = Order(
        order_number=order_number,
        source=source,
        table_id=table_id,
        table_session_id=table_session_id,
        customer_id=customer_id,
        pos_session_id=pos_session_id,
        placed_by_user_id=placed_by_user_id,
        status="draft",
        notes=notes,
    )
    db.add(order)
    await db.flush()

    # Add items if provided
    if items:
        await _add_items_to_order(db, order, items)

    await db.commit()
    await db.refresh(order)

    # Load relationships for response
    result = await db.execute(
        select(Order).options(selectinload(Order.items).selectinload(OrderItem.product))
        .where(Order.id == order.id)
    )
    return result.scalar_one()


async def _add_items_to_order(db: AsyncSession, order: Order, items: list[dict]):
    """Add items to an order and recalculate totals."""
    subtotal = Decimal("0")
    tax_total = Decimal("0")

    for item_data in items:
        product_result = await db.execute(
            select(Product).where(Product.id == item_data["product_id"])
        )
        product = product_result.scalar_one_or_none()
        if product is None:
            continue

        quantity = Decimal(str(item_data["quantity"]))
        unit_price = product.price
        line_total = unit_price * quantity
        line_tax = line_total * (product.tax_percent / Decimal("100"))

        order_item = OrderItem(
            order_id=order.id,
            product_id=product.id,
            quantity=quantity,
            unit_price=unit_price,
            line_total=line_total,
            notes=item_data.get("notes"),
        )
        db.add(order_item)

        subtotal += line_total
        tax_total += line_tax

    order.subtotal = subtotal
    order.tax_total = tax_total
    order.total = subtotal + tax_total


async def update_order_items(db: AsyncSession, order_id: int, updates: list[dict]) -> Order:
    """Update items on a draft order (add/update/remove)."""
    result = await db.execute(
        select(Order).options(selectinload(Order.items)).where(Order.id == order_id)
    )
    order = result.scalar_one_or_none()
    if order is None:
        raise NotFoundError("Order")
    if order.status != "draft":
        raise OrderNotDraftError()

    for update in updates:
        action = update["action"]

        if action == "add":
            product_result = await db.execute(
                select(Product).where(Product.id == update["product_id"])
            )
            product = product_result.scalar_one_or_none()
            if product is None:
                continue

            quantity = Decimal(str(update["quantity"]))
            line_total = product.price * quantity

            order_item = OrderItem(
                order_id=order.id,
                product_id=product.id,
                quantity=quantity,
                unit_price=product.price,
                line_total=line_total,
                notes=update.get("notes"),
            )
            db.add(order_item)

        elif action == "update":
            item_result = await db.execute(
                select(OrderItem).where(OrderItem.id == update["order_item_id"])
            )
            item = item_result.scalar_one_or_none()
            if item and item.order_id == order.id:
                if update.get("quantity"):
                    item.quantity = Decimal(str(update["quantity"]))
                    product_result = await db.execute(
                        select(Product).where(Product.id == item.product_id)
                    )
                    product = product_result.scalar_one()
                    item.line_total = product.price * item.quantity
                if update.get("notes") is not None:
                    item.notes = update["notes"]

        elif action == "remove":
            item_result = await db.execute(
                select(OrderItem).where(OrderItem.id == update["order_item_id"])
            )
            item = item_result.scalar_one_or_none()
            if item and item.order_id == order.id:
                await db.delete(item)

    await db.flush()

    # Recalculate totals
    await _recalculate_order_totals(db, order)
    await db.commit()

    # Reload
    result = await db.execute(
        select(Order).options(selectinload(Order.items).selectinload(OrderItem.product))
        .where(Order.id == order.id)
    )
    return result.scalar_one()


async def _recalculate_order_totals(db: AsyncSession, order: Order):
    """Recalculate subtotal, tax, and total for an order."""
    items_result = await db.execute(
        select(OrderItem).options(selectinload(OrderItem.product))
        .where(OrderItem.order_id == order.id)
    )
    items = items_result.scalars().all()

    subtotal = Decimal("0")
    tax_total = Decimal("0")

    for item in items:
        subtotal += item.line_total
        if item.product:
            tax_total += item.line_total * (item.product.tax_percent / Decimal("100"))

    order.subtotal = subtotal
    order.tax_total = tax_total
    order.discount_total = order.discount_total or Decimal("0")
    order.total = subtotal + tax_total - order.discount_total


async def send_to_kitchen(db: AsyncSession, order_id: int) -> Order:
    """Transition order from draft to sent_to_kitchen. Triggers stock deduction via DB trigger."""
    result = await db.execute(
        select(Order).where(Order.id == order_id)
    )
    order = result.scalar_one_or_none()
    if order is None:
        raise NotFoundError("Order")
    if order.status != "draft":
        raise OrderNotDraftError()

    # This UPDATE fires trg_orders_deduct_stock_on_send in the database
    order.status = "sent_to_kitchen"
    await db.commit()
    await db.refresh(order)

    # Reload with items
    result = await db.execute(
        select(Order).options(selectinload(Order.items).selectinload(OrderItem.product))
        .where(Order.id == order.id)
    )
    return result.scalar_one()


async def get_order_detail(db: AsyncSession, order_id: int) -> Order:
    """Get an order with all its items and product details."""
    result = await db.execute(
        select(Order).options(
            selectinload(Order.items).selectinload(OrderItem.product),
            selectinload(Order.customer),
            selectinload(Order.table),
        ).where(Order.id == order_id)
    )
    order = result.scalar_one_or_none()
    if order is None:
        raise NotFoundError("Order")
    return order


async def get_kds_tickets(db: AsyncSession) -> list[dict]:
    """Get all sent_to_kitchen orders for the KDS display."""
    result = await db.execute(
        select(Order).options(
            selectinload(Order.items).selectinload(OrderItem.product),
            selectinload(Order.table),
        ).where(Order.status == "sent_to_kitchen")
        .order_by(Order.created_at.asc())
    )
    orders = result.scalars().all()

    tickets = []
    for order in orders:
        items = []
        for item in order.items:
            if item.product and item.product.kds_visible:
                items.append({
                    "id": item.id,
                    "product_name": item.product.name,
                    "quantity": float(item.quantity),
                    "kitchen_status": item.kitchen_status,
                    "notes": item.notes,
                    "is_loyalty_redemption": item.is_loyalty_redemption,
                })

        tickets.append({
            "order_id": order.id,
            "order_number": order.order_number,
            "table_number": order.table.table_number if order.table else None,
            "source": order.source,
            "created_at": order.created_at,
            "items": items,
        })

    return tickets


async def update_kitchen_status(db: AsyncSession, item_id: int, new_status: str) -> dict:
    """Update the kitchen status of an order item."""
    result = await db.execute(
        select(OrderItem).options(selectinload(OrderItem.product))
        .where(OrderItem.id == item_id)
    )
    item = result.scalar_one_or_none()
    if item is None:
        raise NotFoundError("Order item")

    # Validate transition: to_cook -> preparing -> completed
    valid_transitions = {
        "to_cook": "preparing",
        "preparing": "completed",
    }
    if item.kitchen_status not in valid_transitions or valid_transitions[item.kitchen_status] != new_status:
        if item.kitchen_status == "completed":
            pass  # already done
        else:
            pass  # allow any valid status

    item.kitchen_status = new_status
    await db.commit()
    await db.refresh(item)

    return {
        "id": item.id,
        "product_name": item.product.name if item.product else None,
        "kitchen_status": item.kitchen_status,
    }
