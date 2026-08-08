# Mini Device Management Platform (MDP) — Agent Instructions

## Project overview

You are building a simplified Unified Endpoint Management (UEM) system. This is a resume-worthy project that demonstrates backend architecture, real-time communication, and LLM integration. The goal is a working, demonstrable system — not a production-grade enterprise product.

---

## Strict scope rules

Do not add anything not listed in this document. If a feature, library, or pattern is not mentioned here, do not include it. When in doubt, do less.

Do not introduce:
- Background task queues (Celery, RQ, etc.)
- Redis or any caching layer
- Email sending or notifications
- Device grouping or policies
- File uploads
- Pagination (keep device count small for demo purposes)
- Rate limiting
- Unit tests unless explicitly asked
- Docker until the core system is working end to end

---

## Tech stack — fixed, do not change

| Layer | Technology |
|---|---|
| Backend | FastAPI |
| Agent | Python script |
| Database | PostgreSQL |
| ORM | SQLAlchemy (async) + Alembic for migrations |
| Auth | JWT via `python-jose` + `passlib` for password hashing |
| Real-time | WebSockets — FastAPI native, no third-party library |
| LLM | Llama 3.1:8b hosted on Modal |
| Frontend | React (Vite) |
| Deployment | Docker + Docker Compose (added last) |

---

## Folder structure

```
mdp/
├── backend/
│   ├── main.py                  # FastAPI app entry point
│   ├── config.py                # Settings via pydantic-settings
│   ├── database.py              # SQLAlchemy async engine + session
│   ├── models.py                # SQLAlchemy ORM models
│   ├── schemas.py               # Pydantic request/response schemas
│   ├── auth/
│   │   ├── router.py            # /auth/login, /auth/me
│   │   └── utils.py             # JWT encode/decode, password hash
│   ├── devices/
│   │   └── router.py            # /devices CRUD + heartbeat
│   ├── commands/
│   │   └── router.py            # /commands issue + status
│   ├── llm/
│   │   └── service.py           # Modal API call + intent parsing
│   ├── websocket/
│   │   ├── manager.py           # ConnectionManager class
│   │   └── router.py            # /ws/admin, /ws/agent/{device_id}
│   └── audit/
│       └── router.py            # /audit/logs
├── agent/
│   ├── agent.py                 # Main agent loop
│   ├── telemetry.py             # psutil data collection
│   └── config.py                # Agent settings (server URL, device name)
├── frontend/
│   └── (Vite React app)
└── docker-compose.yml           # Added last
```

---

## Database schema

Four tables only. Do not add more.

### users
```
id              UUID primary key
email           string unique
hashed_password string
created_at      timestamp default now
```

### devices
```
id              UUID primary key
name            string
hostname        string
os              string
status          string          -- "online" | "offline" | "unreachable"
cpu_usage       float
ram_usage       float
ram_total_gb    float
cpu_cores       integer
ip_address      string
last_seen       timestamp
registered_at   timestamp default now
```

### commands
```
id              UUID primary key
device_id       UUID foreign key → devices.id
issued_by       UUID foreign key → users.id
action          string          -- "restart" | "lock" | "rename" | "notify"
payload         JSON            -- e.g. {"new_name": "vm-renamed"}
status          string          -- "pending" | "dispatched" | "completed" | "failed"
result          string nullable
issued_at       timestamp default now
completed_at    timestamp nullable
```

### audit_logs
```
id              UUID primary key
user_id         UUID foreign key → users.id
device_id       UUID foreign key nullable → devices.id
action          string
detail          string
created_at      timestamp default now
```

---

## API endpoints

### Auth
```
POST   /auth/login          body: {email, password} → {access_token}
GET    /auth/me             header: Bearer token    → {id, email}
```

### Devices
```
POST   /devices/register    Agent calls this on startup → {device_id}
POST   /devices/{id}/heartbeat  Agent calls every 30s with telemetry
GET    /devices             Admin fetches full device list
GET    /devices/{id}        Admin fetches single device
```

### Commands
```
POST   /commands                     Admin issues a single-device command via UI button → {command_id}
                                     body: {device_id, action, payload}
POST   /commands/{id}/result         Agent reports command outcome
GET    /commands/{id}                Poll command status
```

### Bulk operations (LLM)
```
POST   /commands/bulk                body: {prompt} → LLM filters devices → issues command to each target
                                     Returns list of command_ids, one per matched device
```

