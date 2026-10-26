#!/usr/bin/env python3
"""
Simple radio listener for IFM that:
  - Captures 1s segments via ffmpeg
  - Builds 5s windows
  - Computes embedding (model/embedding_model.keras) for each window
  - Compares each 5s window embedding to the previous window embedding and prints similarity

No CLI args. Run directly:  python model/radio_compare_simple.py
"""

import os
import sys
import time
import subprocess
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Tuple

import numpy as np
import librosa
from pydub import AudioSegment
import tensorflow as tf
import zipfile
import tempfile


# Console unicode safety (Windows)
try:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass


# Simple timestamped debug printer
def dbg(msg: str):
    try:
        print(f"[DBG {datetime.now(timezone.utc).isoformat()}] {msg}", flush=True)
    except Exception:
        try:
            print(f"[DBG] {msg}", flush=True)
        except Exception:
            pass


# Paths
REPO_ROOT = Path(__file__).resolve().parents[2]
MODEL_DIR = REPO_ROOT / "backend" / "model"

EMBED_MODEL_PATH = MODEL_DIR / "embedding_model.keras"

# Stream
STATION_NAME = "IFM"
STATION_URL = "https://live.ifm.tn/radio/8000/ifmlive"

# Segmenting/storage
RECORDINGS_DIR = REPO_ROOT / "recordings"
SEGMENT_DIR = RECORDINGS_DIR / "segments"
RECORDINGS_DIR.mkdir(exist_ok=True)
SEGMENT_DIR.mkdir(exist_ok=True, parents=True)

 # Window size (seconds)
DURATION_SEC = 5

# Embedding settings (should match embedding model training)
EMB_SR = 22050
EMB_N_MELS = 64
EMB_N_FFT = 1024
EMB_HOP_LENGTH = 512
SIMILARITY_THRESHOLD = float(os.getenv("SIMILARITY_THRESHOLD", "0.70"))


def start_ffmpeg_segmenter(url: str) -> Optional[subprocess.Popen]:
    """Start ffmpeg to write 1s mono WAV segments in SEGMENT_DIR."""
    output_pattern = str(SEGMENT_DIR / "seg_%09d.wav")
    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error",
        "-reconnect", "1", "-reconnect_streamed", "1", "-reconnect_delay_max", "5",
        "-i", url,
        "-vn", "-ac", "1", "-ar", "44100",
        "-f", "segment", "-segment_time", "1", "-reset_timestamps", "1",
        output_pattern
    ]
    try:
        proc = subprocess.Popen(cmd)
        print(f"Started ffmpeg segmenter for {STATION_NAME}")
        return proc
    except Exception as e:
        print(f"[ERROR] Failed to start segmenter: {e}")
        return None


def list_segments() -> List[Path]:
    files = list(SEGMENT_DIR.glob("seg_*.wav"))
    files.sort()
    return files


def wait_file_stable(p: Path, delay: float = 0.15) -> bool:
    try:
        s1 = p.stat().st_size
        time.sleep(delay)
        s2 = p.stat().st_size
        return s1 == s2 and s2 > 0
    except Exception:
        return False


def get_stable_segments(n: int = 5, retries: int = 5) -> List[Path]:
    for _ in range(retries):
        files = list_segments()
        if len(files) < n + 1:
            time.sleep(0.3)
            continue
        # Skip most recent to avoid partial write
        candidates = files[-(n + 1):-1]
        if all(wait_file_stable(f) for f in candidates):
            return candidates
        time.sleep(0.2)
    return []


def build_window(segment_files: List[Path]) -> Optional[Path]:
    try:
        combined = None
        for f in segment_files:
            seg = AudioSegment.from_wav(str(f))
            combined = seg if combined is None else (combined + seg)
        if combined is None:
            return None
        out_path = RECORDINGS_DIR / f"window_{int(time.time()*1000)}.wav"
        combined.export(str(out_path), format="wav")
        try:
            size = out_path.stat().st_size
            dbg(f"Built 5s window: {out_path.name} size={size} bytes")
        except Exception:
            pass
        return out_path
    except Exception as e:
        print(f"[ERROR] Failed to build window: {e}", flush=True)
        return None


# (Removed MFCC/music classification; we only compare embeddings between consecutive 5s windows)


