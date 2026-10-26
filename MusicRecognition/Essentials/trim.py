import os
from io import BytesIO
from pydub import AudioSegment

AudioSegment.converter = "ffmpeg.exe"
AudioSegment.ffmpeg = "ffmpeg.exe"
AudioSegment.ffprobe = "ffprobe.exe"





def trim_and_convert_audio(audio_number, input_file, output_folder, trim_duration=5):
    # Load the audio file
    audio = AudioSegment.from_file(input_file)

    # Get the duration of the audio in seconds
    total_duration = len(audio) / 1000

    # Start trimming from the 1st second    
    start_time = 0

    

    while start_time + trim_duration <= total_duration:
        # Calculate the end time for trimming (5 seconds)
        end_time = start_time + trim_duration

        # Trim the audio
        trimmed_audio = audio[start_time * 1000:end_time * 1000]

        # Export the trimmed audio to a BytesIO object
        trimmed_wav_data = BytesIO()
        trimmed_audio.export(trimmed_wav_data, format="wav")

        # Reset the buffer position to the beginning
        trimmed_wav_data.seek(0)

        # Export the trimmed audio to a new file
        output_file = os.path.join(output_folder, f"music_{audio_number}.wav")
        trimmed_wav_data.seek(0)  # Reset the buffer position to the beginning
        with open(output_file, 'wb') as output_file:
            output_file.write(trimmed_wav_data.read())

        # Move to the next segment
        start_time += trim_duration
        audio_number += 1
    return audio_number

def process_all_files(input_folder, output_folder):
    # Create the output folder if it doesn't exist
    os.makedirs(output_folder, exist_ok=True)
    audio_number=0

    # Loop through all files in the input folder
    for filename in os.listdir(input_folder):
        if filename.endswith(".mp3"):
            input_file_path = os.path.join(input_folder, filename)
            
            # Continue with other processing functions using input_file_path
       
            os.makedirs(output_folder, exist_ok=True)
            audio_number=trim_and_convert_audio(audio_number, input_file_path, output_folder)

if __name__ == "__main__":
    input_folder = ""  # Change this to your input audio file
    output_folder = ""  # Change this to your desired output file prefix

    process_all_files(input_folder, output_folder)
