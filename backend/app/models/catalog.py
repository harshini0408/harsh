from sqlalchemy import (
    Column, String, Boolean, TIMESTAMP, ForeignKey, Text,
    SmallInteger, Integer, Numeric, text
)
from sqlalchemy.orm import relationship
from app.database import Base


class Category(Base):
    __tablename__ = "categories"

    id = Column(SmallInteger, primary_key=True, autoincrement=True)
    name = Column(String(60), nullable=False, unique=True)
    color_hex = Column(String(7), nullable=False, default="#CCCCCC")
    display_order = Column(SmallInteger, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)

    products = relationship("Product", back_populates="category")


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, autoincrement=True)
    category_id = Column(SmallInteger, ForeignKey("categories.id"), nullable=False)
    name = Column(String(120), nullable=False)
    price = Column(Numeric(10, 2), nullable=False)
    uom = Column(String(20), nullable=False, default="piece")
    tax_percent = Column(Numeric(5, 2), nullable=False, default=0.00)
    description = Column(Text, nullable=True)
    image_url = Column(String(500), nullable=True)
    kds_visible = Column(Boolean, nullable=False, default=True)
    is_active = Column(Boolean, nullable=False, default=True)
    is_loyalty_reward = Column(Boolean, nullable=False, default=False)
    created_at = Column(TIMESTAMP, nullable=False, server_default=text("CURRENT_TIMESTAMP"))
    updated_at = Column(TIMESTAMP, nullable=False, server_default=text("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"))

    category = relationship("Category", back_populates="products")
    inventory_item = relationship("InventoryItem", back_populates="product", uselist=False)
    order_items = relationship("OrderItem", back_populates="product")