# (Removed music model loading/classification)


def build_embedding_network(input_shape: Tuple[int, int, int]):
    from tensorflow.keras import layers, Input, Model
    inp = Input(shape=input_shape)
    x = layers.Conv2D(32, (3, 3), activation='relu', padding='same')(inp)
    x = layers.MaxPooling2D((2, 2))(x)
    x = layers.Conv2D(64, (3, 3), activation='relu', padding='same')(x)
    x = layers.MaxPooling2D((2, 2))(x)
    x = layers.Flatten()(x)
    x = layers.Dense(128, activation='relu')(x)
    x = layers.Dense(64, activation=None)(x)
    x = layers.Lambda(lambda t: tf.math.l2_normalize(t, axis=1))(x)
    return Model(inp, x)


def extract_weights_from_keras(keras_file: Path) -> Optional[str]:
    try:
        tmp_dir = tempfile.mkdtemp(prefix="embedding_model_")
        with zipfile.ZipFile(str(keras_file), 'r') as zf:
            zf.extractall(tmp_dir)
        var_dir = os.path.join(tmp_dir, "variables")
        index_path = os.path.join(var_dir, "variables.index")
        data_entries = os.listdir(var_dir) if os.path.isdir(var_dir) else []
        if os.path.isfile(index_path) and any(name.startswith("variables.data-") for name in data_entries):
            return os.path.join(var_dir, "variables")
        for root, _dirs, files in os.walk(tmp_dir):
            for fname in files:
                if fname.endswith(".weights.h5") or fname.endswith(".h5"):
                    return os.path.join(root, fname)
        return None
    except Exception:
        return None


def load_embedding_model(model_path: Path, input_shape: Tuple[int, int, int]):
    # Prefer rebuilding architecture and loading weights extracted from .keras
    weights_path = extract_weights_from_keras(model_path)
    if weights_path is not None:
        dbg(f"Embedding: rebuilding network with input_shape={input_shape}, loading weights from: {weights_path}")
        model = build_embedding_network(input_shape)
        try:
            model.load_weights(weights_path)
            dbg("Embedding: weights loaded successfully")
            return model
        except Exception:
            dbg("Embedding: failed to load extracted weights, falling back to full model load")

    # Fallback: try loading full model (may fail if Lambda without output_shape)
    try:
        import keras  # type: ignore
        try:
            keras.config.enable_unsafe_deserialization()  # type: ignore[attr-defined]
        except Exception:
            pass
        try:
            dbg("Embedding: attempting full model load via keras (safe_mode=False)")
            model = keras.models.load_model(str(model_path), compile=False, safe_mode=False)  # type: ignore[arg-type]
            dbg("Embedding: full model load succeeded (keras)")
            return model
        except TypeError:
            dbg("Embedding: attempting full model load via keras (no safe_mode)")
            model = keras.models.load_model(str(model_path), compile=False)
            dbg("Embedding: full model load succeeded (keras legacy)")
            return model
    except Exception:
        try:
            from tensorflow.keras.models import load_model as tf_load_model
            dbg("Embedding: attempting full model load via tf.keras")
            model = tf_load_model(str(model_path), compile=False)
            dbg("Embedding: full model load succeeded (tf.keras)")
            return model
        except Exception as e:
            raise RuntimeError(f"Failed to load embedding model: {e}")


def compute_embedding(emb_model, window_file: Path) -> np.ndarray:
    # Build mel to match embedding training
    dbg(f"Embedding: loading audio {window_file.name} at {EMB_SR} Hz")
    y, _ = librosa.load(str(window_file), sr=EMB_SR, mono=True)
    samples = int(EMB_SR * DURATION_SEC)
    if len(y) < samples:
        y = np.pad(y, (0, samples - len(y)))
    elif len(y) > samples:
        y = y[:samples]
    S = librosa.feature.melspectrogram(y=y, sr=EMB_SR, n_fft=EMB_N_FFT, hop_length=EMB_HOP_LENGTH, n_mels=EMB_N_MELS)
    S_db = librosa.power_to_db(S, ref=np.max)
    S_min, S_max = -80.0, 0.0
    S_norm = (S_db - S_min) / (S_max - S_min)
    S_norm = np.clip(S_norm, 0.0, 1.0).astype(np.float32)
    dbg(f"Embedding: mel shape={S_norm.shape}")
    mel = np.expand_dims(S_norm, axis=(0, -1))  # (1, H, W, 1)
    dbg("Embedding: running model.predict...")
    emb = emb_model.predict(mel, verbose=0)[0]
    try:
        dbg(f"Embedding: got vector shape={emb.shape}, l2={float(np.linalg.norm(emb)):.4f}")
    except Exception:
        pass
    # Assume model outputs L2-normalized embeddings
    return emb


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(a, b))


