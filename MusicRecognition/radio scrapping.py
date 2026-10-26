import requests
from bs4 import BeautifulSoup
import re

# List of radio station pages (can be extended)
station_pages = {
    "Mosaique FM": "https://www.mosaiquefm.net/fr/direct",
    "Jawhara FM": "https://www.jawharafm.net/fr/live/",
    "IFM": "https://www.ifm.tn/player",
    "Shems FM": "https://www.shemsfm.net/fr",
    "RTCI": "http://www.radiotunisienne.tn/",
    "Radio Express FM": "https://www.radioexpressfm.com/",
    "Radio National": "http://www.radiotunisienne.tn/",
}

# Regular expressions to detect stream URLs
stream_patterns = re.compile(r'(https?:\/\/[^\s"\']+\.(m3u8|mp3|aac|m3u))')

found_streams = {}

# Function to extract streams from a given station page
def extract_streams(name, url):
    print(f"Scraping: {name} → {url}")
    try:
        res = requests.get(url, timeout=10)
        res.raise_for_status()
        soup = BeautifulSoup(res.text, "html.parser")

        # Look for stream links directly in the HTML
        matches = re.findall(stream_patterns, res.text)
        links = list(set([match[0] for match in matches]))

        if links:
            found_streams[name] = links
        else:
            found_streams[name] = ["No direct stream found."]
    except Exception as e:
        found_streams[name] = [f"Error: {str(e)}"]

# Loop over all stations
for station, page in station_pages.items():
    extract_streams(station, page)

# Print results
print("\n=== ✅ STREAM LINKS FOUND ===\n")
for station, links in found_streams.items():
    print(f"\n🔊 {station}:")
    for link in links:
        print(f"  - {link}")
