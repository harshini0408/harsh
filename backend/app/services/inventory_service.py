from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.inventory import InventoryItem, StockMovement, Supplier, PurchaseOrder, PurchaseOrderItem
from app.models.catalog import Product
from app.core.exceptions import NotFoundError


async def get_inventory_items(db: AsyncSession) -> list[dict]:
    """Get all inventory items with product details."""
    result = await db.execute(
        select(InventoryItem).options(selectinload(InventoryItem.product))
    )
    items = result.scalars().all()
    return [
        {
            "id": item.id,
            "product_id": item.product_id,
            "product_name": item.product.name if item.product else None,
            "sku": item.sku,
            "unit": item.unit,
            "current_stock": float(item.current_stock),
            "reorder_level": float(item.reorder_level),
            "max_stock": float(item.max_stock) if item.max_stock else None,
            "is_perishable": item.is_perishable,
            "expiry_date": item.expiry_date,
            "is_low_stock": float(item.current_stock) <= float(item.reorder_level),
        }
        for item in items
    ]


async def create_stock_movement(
    db: AsyncSession,
    inventory_item_id: int,
    movement_type: str,
    quantity: float,
    note: str,
    performed_by: int | None = None,
) -> StockMovement:
    """Create a manual stock movement and update current_stock."""
    item_result = await db.execute(
        select(InventoryItem).where(InventoryItem.id == inventory_item_id)
    )
    item = item_result.scalar_one_or_none()
    if item is None:
        raise NotFoundError("Inventory item")

    qty = Decimal(str(quantity))

    # Adjust stock based on movement type
    if movement_type in ("purchase_in", "return_in"):
        item.current_stock += qty
    elif movement_type in ("wastage",):
        item.current_stock -= qty
    elif movement_type == "adjustment":
        # Adjustment can go either way — the quantity is absolute; positive means add
        item.current_stock += qty

    # Ensure stock doesn't go negative
    if item.current_stock < 0:
        item.current_stock = Decimal("0")

    movement = StockMovement(
        inventory_item_id=inventory_item_id,
        movement_type=movement_type,
        quantity=qty,
        performed_by=performed_by,
        note=note,
    )
    db.add(movement)
    await db.commit()
    await db.refresh(movement)

    return movement


async def get_low_stock_items(db: AsyncSession) -> list[dict]:
    """Get items where current_stock <= reorder_level."""
    result = await db.execute(
        select(InventoryItem).options(selectinload(InventoryItem.product))
    )
    items = result.scalars().all()

    return [
        {
            "id": item.id,
            "product_id": item.product_id,
            "product_name": item.product.name if item.product else None,
            "sku": item.sku,
            "current_stock": float(item.current_stock),
            "reorder_level": float(item.reorder_level),
        }
        for item in items
        if float(item.current_stock) <= float(item.reorder_level)
    ]
