# Red Dwarf Dashboard data schema
# Each run produces data.json with this structure:
{
  "timestamp": "ISO datetime",
  "house": {
    "indoor_temp": null,
    "indoor_humidity": null,
    "outdoor_temp": null,
    "outdoor_humidity": null,
    "wind_speed": null,
    "wind_direction": null,
    "pressure": null,
    "rain_today": null,
    "uv_index": null,
    "power_usage": null,
    "gas_consumption": null,
    "heating_active": null
  },
  "locations": {
    "altrincham": {"temp": null, "conditions": null},
    "overseal": {"temp": null, "conditions": null},
    "llandudno": {"temp": null, "conditions": null}
  },
  "metrolink": null,
  "headlines": [],
  "crew_quote": null
}
