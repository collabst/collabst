"""
Project-level WebSocket for broadcasting file system events.
All users in a project connect to this WebSocket to receive real-time
notifications about file creation, updates, and deletion.
"""

from dataclasses import dataclass
from typing import Dict
import json

from fastapi import WebSocket, WebSocketDisconnect

from app.models.project_collaborator import CollaboratorRole
from app.websocket.auth import WebSocketProjectContext, get_current_project_role


@dataclass
class ProjectSocketConnection:
    user_id: int
    project_db_id: int


class ProjectConnectionManager:
    def __init__(self):
        # project_id(ref/hash) -> websocket -> connection metadata
        self.active_connections: Dict[str, Dict[WebSocket, ProjectSocketConnection]] = {}

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

    async def connect(
        self,
        websocket: WebSocket,
        project_id: str,
        *,
        user_id: int,
        project_db_id: int,
    ):
        await websocket.accept()
        if project_id not in self.active_connections:
            self.active_connections[project_id] = {}

        self.active_connections[project_id][websocket] = ProjectSocketConnection(
            user_id=user_id,
            project_db_id=project_db_id,
        )
        print(
            f"Client connected to project {project_id}. "
            f"Total: {len(self.active_connections[project_id])}"
        )

    def disconnect(self, websocket: WebSocket, project_id: str):
        if project_id in self.active_connections:
            self.active_connections[project_id].pop(websocket, None)
            print(
                f"Client disconnected from project {project_id}. "
                f"Remaining: {len(self.active_connections[project_id])}"
            )
            if not self.active_connections[project_id]:
                del self.active_connections[project_id]

    async def send_event_to_user(self, project_id: str, user_id: int, message: dict):
        if project_id not in self.active_connections:
            return

        message_str = json.dumps(message)
        disconnected = []

        for connection, metadata in self.active_connections[project_id].items():
            if metadata.user_id != user_id:
                continue
            try:
                await connection.send_text(message_str)
            except Exception as e:
                print(f"Error sending user-specific event: {e}")
                disconnected.append(connection)

        for conn in disconnected:
            self.disconnect(conn, project_id)

    async def broadcast_to_project(self, project_id: str, message: dict, sender: WebSocket = None):
        """Broadcast a message to all clients in a project (except sender)."""
        if project_id not in self.active_connections:
            return

        message_str = json.dumps(message)
        disconnected = []

        for connection, metadata in self.active_connections[project_id].items():
            if sender and connection == sender:
                continue

            role = await get_current_project_role(
                project_id=metadata.project_db_id,
                user_id=metadata.user_id,
            )
            if role is None or not self._is_role_at_least(role, CollaboratorRole.READER):
                try:
                    await connection.send_text(
                        json.dumps(
                            {
                                "type": "ws_unauthorized",
                                "channel": "project",
                                "code": "role_revoked",
                                "reason": "Project access revoked",
                            }
                        )
                    )
                except Exception:
                    disconnected.append(connection)
                continue

            try:
                await connection.send_text(message_str)
            except Exception as e:
                print(f"Error sending to client: {e}")
                disconnected.append(connection)

        for conn in disconnected:
            self.disconnect(conn, project_id)


project_manager = ProjectConnectionManager()


async def project_websocket_endpoint(
    websocket: WebSocket,
    project_id: str,
    context: WebSocketProjectContext,
):
    """
    WebSocket endpoint for project-level events.
    Messages format:
    {
        "type": "file_created" | "file_updated" | "file_deleted",
        "file": { file object }
    }
    """
    await project_manager.connect(
        websocket,
        project_id,
        user_id=context.user_id,
        project_db_id=context.project_id,
    )

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            if message.get("type") == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
    except WebSocketDisconnect:
        project_manager.disconnect(websocket, project_id)
    except Exception as e:
        print(f"Project WebSocket error: {e}")
        project_manager.disconnect(websocket, project_id)
