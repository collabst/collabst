"""Application-managed websocket for domain notifications (comments, project role changes, etc.)."""

from dataclasses import dataclass
from typing import Dict
import json

from fastapi import WebSocket, WebSocketDisconnect

from app.models.project_collaborator import CollaboratorRole
from app.websocket.auth import WebSocketProjectContext, get_current_project_role


@dataclass
class NotificationSocketConnection:
    user_id: int
    project_db_id: int


class NotificationConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, Dict[WebSocket, NotificationSocketConnection]] = {}

    @staticmethod
    def _is_role_at_least(role: CollaboratorRole, minimum: CollaboratorRole) -> bool:
        order = {
            CollaboratorRole.READER: 1,
            CollaboratorRole.COMMENTOR: 2,
            CollaboratorRole.WRITER: 3,
            CollaboratorRole.ADMIN: 4,
            CollaboratorRole.OWNER: 5,
        }
        return order.get(role, 0) >= order.get(minimum, 0)

    async def connect(self, websocket: WebSocket, project_id: str, context: WebSocketProjectContext):
        await websocket.accept()
        if project_id not in self.active_connections:
            self.active_connections[project_id] = {}

        self.active_connections[project_id][websocket] = NotificationSocketConnection(
            user_id=context.user_id,
            project_db_id=context.project_id,
        )

    def disconnect(self, websocket: WebSocket, project_id: str):
        if project_id in self.active_connections:
            self.active_connections[project_id].pop(websocket, None)
            if not self.active_connections[project_id]:
                del self.active_connections[project_id]

    async def send_event_to_user(self, project_id: str, user_id: int, message: dict):
        if project_id not in self.active_connections:
            return

        payload = json.dumps(message)
        dead_connections = []
        for socket, metadata in self.active_connections[project_id].items():
            if metadata.user_id != user_id:
                continue
            try:
                await socket.send_text(payload)
            except Exception:
                dead_connections.append(socket)

        for socket in dead_connections:
            self.disconnect(socket, project_id)

    async def broadcast_to_project(
        self,
        project_id: str,
        message: dict,
        minimum_role: CollaboratorRole = CollaboratorRole.READER,
    ):
        if project_id not in self.active_connections:
            return

        payload = json.dumps(message)
        dead_connections = []

        for socket, metadata in self.active_connections[project_id].items():
            role = await get_current_project_role(project_id=metadata.project_db_id, user_id=metadata.user_id)
            if role is None or not self._is_role_at_least(role, minimum_role):
                continue
            try:
                await socket.send_text(payload)
            except Exception:
                dead_connections.append(socket)

        for socket in dead_connections:
            self.disconnect(socket, project_id)


notifications_manager = NotificationConnectionManager()


async def notifications_websocket_endpoint(
    websocket: WebSocket,
    project_id: str,
    context: WebSocketProjectContext,
):
    await notifications_manager.connect(websocket, project_id, context)

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            if message.get("type") == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
    except WebSocketDisconnect:
        notifications_manager.disconnect(websocket, project_id)
    except Exception:
        notifications_manager.disconnect(websocket, project_id)
