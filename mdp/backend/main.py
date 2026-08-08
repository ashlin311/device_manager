import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timezone, timedelta

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from database import async_session
from models import Device
from schemas import DeviceResponse
from websocket.manager import manager


async def check_device_status():
    """Background task: mark devices offline if last_seen > 90 seconds ago."""
    while True:
        await asyncio.sleep(60)
        try:
            async with async_session() as db:
                cutoff = datetime.now(timezone.utc) - timedelta(seconds=90)
                result = await db.execute(
                    select(Device).where(
                        Device.last_seen < cutoff,
                        Device.status != "offline",
                    )
                )
                stale_devices = result.scalars().all()

                for device in stale_devices:
                    device.status = "offline"
                    # Push update to admin WebSocket
                    await manager.broadcast({
                        "type": "device_update",
                        "device": DeviceResponse.model_validate(device).model_dump(mode="json"),
                    })

                await db.commit()
        except Exception as e:
            print(f"[STATUS CHECK] Error: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown lifecycle for the FastAPI app."""
    # Start background task for device status monitoring
    task = asyncio.create_task(check_device_status())
    yield
    # Cleanup on shutdown
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title="Mini Device Management Platform",
    description="Simplified UEM system with real-time device management",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow the React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
from auth.router import router as auth_router
from devices.router import router as devices_router
from commands.router import router as commands_router
from audit.router import router as audit_router
from websocket.router import router as ws_router

app.include_router(auth_router)
app.include_router(devices_router)
app.include_router(commands_router)
app.include_router(audit_router)
app.include_router(ws_router)


@app.get("/")
async def root():
    return {"message": "MDP API is running", "docs": "/docs"}
