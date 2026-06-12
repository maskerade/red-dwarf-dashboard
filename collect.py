#!/usr/bin/env python3
"""
Red Dwarf Dashboard — data collector.
Collects from Home Assistant, wttr.in weather, The Register headlines,
and generates a fresh crew quote via LLM.
Outputs data.json to the same directory.
"""

import json
import os
import sys
import pathlib
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from urllib.error import URLError
from urllib.request import Request, urlopen

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(SCRIPT_DIR, "data.json")
HASS_URL = "http://192.168.8.107:8123"

# Auto-load secrets from ~/.hermes/.env if not in environment
HASS_TOKEN = os.environ.get("HASS_TOKEN", "")
OPENROUTER_KEY = os.environ.get("OPENROUTER_API_KEY", "")

_env_path = pathlib.Path.home() / ".hermes" / ".env"
if _env_path.exists():
    for line in _env_path.read_text().splitlines():
        if line.startswith("HASS_TOKEN="):
            if not HASS_TOKEN:
                HASS_TOKEN = line.split("=", 1)[1].strip()
        elif line.startswith("OPENROUTER_API_KEY="):
            if not OPENROUTER_KEY:
                OPENROUTER_KEY = line.split("=", 1)[1].strip()


# ── helpers ──────────────────────────────────────────────────────────────


def fetch_json(url, headers=None, timeout=15):
    """Fetch a URL and parse JSON. Returns None on failure."""
    try:
        req = Request(url, headers=headers or {})
        with urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as exc:
        print(f"  [WARN] fetch_json failed: {url} — {exc}", file=sys.stderr)
        return None


def fetch_text(url, headers=None, timeout=15):
    """Fetch a URL and return raw text. Returns None on failure."""
    try:
        req = Request(url, headers=headers or {})
        with urlopen(req, timeout=timeout) as resp:
            return resp.read().decode("utf-8")
    except Exception as exc:
        print(f"  [WARN] fetch_text failed: {url} — {exc}", file=sys.stderr)
        return None


def safe_float(val):
    """Convert to float or None."""
    if val is None:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def post_json(url, data, headers=None, timeout=30):
    """POST JSON to a URL and parse JSON response. Returns None on failure."""
    try:
        body = json.dumps(data).encode("utf-8")
        req = Request(url, data=body, headers=headers or {}, method="POST")
        req.add_header("Content-Type", "application/json")
        with urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as exc:
        print(f"  [WARN] post_json failed: {url} — {exc}", file=sys.stderr)
        return None


# ── Home Assistant ───────────────────────────────────────────────────────
# sensor entity_id → data.json key path (dot-separated for nesting)
HASS_SENSORS = {
    "sensor.ws2900_v2_01_18_outdoor_temperature": ("house", "outdoor_temp"),
    "sensor.ws2900_v2_01_18_humidity": ("house", "outdoor_humidity"),
    "sensor.ws2900_v2_01_18_indoor_temperature": ("house", "indoor_temp"),
    "sensor.ws2900_v2_01_18_indoor_humidity": ("house", "indoor_humidity"),
    "sensor.ws2900_v2_01_18_wind_speed": ("house", "wind_speed"),
    "sensor.ws2900_v2_01_18_wind_direction": ("house", "wind_direction"),
    "sensor.ws2900_v2_01_18_daily_rain": ("house", "rain_today"),
    "sensor.ws2900_v2_01_18_relative_pressure": ("house", "pressure"),
    "sensor.ws2900_v2_01_18_uv_index": ("house", "uv_index"),
    "sensor.house_apparent_power": ("house", "power_usage"),
    "sensor.eph_controls_ember_gas_consumption": ("house", "gas_consumption"),
    "sensor.zone1_heating": ("house", "heating_active"),
    "sensor.metrolink_altrincham_message": ("metrolink",),
}


def collect_hass():
    """Fetch all HA sensors and return a flat dict of values."""
    if not HASS_TOKEN:
        print("  [WARN] HASS_TOKEN not set, skipping Home Assistant", file=sys.stderr)
        return {}

    headers = {
        "Authorization": f"Bearer {HASS_TOKEN}",
        "Content-Type": "application/json",
    }
    results = {}
    for entity_id in HASS_SENSORS:
        url = f"{HASS_URL}/api/states/{entity_id}"
        data = fetch_json(url, headers=headers)
        if data is not None:
            results[entity_id] = data.get("state")
        else:
            results[entity_id] = None
    return results


# ── Weather (wttr.in) ────────────────────────────────────────────────────

POSTCODES = {
    "altrincham": "WA15+9ER",
    "overseal": "DE12+6LJ",
    "llandudno": "LL30+1YD",
}


def collect_weather():
    """Fetch current weather for each postcode from wttr.in."""
    locations = {}
    for key, postcode in POSTCODES.items():
        url = f"https://wttr.in/{postcode}?format=j1"
        data = fetch_json(url)
        if data is None:
            locations[key] = {"temp": None, "conditions": None}
        else:
            try:
                cc = data["current_condition"][0]
                temp = safe_float(cc.get("temp_C"))
                conditions = cc.get("weatherDesc", [{}])[0].get("value")
                locations[key] = {"temp": temp, "conditions": conditions}
            except (KeyError, IndexError, TypeError) as exc:
                print(f"  [WARN] Failed to parse wttr.in data for {key}: {exc}", file=sys.stderr)
                locations[key] = {"temp": None, "conditions": None}
    return locations


# ── The Register headlines ──────────────────────────────────────────────

