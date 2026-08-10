from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models import Command, Device, AuditLog, User
from schemas import (
    CommandCreateRequest,
    CommandResultRequest,
    CommandResponse,
    NaturalCommandRequest,
    NaturalCommandResponse,
    DeviceResponse,
)
from auth.router import get_current_user
from websocket.manager import manager

router = APIRouter(prefix="/commands", tags=["commands"])


@router.post("", response_model=CommandResponse, status_code=status.HTTP_201_CREATED)
async def create_command(
    request: CommandCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin issues a command to a device."""
    # Validate device exists
    result = await db.execute(select(Device).where(Device.id == request.device_id))
    device = result.scalar_one_or_none()
    if device is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")

    # Validate action
    valid_actions = {"restart", "lock", "rename", "notify"}
    if request.action not in valid_actions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid action. Must be one of: {', '.join(valid_actions)}",
        )

    command = Command(
        device_id=request.device_id,
        issued_by=current_user.id,
        action=request.action,
        payload=request.payload,
        status="pending",
    )
    db.add(command)
    await db.flush()
    await db.refresh(command)

    # Dispatch to agent via WebSocket
    await manager.send(request.device_id, {
        "command_id": command.id,
        "action": command.action,
        "payload": command.payload,
    })
    command.status = "dispatched"

    # Audit log
    audit = AuditLog(
        user_id=current_user.id,
        device_id=request.device_id,
        action="command_issued",
        detail=f"Issued '{request.action}' to device {device.name}",
    )
    db.add(audit)

    # Notify admin WS
    await manager.broadcast({
        "type": "command_update",
        "command": CommandResponse.model_validate(command).model_dump(mode="json"),
    })

    return command


@router.get("/{command_id}", response_model=CommandResponse)
async def get_command(
    command_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Poll command status."""
    result = await db.execute(select(Command).where(Command.id == command_id))
    command = result.scalar_one_or_none()
    if command is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Command not found")
    return command


@router.post("/{command_id}/result")
async def report_result(
    command_id: str,
    request: CommandResultRequest,
    db: AsyncSession = Depends(get_db),
):
    """Agent reports the result of a command execution. No auth required (agent-facing)."""
    result = await db.execute(select(Command).where(Command.id == command_id))
    command = result.scalar_one_or_none()
    if command is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Command not found")

    command.status = request.status
    command.result = request.result
    command.completed_at = datetime.now(timezone.utc)
    
    result = await db.execute(select(Device).where(Device.id == command.device_id))
    device = result.scalar_one_or_none()

    if device and request.status == "completed":
        if command.action == "rename":
            new_name = command.payload.get("new_name")
            if new_name:
                device.name = new_name
                await db.flush()


    # Audit log
    audit = AuditLog(
        user_id=command.issued_by,
        device_id=command.device_id,
        action="command_completed",
        detail=f"Command '{command.action}' {request.status}: {request.result}",
    )
    db.add(audit)

    # Notify admin WS
    await manager.broadcast({
        "type": "command_update",
        "command": CommandResponse.model_validate(command).model_dump(mode="json"),
    })

    return {"status": "ok"}


@router.post("/natural", response_model=NaturalCommandResponse)
async def natural_command(
    request: NaturalCommandRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Parse a natural language admin instruction via LLM and issue command(s)."""
    from llm.service import parse_natural_command

    # Get all devices for context
    result = await db.execute(select(Device))
    devices = result.scalars().all()

    device_list = [
        {"id": d.id, "name": d.name, "hostname": d.hostname, "status": d.status}
        for d in devices
    ]

    # Call LLM
    parsed = await parse_natural_command(request.prompt, device_list)

    if "error" in parsed:
        return NaturalCommandResponse(error=parsed["error"])

    action = parsed.get("action")
    targets = parsed.get("targets", [])
    payload = parsed.get("payload", {})

    # Issue commands for each target
    issued_commands = []
    for device_id in targets:
        # Validate device exists
        dev_result = await db.execute(select(Device).where(Device.id == device_id))
        device = dev_result.scalar_one_or_none()
        if device is None:
            continue

        command = Command(
            device_id=device_id,
            issued_by=current_user.id,
            action=action,
            payload=payload,
            status="pending",
        )
        db.add(command)
        await db.flush()
        await db.refresh(command)

        # Dispatch via WebSocket
        await manager.send(device_id, {
            "command_id": command.id,
            "action": command.action,
            "payload": command.payload,
        })
        command.status = "dispatched"

        # Audit log
        audit = AuditLog(
            user_id=current_user.id,
            device_id=device_id,
            action="command_issued",
            detail=f"LLM-issued '{action}' to device {device.name} (prompt: {request.prompt})",
        )
        db.add(audit)

        issued_commands.append(command)

    return NaturalCommandResponse(
        action=action,
        targets=targets,
        payload=payload,
        commands=[CommandResponse.model_validate(c) for c in issued_commands],
    )
