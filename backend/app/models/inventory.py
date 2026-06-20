from sqlalchemy import (
    Column, String, Boolean, TIMESTAMP, ForeignKey, Text, Date,
    Integer, BigInteger, Numeric, Enum, text
)
from sqlalchemy.orm import relationship
from app.database import Base


class InventoryItem(Base):
    __tablename__ = "inventory_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, unique=True)
    sku = Column(String(50), nullable=False, unique=True)
    unit = Column(String(20), nullable=False, default="piece")
    current_stock = Column(Numeric(10, 2), nullable=False, default=0)
    reorder_level = Column(Numeric(10, 2), nullable=False, default=0)
    max_stock = Column(Numeric(10, 2), nullable=True)
    is_perishable = Column(Boolean, nullable=False, default=False)
    expiry_date = Column(Date, nullable=True)
    updated_at = Column(TIMESTAMP, nullable=False, server_default=text("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"))

    product = relationship("Product", back_populates="inventory_item")
    stock_movements = relationship("StockMovement", back_populates="inventory_item")


class StockMovement(Base):
    __tablename__ = "stock_movements"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    inventory_item_id = Column(Integer, ForeignKey("inventory_items.id", ondelete="CASCADE"), nullable=False)
    movement_type = Column(
        Enum("purchase_in", "sale_out", "wastage", "adjustment", "return_in", name="movement_type_enum"),
        nullable=False
    )
    quantity = Column(Numeric(10, 2), nullable=False)
    reference_order_id = Column(Integer, ForeignKey("orders.id", ondelete="SET NULL"), nullable=True)
    performed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    note = Column(String(255), nullable=True)
    created_at = Column(TIMESTAMP, nullable=False, server_default=text("CURRENT_TIMESTAMP"))

    inventory_item = relationship("InventoryItem", back_populates="stock_movements")
    performed_by_user = relationship("User", foreign_keys=[performed_by])


class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(120), nullable=False)
    contact_person = Column(String(100), nullable=True)
    mobile_number = Column(String(15), nullable=True)
    email = Column(String(150), nullable=True)
    address = Column(String(255), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)

    purchase_orders = relationship("PurchaseOrder", back_populates="supplier")


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id = Column(Integer, primary_key=True, autoincrement=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    status = Column(
        Enum("draft", "ordered", "received", "cancelled", name="po_status_enum"),
        nullable=False, default="draft"
    )
    notes = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(TIMESTAMP, nullable=False, server_default=text("CURRENT_TIMESTAMP"))
    received_at = Column(TIMESTAMP, nullable=True)

    supplier = relationship("Supplier", back_populates="purchase_orders")
    created_by_user = relationship("User", foreign_keys=[created_by])
    items = relationship("PurchaseOrderItem", back_populates="purchase_order", cascade="all, delete-orphan")


class PurchaseOrderItem(Base):
    __tablename__ = "purchase_order_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    purchase_order_id = Column(Integer, ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False)
    inventory_item_id = Column(Integer, ForeignKey("inventory_items.id"), nullable=False)
    quantity = Column(Numeric(10, 2), nullable=False)
    unit_cost = Column(Numeric(10, 2), nullable=False)

    purchase_order = relationship("PurchaseOrder", back_populates="items")
    inventory_item = relationship("InventoryItem")
