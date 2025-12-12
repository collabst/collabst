"""
YJS WebSocket Server with Redis + PostgreSQL Persistence

Uses pycrdt-websocket WebsocketServer for proper Y.js sync protocol and awareness handling.
Uses a custom RedisYStore for fast in-memory state with PostgreSQL snapshots.

Architecture:
- Redis: Live in-memory storage for real-time CRDT state
- PostgreSQL: Durable storage for periodic snapshots
- WebsocketServer: Manages rooms, handles sync protocol and awareness
- Custom RedisYStore: Writes to Redis immediately, snapshots to PostgreSQL periodically

Flow:
1. Client connects → WebsocketServer gets/creates room
2. Room loads state from Redis (fast) or PostgreSQL (fallback)
3. YRoom handles sync protocol and awareness broadcasting automatically
4. Updates are written to Redis immediately for low latency
5. Background task periodically snapshots to PostgreSQL
6. Last client disconnects → Final snapshot saved, Redis cleaned up
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
import redis.asyncio as redis

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


class RedisYStore(BaseYStore):
    """YStore implementation with Redis for live state and PostgreSQL for snapshots.

    Architecture:
    - Redis: Fast in-memory storage for live CRDT state
    - PostgreSQL: Durable storage for periodic snapshots
    - Updates are written to Redis immediately
    - Snapshots are saved to PostgreSQL periodically
    """

    # Required class attributes for BaseYStore
    _started: Event | None = None
    _stopped: Event
    __start_lock: Lock | None = None

    def __init__(
        self,
        path: str,
        redis_client: redis.Redis,
        async_session_factory: sessionmaker,
        snapshot_interval: int = 30,
        metadata_callback=None,
        log=None
    ):
        """
        Args:
            path: The room/document path (e.g., "project-123")
            redis_client: Redis client for live state
            async_session_factory: SQLAlchemy async session factory for snapshots
            snapshot_interval: Seconds between PostgreSQL snapshots
        """
        self._path = path
        self._redis_client = redis_client
        self._async_session_factory = async_session_factory
        self._project_id = self._extract_project_id(path)
        self._snapshot_interval = snapshot_interval
        self._metadata_callback = metadata_callback
        self._log = log
        self._stopped = Event()
        self._db_session: AsyncSession | None = None
        self._internal_doc: Doc | None = None
        self._snapshot_task: asyncio.Task | None = None
        self._last_snapshot_time = 0.0
        self._updates_since_snapshot = 0
    
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
        path = path.lstrip("/")
        if path.startswith("project-"):
            try:
                return int(path.split("-")[1])
            except (IndexError, ValueError):
                return None
        return None

    def _redis_key(self) -> str:
        """Get the Redis key for this document."""
        return f"yjs:doc:{self._path}"

    async def _snapshot_to_postgres(self) -> None:
        """Save current state snapshot to PostgreSQL."""
        if self._project_id is None or self._internal_doc is None:
            return

        update_bytes = self._internal_doc.get_update()
        if not update_bytes:
            return

        try:
            result = await self._db_session.execute(
                select(YjsDocumentState).where(YjsDocumentState.project_id == self._project_id)
            )
            yjs_state = result.scalar_one_or_none()

            if yjs_state:
                yjs_state.state = update_bytes
            else:
                yjs_state = YjsDocumentState(project_id=self._project_id, state=update_bytes)
                self._db_session.add(yjs_state)

            await self._db_session.commit()
            self._last_snapshot_time = time.time()
            self._updates_since_snapshot = 0
            print(f"[YJS] Snapshot saved to PostgreSQL: {self._path} ({len(update_bytes)} bytes)")
        except Exception as e:
            await self._db_session.rollback()
            print(f"[YJS] Error saving snapshot to PostgreSQL: {e}")

    async def _periodic_snapshot_loop(self) -> None:
        """Periodically snapshot to PostgreSQL."""
        while not self._stopped.is_set():
            try:
                await asyncio.sleep(self._snapshot_interval)
                if self._updates_since_snapshot > 0:
                    await self._snapshot_to_postgres()
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"[YJS] Error in snapshot loop: {e}")

    async def start(
        self,
        *,
        task_status: TaskStatus[None] = TASK_STATUS_IGNORED,
        from_context_manager: bool = False,
    ):
        """Start the store and background snapshot task."""
        # Create long-lived database session for snapshots
        self._db_session = self._async_session_factory()

        # Start periodic snapshot task
        self._snapshot_task = asyncio.create_task(self._periodic_snapshot_loop())

        task_status.started()
        self.started.set()
        print(f"[YJS] RedisYStore started for {self._path}")

    async def stop(self) -> None:
        """Stop the store, save final snapshot, and cleanup resources."""
        # Cancel snapshot task
        if self._snapshot_task:
            self._snapshot_task.cancel()
            try:
                await self._snapshot_task
            except asyncio.CancelledError:
                pass

        # Save final snapshot to PostgreSQL
        if self._updates_since_snapshot > 0:
            await self._snapshot_to_postgres()

        # Clean up Redis state
        if self._project_id is not None:
            try:
                await self._redis_client.delete(self._redis_key())
                print(f"[YJS] Cleaned up Redis state for {self._path}")
            except Exception as e:
                print(f"[YJS] Error cleaning up Redis: {e}")

        # Clean up internal doc to free memory
        if self._internal_doc is not None:
            del self._internal_doc
            self._internal_doc = None

        # Close the long-lived database session
        if self._db_session is not None:
            await self._db_session.close()
            self._db_session = None

        self._stopped.set()
        print(f"[YJS] RedisYStore stopped for {self._path}")
    
    async def read(self) -> AsyncIterator[tuple[bytes, bytes, float]]:
        """Read stored updates from Redis (live) or PostgreSQL (fallback).

        Yields:
            Tuples of (update, metadata, timestamp)
        """
        if self._project_id is None:
            return

        # Try Redis first (live state)
        try:
            redis_state = await self._redis_client.get(self._redis_key())
            if redis_state:
                print(f"[YJS] Loaded state from Redis: {self._path} ({len(redis_state)} bytes)")
                yield (redis_state, b"", time.time())
                return
        except Exception as e:
            print(f"[YJS] Error reading from Redis: {e}")

        # Fallback to PostgreSQL (snapshot)
        if self._db_session is None:
            return

        try:
            result = await self._db_session.execute(
                select(YjsDocumentState).where(YjsDocumentState.project_id == self._project_id)
            )
            yjs_state = result.scalar_one_or_none()

            if yjs_state and yjs_state.state:
                print(f"[YJS] Loaded state from PostgreSQL: {self._path} ({len(yjs_state.state)} bytes)")
                # Also restore to Redis for future fast access
                await self._redis_client.set(self._redis_key(), yjs_state.state)
                yield (yjs_state.state, b"", time.time())
        except Exception as e:
            print(f"[YJS] Error reading from PostgreSQL: {e}")
    
    async def write(self, data: bytes) -> None:
        """Store an update to Redis immediately.

        This is called by YRoom for each document update.
        Updates are written to Redis immediately for fast access.
        Periodic snapshots are saved to PostgreSQL.
        """
        if self._project_id is None:
            return

        # Apply update to internal doc to build full state
        if self._internal_doc is None:
            self._internal_doc = Doc()
            # Load existing state first
            async for update, metadata, timestamp in self.read():
                self._internal_doc.apply_update(update)

        # Apply new update
        self._internal_doc.apply_update(data)

        # Save full document state to Redis immediately
        update_bytes = self._internal_doc.get_update()
        if not update_bytes:
            return

        try:
            # Write to Redis for fast real-time access
            await self._redis_client.set(self._redis_key(), update_bytes)
            self._updates_since_snapshot += 1
            # Note: No logging here to avoid spam - updates are frequent
        except Exception as e:
            print(f"[YJS] Error writing to Redis: {e}")
    
    async def apply_updates(self, ydoc: Doc) -> None:
        """Apply all stored updates to the YDoc from Redis or PostgreSQL."""
        async for update, metadata, timestamp in self.read():
            ydoc.apply_update(update)

    async def encode_state_as_update(self, ydoc: Doc) -> None:
        """Store the YDoc state to both Redis and PostgreSQL."""
        if self._project_id is None:
            return

        # Use get_update() NOT get_state() - they return different formats!
        update_bytes = ydoc.get_update()
        if not update_bytes:
            return

        # Save to Redis immediately
        try:
            await self._redis_client.set(self._redis_key(), update_bytes)
        except Exception as e:
            print(f"[YJS] Error saving to Redis: {e}")

        # Save to PostgreSQL as well
        if self._db_session is None:
            return

        try:
            result = await self._db_session.execute(
                select(YjsDocumentState).where(YjsDocumentState.project_id == self._project_id)
            )
            yjs_state = result.scalar_one_or_none()

            if yjs_state:
                yjs_state.state = update_bytes
            else:
                yjs_state = YjsDocumentState(project_id=self._project_id, state=update_bytes)
                self._db_session.add(yjs_state)

            await self._db_session.commit()
            print(f"[YJS] Saved final state to PostgreSQL: {self._path} ({len(update_bytes)} bytes)")
        except Exception as e:
            await self._db_session.rollback()
            print(f"[YJS] Error saving to PostgreSQL: {e}")
    
    async def get_metadata(self) -> bytes:
        """Get metadata."""
        if self._metadata_callback is not None:
            return await self._metadata_callback()
        return b""


class YjsConnectionManager:
    """Manages YJS WebSocket connections using pycrdt-websocket with Redis."""

    def __init__(self):
        self._websocket_server: WebsocketServer | None = None
        self._async_session_factory: sessionmaker | None = None
        self._redis_client: redis.Redis | None = None
        self._initialized = False
        self._server_task: asyncio.Task | None = None
        self._room_creation_locks: dict[str, asyncio.Lock] = {}  # Lock per room path
        self._locks_lock = asyncio.Lock()  # Lock for the locks dictionary itself
    
    async def initialize(self):
        """Initialize the WebSocket server, Redis, and database connections."""
        if self._initialized:
            return

        # Redis client for live state
        self._redis_client = await redis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=False  # Keep as bytes for CRDT data
        )
        print("[YJS] Redis client connected")

        # Database engine and session factory for snapshots
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

        # Close Redis connection
        if self._redis_client:
            await self._redis_client.close()
            print("[YJS] Redis client closed")

        print("[YJS] Shutdown complete")
    
    async def _get_room_lock(self, room_path: str) -> asyncio.Lock:
        """Get or create a lock for a specific room path."""
        async with self._locks_lock:
            if room_path not in self._room_creation_locks:
                self._room_creation_locks[room_path] = asyncio.Lock()
            return self._room_creation_locks[room_path]

    def _create_ystore(self, path: str) -> RedisYStore:
        """Create a RedisYStore for a given path."""
        return RedisYStore(
            path=path,
            redis_client=self._redis_client,
            async_session_factory=self._async_session_factory,
            snapshot_interval=settings.YJS_SNAPSHOT_INTERVAL_SECONDS
        )
    
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

        # Use a lock to prevent race conditions when creating rooms
        room_lock = await self._get_room_lock(room_path)
        async with room_lock:
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
