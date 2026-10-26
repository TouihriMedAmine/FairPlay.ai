import os
import subprocess
import uuid
import datetime
import requests
from pathlib import Path

# Directory to save samples
SAMPLES_DIR = Path("samples")
SAMPLES_DIR.mkdir(exist_ok=True)

# Duration of audio samples in seconds
SAMPLE_DURATION = 5

# List of radios with names and URLs
RADIO_STREAMS = [
    ("France Inter", "https://direct.franceinter.fr/live/franceinter-midfi.mp3"),
    ("Mosaique FM", "https://radio.mosaiquefm.net/mosalive"),
    ("Radio Nationale", "https://radio.radiotunisienne.tn/nationale"),
    ("Diwan FM", "https://streaming.diwanfm.net/stream"),
    ("Zaitouna FM", "https://radio.radiotunisienne.tn/radiozaitouna"),
    ("Express FM", "https://expressfm.ice.infomaniak.ch/expressfm-64.mp3"),
    ("Radio Jeunes", "http://rtstream.tanitweb.com/jeunes"),
    ("RTCI", "http://rtstream.tanitweb.com/rtci"),
    ("Radio Sfax", "http://rtstream.tanitweb.com/sfax"),
    ("Radio Monastir", "http://rtstream.tanitweb.com/monastir"),
    ("Oxygene FM", "https://streaming.radiooxygene.tn/oxygenefm"),
    ("Radio Le Kef", "https://radio.radiotunisienne.tn/kef"),
    ("Radio MFM", "https://stream.zeno.fm/ilg7ocmkwfgtv.m3u"),
    ("Radio Monastir", "https://radio.radiotunisienne.tn/monastir"),
    ("Culturelle RT", "http://rtstream.tanitweb.com/culturelle"),
    ("Knooz FM", "http://streaming.knoozfm.net:8000/knoozfm"),
    ("Misk FM", "https://live.misk.art/stream"),
    ("Radio IFM", "https://live.ifm.tn/radio/8000/ifmlive"),
]

def sanitize_filename(name: str) -> str:
    return name.lower().replace(" ", "_").replace("/", "_")

def record_sample(name: str, url: str, duration: int = SAMPLE_DURATION):
    print(f"\n📻 Recording sample from: {name}")
    timestamp = datetime.datetime.now().strftime("%H%M%S")
    filename = SAMPLES_DIR / f"{sanitize_filename(name)}_{uuid.uuid4().hex[:8]}.mp3"

    # Try to resolve real stream URL if it's a .m3u or .pls
    if url.endswith((".m3u", ".pls")):
        try:
            resp = requests.get(url, timeout=5)
            lines = [line.strip() for line in resp.text.splitlines() if line.strip()]
            for line in lines:
                if line.startswith("http"):
                    print(f"🔍 Resolved URL: {line}")
                    url = line
                    break
        except Exception as e:
            print(f"❌ Failed to resolve playlist: {e}")
            return False

    # Run ffmpeg command to capture stream
    try:
        subprocess.run([
            "ffmpeg", "-y",
            "-i", url,
            "-t", str(duration),
            "-loglevel", "error",
            str(filename)
        ], check=True, timeout=duration + 5)
        print(f"✅ Saved: {filename}")
        return True
    except subprocess.TimeoutExpired:
        print("❌ Timed out")
    except subprocess.CalledProcessError:
        print("❌ ffmpeg failed to record")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
    return False

def main():
    print(f"Starting radio extractor at {datetime.datetime.now()}\n")
    for name, url in RADIO_STREAMS:
        record_sample(name, url)

if __name__ == "__main__":
    main()
