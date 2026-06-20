from sqlalchemy import (
    Column, String, Boolean, TIMESTAMP, ForeignKey, Text,
    SmallInteger, Integer, BigInteger, text
)
from sqlalchemy.orm import relationship
from app.database import Base


class Role(Base):
    __tablename__ = "roles"

    id = Column(SmallInteger, primary_key=True, autoincrement=True)
    name = Column(String(30), nullable=False, unique=True)

    users = relationship("User", back_populates="role")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), nullable=False, unique=True)
    mobile_number = Column(String(15), nullable=False, unique=True)
    password_hash = Column(String(255), nullable=False)
    role_id = Column(SmallInteger, ForeignKey("roles.id"), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(TIMESTAMP, nullable=False, server_default=text("CURRENT_TIMESTAMP"))
    updated_at = Column(TIMESTAMP, nullable=False, server_default=text("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"))
    deleted_at = Column(TIMESTAMP, nullable=True)

    role = relationship("Role", back_populates="users")
    session_logs = relationship("UserSessionLog", back_populates="user")


class UserSessionLog(Base):
    __tablename__ = "user_sessions_log"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    login_at = Column(TIMESTAMP, nullable=False, server_default=text("CURRENT_TIMESTAMP"))
    logout_at = Column(TIMESTAMP, nullable=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)

    user = relationship("User", back_populates="session_logs")
