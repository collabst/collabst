"""
Project-level WebSocket for broadcasting file system events.
All users in a project connect to this WebSocket to receive real-time
notifications about file creation, updates, and deletion.
"""
from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, Set
import json


class ProjectConnectionManager:
    def __init__(self):
        # project_id -> set of websockets
        self.active_connections: Dict[int, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, project_id: int):
        await websocket.accept()
        if project_id not in self.active_connections:
            self.active_connections[project_id] = set()
        self.active_connections[project_id].add(websocket)
        print(f"Client connected to project {project_id}. Total: {len(self.active_connections[project_id])}")

    def disconnect(self, websocket: WebSocket, project_id: int):
        if project_id in self.active_connections:
            self.active_connections[project_id].discard(websocket)
            print(f"Client disconnected from project {project_id}. Remaining: {len(self.active_connections[project_id])}")
            if not self.active_connections[project_id]:
                del self.active_connections[project_id]

    async def broadcast_to_project(self, project_id: int, message: dict, sender: WebSocket = None):
        """Broadcast a message to all clients in a project (except sender)"""
        if project_id not in self.active_connections:
            return

        message_str = json.dumps(message)
        disconnected = []

        for connection in self.active_connections[project_id]:
            if sender and connection == sender:
                continue
            try:
                await connection.send_text(message_str)
            except Exception as e:
                print(f"Error sending to client: {e}")
                disconnected.append(connection)

        # Clean up disconnected clients
        for conn in disconnected:
            self.disconnect(conn, project_id)


project_manager = ProjectConnectionManager()


async def project_websocket_endpoint(websocket: WebSocket, project_id: int):
    """
    WebSocket endpoint for project-level events.
    Messages format:
    {
        "type": "file_created" | "file_updated" | "file_deleted",
        "file": { file object }
    }
    """
    await project_manager.connect(websocket, project_id)
    try:
        while True:
            # Keep connection alive and handle any client messages
            data = await websocket.receive_text()
            # For now, we just echo back to confirm connection
            # Most events will be broadcast from API endpoints
            message = json.loads(data)
            if message.get("type") == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
    except WebSocketDisconnect:
        project_manager.disconnect(websocket, project_id)
    except Exception as e:
        print(f"Project WebSocket error: {e}")
        project_manager.disconnect(websocket, project_id)
