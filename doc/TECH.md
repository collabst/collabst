# Tech Stack

Collabst is a real-time collaborative Typst editor. The stack is built around [Yjs](https://yjs.dev/) CRDTs for conflict-free collaborative editing.

## Layers

| Layer | Technology |
|---|---|
| Frontend | Svelte 5 + SvelteKit, TypeScript, Vite |
| Backend | FastAPI, Python 3.12, uv |
| Database | PostgreSQL 16 — SQLAlchemy async, Alembic migrations |
| Live state | Redis — active Yjs document state |
| Object storage | MinIO — binary assets (S3-compatible) |
| Auth | JWT (access + refresh tokens), bcrypt |

## Frontend

SvelteKit app with [CodeMirror](https://codemirror.net/) as the editor. Yjs binds editor state across clients via WebSocket (`y-websocket`, `y-codemirror.next`), with IndexedDB for offline persistence.

## Backend

FastAPI with fully async SQLAlchemy + asyncpg. Real-time sync is handled by `pycrdt-websocket`, a Yjs-compatible WebSocket server.

## Collaboration & Persistence

```
Client (Yjs + y-websocket)
        │  WebSocket
        ▼
Backend (pycrdt-websocket)
    ├── Redis       ← live CRDT state, updated on every change
    └── PostgreSQL  ← snapshots every 30s and on last disconnect
```

On connect, state is loaded from PostgreSQL if Redis is empty. Binary asset metadata lives in PostgreSQL; files live in MinIO.

## Infrastructure

All services run via Docker Compose (`docker-compose.dev.yml`): PostgreSQL, Redis, MinIO, backend (`:8000`), frontend (`:5173`). See `.env.example` for configuration.
