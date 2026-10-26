import os
import time
import uuid
import requests
import json
import base64
import librosa
import numpy as np
from pydub import AudioSegment
from tensorflow.keras.models import load_model
from datetime import datetime, timedelta, timezone

# 🎵 Constants
SAMPLE_RATE = 22050
DURATION = 5  # seconds
MFCC_FEATURES = 40
MAX_PAD_LEN = 130
RECORDINGS_DIR = "recordings"
os.makedirs(RECORDINGS_DIR, exist_ok=True)

# Load API key from config.json
try:
    with open("config.json", "r") as f:
        config = json.load(f)
    import os
    from dotenv import load_dotenv
    load_dotenv()
    API_KEY = os.getenv('RAPIDAPI_KEY') or config.get("API_KEY")
    if not API_KEY:
        raise ValueError("RAPIDAPI_KEY not found in .env")
except Exception as e:
    raise RuntimeError(f"[ERROR] Cannot load API key: {e}")

# Base URL for your local DB
BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:8000")

# Test database connection
def test_database_connection():
    try:
        response = requests.get(f"{BASE_URL}/api/songplayed/", timeout=5)
        if response.status_code == 200:
            print(f"✅ Database connection successful: {BASE_URL}")
            return True
        else:
            print(f"⚠️ Database responded with status {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print(f"❌ Cannot connect to database at {BASE_URL}")
        print("Make sure your Django server is running: python manage.py runserver")
        return False
    except Exception as e:
        print(f"❌ Database connection test failed: {e}")
        return False

# Radio stations
radio_stations = [
    {"name": "France Inter", "url": "http://icecast.radiofrance.fr/franceinter-midfi.mp3"},
    {"name": "Mosaique FM", "url": "https://radio.mosaiquefm.net/mosalive.m3u"},
    {"name": "Jawhara FM", "url": "http://streaming2.toutech.net:8000/jawharafm.m3u"},
    {"name": "IFM", "url": "https://live.ifm.tn/radio/8000/ifmlive?1585267848.m3u"},
    {"name": "Radio Nationale", "url": "http://rtstream.tanitweb.com/nationale.m3u"},
]

# Load music classifier model
model_path = os.getenv("MODEL_PATH", "./backend/model/music_classifier_model.h5")
model = load_model(model_path, compile=False)

# Shazam API
SHAZAM_URL = "https://shazam.p.rapidapi.com/songs/detect"
SHAZAM_HEADERS = {
    "content-type": "text/plain",
    "X-RapidAPI-Key": API_KEY,
    "X-RapidAPI-Host": "shazam.p.rapidapi.com"
}

# MFCC extraction
def extract_features(file_path, duration=DURATION, sr=SAMPLE_RATE, n_mfcc=MFCC_FEATURES, max_pad_len=MAX_PAD_LEN):
    try:
        signal, _ = librosa.load(file_path, sr=sr, duration=duration)
        mfcc = librosa.feature.mfcc(y=signal, sr=sr, n_mfcc=n_mfcc)
        if mfcc.shape[1] < max_pad_len:
            pad_width = max_pad_len - mfcc.shape[1]
            mfcc = np.pad(mfcc, pad_width=((0, 0), (0, pad_width)), mode="constant")
        else:
            mfcc = mfcc[:, :max_pad_len]
        return mfcc.T
    except Exception as e:
        print(f"[ERROR] Feature extraction failed: {e}")
        return None

# Convert audio to base64 WAV for Shazam
def convert_audio_to_base64(file_path):
    try:
        audio = AudioSegment.from_file(file_path)
        audio = audio.set_channels(1).set_frame_rate(44100)
        audio = audio[:DURATION * 1000]
        wav_path = file_path.replace(".mp3", ".wav")
        audio.export(wav_path, format="wav")
        with open(wav_path, "rb") as f:
            return base64.b64encode(f.read()).decode("utf-8")
    except Exception as e:
        print(f"[ERROR] Base64 conversion failed: {e}")
        return None

# Send song to database
def send_song_to_database(song_data, radio_name):
    track = song_data.get("track", {})
    artist = track.get("subtitle", "Unknown Artist")
    title = track.get("title", "Unknown Title")
    
    # Safely extract album information
    album = "Unknown Album"
    try:
        sections = track.get("sections", [])
        if sections and len(sections) > 0:
            metadata = sections[0].get("metadata", [])
            if metadata and len(metadata) > 0:
                album = metadata[0].get("text", "Unknown Album")
    except (IndexError, KeyError, TypeError):
        album = "Unknown Album"
    
    payload = {"title": title, "artist": artist, "album": album, "radio_name": radio_name}
    
    # Try different approaches for the API call
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "FairPlay-AI/1.0"
    }
    
    try:
        # First try with JSON payload
        response = requests.post(f"{BASE_URL}/api/songplayed/", json=payload, headers=headers)
        
        if response.status_code == 201:
            print(f"✅ Added: {title} by {artist} on {radio_name}")
        elif response.status_code == 403:
            print(f"[ERROR] DB insert failed: 403 Forbidden - Check Django settings for CSRF/CORS")
            print(f"[DEBUG] Response: {response.text}")
        elif response.status_code == 400:
            print(f"[ERROR] DB insert failed: 400 Bad Request - Invalid data format")
            print(f"[DEBUG] Response: {response.text}")
        else:
            print(f"[ERROR] DB insert failed: {response.status_code}")
            print(f"[DEBUG] Response: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print(f"[ERROR] Cannot connect to database at {BASE_URL}")
    except Exception as e:
        print(f"[ERROR] Database request failed: {e}")

# Cooldowns
skip_stations_until = {}
api_rate_limit_until = None

# Test database connection before starting
print("🔍 Testing database connection...")
if not test_database_connection():
    print("❌ Database connection failed. Please check your Django server.")
    exit(1)

# Main loop
while True:
    if api_rate_limit_until and datetime.now() < api_rate_limit_until:
        print("⏳ Waiting for API rate limit...")
        time.sleep(10)
        continue

    for station in radio_stations:
        radio_name = station["name"]
        station_url = station["url"]
        now = datetime.now()

        if radio_name in skip_stations_until and now < skip_stations_until[radio_name]:
            continue

        # Resolve .m3u playlist
        if station_url.endswith(".m3u"):
            try:
                res = requests.get(station_url, timeout=5)
                for line in res.text.splitlines():
                    if line.strip().startswith("http"):
                        station_url = line.strip()
                        break
            except:
                print(f"[ERROR] Failed to resolve playlist for {radio_name}")
                continue

        filename = os.path.join(RECORDINGS_DIR, f"{radio_name.replace(' ', '_')}_{int(time.time())}.mp3")
        try:
            r = requests.get(station_url, stream=True, timeout=10)
            with open(filename, "wb") as f:
                for block in r.iter_content(1024):
                    if block:
                        f.write(block)
                    if os.path.getsize(filename) > SAMPLE_RATE * DURATION * 2:  # roughly 5s
                        break
        except Exception as e:
            print(f"[ERROR] Failed to record {radio_name}: {e}")
            continue

        print(f"💾 Saved segment: {filename}")

        # Extract MFCC and classify
        features = extract_features(filename)
        if features is None:
            continue

        features = np.expand_dims(features, axis=0)
        try:
            prediction = model.predict(features)
        except Exception as e:
            print(f"[ERROR] Failed to classify audio: {e}")
            continue

        if np.argmax(prediction) == 1:  # music detected
            print("🎵 Music detected.")
            base64_audio = convert_audio_to_base64(filename)
            if base64_audio:
                try:
                    response = requests.post(SHAZAM_URL, data=base64_audio, headers=SHAZAM_HEADERS)
                    if response.status_code == 200:
                        song_data = response.json()
                        print(f"🔍 Shazam response: {song_data}")  # Debug output
                        try:
                            send_song_to_database(song_data, radio_name)
                            skip_stations_until[radio_name] = now + timedelta(seconds=180)
                        except Exception as db_error:
                            print(f"[ERROR] Database operation failed: {db_error}")
                            print(f"💾 Saved recording (DB error): {filename}")
                    elif response.status_code == 429:
                        print("🚫 Shazam rate limit hit!")
                        api_rate_limit_until = now + timedelta(minutes=5)
                        break
                    else:
                        print(f"[ERROR] Shazam API returned {response.status_code}")
                        print(f"💾 Saved recording (API error): {filename}")
                except Exception as e:
                    print(f"[ERROR] Shazam request failed: {e}")
                    print(f"💾 Saved recording (request error): {filename}")
        else:
            print("🔇 Non-music detected.")
            os.remove(filename)

    # print("⏱ Waiting 180s before next check...")
    # time.sleep(180)
