from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.user import User
from app.models.inventory import InventoryItem, StockMovement, Supplier, PurchaseOrder, PurchaseOrderItem
from app.schemas.inventory import (
    InventoryItemCreateRequest, InventoryItemUpdateRequest, InventoryItemResponse,
    StockAdjustmentRequest, StockMovementResponse,
    SupplierCreateRequest, SupplierUpdateRequest, SupplierResponse,
    PurchaseOrderCreateRequest, PurchaseOrderResponse,
)
from app.services.inventory_service import get_inventory_items, create_stock_movement, get_low_stock_items
from app.core.dependencies import role_required
from app.core.exceptions import NotFoundError

router = APIRouter(prefix="/inventory", tags=["Inventory"])


@router.get("/items")
async def list_inventory(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required("inventory_manager", "superadmin")),
):
    """List all inventory items with stock levels."""
    return await get_inventory_items(db)


@router.post("/items")
async def create_inventory_item(
    request: InventoryItemCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required("inventory_manager", "superadmin")),
):
    """Create a new inventory item."""
    item = InventoryItem(**request.model_dump())
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return {"id": item.id, "message": "Inventory item created."}


@router.put("/items/{item_id}")
async def update_inventory_item(
    item_id: int,
    request: InventoryItemUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required("inventory_manager", "superadmin")),
):
    """Update an inventory item."""
    result = await db.execute(select(InventoryItem).where(InventoryItem.id == item_id))
    item = result.scalar_one_or_none()
    if item is None:
        raise NotFoundError("Inventory item")

    update_data = request.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(item, key, value)
    await db.commit()
    return {"message": "Inventory item updated."}


@router.post("/stock-movements")
async def create_movement(
    request: StockAdjustmentRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required("inventory_manager", "superadmin")),
):
    """Create a manual stock movement (adjustment, wastage, purchase_in, return_in)."""
    movement = await create_stock_movement(
        db, request.inventory_item_id, request.movement_type,
        request.quantity, request.note, current_user.id,
    )
    return {"id": movement.id, "message": "Stock movement recorded."}


@router.get("/stock-movements")
async def list_movements(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required("inventory_manager", "superadmin")),
):
    """List recent stock movements."""
    result = await db.execute(
        select(StockMovement)
        .options(selectinload(StockMovement.inventory_item).selectinload(InventoryItem.product))
        .order_by(StockMovement.created_at.desc())
        .limit(100)
    )
    movements = result.scalars().all()
    return [
        {
            "id": m.id,
            "inventory_item_id": m.inventory_item_id,
            "product_name": m.inventory_item.product.name if m.inventory_item and m.inventory_item.product else None,
            "movement_type": m.movement_type,
            "quantity": float(m.quantity),
            "reference_order_id": m.reference_order_id,
            "performed_by": m.performed_by,
            "note": m.note,
            "created_at": m.created_at,
        }
        for m in movements
    ]


@router.get("/low-stock")
async def list_low_stock(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required("inventory_manager", "superadmin")),
):
    """Get items with stock at or below reorder level."""
    return await get_low_stock_items(db)


# --- Suppliers ---
@router.get("/suppliers")
async def list_suppliers(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required("inventory_manager", "superadmin")),
):
    result = await db.execute(select(Supplier))
    return [SupplierResponse.model_validate(s) for s in result.scalars().all()]


@router.post("/suppliers")
async def create_supplier(
    request: SupplierCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required("inventory_manager", "superadmin")),
):
    supplier = Supplier(**request.model_dump())
    db.add(supplier)
    await db.commit()
    await db.refresh(supplier)
    return {"id": supplier.id, "message": "Supplier created."}


@router.put("/suppliers/{supplier_id}")
async def update_supplier(
    supplier_id: int,
    request: SupplierUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required("inventory_manager", "superadmin")),
):
    result = await db.execute(select(Supplier).where(Supplier.id == supplier_id))
    supplier = result.scalar_one_or_none()
    if supplier is None:
        raise NotFoundError("Supplier")
    for key, value in request.model_dump(exclude_unset=True).items():
        setattr(supplier, key, value)
    await db.commit()
    return {"message": "Supplier updated."}


# --- Purchase Orders ---
@router.get("/purchase-orders")
async def list_purchase_orders(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required("inventory_manager", "superadmin")),
):
    result = await db.execute(
        select(PurchaseOrder)
        .options(selectinload(PurchaseOrder.supplier), selectinload(PurchaseOrder.items))
        .order_by(PurchaseOrder.created_at.desc())
    )
    orders = result.scalars().all()
    return [
        {
            "id": po.id,
            "supplier_id": po.supplier_id,
            "supplier_name": po.supplier.name if po.supplier else None,
            "status": po.status,
            "notes": po.notes,
            "created_by": po.created_by,
            "created_at": po.created_at,
            "received_at": po.received_at,
            "items": [
                {
                    "id": item.id,
                    "inventory_item_id": item.inventory_item_id,
                    "quantity": float(item.quantity),
                    "unit_cost": float(item.unit_cost),
                }
                for item in po.items
            ],
        }
        for po in orders
    ]


@router.post("/purchase-orders")
async def create_purchase_order(
    request: PurchaseOrderCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required("inventory_manager", "superadmin")),
):
    po = PurchaseOrder(
        supplier_id=request.supplier_id,
        notes=request.notes,
        created_by=current_user.id,
    )
    db.add(po)
    await db.flush()

    for item_data in request.items:
        poi = PurchaseOrderItem(
            purchase_order_id=po.id,
            inventory_item_id=item_data.inventory_item_id,
            quantity=item_data.quantity,
            unit_cost=item_data.unit_cost,
        )
        db.add(poi)

    await db.commit()
    await db.refresh(po)
    return {"id": po.id, "message": "Purchase order created."}