def cleanup_segments_keep_recent(keep_n: int = 30):
    try:
        files = list_segments()
        to_delete = files[:-keep_n]
        now = time.time()
        for f in to_delete:
            try:
                if now - f.stat().st_mtime < 3:
                    continue
                f.unlink()
            except Exception:
                pass
    except Exception:
        pass


def main():
    print(f"Listening to {STATION_NAME}: {STATION_URL}")

    # Prepare a dummy input to infer embedding input shape using a temporary 5s of silence
    emb_model_path = EMBED_MODEL_PATH
    if not emb_model_path.exists():
        raise FileNotFoundError(f"Embedding model not found: {emb_model_path}")

    # Delay embedding model creation until first music window to derive exact input shape
    emb_model = None

    # Start segmenter
    proc = start_ffmpeg_segmenter(STATION_URL)
    if proc is None:
        raise SystemExit(1)

    prev_embedding: Optional[np.ndarray] = None
    last_processed_index = -1

    time.sleep(2)

    try:
        while True:
            dbg("Polling for stable segments...")
            segs = get_stable_segments(5)
            if len(segs) < 5:
                dbg("Not enough stable segments yet; sleeping 0.4s")
                time.sleep(0.4)
                continue

            newest_idx = int(segs[-1].stem.split('_')[1])
            if newest_idx == last_processed_index:
                dbg("No new segments yet; sleeping 0.2s")
                time.sleep(0.2)
                continue
            last_processed_index = newest_idx

            window = build_window(segs)
            if not window:
                dbg("Failed to build window; sleeping 0.1s")
                time.sleep(0.1)
                continue

            window_start = datetime.now(timezone.utc)
            try:
                # Ensure embedding model is loaded (derive input shape from current window)
                if emb_model is None:
                    dbg("Preparing first mel to derive embedding input shape...")
                    y, _ = librosa.load(str(window), sr=EMB_SR, mono=True)
                    samples = int(EMB_SR * DURATION_SEC)
                    if len(y) < samples:
                        y = np.pad(y, (0, samples - len(y)))
                    elif len(y) > samples:
                        y = y[:samples]
                    S = librosa.feature.melspectrogram(y=y, sr=EMB_SR, n_fft=EMB_N_FFT, hop_length=EMB_HOP_LENGTH, n_mels=EMB_N_MELS)
                    H, W = S.shape
                    dbg(f"Derived mel shape HxW=({H},{W}); loading embedding model...")
                    emb_model = load_embedding_model(emb_model_path, input_shape=(H, W, 1))
                    print("Embedding model loaded", flush=True)

                # Compute current embedding
                dbg("Computing embedding for current 5s window...")
                curr_emb = compute_embedding(emb_model, window)

                # If first window, store and wait for the next one to compare
                if prev_embedding is None:
                    dbg("First window captured; waiting for next to compare")
                    prev_embedding = curr_emb
                    continue

                # Compare with previous window embedding
                sim = cosine_similarity(curr_emb, prev_embedding)
                print(f"Window @ {window_start.isoformat()} | similarity_with_previous={sim:.3f}", flush=True)

                # Shift window
                prev_embedding = curr_emb

            finally:
                try:
                    window.unlink()
                except Exception:
                    pass

            if newest_idx % 30 == 0:
                cleanup_segments_keep_recent(keep_n=30)

    except KeyboardInterrupt:
        print("Interrupted by user, shutting down...")
    finally:
        try:
            if proc:
                proc.terminate()
                proc.wait(timeout=3)
        except Exception:
            try:
                proc.kill()
            except Exception:
                pass


if __name__ == "__main__":
    main()


