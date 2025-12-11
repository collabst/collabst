"""
YJS WebSocket Server with PostgreSQL Persistence

Uses pycrdt-websocket WebsocketServer for proper Y.js sync protocol and awareness handling.
Uses a custom YStore for PostgreSQL persistence.

Architecture:
- PostgreSQL: Source of truth for YJS document states (full state vector)
- WebsocketServer: Manages rooms, handles sync protocol and awareness
- Custom PostgresYStore: Persists updates to PostgreSQL

Flow:
1. Client connects → WebsocketServer gets/creates room
2. Room loads state from PostgresYStore (PostgreSQL)
3. YRoom handles sync protocol and awareness broadcasting automatically
4. Updates are persisted to PostgreSQL via YStore
5. Last client disconnects → Room is auto-cleaned
"""
from fastapi import WebSocket, WebSocketDisconnect
from typing import AsyncIterator
import asyncio
import time
from contextlib import asynccontextmanager

from anyio import Lock, Event
from anyio.abc import TaskStatus
from anyio import TASK_STATUS_IGNORED
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select

from pycrdt import Doc
from pycrdt_websocket import WebsocketServer, YRoom
from pycrdt_websocket.ystore import BaseYStore
from pycrdt_websocket.websocket_server import exception_logger

from app.core.config import settings
from app.models.yjs_state import YjsDocumentState


class FastAPIWebsocket:
    """Adapter to make FastAPI WebSocket compatible with pycrdt-websocket.
    
    This implements the Channel protocol required by pycrdt-websocket.
    """
    
    def __init__(self, websocket: WebSocket, path: str):
        self._websocket = websocket
        self._path = path
        self._send_lock = Lock()
        self._closed = False
    
    @property
    def path(self) -> str:
        return self._path
    
    def __aiter__(self):
        return self
    
    async def __anext__(self) -> bytes:
        try:
            message = await self.recv()
        except Exception:
            raise StopAsyncIteration()
        return message
    
    async def recv(self) -> bytes:
        try:
            return await self._websocket.receive_bytes()
        except Exception:
            self._closed = True
            raise
    
    async def send(self, message: bytes) -> None:
        if self._closed:
            return
        try:
            async with self._send_lock:
                await self._websocket.send_bytes(message)
        except Exception:
            self._closed = True


