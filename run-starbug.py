#!/usr/bin/env python3
"""Starbug runner with embedded API key."""
import base64, os, subprocess, sys

# Decode key — don't log it
os.environ["PORTAINER_API_KEY"] = base64.b64decode(
    "cHRyX2pjSDJGUzhIK2tuR20xdVRsVmExa2NqVGxZQ1hrdkF5VnVNcDJoNGI1NjA9"
).decode()

result = subprocess.run(
    [sys.executable, "/Users/stefan/red-dwarf-dashboard/starbug-collect.py"],
    capture_output=True, text=True
)
print(result.stdout)
if result.stderr:
    print(result.stderr, file=sys.stderr)
