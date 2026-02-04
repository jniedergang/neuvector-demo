"""WebSocket endpoints for real-time streaming."""

import uuid
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from typing import Any, Optional

from app.core.kubectl import Kubectl
from app.core.websocket_manager import manager
from app.demos import DemoRegistry
from app.lifecycle import prepare_platform, reset_platform, get_status
from app.config import NAMESPACE


router = APIRouter()


class ExecuteRequest(BaseModel):
    """Request model for demo execution."""
    action: str  # "demo", "prepare", "reset", "status"
    demo_id: Optional[str] = None
    params: dict[str, Any] = {}


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """Main WebSocket endpoint for all real-time operations."""
    client_id = str(uuid.uuid4())
    await manager.connect(websocket, client_id)

    kubectl = Kubectl(namespace=NAMESPACE)

    try:
        while True:
            # Receive command
            data = await websocket.receive_json()

            action = data.get("action")
            if not action:
                await manager.send_error(client_id, "No action specified")
                continue

            await manager.send_status(client_id, "running", f"Starting {action}...")

            try:
                if action == "prepare":
                    params = data.get("params", {})
                    nv_username = params.get("nv_username")
                    nv_password = params.get("nv_password")
                    image_registry = params.get("image_registry")
                    async for line in prepare_platform(kubectl, nv_username, nv_password, image_registry):
                        await manager.send_output(client_id, line)

                elif action == "reset":
                    async for line in reset_platform(kubectl):
                        await manager.send_output(client_id, line)

                elif action == "status":
                    async for line in get_status(kubectl):
                        await manager.send_output(client_id, line)

                elif action == "demo":
                    demo_id = data.get("demo_id")
                    if not demo_id:
                        await manager.send_error(client_id, "No demo_id specified")
                        continue

                    demo = DemoRegistry.get(demo_id)
                    if not demo:
                        await manager.send_error(client_id, f"Demo '{demo_id}' not found")
                        continue

                    params = data.get("params", {})

                    # Validate parameters
                    valid, error = await demo.validate_params(params)
                    if not valid:
                        await manager.send_error(client_id, error)
                        continue

                    # Execute demo
                    async for line in demo.execute(kubectl, params):
                        await manager.send_output(client_id, line)

                else:
                    await manager.send_error(client_id, f"Unknown action: {action}")
                    continue

                await manager.send_complete(client_id, success=True)

            except Exception as e:
                await manager.send_error(client_id, str(e))
                await manager.send_complete(client_id, success=False, message=str(e))

    except WebSocketDisconnect:
        manager.disconnect(client_id)
