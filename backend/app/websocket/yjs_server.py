from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, Set
import json
import asyncio


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        self.document_states: Dict[str, bytes] = {}

    async def connect(self, websocket: WebSocket, document_id: str):
        await websocket.accept()
        if document_id not in self.active_connections:
            self.active_connections[document_id] = set()
        self.active_connections[document_id].add(websocket)

    def disconnect(self, websocket: WebSocket, document_id: str):
        if document_id in self.active_connections:
            self.active_connections[document_id].discard(websocket)
            if not self.active_connections[document_id]:
                del self.active_connections[document_id]

    async def broadcast(self, message: bytes, document_id: str, sender: WebSocket):
        if document_id in self.active_connections:
            for connection in self.active_connections[document_id]:
                if connection != sender:
                    try:
                        await connection.send_bytes(message)
                    except Exception:
                        pass

    async def send_sync_step1(self, websocket: WebSocket, document_id: str):
        if document_id in self.document_states:
            state = self.document_states[document_id]
            await websocket.send_bytes(state)

    def update_state(self, document_id: str, state: bytes):
        self.document_states[document_id] = state


manager = ConnectionManager()


async def websocket_endpoint(websocket: WebSocket, document_id: str):
    await manager.connect(websocket, document_id)
    try:
        await manager.send_sync_step1(websocket, document_id)

        while True:
            data = await websocket.receive_bytes()

            manager.update_state(document_id, data)

            await manager.broadcast(data, document_id, websocket)

    except WebSocketDisconnect:
        manager.disconnect(websocket, document_id)
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(websocket, document_id)
