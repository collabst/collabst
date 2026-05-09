from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, comments, files, invitations, profile_pic, projects, users
from app.core.config import settings
from app.services.redis_service import redis_service
from app.websocket.auth import WebSocketAuthError, authenticate_websocket_project
from app.websocket.notifications_ws import notifications_websocket_endpoint
from app.websocket.project_ws import project_websocket_endpoint
from app.websocket.yjs_server import manager as yjs_manager
from app.websocket.yjs_server import websocket_endpoint


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
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
app.include_router(profile_pic.router, prefix=f"{settings.API_V1_STR}", tags=["users"])
app.include_router(users.router, prefix=f"{settings.API_V1_STR}/users", tags=["users"])
app.include_router(projects.router, prefix=f"{settings.API_V1_STR}/projects", tags=["projects"])
app.include_router(files.router, prefix=f"{settings.API_V1_STR}/projects", tags=["files"])
app.include_router(invitations.router, prefix=f"{settings.API_V1_STR}/projects", tags=["invitations"])
app.include_router(comments.router, prefix=f"{settings.API_V1_STR}/projects", tags=["comments"])


@app.get("/")
def read_root():
    return {"message": "Typst Collaboration Platform API", "version": settings.VERSION}


@app.websocket(f"{settings.API_V1_STR}" + "/ws/{document_id}")
async def websocket_route(websocket: WebSocket, document_id: str):
    token = websocket.query_params.get("token")
    project_ref = document_id.removeprefix("project-")
    try:
        context = await authenticate_websocket_project(token=token, project_ref=project_ref)
    except WebSocketAuthError as e:
        await websocket.close(code=1008, reason=e.reason)
        return

    await websocket_endpoint(websocket, document_id, context)


@app.websocket(f"{settings.API_V1_STR}" + "/ws/project/{project_id}")
async def project_websocket_route(websocket: WebSocket, project_id: str):
    token = websocket.query_params.get("token")
    try:
        context = await authenticate_websocket_project(token=token, project_ref=project_id)
    except WebSocketAuthError as e:
        await websocket.close(code=1008, reason=e.reason)
        return

    await project_websocket_endpoint(websocket, project_id, context)


@app.websocket(f"{settings.API_V1_STR}" + "/ws/notifications/project/{project_id}")
async def notifications_websocket_route(websocket: WebSocket, project_id: str):
    token = websocket.query_params.get("token")
    try:
        context = await authenticate_websocket_project(token=token, project_ref=project_id)
    except WebSocketAuthError as e:
        await websocket.close(code=1008, reason=e.reason)
        return

    await notifications_websocket_endpoint(websocket, project_id, context)
