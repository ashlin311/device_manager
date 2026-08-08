from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr


# ---------- Auth ----------
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: str
    email: str

    model_config = {"from_attributes": True}


# ---------- Devices ----------
class DeviceRegisterRequest(BaseModel):
    name: str
    hostname: str | None = None
    os: str | None = None
    cpu_usage: float | None = None
    ram_usage: float | None = None
    ram_total_gb: float | None = None
    cpu_cores: int | None = None
    ip_address: str | None = None


class DeviceRegisterResponse(BaseModel):
    device_id: str


class HeartbeatPayload(BaseModel):
    cpu_usage: float
    ram_usage: float
    ram_total_gb: float
    cpu_cores: int
    ip_address: str
    os: str
    hostname: str


class DeviceResponse(BaseModel):
    id: str
    name: str
    hostname: str | None = None
    os: str | None = None
    status: str
    cpu_usage: float | None = None
    ram_usage: float | None = None
    ram_total_gb: float | None = None
    cpu_cores: int | None = None
    ip_address: str | None = None
    last_seen: datetime | None = None
    registered_at: datetime | None = None

    model_config = {"from_attributes": True}


# ---------- Commands ----------
class CommandCreateRequest(BaseModel):
    device_id: str
    action: str  # "restart" | "lock" | "rename" | "notify"
    payload: dict = {}


class CommandResultRequest(BaseModel):
    status: str  # "completed" | "failed"
    result: str


class CommandResponse(BaseModel):
    id: str
    device_id: str
    issued_by: str
    action: str
    payload: dict | None = None
    status: str
    result: str | None = None
    issued_at: datetime | None = None
    completed_at: datetime | None = None

    model_config = {"from_attributes": True}


class NaturalCommandRequest(BaseModel):
    prompt: str


class NaturalCommandResponse(BaseModel):
    action: str | None = None
    targets: list[str] = []
    payload: dict = {}
    commands: list[CommandResponse] = []
    error: str | None = None


# ---------- Audit ----------
class AuditLogResponse(BaseModel):
    id: str
    user_id: str
    device_id: str | None = None
    action: str
    detail: str | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}
