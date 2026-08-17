# Device Management Platform

A Unified Endpoint Management (UEM) system for real-time remote device control. Admins can monitor registered devices, issue commands, and query the system using plain English.

---

## Architecture

```
mdp/
  backend/    FastAPI — REST API, WebSocket hub, LLM integration, Alembic migrations
  frontend/   React — admin dashboard with live device status and audit log
  agent/      Python agent that runs on each managed device
```

---

## How it works

**Registration and heartbeat**
Each device runs the agent, which self-registers with the backend and sends telemetry (CPU, RAM, IP) every 30 seconds. Devices missing a heartbeat for more than 90 seconds are marked offline automatically.

**Command dispatch**
Admins issue commands through the dashboard. The backend persists the command, pushes it to the target agent over a persistent WebSocket connection, and waits for the agent to report the result. Supported actions: `restart`, `lock`, `rename`, `notify`.

**Natural language commands**
Admins can type a plain-English instruction. The backend sends it to a Qwen2.5-7B-Instruct-AWQ model hosted on Modal (via vLLM) which resolves the intent into a structured command targeting specific device UUIDs.

**Real-time updates**
The admin dashboard maintains a WebSocket connection to the backend. Device status changes and command completions are pushed instantly without polling.

**Audit log**
Every command issued and completed is recorded against the user and device for traceability.

---

## Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI, SQLAlchemy (async), PostgreSQL, Alembic |
| Frontend | React, Vite |
| Agent | Python, asyncio, websockets, psutil |
| LLM inference | Qwen2.5-7B-Instruct-AWQ on Modal (vLLM) |
| Real-time | WebSockets (native FastAPI) |

---

## Running locally

```bash
# Backend
cd mdp/backend
uvicorn main:app --reload --port 8000

# Frontend
cd mdp/frontend
npm run dev

# Agent (one instance per device)
cd mdp/agent
python agent.py
```

The LLM endpoint requires a deployed Modal function. Set `MODAL_ENDPOINT_URL` in `mdp/backend/.env`.
