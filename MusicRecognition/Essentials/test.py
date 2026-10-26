import os
import numpy as np
import librosa
from tensorflow.keras.models import load_model
from tabulate import tabulate

def preprocess_audio(file_path):
    # Load audio file with librosa
    audio, sr = librosa.load(file_path)
    # Extract features like MFCCs, chroma features, etc.
    # For simplicity, let's use only MFCCs for this example
    mfccs = librosa.feature.mfcc(y=audio, sr=sr, n_mfcc=20)
    return mfccs.flatten()  # Flatten MFCC features

def test_model_on_folder(folder_path, model):
    music_results = []
    non_music_results = []
    for filename in os.listdir(folder_path):
        if filename.endswith('.mp3'):
            file_path = os.path.join(folder_path, filename)
            audio_data = preprocess_audio(file_path)
            # Assuming your model expects a 1D array as input
            prediction = model.predict(np.expand_dims(audio_data, axis=0))
            # Assuming your model returns a binary prediction (0 or 1)
            is_music = prediction[0][0] >= 0.5
            if is_music:
                music_results.append([filename, 'music'])
            else:
                non_music_results.append([filename, 'non-music'])

    # Display results in a table
    headers = ["File", "Category"]
    print("Music Files:")
    print(tabulate(music_results, headers=headers))
    print("\nNon-Music Files:")
    print(tabulate(non_music_results, headers=headers))

if __name__ == "__main__":
    # Load your trained model
    model_path = "CNNmodelForMp3_99%.h5"  # Update with the path to your model
    model = load_model(model_path)

    # Test the model on the "test1" folder
    test_folder = "test1"  # Update with the path to your test folder
    test_model_on_folder(test_folder, model)
