import requests
import time
from pydub import AudioSegment
import numpy as np
import base64
import os
import librosa
import numpy as np
from tensorflow.keras.models import load_model

# Load the pre-trained model
model_path = "CNNmodelForMp3_99%.h5" 
model = load_model(model_path, compile=False)

# Function to convert audio to base64 format
def convert_audio_to_base64(audio_file_path):
    audio = AudioSegment.from_file(audio_file_path)
    audio = audio[:5000]
    audio = audio.set_channels(1)
    audio = audio.set_frame_rate(44100)
    audio = audio.set_sample_width(2)
    audio_raw = audio.raw_data
    audio_array = np.frombuffer(audio_raw, dtype=np.int16)
    audio_base64 = base64.b64encode(audio_array.tobytes()).decode()
    return audio_base64

# API details. Put the key in the environment, not in this file.
url = "https://shazam.p.rapidapi.com/songs/detect"
headers = {
	"content-type": "text/plain",
	"X-RapidAPI-Key": os.environ.get("RAPIDAPI_KEY", ""),
	"X-RapidAPI-Host": "shazam.p.rapidapi.com"
}

# Main loop to fetch the M3U playlist and process audio stream
while True:
    m3u_url = 'https://radio.mosaiquefm.net/mosalive.m3u'
    print("Fetching M3U playlist...")
    response = requests.get(m3u_url)

    if response.status_code == 200:
        lines = response.text.split('\n')
        stream_url = None
        for line in lines:
            if line.startswith('http'):
                stream_url = line.strip()
                break

        if stream_url:
            print("Found stream URL:", stream_url)
            start_time = time.time()
            filename = os.path.join("files", str(time.strftime("%Y-%m-%d_%H_%M_%S.mp3")))  # Save file in "files" folder

            with open(filename, 'wb') as f:
                try:
                    r = requests.get(stream_url, stream=True)
                    print("recording")
                    for block in r.iter_content(1024):
                        if time.time() - start_time < 2:
                            f.write(block)
                        else:
                            audio, sr = librosa.load(filename)  # Read the recorded audio from the "files" folder
                            mfccs = librosa.feature.mfcc(y=audio, sr=sr, n_mfcc=20)
                            resized_features = np.resize(mfccs, (1, 4320))
                            resized_features = resized_features.reshape(1, resized_features.shape[1])
                            prediction = model.predict(resized_features)
                            if prediction < 1.0:
                                print("classified as non-music.")
                                print("Prediction:", np.squeeze(prediction))
                            else:
                                print("is classified as music.")
                                print("Prediction:", np.squeeze(prediction))
                                payload = convert_audio_to_base64(filename)
                                response = requests.post(url, data=payload, headers=headers)
                                print(response.json())
                            print("Segment recorded.")
                            break

                except KeyboardInterrupt:
                    print("Recording interrupted.")

        else:
            print("Stream URL not found in the M3U playlist.")

    else:
        print("Failed to fetch the M3U playlist.")
