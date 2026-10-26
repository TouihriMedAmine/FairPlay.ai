import yt_dlp
import os

# Get the directory where this script is located
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# File containing the list of URLs (in the same folder as the script)
URLS_FILE = os.path.join(SCRIPT_DIR, 'urls.txt')  # Ensure this file exists in the same directory as the script


# Clean URLs
def clean_url(url):
    return url.split('?')[0].strip()

# yt-dlp config to save downloads in the same folder as the script
ydl_opts = {
    'format': 'bestaudio/best',
    'outtmpl': os.path.join(SCRIPT_DIR, '%(title)s.%(ext)s'),  # Save in script's folder
    'quiet': False,
    'postprocessors': [{
        'key': 'FFmpegExtractAudio',
        'preferredcodec': 'mp3',
        'preferredquality': '192',
    }],
}

# Read and clean URLs
with open(URLS_FILE, 'r') as file:
    urls = file.readlines()

# Download loop
for link in urls:
    url = clean_url(link)
    print(f"\nDownloading: {url}")
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])
    except Exception as e:
        print(f"Error downloading {url}: {e}")