def collect_headlines():
    """Fetch the top headlines from The Register RSS feed."""
    text = fetch_text("https://www.theregister.com/headlines.atom")
    if text is None:
        return []

    headlines = []
    try:
        root = ET.fromstring(text)
        for item in root.iter("item"):
            title_el = item.find("title")
            if title_el is not None and title_el.text:
                headlines.append(title_el.text.strip())
            if len(headlines) >= 4:
                break
    except ET.ParseError as exc:
        print(f"  [WARN] Failed to parse RSS feed: {exc}", file=sys.stderr)
        return []
    return headlines


# ── Crew quote generation via LLM ───────────────────────────────────────

def generate_crew_quote(data):
    """Ask a lightweight LLM to generate a Red Dwarf crew quote referencing
    today's actual data (weather, house stats, headlines).
    Falls back to a sensible default if the API call fails."""
    if not OPENROUTER_KEY:
        print("  [WARN] OPENROUTER_API_KEY not set, skipping crew quote generation", file=sys.stderr)
        return None

    # Build a prompt with today's data
    house = data.get("house", {})
    locations = data.get("locations", {})
    headlines = data.get("headlines", [])

    weather_str = "; ".join(
        f"{loc}: {v.get('temp', '?')}°C, {v.get('conditions', '?')}"
        for loc, v in locations.items() if v.get('temp') is not None
    ) or "no weather data"

    headline_str = "; ".join(headlines[:2]) if headlines else "no headlines"

    prompt = (
        "You are the ship's computer from Red Dwarf. Generate ONE short, authentic "
        "in-character quote (1-2 sentences) from one of the crew — Holly, Rimmer, "
        "Kryten, Cat, or Lister — that references today's real conditions:\n"
        f"\n"
        f"Weather: {weather_str}\n"
        f"Indoor temp: {house.get('indoor_temp', '?')}°C, humidity: {house.get('indoor_humidity', '?')}%\n"
        f"Power usage: {house.get('power_usage', '?')} kWh\n"
        f"News: {headline_str}\n"
        f"\n"
        "Rules:\n"
        "- Output ONLY the quote text, nothing else. No labels, no character name prefix.\n"
        "- Wrap the quote in double quotes.\n"
        "- The character's personality must be obvious from the voice alone.\n"
        "- Reference one of the data points naturally (not like a list).\n"
        "- Keep it 1-2 sentences, under 200 characters.\n"
        "- Holly: spaced-out and cheerful. Rimmer: pompous and wrong.\n"
        "- Kryten: polite and obsessive. Cat: vain and fabulous.\n"
        "- Lister: casual, working-class, mentions curry if it fits.\n"
    )

    payload = {
        "model": "openai/gpt-4o-mini",
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 120,
        "temperature": 0.9,
    }

    headers = {
        "Authorization": f"Bearer {OPENROUTER_KEY}",
        "Content-Type": "application/json",
    }

    result = post_json(
        "https://openrouter.ai/api/v1/chat/completions",
        payload,
        headers=headers,
        timeout=20,
    )

    if result is None:
        print("  [WARN] LLM quote generation failed — no response", file=sys.stderr)
        return None

    try:
        quote = result["choices"][0]["message"]["content"].strip()
        if quote:
            print(f"  [INFO] Generated quote: {quote}", file=sys.stderr)
            return quote
    except (KeyError, IndexError, TypeError) as exc:
        print(f"  [WARN] Failed to parse LLM response: {exc}", file=sys.stderr)

    return None


# ── main ─────────────────────────────────────────────────────────────────

def build_data():
    """Assemble the full data.json document."""
    print("[INFO] Starting data collection...", file=sys.stderr)

    print("[INFO] Collecting Home Assistant sensors...", file=sys.stderr)
    hass_values = collect_hass()

    print("[INFO] Collecting weather data from wttr.in...", file=sys.stderr)
    locations = collect_weather()

    print("[INFO] Fetching The Register headlines...", file=sys.stderr)
    headlines = collect_headlines()

    # ── Build the data dict ──────────────────────────────────────────────
    data = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "house": {
            "indoor_temp": None,
            "indoor_humidity": None,
            "outdoor_temp": None,
            "outdoor_humidity": None,
            "wind_speed": None,
            "wind_direction": None,
            "pressure": None,
            "rain_today": None,
            "uv_index": None,
            "power_usage": None,
            "gas_consumption": None,
            "heating_active": None,
        },
        "locations": locations,
        "metrolink": None,
        "headlines": headlines,
        "crew_quote": None,
    }

    # Map HA results into data
    for entity_id, keys in HASS_SENSORS.items():
        raw = hass_values.get(entity_id)
        if raw is None:
            continue

        if entity_id == "sensor.zone1_heating":
            value = raw.lower() in ("on", "yes", "true", "1")
        elif entity_id == "sensor.metrolink_altrincham_message":
            value = str(raw)
        else:
            value = safe_float(raw)
            if value is None:
                value = raw

        if len(keys) == 2:
            data[keys[0]][keys[1]] = value
        elif len(keys) == 1:
            data[keys[0]] = value

    # ── Generate crew quote ──────────────────────────────────────────────
    print("[INFO] Generating crew quote via LLM...", file=sys.stderr)
    quote = generate_crew_quote(data)
    if quote:
        data["crew_quote"] = quote

    return data


def main():
    data = build_data()

    print(f"[INFO] Writing {DATA_FILE}...", file=sys.stderr)
    with open(DATA_FILE, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"[INFO] Done. Data written: {DATA_FILE}", file=sys.stderr)
    print(json.dumps(data, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()