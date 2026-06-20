from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.models.venue import TableMaster, TableSession, Floor
from app.core.exceptions import TableOccupiedError, NotFoundError
from app.utils.qr import generate_device_token


async def check_table_status(db: AsyncSession, qr_token: str) -> dict:
    """Check if a table has an active session by QR token."""
    result = await db.execute(
        select(TableMaster).where(TableMaster.qr_token == qr_token)
    )
    table = result.scalar_one_or_none()
    if table is None:
        raise NotFoundError("Table")

    # Load floor
    await db.refresh(table, ["floor"])

    # Check for active session
    session_result = await db.execute(
        select(TableSession).where(
            TableSession.table_id == table.id,
            TableSession.status == "active"
        )
    )
    active_session = session_result.scalar_one_or_none()

    return {
        "occupied": active_session is not None,
        "table_id": table.id,
        "table_number": table.table_number,
        "floor_name": table.floor.name,
    }


async def open_customer_session(db: AsyncSession, qr_token: str) -> dict:
    """Open a customer QR session. Returns 409 if table already occupied."""
    result = await db.execute(
        select(TableMaster).where(TableMaster.qr_token == qr_token)
    )
    table = result.scalar_one_or_none()
    if table is None:
        raise NotFoundError("Table")

    device_token = generate_device_token()

    session = TableSession(
        table_id=table.id,
        status="active",
        opened_by="customer_qr",
        opened_by_user_id=None,
        lock_mode="device",
        device_token=device_token,
    )
    db.add(session)

    try:
        await db.commit()
        await db.refresh(session)
    except IntegrityError:
        await db.rollback()
        raise TableOccupiedError()

    return {
        "session_id": session.id,
        "table_id": table.id,
        "table_number": table.table_number,
        "device_token": device_token,
    }


async def open_cashier_session(db: AsyncSession, table_id: int, user_id: int) -> dict:
    """Open a cashier session for a table."""
    result = await db.execute(
        select(TableMaster).where(TableMaster.id == table_id)
    )
    table = result.scalar_one_or_none()
    if table is None:
        raise NotFoundError("Table")

    session = TableSession(
        table_id=table.id,
        status="active",
        opened_by="cashier",
        opened_by_user_id=user_id,
        lock_mode="device",
    )
    db.add(session)

    try:
        await db.commit()
        await db.refresh(session)
    except IntegrityError:
        await db.rollback()
        raise TableOccupiedError()

    return {
        "session_id": session.id,
        "table_id": table.id,
        "table_number": table.table_number,
    }


async def close_session(db: AsyncSession, session_id: int) -> None:
    """Close a table session."""
    result = await db.execute(
        select(TableSession).where(TableSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise NotFoundError("Session")

    session.status = "closed"
    session.closed_at = datetime.now(timezone.utc)
    await db.commit()


async def get_all_tables_with_status(db: AsyncSession) -> list[dict]:
    """Get all tables with their session status for the floor view."""
    result = await db.execute(
        select(TableMaster).where(TableMaster.is_active == True)
    )
    tables = result.scalars().all()

    table_data = []
    for table in tables:
        await db.refresh(table, ["floor"])

        # Check for active session
        session_result = await db.execute(
            select(TableSession).where(
                TableSession.table_id == table.id,
                TableSession.status == "active"
            )
        )
        active_session = session_result.scalar_one_or_none()

        table_data.append({
            "id": table.id,
            "floor_id": table.floor_id,
            "floor_name": table.floor.name,
            "table_number": table.table_number,
            "seats": table.seats,
            "is_active": table.is_active,
            "qr_token": table.qr_token,
            "has_active_session": active_session is not None,
            "session_opened_by": active_session.opened_by if active_session else None,
            "session_id": active_session.id if active_session else None,
        })

    return table_data
