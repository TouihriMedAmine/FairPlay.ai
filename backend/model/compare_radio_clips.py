#!/usr/bin/env python3
"""
Compare two audio clips using a mel-spectrogram embedding model.

Default model path: model/embedding_model.keras

Usage:
  python model/compare_radio_clips.py --file1 <path> --file2 <path> \
      [--model model/embedding_model.keras] [--threshold 0.70]
"""

import os
import sys
import argparse
import shutil
import subprocess
import tempfile
import zipfile
from pathlib import Path
from typing import Optional, Tuple

import numpy as np
import librosa
import tensorflow as tf


# Console-friendly output on Windows
try:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass


# Audio/Mel settings (must match training)
SR = 22050
DURATION = 5.0
SAMPLES = int(SR * DURATION)
N_MELS = 64
N_FFT = 1024
HOP_LENGTH = 512


def ffmpeg_decode_mono_f32(file_path: str, sr: int) -> Optional[np.ndarray]:
    """Decode audio to mono float32 at given sample rate using ffmpeg (fallback path)."""
    if shutil.which("ffmpeg") is None:
        return None
    cmd = [
        "ffmpeg",
        "-nostdin",
        "-v",
        "error",
        "-hide_banner",
        "-i",
        file_path,
        "-vn",
        "-sn",
        "-dn",
        "-f",
        "f32le",
        "-ac",
        "1",
        "-ar",
        str(sr),
        "pipe:1",
    ]
    proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if proc.returncode != 0 or not proc.stdout:
        return None
    audio = np.frombuffer(proc.stdout, dtype=np.float32)
    return audio if audio.size > 0 else None


def load_mel_spectrogram(file_path: str) -> np.ndarray:
    """Load file, pad/trim to DURATION, compute mel-spectrogram, normalize to [0,1], shape (H,W,1)."""
    y: Optional[np.ndarray]
    try:
        y_lib, _ = librosa.load(file_path, sr=SR, mono=True)
        y = y_lib
    except Exception:
        y = None
    if y is None:
        y = ffmpeg_decode_mono_f32(file_path, SR)
    if y is None:
        raise RuntimeError(f"Failed to decode audio: {file_path}")

    if len(y) < SAMPLES:
        y = np.pad(y, (0, SAMPLES - len(y)))
    elif len(y) > SAMPLES:
        y = y[:SAMPLES]

    S = librosa.feature.melspectrogram(
        y=y, sr=SR, n_fft=N_FFT, hop_length=HOP_LENGTH, n_mels=N_MELS
    )
    S_db = librosa.power_to_db(S, ref=np.max)
    S_min, S_max = -80.0, 0.0
    S_norm = (S_db - S_min) / (S_max - S_min)
    S_norm = np.clip(S_norm, 0.0, 1.0)
    return np.expand_dims(S_norm.astype(np.float32), axis=-1)


def build_embedding_network(input_shape: Tuple[int, int, int]) -> tf.keras.Model:
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


def extract_weights_from_keras(keras_file: str) -> Optional[str]:
    """Try to extract either TF checkpoint prefix or a .h5 weights file from a .keras zip."""
    try:
        tmp_dir = tempfile.mkdtemp(prefix="embedding_model_")
        with zipfile.ZipFile(keras_file, 'r') as zf:
            zf.extractall(tmp_dir)
        var_dir = os.path.join(tmp_dir, "variables")
        index_path = os.path.join(var_dir, "variables.index")
        data_glob = [p for p in os.listdir(var_dir)] if os.path.isdir(var_dir) else []
        if os.path.isfile(index_path) and any(name.startswith("variables.data-") for name in data_glob):
            return os.path.join(var_dir, "variables")  # checkpoint prefix
        for root, _dirs, files in os.walk(tmp_dir):
            for fname in files:
                if fname.endswith(".weights.h5") or fname.endswith(".h5"):
                    return os.path.join(root, fname)
        return None
    except Exception:
        return None


def load_embedding_model(model_path: str, input_shape: Tuple[int, int, int]) -> tf.keras.Model:
    """Load embedding model: prefer rebuilding architecture + loading weights; fallback to full load."""
    weights_path = extract_weights_from_keras(model_path)
    if weights_path is not None:
        model = build_embedding_network(input_shape)
        try:
            model.load_weights(weights_path)
            return model
        except Exception:
            pass

    # Fallback: try Keras/TF full-model loading (allow unsafe deserialization if needed)
    try:
        import keras  # type: ignore
        try:
            keras.config.enable_unsafe_deserialization()  # type: ignore[attr-defined]
        except Exception:
            pass
        try:
            return keras.models.load_model(model_path, compile=False, safe_mode=False)  # type: ignore[arg-type]
        except TypeError:
            return keras.models.load_model(model_path, compile=False)
    except Exception:
        try:
            return tf.keras.models.load_model(model_path, compile=False, safe_mode=False)  # type: ignore[arg-type]
        except TypeError:
            return tf.keras.models.load_model(model_path, compile=False)


def get_embedding(model: tf.keras.Model, file_path: str) -> np.ndarray:
    mel = np.expand_dims(load_mel_spectrogram(file_path), axis=0)
    emb = model.predict(mel, verbose=0)[0]
    return emb


def cosine_similarity(vec1: np.ndarray, vec2: np.ndarray) -> float:
    # Vectors are already L2-normalized by the model; cosine = dot product
    return float(np.dot(vec1, vec2))


def main():
    repo_root = Path(__file__).resolve().parents[2]
    default_model = str((repo_root / "backend" / "model" / "embedding_model.keras").resolve())

    parser = argparse.ArgumentParser(description="Compare two audio clips using an embedding model")
    parser.add_argument("--file1", required=True, help="Path to first audio file")
    parser.add_argument("--file2", required=True, help="Path to second audio file")
    parser.add_argument("--model", default=default_model, help="Path to embedding model (.keras)")
    parser.add_argument("--threshold", type=float, default=0.70, help="Cosine similarity threshold for SAME")
    args = parser.parse_args()

    model_path = args.model
    if not Path(model_path).exists():
        print(f"Model not found: {model_path}")
        sys.exit(1)

    # Determine input shape from file1 mel
    probe_mel = load_mel_spectrogram(args.file1)
    input_shape = probe_mel.shape  # (H, W, 1)

    model = load_embedding_model(model_path, input_shape)

    e1 = get_embedding(model, args.file1)
    e2 = get_embedding(model, args.file2)
    sim = cosine_similarity(e1, e2)

    verdict = "SAME" if sim >= args.threshold else "DIFFERENT"
    print(f"Similarity: {sim:.6f} | Threshold: {args.threshold:.2f} | Verdict: {verdict}")
    print(f"A: {Path(args.file1).name}")
    print(f"B: {Path(args.file2).name}")


if __name__ == "__main__":
    main()