class PostgresYStore(BaseYStore):
    """YStore implementation that persists to PostgreSQL.
    
    This stores the full document state as a single blob per project,
    rather than storing individual updates.
    """
    
    # Required class attributes for BaseYStore
    _started: Event | None = None
    _stopped: Event
    __start_lock: Lock | None = None
    
    def __init__(self, path: str, async_session_factory: sessionmaker, metadata_callback=None, log=None):
        """
        Args:
            path: The room/document path (e.g., "project-123")
            async_session_factory: SQLAlchemy async session factory
        """
        self._path = path
        self._async_session_factory = async_session_factory
        self._project_id = self._extract_project_id(path)
        self._updates: list[tuple[bytes, bytes, float]] = []  # Store updates in memory
        self._metadata_callback = metadata_callback
        self._log = log
        self._stopped = Event()
    
    @property
    def started(self) -> Event:
        if self._started is None:
            self._started = Event()
        return self._started
    
    @property
    def start_lock(self) -> Lock:
        if self.__start_lock is None:
            self.__start_lock = Lock()
        return self.__start_lock
    
    def _extract_project_id(self, path: str) -> int | None:
        """Extract project ID from path (e.g., 'project-123' -> 123)."""
        # Remove leading slash if present
        path = path.lstrip("/")
        if path.startswith("project-"):
            try:
                return int(path.split("-")[1])
            except (IndexError, ValueError):
                return None
        return None
    
    @asynccontextmanager
    async def _get_db(self):
        """Get database session."""
        async with self._async_session_factory() as session:
            yield session
    
    async def start(
        self,
        *,
        task_status: TaskStatus[None] = TASK_STATUS_IGNORED,
        from_context_manager: bool = False,
    ):
        """Start the store."""
        task_status.started()
        self.started.set()
    
    async def stop(self) -> None:
        """Stop the store."""
        self._stopped.set()
    
    async def read(self) -> AsyncIterator[tuple[bytes, bytes, float]]:
        """Read stored updates.
        
        Yields:
            Tuples of (update, metadata, timestamp)
        """
        if self._project_id is None:
            return
        
        async with self._get_db() as db:
            result = await db.execute(
                select(YjsDocumentState).where(YjsDocumentState.project_id == self._project_id)
            )
            yjs_state = result.scalar_one_or_none()
            
            if yjs_state and yjs_state.state:
                # Return the full state as a single "update"
                yield (yjs_state.state, b"", time.time())
    
    async def write(self, data: bytes) -> None:
        """Store an update.
        
        This is called by YRoom for each document update.
        We apply the update to our internal doc and save the full state.
        """
        if self._project_id is None:
            return
        
        # Apply update to internal doc to build full state
        if not hasattr(self, '_internal_doc'):
            self._internal_doc = Doc()
            # Load existing state first
            async for update, metadata, timestamp in self.read():
                self._internal_doc.apply_update(update)
        
        # Apply new update
        self._internal_doc.apply_update(data)
        
        # Save full document as update (NOT state vector - they're different formats!)
        # get_update() returns bytes that can be applied with apply_update()
        # get_state() returns a state vector which is NOT compatible with apply_update()
        update_bytes = self._internal_doc.get_update()
        if not update_bytes:
            return
        
        try:
            async with self._get_db() as db:
                result = await db.execute(
                    select(YjsDocumentState).where(YjsDocumentState.project_id == self._project_id)
                )
                yjs_state = result.scalar_one_or_none()
                
                if yjs_state:
                    yjs_state.state = update_bytes
                else:
                    yjs_state = YjsDocumentState(project_id=self._project_id, state=update_bytes)
                    db.add(yjs_state)
                
                await db.commit()
            print(f"[YJS] Saved update to PostgreSQL: {self._path} ({len(update_bytes)} bytes)")
        except Exception as e:
            print(f"[YJS] Error saving update to PostgreSQL: {e}")
    
    async def apply_updates(self, ydoc: Doc) -> None:
        """Apply all stored updates to the YDoc."""
        async for update, metadata, timestamp in self.read():
            ydoc.apply_update(update)
    
    async def encode_state_as_update(self, ydoc: Doc) -> None:
        """Store the YDoc state as an update."""
        if self._project_id is None:
            return
        
        # Use get_update() NOT get_state() - they return different formats!
        update_bytes = ydoc.get_update()
        if not update_bytes:
            return
        
        try:
            async with self._get_db() as db:
                result = await db.execute(
                    select(YjsDocumentState).where(YjsDocumentState.project_id == self._project_id)
                )
                yjs_state = result.scalar_one_or_none()
                
                if yjs_state:
                    yjs_state.state = update_bytes
                else:
                    yjs_state = YjsDocumentState(project_id=self._project_id, state=update_bytes)
                    db.add(yjs_state)
                
                await db.commit()
            print(f"[YJS] Saved state to PostgreSQL: {self._path} ({len(update_bytes)} bytes)")
        except Exception as e:
            print(f"[YJS] Error saving to PostgreSQL: {e}")
    
    async def get_metadata(self) -> bytes:
        """Get metadata."""
        if self._metadata_callback is not None:
            return await self._metadata_callback()
        return b""


