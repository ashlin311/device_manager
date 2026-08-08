import psutil
import platform
import socket


def collect_telemetry() -> dict:
    """Collect system telemetry data using psutil."""
    return {
        "cpu_usage": psutil.cpu_percent(interval=1),
        "ram_usage": psutil.virtual_memory().percent,
        "ram_total_gb": round(psutil.virtual_memory().total / 1e9, 1),
        "cpu_cores": psutil.cpu_count(),
        "ip_address": socket.gethostbyname(socket.gethostname()),
        "os": platform.system() + " " + platform.release(),
        "hostname": platform.node(),
    }
