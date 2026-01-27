"""WebSocket connection manager for real-time streaming."""

import asyncio
import json
from typing import Any
from fastapi import WebSocket


class ConnectionManager:
    """Manages WebSocket connections and message broadcasting."""

    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, client_id: str):
        """Accept a new WebSocket connection."""
        await websocket.accept()
        self.active_connections[client_id] = websocket

    def disconnect(self, client_id: str):
        """Remove a WebSocket connection."""
        if client_id in self.active_connections:
            del self.active_connections[client_id]

    async def send_message(self, client_id: str, message: dict[str, Any]):
        """Send a JSON message to a specific client."""
        if client_id in self.active_connections:
            try:
                await self.active_connections[client_id].send_json(message)
            except Exception:
                self.disconnect(client_id)

    async def send_output(self, client_id: str, output: str, output_type: str = "stdout"):
        """Send output line to client."""
        await self.send_message(client_id, {
            "type": "output",
            "output_type": output_type,
            "data": output,
        })

    async def send_status(self, client_id: str, status: str, message: str = ""):
        """Send status update to client."""
        await self.send_message(client_id, {
            "type": "status",
            "status": status,
            "message": message,
        })

    async def send_error(self, client_id: str, error: str):
        """Send error message to client."""
        await self.send_message(client_id, {
            "type": "error",
            "data": error,
        })

    async def send_complete(self, client_id: str, success: bool = True, message: str = ""):
        """Send completion message to client."""
        await self.send_message(client_id, {
            "type": "complete",
            "success": success,
            "message": message,
        })

    async def broadcast(self, message: dict[str, Any]):
        """Broadcast message to all connected clients."""
        disconnected = []
        for client_id, websocket in self.active_connections.items():
            try:
                await websocket.send_json(message)
            except Exception:
                disconnected.append(client_id)

        for client_id in disconnected:
            self.disconnect(client_id)


# Global connection manager instance
manager = ConnectionManager()