class YjsConnectionManager:
    """Manages YJS WebSocket connections using pycrdt-websocket."""
    
    def __init__(self):
        self._websocket_server: WebsocketServer | None = None
        self._async_session_factory: sessionmaker | None = None
        self._initialized = False
        self._server_task: asyncio.Task | None = None
    
    async def initialize(self):
        """Initialize the WebSocket server and database connections."""
        if self._initialized:
            return
        
        # Database engine and session factory
        engine = create_async_engine(settings.DATABASE_URL)
        self._async_session_factory = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        print("[YJS] Database session factory created")
        
        # Create WebsocketServer - it manages rooms automatically
        # exception_logger logs errors instead of crashing
        self._websocket_server = WebsocketServer(
            rooms_ready=True,
            auto_clean_rooms=True,
            exception_handler=exception_logger,
        )
        
        # Start the server in a background task
        # WebsocketServer.start() blocks until stop() is called
        self._server_task = asyncio.create_task(self._websocket_server.start())
        # Wait for it to be ready
        await self._websocket_server.started.wait()
        print("[YJS] WebsocketServer started")
        
        self._initialized = True
    
    async def shutdown(self):
        """Clean shutdown."""
        print("[YJS] Shutting down...")
        
        if self._websocket_server:
            # Save all room states before shutting down
            for room_name, room in list(self._websocket_server.rooms.items()):
                if room.ystore:
                    await room.ystore.encode_state_as_update(room.ydoc)
            
            await self._websocket_server.stop()
        
        # Cancel the background task
        if self._server_task:
            self._server_task.cancel()
            try:
                await self._server_task
            except asyncio.CancelledError:
                pass
        
        print("[YJS] Shutdown complete")
    
    def _create_ystore(self, path: str) -> PostgresYStore:
        """Create a YStore for a given path."""
        return PostgresYStore(path, self._async_session_factory)
    
    async def serve(self, websocket: WebSocket, document_id: str):
        """Handle a WebSocket connection for Y.js synchronization."""
        if not self._initialized:
            await self.initialize()
        
        await websocket.accept()
        
        # Create adapter for FastAPI websocket
        # The path is used by WebsocketServer to determine the room name
        room_path = f"/{document_id}"
        ws_adapter = FastAPIWebsocket(websocket, room_path)
        
        print(f"[YJS] Client connecting to room: {room_path}")
        
        # Check if room exists, if not we need to set up the ystore
        if room_path not in self._websocket_server.rooms:
            # Pre-create the room with ystore
            ystore = self._create_ystore(room_path)
            room = YRoom(ready=False, ystore=ystore)  # ready=False until we load state
            
            # Load existing state from PostgreSQL
            ydoc = room.ydoc
            await ystore.apply_updates(ydoc)
            
            # Now mark as ready
            room.ready = True
            
            # Add to server's rooms
            self._websocket_server.rooms[room_path] = room
            await self._websocket_server.start_room(room)
            print(f"[YJS] Created room with persistence: {room_path}")
        
        try:
            # WebsocketServer.serve handles everything:
            # - Gets or creates the room based on ws_adapter.path
            # - Document sync protocol
            # - Awareness (cursors, selections, presence)
            # - Broadcasting to all connected clients
            # - Auto-cleanup when no clients remain
            await self._websocket_server.serve(ws_adapter)
        except WebSocketDisconnect:
            pass
        except Exception as e:
            print(f"[YJS] WebSocket error: {e}")
        finally:
            # Save state when client disconnects
            room_path = f"/{document_id}"
            if room_path in self._websocket_server.rooms:
                room = self._websocket_server.rooms[room_path]
                if room.ystore and not room.clients:
                    # Save state to PostgreSQL when last client leaves
                    await room.ystore.encode_state_as_update(room.ydoc)
                    print(f"[YJS] Saved state on last client disconnect: {room_path}")
            
            print(f"[YJS] Client disconnected from room: {room_path}")


# Global manager instance
manager = YjsConnectionManager()


async def websocket_endpoint(websocket: WebSocket, document_id: str):
    """WebSocket endpoint for YJS document synchronization."""
    await manager.serve(websocket, document_id)
