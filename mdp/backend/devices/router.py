from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models import Device, AuditLog, User, Command
from schemas import (
    DeviceRegisterRequest,
    DeviceRegisterResponse,
    HeartbeatPayload,
    DeviceResponse,
    CommandResponse,
)
from auth.router import get_current_user

router = APIRouter(prefix="/devices", tags=["devices"])


@router.post("/register", response_model=DeviceRegisterResponse)
async def register_device(
    request: DeviceRegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    """Agent calls this on startup to register itself."""
    device = Device(
        name=request.name,
        hostname=request.hostname,
        os=request.os,
        cpu_usage=request.cpu_usage,
        ram_usage=request.ram_usage,
        ram_total_gb=request.ram_total_gb,
        cpu_cores=request.cpu_cores,
        ip_address=request.ip_address,
        status="online",
        last_seen=datetime.now(timezone.utc),
    )
    db.add(device)
    await db.flush()
    await db.refresh(device)
    return DeviceRegisterResponse(device_id=device.id)


@router.post("/{device_id}/heartbeat")
async def heartbeat(
    device_id: str,
    payload: HeartbeatPayload,
    db: AsyncSession = Depends(get_db),
):
    """Agent calls this every 30s with telemetry data."""
    result = await db.execute(select(Device).where(Device.id == device_id))
    device = result.scalar_one_or_none()
    if device is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")

    device.cpu_usage = payload.cpu_usage
    device.ram_usage = payload.ram_usage
    device.ram_total_gb = payload.ram_total_gb
    device.cpu_cores = payload.cpu_cores
    device.ip_address = payload.ip_address
    device.os = payload.os
    device.hostname = payload.hostname
    device.status = "online"
    device.last_seen = datetime.now(timezone.utc)

    # Push update to admin WebSocket
    from websocket.manager import manager
    await manager.broadcast({
        "type": "device_update",
        "device": DeviceResponse.model_validate(device).model_dump(mode="json"),
    })

    return {"status": "ok"}


@router.get("", response_model=list[DeviceResponse])
async def list_devices(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin fetches full device list."""
    result = await db.execute(select(Device))
    devices = result.scalars().all()
    return devices


@router.get("/{device_id}", response_model=DeviceResponse)
async def get_device(
    device_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin fetches a single device."""
    result = await db.execute(select(Device).where(Device.id == device_id))
    device = result.scalar_one_or_none()
    if device is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")
    return device


@router.get("/{device_id}/commands", response_model=list[CommandResponse])
async def get_device_commands(
    device_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin fetches command history for a specific device."""
    # Check if device exists first
    result = await db.execute(select(Device).where(Device.id == device_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")

    cmd_result = await db.execute(
        select(Command)
        .where(Command.device_id == device_id)
        .order_by(Command.issued_at.desc())
    )
    commands = cmd_result.scalars().all()
    return commands