### Audit
```
GET    /audit/logs          Admin fetches audit log
```

### WebSocket
```
WS     /ws/admin            Frontend connects — receives live device updates
WS     /ws/agent/{device_id}  Agent connects — receives dispatched commands
```

---

## WebSocket behavior

**Admin WebSocket** (`/ws/admin`):
- Backend pushes a message whenever any device's status changes or a command completes
- Message format: `{"type": "device_update", "device": {...}}` or `{"type": "command_update", "command": {...}}`
- Frontend receives and updates UI state

**Agent WebSocket** (`/ws/agent/{device_id}`):
- Agent connects on startup and keeps the connection alive
- Backend pushes a command when one is dispatched: `{"command_id": "...", "action": "restart", "payload": {}}`
- Agent executes (simulated), then calls `POST /commands/{id}/result` with outcome

Use a simple `ConnectionManager` class in `websocket/manager.py` with:
- `connect(websocket, client_id)`
- `disconnect(client_id)`
- `send(client_id, message)`
- `broadcast(message)`

No third-party WebSocket libraries. FastAPI's native WebSocket support is sufficient.

---

## LLM integration

**Model:** Llama 3.1:8b  
**Host:** Modal  
**Purpose:** Handle bulk operations only — filter devices by condition and return target device IDs

Single-device commands (restart, lock, rename, notify) are handled via UI buttons on the device card and device detail page. The LLM is only invoked when the admin types a natural language instruction targeting multiple devices based on a condition.

Examples of what goes through the LLM:
- "restart all devices that have been offline for more than 2 hours"
- "lock all devices where CPU usage is above 85%"
- "notify all devices running Ubuntu"
- "restart all VMs"

### Modal setup
- Deploy a Modal app that loads Llama 3.1:8b and exposes an HTTP endpoint
- FastAPI calls that endpoint via `httpx` (async HTTP client)
- Modal docs: https://modal.com/docs/guide
- Modal function serving: https://modal.com/docs/guide/webhooks

### Prompt sent to LLM
```
You are a device management assistant. Return ONLY a valid JSON object, no explanation, no markdown, no backticks.

You will receive a list of devices with their current telemetry and a bulk operation instruction from the admin.
Your job is to identify which devices match the condition in the instruction and return their IDs.

Available devices:
{device_list_as_json}

Each device has: id, name, hostname, os, status ("online"|"offline"|"unreachable"), cpu_usage (%), ram_usage (%), last_seen (ISO timestamp).

Admin instruction: "{user_prompt}"

Return format:
{
  "action": "restart" | "lock" | "rename" | "notify",
  "targets": ["device-id-1", "device-id-2"],
  "payload": {}
}

Rules:
- targets must be a list of device UUIDs from the available devices list only — do not invent IDs
- payload is only needed for "rename" (include new_name) and "notify" (include message)
- for time-based conditions like "offline for more than 2 hours", compare last_seen against the current time provided
- if no devices match the condition, return {"error": "no devices match the condition"}
- if the instruction is ambiguous or cannot be resolved, return {"error": "reason"}
- never target all devices unless the instruction explicitly says so
```

Pass current UTC time alongside the device list so the LLM can resolve time-based conditions:
```python
import json
from datetime import datetime, timezone

context = {
    "current_time": datetime.now(timezone.utc).isoformat(),
    "devices": device_list
}
# inject into prompt as json.dumps(context)
```

### Parsing the response
```python
import json

raw = response.text.strip()
raw = raw.replace("```json", "").replace("```", "").strip()
parsed = json.loads(raw)
```

Always wrap in try/except. If parsing fails, return a 400 error to the frontend with the raw LLM output for debugging.

---

## Agent behavior

The agent is a Python script, not a service or daemon. Run it with `python agent.py`.

### Startup sequence
1. Read config (server URL, device name) from environment variables or `config.py`
2. Collect telemetry via psutil
3. `POST /devices/register` — get back a `device_id`
4. Store `device_id` in memory for the session
5. Connect to `WS /ws/agent/{device_id}`
6. Start heartbeat loop (every 30 seconds in a background thread or asyncio task)

### Heartbeat payload
```python
import psutil, platform

{
  "cpu_usage": psutil.cpu_percent(interval=1),
  "ram_usage": psutil.virtual_memory().percent,
  "ram_total_gb": round(psutil.virtual_memory().total / 1e9, 1),
  "cpu_cores": psutil.cpu_count(),
  "ip_address": socket.gethostbyname(socket.gethostname()),
  "os": platform.system() + " " + platform.release(),
  "hostname": platform.node()
}
```

