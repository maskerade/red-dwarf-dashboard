#!/usr/bin/env python3
"""Starbug (NAS) data collector.
Fetches stats from the Asustor NAS via the Portainer API.
Outputs starbug.json alongside data.json for the dashboard.
"""

import json
import os
import sys
import pathlib
import ssl
from datetime import datetime, timezone
from urllib.request import Request, urlopen
from urllib.error import URLError

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(SCRIPT_DIR, "starbug.json")
PORTAINER_URL = "https://192.168.8.107:19943"

# Create unverified SSL context for self-signed certs
_ssl_ctx = ssl.create_default_context()
_ssl_ctx.check_hostname = False
_ssl_ctx.verify_mode = ssl.CERT_NONE

# Read API key from Hermes env
PORTAINER_KEY = ""
_env_path = pathlib.Path.home() / ".hermes" / ".env"
if _env_path.exists():
    for line in _env_path.read_text().splitlines():
        if line.startswith("PORTAINER_API_KEY="):
            PORTAINER_KEY = line.split("=", 1)[1].strip()

# Also check direct env
if not PORTAINER_KEY:
    PORTAINER_KEY = os.environ.get("PORTAINER_API_KEY", "")


def fetch_json(url, headers=None, timeout=15):
    try:
        req = Request(url, headers=headers or {})
        with urlopen(req, timeout=timeout, context=_ssl_ctx) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as exc:
        print(f"  [WARN] fetch_json failed: {url} — {exc}", file=sys.stderr)
        return None


def collect_starbug(api_key):
    """Fetch NAS stats via Portainer API."""
    headers = {"X-API-Key": api_key, "Content-Type": "application/json"}

    # Get endpoints (Docker environments)
    endpoints = fetch_json(f"{PORTAINER_URL}/api/endpoints", headers=headers)
    if not endpoints:
        return {"status": "offline", "error": "Cannot reach Portainer API"}

    local = None
    for ep in endpoints:
        if ep.get("Id") == 3 or ep.get("Name") == "local":
            local = ep
            break
    if not local:
        local = endpoints[0]

    eid = local["Id"]
    result = {
        "status": "online",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "docker": {
            "version": "",
            "containers": {"total": 0, "running": 0, "stopped": 0},
        },
        "system": {
            "cpu_count": 0,
            "memory_bytes": 0,
            "memory_gb": 0,
        },
    }

    # Get Docker info
    info = fetch_json(f"{PORTAINER_URL}/api/endpoints/{eid}/docker/info", headers=headers)
    if info:
        result["docker"]["version"] = info.get("ServerVersion", "")
        result["system"]["cpu_count"] = info.get("NCPU", 0)
        mem = info.get("MemTotal", 0)
        result["system"]["memory_bytes"] = mem
        result["system"]["memory_gb"] = round(mem / (1024**3), 1)

    # Get containers
    containers = fetch_json(
        f"{PORTAINER_URL}/api/endpoints/{eid}/docker/containers/json?all=true",
        headers=headers,
    )
    if containers:
        result["docker"]["containers"]["total"] = len(containers)
        running = [c for c in containers if c.get("State") == "running"]
        result["docker"]["containers"]["running"] = len(running)
        result["docker"]["containers"]["stopped"] = len(containers) - len(running)
        result["containers"] = []
        for c in containers:
            names = c.get("Names", ["?"])
            name = names[0].lstrip("/") if names else "?"
            result["containers"].append({
                "name": name,
                "state": c.get("State", "?"),
                "status": c.get("Status", "?"),
                "image": c.get("Image", "?"),
            })

    # Get system resources
    try:
        # Try Docker stats endpoint
        stats = fetch_json(
            f"{PORTAINER_URL}/api/endpoints/{eid}/docker/system/df",
            headers=headers,
        )
        if stats:
            layers = stats.get("LayersSize", 0)
            result["system"]["docker_disk_bytes"] = layers
            result["system"]["docker_disk_gb"] = round(layers / (1024**3), 1)
    except Exception:
        pass

    # Get NAS host info via Docker
    sys_info = fetch_json(
        f"{PORTAINER_URL}/api/endpoints/{eid}/docker/containers/json?all=true&filters=%7B%22name%22%3A%5B%22starbug-cockpit%22%5D%7D",
        headers=headers,
    )
    if sys_info:
        for c in sys_info:
            if "starbug-cockpit" in c.get("Names", [""])[0]:
                result["starbug_cockpit"] = {
                    "status": c.get("Status", "?"),
                    "state": c.get("State", "?"),
                }

    return result


def main():
    if not PORTAINER_KEY:
        print(
            "[WARN] PORTAINER_API_KEY not set. Set it in ~/.hermes/.env",
            file=sys.stderr,
        )
        data = {"status": "offline", "error": "No PORTAINER_API_KEY set"}
    else:
        print("[INFO] Collecting Starbug (NAS) data...", file=sys.stderr)
        data = collect_starbug(PORTAINER_KEY)

    print(f"[INFO] Writing {DATA_FILE}...", file=sys.stderr)
    with open(DATA_FILE, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"[INFO] Done. Data written: {DATA_FILE}", file=sys.stderr)
    print(json.dumps(data, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
