from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import settings
from app.services.redis_service import redis_service
from app.api import auth, projects, files
from app.websocket.yjs_server import websocket_endpoint


@asynccontextmanager
async def lifespan(app: FastAPI):
    await redis_service.connect()
    yield
    await redis_service.disconnect()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan,
    redirect_slashes=False,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
app.include_router(projects.router, prefix=f"{settings.API_V1_STR}/projects", tags=["projects"])
app.include_router(files.router, prefix=f"{settings.API_V1_STR}/projects", tags=["files"])


@app.get("/")
def read_root():
    return {"message": "Typst Collaboration Platform API", "version": settings.VERSION}


@app.websocket("/ws/{document_id}")
async def websocket_route(websocket: WebSocket, document_id: str):
    await websocket_endpoint(websocket, document_id)
