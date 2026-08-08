import json
from fastapi import WebSocket


class ConnectionManager:
    """Manages WebSocket connections for admin and agent clients."""

    def __init__(self):
        # admin connections: list of WebSocket
        self.admin_connections: list[WebSocket] = []
        # agent connections: device_id → WebSocket
        self.agent_connections: dict[str, WebSocket] = {}

    async def connect_admin(self, websocket: WebSocket):
        await websocket.accept()
        self.admin_connections.append(websocket)

    def disconnect_admin(self, websocket: WebSocket):
        if websocket in self.admin_connections:
            self.admin_connections.remove(websocket)

    async def connect_agent(self, websocket: WebSocket, device_id: str):
        await websocket.accept()
        self.agent_connections[device_id] = websocket

    def disconnect_agent(self, device_id: str):
        self.agent_connections.pop(device_id, None)

    async def send(self, client_id: str, message: dict):
        """Send a message to a specific agent by device_id."""
        ws = self.agent_connections.get(client_id)
        if ws:
            await ws.send_text(json.dumps(message))

    async def broadcast(self, message: dict):
        """Broadcast a message to all connected admin clients."""
        dead = []
        for ws in self.admin_connections:
            try:
                await ws.send_text(json.dumps(message))
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect_admin(ws)


# Singleton instance
manager = ConnectionManager()
