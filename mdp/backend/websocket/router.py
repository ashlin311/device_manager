from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from websocket.manager import manager

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/admin")
async def admin_websocket(websocket: WebSocket):
    """Frontend connects here to receive live device and command updates."""
    await manager.connect_admin(websocket)
    try:
        while True:
            # Keep connection alive — admin WS is receive-only from server
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect_admin(websocket)


@router.websocket("/ws/agent/{device_id}")
async def agent_websocket(websocket: WebSocket, device_id: str):
    """Agent connects here to receive dispatched commands."""
    await manager.connect_agent(websocket, device_id)
    try:
        while True:
            # Keep connection alive — agent sends heartbeats via REST
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect_agent(device_id)
