import os
from io import BytesIO
from pydub import AudioSegment

# Set the paths to ffmpeg and ffprobe executables
ffmpeg_path = "ffmpeg.exe"
ffprobe_path = "ffprobe.exe"

# Set the paths for AudioSegment to use ffmpeg and ffprobe
AudioSegment.converter = ffmpeg_path
AudioSegment.ffmpeg = ffmpeg_path
AudioSegment.ffprobe = ffprobe_path

def trim_and_convert_audio(audio_number, input_file, output_folder, trim_duration=5):
    # Load the audio file
    audio = AudioSegment.from_file(input_file)

    # Get the duration of the audio in seconds
    total_duration = len(audio) / 1000

    # Start trimming from the 1st second
    start_time = 65
    
    while start_time + trim_duration <= total_duration-15 :      
        # Calculate the end time for trimming (5 seconds)
        end_time = start_time + trim_duration

        # Trim the audio
        trimmed_audio = audio[start_time * 1000:end_time * 1000]

        # Export the trimmed audio to a BytesIO object
        trimmed_mp3_data = BytesIO()
        trimmed_audio.export(trimmed_mp3_data, format="mp3")

        # Reset the buffer position to the beginning
        trimmed_mp3_data.seek(0)

        # Export the trimmed audio to a new file
        output_file = os.path.join(output_folder, f"non_music_{audio_number}.mp3")
        trimmed_mp3_data.seek(0)  # Reset the buffer position to the beginning
        with open(output_file, 'wb') as output_file:
            output_file.write(trimmed_mp3_data.read())

        # Move to the next segment
        start_time += trim_duration
        audio_number += 1
        
    return audio_number

def process_all_files(input_folder, output_folder):
    # Create the output folder if it doesn't exist
    os.makedirs(output_folder, exist_ok=True)
    audio_number=0 # Starting number for output files
    # Loop through all files in the input folder
    i=0
    for filename in os.listdir(input_folder):
        if filename.endswith(".mp3"):
            input_file_path = os.path.join(input_folder, filename)
            
            # Continue with other processing functions using input_file_path
       
            os.makedirs(output_folder, exist_ok=True)
            audio_number=trim_and_convert_audio(audio_number, input_file_path, output_folder)
            print(str(i)+' '+filename+" trimming done with "+str(audio_number)+" files")
            i += 1
        

if __name__ == "__main__":
    input_folder = "Data/rebirth"  # Change this to your input audio file
    output_folder = "Data/TestData/NonMusic"   # Change this to your desired output folder

    process_all_files(input_folder, output_folder)