### Simulated command execution
```python
def execute_command(action, payload):
    if action == "restart":
        time.sleep(2)
        return {"status": "completed", "result": "Simulated restart complete"}
    elif action == "lock":
        return {"status": "completed", "result": "Simulated lock applied"}
    elif action == "rename":
        return {"status": "completed", "result": f"Renamed to {payload.get('new_name')}"}
    elif action == "notify":
        print(f"[NOTIFICATION] {payload.get('message')}")
        return {"status": "completed", "result": "Notification displayed"}
    else:
        return {"status": "failed", "result": "Unknown action"}
```

Do not perform any real system actions. Simulation only.

---

## Device status tracking

A background task in FastAPI checks every 60 seconds:
- Any device with `last_seen` older than 90 seconds → set status to `offline`
- Use FastAPI's `lifespan` for startup/shutdown events to run this task

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
import asyncio

@asynccontextmanager
async def lifespan(app: FastAPI):
    asyncio.create_task(check_device_status())
    yield

async def check_device_status():
    while True:
        await asyncio.sleep(60)
        # query devices where last_seen < now - 90s, update status to offline
        # push update to /ws/admin
```

---

## Auth implementation

- Passwords hashed with `passlib` (bcrypt)
- JWT tokens signed with a secret key from environment variable
- Token expiry: 24 hours
- Protected endpoints use a FastAPI dependency `get_current_user`

```python
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

async def get_current_user(token: str = Depends(oauth2_scheme)):
    # decode JWT, return user or raise 401
```

Agents do not use JWT. They authenticate by device_id only — the device_id is their identity. Do not add token auth to agents; it overcomplicates the setup.

---

## Frontend pages

Four pages only:

| Page | Route | Description |
|---|---|---|
| Login | `/login` | Email + password form, stores JWT in memory |
| Dashboard | `/` | Device cards with live status, bulk operation input at top |
| Device detail | `/devices/:id` | Single device telemetry + command history |
| Audit log | `/audit` | Table of all admin actions |

Use React Context for auth state. Use native WebSocket API (no socket.io). Use `fetch` for REST calls (no axios unless you already have it).

Store JWT in memory (a React state variable or context), not localStorage.

---

## Environment variables

### Backend `.env`
```
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/mdp
SECRET_KEY=your-secret-key-here
MODAL_ENDPOINT_URL=https://your-modal-endpoint.modal.run
```

### Agent `.env`
```
SERVER_URL=http://192.168.x.x:8000
DEVICE_NAME=ashlin-vm1
```

---

## External API documentation

| Service | Purpose | Docs |
|---|---|---|
| Modal | Host Llama 3.1:8b | https://modal.com/docs/guide |
| Modal webhooks | Expose model as HTTP endpoint | https://modal.com/docs/guide/webhooks |
| FastAPI WebSockets | Native WS support | https://fastapi.tiangolo.com/advanced/websockets/ |
| FastAPI lifespan | Background startup tasks | https://fastapi.tiangolo.com/advanced/events/ |
| SQLAlchemy async | Async ORM | https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html |
| Alembic | DB migrations | https://alembic.sqlalchemy.org/en/latest/tutorial.html |
| python-jose | JWT | https://python-jose.readthedocs.io/en/latest/ |
| passlib | Password hashing | https://passlib.readthedocs.io/en/stable/ |
| psutil | System telemetry | https://psutil.readthedocs.io/en/latest/ |

---

## Build order

Build in this order. Do not skip ahead.

1. Database models + Alembic migration
2. Auth endpoints (login, me)
3. Device registration + heartbeat endpoint
4. WebSocket manager + agent WebSocket endpoint
5. Agent script (register, heartbeat, listen for commands)
6. Command dispatch endpoint
7. Device status background task
8. Audit log writes (add to existing endpoints, not a separate pass)
9. LLM service + `/commands/natural` endpoint
10. React frontend (login → dashboard → device detail → audit log)
11. Docker Compose (last, after everything works locally)

---

## What this project demonstrates

- Client-server architecture with real-time communication
- Device telemetry pipeline
- JWT authentication
- WebSocket connection management
- LLM integration for natural language bulk operations
- Audit logging
- Async Python backend