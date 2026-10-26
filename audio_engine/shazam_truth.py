"""Ground-truth check: what does Shazam say a real FM segment contains?"""

import base64 as b64
import json
import os
import time
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

repo = Path(__file__).resolve().parent.parent
cfg = json.loads((repo / "config.json").read_text(encoding="utf-8-sig"))

HEADERS = {
    "content-type": "text/plain",
    "X-RapidAPI-Key": os.getenv("RAPIDAPI_KEY") or cfg.get("API_KEY"),
    "X-RapidAPI-Host": "shazam.p.rapidapi.com",
}

segments = [
    repo / "recordings" / "segments" / "mosaique_fm" / "seg_000002057.wav",
    repo / "recordings" / "segments" / "diwan_fm" / "seg_000002101.wav",
    repo / "recordings" / "segments" / "express_fm" / "seg_000002101.wav",
    repo / "recordings" / "segments" / "france_inter" / "seg_000002105.wav",
    repo / "recordings" / "segments" / "rtci" / "seg_000002114.wav",
]

for seg in segments:
    if not seg.exists():
        print(f"[skip] {seg}")
        continue
    data = seg.read_bytes()
    r = requests.post("https://shazam.p.rapidapi.com/songs/detect",
                      data=b64.b64encode(data).decode(), headers=HEADERS, timeout=15)
    if r.status_code == 200 and isinstance(r.json(), dict) and r.json().get("track"):
        t = r.json()["track"]
        print(f"[SHAZAM] {seg.parent.name}/{seg.name}: {t.get('title')} - {t.get('subtitle')}")
    else:
        print(f"[shazam-nomatch {r.status_code}] {seg.parent.name}/{seg.name}")
    time.sleep(2)
