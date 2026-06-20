from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, Set
import json

router = APIRouter(tags=["WebSocket"])

# Connected KDS clients
kds_clients: Set[WebSocket] = set()
# Connected order-tracking clients (customer self-order status)
order_clients: Dict[int, Set[WebSocket]] = {}  # order_id -> set of websockets


@router.websocket("/ws/kds")
async def kds_websocket(websocket: WebSocket):
    """WebSocket endpoint for Kitchen Display System live updates."""
    await websocket.accept()
    kds_clients.add(websocket)
    try:
        while True:
            # Keep connection alive, wait for client messages (pings)
            data = await websocket.receive_text()
            # Client can send ping/pong
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        kds_clients.discard(websocket)


@router.websocket("/ws/orders/{order_id}")
async def order_status_websocket(websocket: WebSocket, order_id: int):
    """WebSocket endpoint for tracking order status (customer self-order)."""
    await websocket.accept()
    if order_id not in order_clients:
        order_clients[order_id] = set()
    order_clients[order_id].add(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        if order_id in order_clients:
            order_clients[order_id].discard(websocket)
            if not order_clients[order_id]:
                del order_clients[order_id]


async def broadcast_kds_update(data: dict):
    """Send an update to all connected KDS clients."""
    message = json.dumps(data, default=str)
    disconnected = set()
    for client in kds_clients:
        try:
            await client.send_text(message)
        except Exception:
            disconnected.add(client)
    kds_clients.difference_update(disconnected)


async def broadcast_order_update(order_id: int, data: dict):
    """Send an update to all clients tracking a specific order."""
    if order_id not in order_clients:
        return
    message = json.dumps(data, default=str)
    disconnected = set()
    for client in order_clients[order_id]:
        try:
            await client.send_text(message)
        except Exception:
            disconnected.add(client)
    order_clients[order_id].difference_update(disconnected)
