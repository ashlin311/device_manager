import asyncio
import json
import time
import httpx
import websockets

from config import SERVER_URL, DEVICE_NAME
from telemetry import collect_telemetry


device_id = None


def execute_command(action: str, payload: dict) -> dict:
    """Simulate command execution (no real system actions)."""
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


async def register_device() -> str:
    """Register the device with the backend server."""
    telemetry = collect_telemetry()
    data = {
        "name": DEVICE_NAME,
        **telemetry,
    }
    async with httpx.AsyncClient() as client:
        response = await client.post(f"{SERVER_URL}/devices/register", json=data)
        response.raise_for_status()
        result = response.json()
        return result["device_id"]


async def send_heartbeat():
    """Send heartbeat with telemetry data every 30 seconds."""
    global device_id
    while True:
        await asyncio.sleep(30)
        try:
            telemetry = collect_telemetry()
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{SERVER_URL}/devices/{device_id}/heartbeat",
                    json=telemetry,
                )
                response.raise_for_status()
                print(f"[HEARTBEAT] Sent — CPU: {telemetry['cpu_usage']}%, RAM: {telemetry['ram_usage']}%")
        except Exception as e:
            print(f"[HEARTBEAT] Error: {e}")


async def report_command_result(command_id: str, result: dict):
    """Report command execution result back to the server."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{SERVER_URL}/commands/{command_id}/result",
            json=result,
        )
        response.raise_for_status()
        print(f"[COMMAND] Reported result for {command_id}: {result['status']}")


async def listen_for_commands():
    """Connect to the agent WebSocket and listen for dispatched commands."""
    global device_id
    ws_url = SERVER_URL.replace("http://", "ws://").replace("https://", "wss://")
    ws_url = f"{ws_url}/ws/agent/{device_id}"

    while True:
        try:
            async with websockets.connect(ws_url) as ws:
                print(f"[WS] Connected to {ws_url}")
                while True:
                    message = await ws.recv()
                    data = json.loads(message)
                    print(f"[WS] Received command: {data}")

                    command_id = data.get("command_id")
                    action = data.get("action")
                    payload = data.get("payload", {})

                    # Execute command (simulated)
                    result = execute_command(action, payload)

                    # Report result back to server
                    await report_command_result(command_id, result)

        except Exception as e:
            print(f"[WS] Disconnected: {e}. Reconnecting in 5 seconds...")
            await asyncio.sleep(5)


async def main():
    global device_id

    print("=" * 50)
    print(f"  MDP Agent — {DEVICE_NAME}")
    print(f"  Server: {SERVER_URL}")
    print("=" * 50)

    # Step 1: Register device
    print("[STARTUP] Collecting telemetry...")
    device_id = await register_device()
    print(f"[STARTUP] Registered as device_id: {device_id}")

    # Step 2: Start heartbeat loop and WebSocket listener concurrently
    print("[STARTUP] Starting heartbeat loop and command listener...")
    await asyncio.gather(
        send_heartbeat(),
        listen_for_commands(),
    )


if __name__ == "__main__":
    asyncio.run(main())
