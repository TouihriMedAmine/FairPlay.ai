import os
import shutil
from pydub import AudioSegment
from pydub.utils import make_chunks

# Set ffmpeg paths (adjust if needed)
AudioSegment.converter = "ffmpeg.exe"
AudioSegment.ffprobe = "ffprobe.exe"

# Silence threshold in dBFS
SILENCE_THRESHOLD = -50.0  # Consider as silent if below this
SILENCE_RATIO_THRESHOLD = 0.9  # 90% or more silent chunks

# Length of chunk to check (in milliseconds)
CHUNK_LENGTH_MS = 1000  # 1 second

def is_mostly_silent(audio, silence_threshold=SILENCE_THRESHOLD, ratio_threshold=SILENCE_RATIO_THRESHOLD):
    chunks = make_chunks(audio, CHUNK_LENGTH_MS)
    total_chunks = len(chunks)
    silent_chunks = sum(1 for chunk in chunks if chunk.dBFS < silence_threshold)

    if total_chunks == 0:
        return True  # Empty file

    silence_ratio = silent_chunks / total_chunks
    return silence_ratio >= ratio_threshold

def check_audio_file(file_path, silent_folder):
    try:
        audio = AudioSegment.from_file(file_path)
        duration = len(audio)

        if duration == 0:
            print(f"[❌] {file_path} - 0ms duration")
            shutil.move(file_path, os.path.join(silent_folder, os.path.basename(file_path)))
            return

        if is_mostly_silent(audio):
            print(f"[⚠️] {file_path} - Mostly silent, moved to '{silent_folder}'")
            shutil.move(file_path, os.path.join(silent_folder, os.path.basename(file_path)))
        else:
            print(f"[✅] {file_path} - Valid, avg dBFS = {audio.dBFS:.2f}")

    except Exception as e:
        print(f"[❌] {file_path} - Error: {e}")

def check_all_audio_files(folder):
    silent_folder = os.path.join(folder, "silent")
    os.makedirs(silent_folder, exist_ok=True)

    print(f"\nChecking audio files in: {folder}\n")
    for filename in os.listdir(folder):
        if filename.lower().endswith(('.mp3', '.wav', '.m4a')):
            file_path = os.path.join(folder, filename)
            check_audio_file(file_path, silent_folder)

if __name__ == "__main__":
    folder_path = "Data/DataSet/Music"  # 🔁 Replace with your input folder
    check_all_audio_files(folder_path)
