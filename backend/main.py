from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import settings
from app.services.redis_service import redis_service
from app.api import auth, projects, files, invitations
from app.websocket.yjs_server import websocket_endpoint, manager as yjs_manager
from app.websocket.project_ws import project_websocket_endpoint


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize services
    await redis_service.connect()
    await yjs_manager.initialize()
    
    yield
    
    # Cleanup services
    await yjs_manager.shutdown()
    await redis_service.disconnect()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan,
    redirect_slashes=False,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
app.include_router(projects.router, prefix=f"{settings.API_V1_STR}/projects", tags=["projects"])
app.include_router(files.router, prefix=f"{settings.API_V1_STR}/projects", tags=["files"])
app.include_router(invitations.router, prefix=f"{settings.API_V1_STR}/projects", tags=["invitations"])


@app.get("/")
def read_root():
    return {"message": "Typst Collaboration Platform API", "version": settings.VERSION}


@app.websocket(f"{settings.API_V1_STR}" + "/ws/{document_id}")
async def websocket_route(websocket: WebSocket, document_id: str):
    await websocket_endpoint(websocket, document_id)


@app.websocket(f"{settings.API_V1_STR}" + "/ws/project/{project_id}")
async def project_websocket_route(websocket: WebSocket, project_id: int):
    await project_websocket_endpoint(websocket, project_id)
