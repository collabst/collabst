"""
YJS WebSocket Server with PostgreSQL Persistence + Redis Caching

Architecture:
- PostgreSQL: Source of truth for YJS document states
- Redis: Cache for active projects (fast access)
- Memory: Hot cache for currently connected documents

Flow:
1. Client connects → Load from Redis (cache hit) or PostgreSQL (cache miss)
2. Client sends updates → Broadcast to others, update memory cache
3. Periodically → Save to Redis (every 5s) and PostgreSQL (every 30s)
4. Last client disconnects → Save to PostgreSQL, clear from memory
"""
from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, Set
import asyncio
import time
import redis.asyncio as redis
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from contextlib import asynccontextmanager

from app.core.config import settings
from app.models.yjs_state import YjsDocumentState


# Configuration
REDIS_KEY_PREFIX = "yjs:doc:"
REDIS_PERSIST_INTERVAL = 5      # Save to Redis every 5 seconds
DB_PERSIST_INTERVAL = 30        # Save to PostgreSQL every 30 seconds
REDIS_CACHE_TTL = 3600          # Redis cache TTL: 1 hour


class YjsConnectionManager:
    def __init__(self):
        # Active WebSocket connections per document
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        
        # In-memory cache of document states (hot cache)
        self.document_states: Dict[str, bytes] = {}
        
        # Track when documents were last modified (for dirty checking)
        self.last_modified: Dict[str, float] = {}
        
        # Track last save time to DB
        self.last_db_save: Dict[str, float] = {}
        
        # Redis client
        self.redis: redis.Redis | None = None
        
        # Database session factory
        self.async_session: sessionmaker | None = None
        
        # Background task for periodic saves
        self._save_task: asyncio.Task | None = None
        self._running = False

    async def initialize(self):
        """Initialize Redis and database connections."""
        # Redis connection (binary mode)
        self.redis = await redis.from_url(
            settings.REDIS_URL,
            decode_responses=False
        )
        print("[YJS] Redis connected")
        
        # Database engine and session factory
        engine = create_async_engine(settings.DATABASE_URL)
        self.async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        print("[YJS] Database session factory created")
        
        # Start background save task
        self._running = True
        self._save_task = asyncio.create_task(self._periodic_save_loop())
        print("[YJS] Background save task started")

    async def shutdown(self):
        """Clean shutdown - save all pending states."""
        print("[YJS] Shutting down...")
        self._running = False
        
        if self._save_task:
            self._save_task.cancel()
            try:
                await self._save_task
            except asyncio.CancelledError:
                pass
        
        # Save all documents to database before shutdown
        for doc_id in list(self.document_states.keys()):
            await self._save_to_database(doc_id)
        
        if self.redis:
            await self.redis.close()
        
        print("[YJS] Shutdown complete")

    @asynccontextmanager
    async def get_db(self):
        """Get database session."""
        async with self.async_session() as session:
            yield session

    async def _load_state(self, document_id: str) -> bytes | None:
        """Load state from Redis (cache) or PostgreSQL (source of truth)."""
        # Try Redis first (fast)
        redis_key = f"{REDIS_KEY_PREFIX}{document_id}"
        state = await self.redis.get(redis_key)
        
        if state:
            print(f"[YJS] Cache HIT (Redis): {document_id} ({len(state)} bytes)")
            return state
        
        # Cache miss - load from PostgreSQL
        project_id = self._extract_project_id(document_id)
        if not project_id:
            return None
        
        async with self.get_db() as db:
            result = await db.execute(
                select(YjsDocumentState).where(YjsDocumentState.project_id == project_id)
            )
            yjs_state = result.scalar_one_or_none()
            
            if yjs_state and yjs_state.state:
                print(f"[YJS] Cache MISS - loaded from PostgreSQL: {document_id} ({len(yjs_state.state)} bytes)")
                # Cache in Redis for future requests
                await self.redis.set(redis_key, yjs_state.state, ex=REDIS_CACHE_TTL)
                return yjs_state.state
        
        print(f"[YJS] No existing state for: {document_id}")
        return None

    async def _save_to_redis(self, document_id: str):
        """Save state to Redis cache."""
        if document_id not in self.document_states:
            return
        
        state = self.document_states[document_id]
        redis_key = f"{REDIS_KEY_PREFIX}{document_id}"
        await self.redis.set(redis_key, state, ex=REDIS_CACHE_TTL)

    async def _save_to_database(self, document_id: str):
        """Save state to PostgreSQL (source of truth)."""
        if document_id not in self.document_states:
            return
        
        project_id = self._extract_project_id(document_id)
        if not project_id:
            return
        
        state = self.document_states[document_id]
        
        try:
            async with self.get_db() as db:
                # Upsert: update if exists, insert if not
                result = await db.execute(
                    select(YjsDocumentState).where(YjsDocumentState.project_id == project_id)
                )
                yjs_state = result.scalar_one_or_none()
                
                if yjs_state:
                    yjs_state.state = state
                else:
                    yjs_state = YjsDocumentState(project_id=project_id, state=state)
                    db.add(yjs_state)
                
                await db.commit()
            
            self.last_db_save[document_id] = time.time()
            print(f"[YJS] Saved to PostgreSQL: {document_id} ({len(state)} bytes)")
        except Exception as e:
            print(f"[YJS] Error saving to PostgreSQL: {e}")

    async def _periodic_save_loop(self):
        """Background task to periodically save states."""
        while self._running:
            await asyncio.sleep(REDIS_PERSIST_INTERVAL)
            
            current_time = time.time()
            
            for doc_id in list(self.document_states.keys()):
                last_mod = self.last_modified.get(doc_id, 0)
                last_save = self.last_db_save.get(doc_id, 0)
                
                # Save to Redis if modified
                if last_mod > 0:
                    await self._save_to_redis(doc_id)
                
                # Save to PostgreSQL if modified and enough time has passed
                if last_mod > last_save and (current_time - last_save) >= DB_PERSIST_INTERVAL:
                    await self._save_to_database(doc_id)

    def _extract_project_id(self, document_id: str) -> int | None:
        """Extract project ID from document ID (e.g., 'project-123' -> 123)."""
        if document_id.startswith("project-"):
            try:
                return int(document_id.split("-")[1])
            except (IndexError, ValueError):
                return None
        return None

    async def connect(self, websocket: WebSocket, document_id: str):
        """Handle new client connection."""
        await websocket.accept()
        
        if document_id not in self.active_connections:
            self.active_connections[document_id] = set()
        self.active_connections[document_id].add(websocket)
        
        # Load state if not in memory
        if document_id not in self.document_states:
            state = await self._load_state(document_id)
            if state:
                self.document_states[document_id] = state
        
        count = len(self.active_connections[document_id])
        print(f"[YJS] Client connected to {document_id}. Total: {count}")

    async def disconnect(self, websocket: WebSocket, document_id: str):
        """Handle client disconnection."""
        if document_id not in self.active_connections:
            return
        
        self.active_connections[document_id].discard(websocket)
        remaining = len(self.active_connections[document_id])
        print(f"[YJS] Client disconnected from {document_id}. Remaining: {remaining}")
        
        # If no more clients, save to DB and clean up memory
        if remaining == 0:
            del self.active_connections[document_id]
            
            # Save to database immediately when last client leaves
            if document_id in self.document_states:
                await self._save_to_database(document_id)
                # Clean up memory (Redis still has it cached)
                del self.document_states[document_id]
                if document_id in self.last_modified:
                    del self.last_modified[document_id]
                print(f"[YJS] Cleaned up memory for {document_id}")

    async def broadcast(self, message: bytes, document_id: str, sender: WebSocket):
        """Broadcast message to all clients except sender."""
        if document_id not in self.active_connections:
            return
        
        disconnected = []
        for conn in self.active_connections[document_id]:
            if conn != sender:
                try:
                    await conn.send_bytes(message)
                except Exception:
                    disconnected.append(conn)
        
        for conn in disconnected:
            await self.disconnect(conn, document_id)

    async def send_initial_state(self, websocket: WebSocket, document_id: str):
        """Send stored state to newly connected client."""
        if document_id in self.document_states:
            state = self.document_states[document_id]
            if state:
                await websocket.send_bytes(state)
                print(f"[YJS] Sent initial state: {len(state)} bytes")

    def update_state(self, document_id: str, state: bytes):
        """Update in-memory state and mark as modified."""
        self.document_states[document_id] = state
        self.last_modified[document_id] = time.time()


# Global manager instance
manager = YjsConnectionManager()


async def websocket_endpoint(websocket: WebSocket, document_id: str):
    """WebSocket endpoint for YJS document synchronization."""
    await manager.connect(websocket, document_id)
    
    try:
        # Send stored state to new client
        await manager.send_initial_state(websocket, document_id)
        
        while True:
            data = await websocket.receive_bytes()
            
            # Update state
            manager.update_state(document_id, data)
            
            # Broadcast to other clients
            await manager.broadcast(data, document_id, websocket)
    
    except WebSocketDisconnect:
        await manager.disconnect(websocket, document_id)
    except Exception as e:
        print(f"[YJS] WebSocket error: {e}")
        await manager.disconnect(websocket, document_id)
