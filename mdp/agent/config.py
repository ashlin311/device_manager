import os
from dotenv import load_dotenv

load_dotenv()

SERVER_URL = os.getenv("SERVER_URL", "http://localhost:8000")
DEVICE_NAME = os.getenv("DEVICE_NAME", "dev-machine-1")
