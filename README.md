# FairPlay

FairPlay records what is playing on live radio and stores each song's station, start, end, and duration. A React dashboard then filters that airplay and exports it.

The detector in `fetch.py` does four jobs:

1. `ffmpeg` cuts each stream into short segments and builds a 5-second window.
2. A local MFCC classifier decides whether that window is music. The default cutoff is `MUSIC_THRESHOLD=0.8`.
3. If it is music, a local fingerprint index tries to name the song. On a miss, the script asks shazam-api.com and then the RapidAPI Shazam endpoint.
4. While the song is playing, YAMNet embeddings compare consecutive windows. A hard drop below `0.4`, or three windows under `0.5`, is treated as a song change. Two consecutive non-music windows close the play.

Plays are posted to the Django API. The same song on the same station is merged when the gap is under `SONG_MERGE_WINDOW` (default 120 seconds). A background worker can download a Shazam hit with `yt-dlp` and add its fingerprints to the local index. Those downloads land in `audio_engine/Dataset/` and stay out of git.

## What is in this repository

| Piece | Role |
| --- | --- |
| `fetch.py` | Live detector. Entry point for monitoring. |
| `backend/` | Django 5 REST API: users, stations, plays, song details. |
| `src/` | React 18 dashboard (Material UI, Recharts, JWT, PDF export). |
| `audio_engine/` | Spectral-peak fingerprinting, SQLite index, FastAPI, pytest. |
| `MusicRecognition/` | Dataset preparation scripts and training notebooks. |
| `backend/model/music_classifier_model.h5` | The weight file `fetch.py` loads. It is not in this repository. |

`fetch1.py` is an earlier single-station script. The live path is `fetch.py`.

## Stations

`DEFAULT_STATIONS` in `fetch.py` has 17 streams. Sixteen are Tunisian; France Inter is included as well.

Mosaique FM, Radio Nationale, Diwan FM, Zaitouna FM, Express FM, Radio Jeunes, RTCI, Radio Sfax, Radio Monastir, Oxygene FM, Radio Le Kef, Radio MFM, Culturelle RT, Knooz FM, Misk FM, IFM, France Inter.

With no environment overrides, `main()` starts a thread per station. `RADIO_DISABLE` skips names. `SINGLE=1` or `RADIO_NAME` plus `RADIO_URL` runs one stream. The default single station in that mode is Mosaique FM.

Load the same list into Django with:

```bash
cd backend
python manage.py load_radio_stations
```

## Music / non-music classifier

`fetch.py` extracts features like this:

- sample rate 16,000 Hz (chosen so the same window can be passed to YAMNet)
- duration 5 seconds
- 40 MFCCs
- pad or truncate to 130 frames
- music when the music-class probability is at least 0.8

`fetch.py` loads `backend/model/music_classifier_model.h5`. That file is kept in the private repository [fairplay-music-classifier](https://github.com/TouihriMedAmine/fairplay-music-classifier). Clone it and copy `music_classifier_model.h5` into `backend/model/`. The public tree does not contain the weights.

`MusicRecognition/Notebooks/music-detection-with-rnn.ipynb` is the BiLSTM that uses 40 MFCCs, 5 seconds, and pad length 130, which is the feature shape `fetch.py` expects. It was trained at 22,050 Hz. The dataset paths in the notebook are empty. Its saved output prints test accuracy **1.00** (0.9967 on 23,758 clips). That fit passes the test split as `validation_data`, and the split is a random cut of clips, so clips from the same recording can sit on both sides. Treat 1.00 as a training log, not as a held-out result.

`MusicRecognition/Essentials/` has the clip tools that remain: `trim.py`, `cleaningFiles.py`, `corrupted_files.py`, and `download.py`. Their folder paths are blank. `MusicRecognition/Data/links.txt` is the source list used while building the set. The audio itself is not in this tree. `generate.ipynb` draws the loaded network and reads `../backend/model/music_classifier_model.h5`.

## Fingerprint engine

`audio_engine/` is a Shazam-style matcher, separate from the classifier:

- mono audio at 44,100 Hz
- STFT peaks in log-spaced bands, landmark hashes, SQLite inverted index
- offset histogram matching
- FastAPI service (`api.py`) and `pytest` under `audio_engine/tests/`

`identify_with_engine()` in `fetch.py` calls this package first. `Dataset/` and `Test/` hold full tracks and clips cut from those tracks, so both directories are gitignored. `clip_test_results.txt` scores clips of songs that are already in the index; it is a self-match log, not an independent recognition benchmark.

Engine dependencies are in the root `requirements.txt`. From `audio_engine/`, with the virtualenv active:

```bash
pytest -q
```

## Dashboard and API

Development API permissions are `AllowAny`. Guest mode is a flag in `localStorage`; it does not create a user. Sign-in uses JWT (`djangorestframework-simplejwt`).

Routes in `src/App.js`:

- `/authentication` login, register, and guest
- `/home` song list, search, artist filter
- `/analysis` station, artist, and time charts, plus PDF export

Endpoints, all under `/api/`:

- `POST /login/` and `POST /register/`
- `GET|POST /songplayed/` and `GET|PATCH|DELETE /songplayed/<id>/`
- `GET /radiostations/`
- `GET|POST /songdetails/` and `GET /songdetails/<id>/` (title or artist via `?search=`)

`SongPlayed` stores title, artist, album, station, start, end, and duration. `SongDetails` stores label, release, writers, performers, genres, artwork, and the Shazam key when a lookup returns them.

## Run it locally

Python 3.11 and Node.js 18 or newer. TensorFlow 2.16 publishes wheels for Windows, macOS (Intel and Apple Silicon), and Linux x86_64. `ffmpeg` has to be on `PATH`. `soundfile` also needs `libsndfile`. The `.exe` files under `MusicRecognition/Essentials/` are Windows-only and are gitignored.

Install the system packages:

```bash
# Windows
winget install Gyan.FFmpeg

# macOS
brew install ffmpeg libsndfile

# Debian / Ubuntu
sudo apt update && sudo apt install ffmpeg libsndfile1
```

Open a new terminal so `ffmpeg` is on `PATH`, then create the virtualenv from the repository root:

```bash
# Linux and macOS
python3 -m venv .venv
source .venv/bin/activate

# Windows
python -m venv .venv
.venv\Scripts\activate
```

```bash
python -m pip install -r requirements.txt
```

```bash
# Linux and macOS
cp .env.example .env

# Windows
copy .env.example .env
```

Fill `RAPIDAPI_KEY` before starting `fetch.py`. `SHAZAM_API_COM_KEY` is the second recognizer. `DJANGO_SECRET_KEY` replaces the development default. Leave the keys in `config.json` empty; `fetch.py` still opens that file on startup.

In that same terminal:

```bash
cd backend
python manage.py migrate
python manage.py load_radio_stations
python manage.py runserver
```

Leave this process running. In a second terminal, go back to the repository root, activate `.venv` again, and start the dashboard:

```bash
npm install
npm start
```

The API is `http://localhost:8000`. The React dev server is `http://localhost:3000` (`src/config.js` reads `REACT_APP_API_URL`, otherwise `http://localhost:8000/api`).

Copy the classifier weights into place before monitoring. The file is in the private repo `TouihriMedAmine/fairplay-music-classifier`.

```bash
git clone https://github.com/TouihriMedAmine/fairplay-music-classifier.git
```

```bash
# Linux and macOS
mkdir -p backend/model
cp fairplay-music-classifier/music_classifier_model.h5 backend/model/

# Windows
mkdir backend\model
copy fairplay-music-classifier\music_classifier_model.h5 backend\model\
```

In a third terminal, from the repository root with `.venv` active, start monitoring once the API is up:

```bash
python fetch.py
```

Useful variables, with the defaults in `fetch.py` and `.env.example`:

| Variable | Default | Effect |
| --- | --- | --- |
| `MODEL_PATH` | `./backend/model/music_classifier_model.h5` | Classifier weights |
| `MUSIC_THRESHOLD` | `0.8` | Music if P(music) is at least this |
| `NON_MUSIC_END_STREAK` | `2` | Non-music windows before a play closes |
| `SONG_MERGE_WINDOW` | `120` | Seconds within which the same song on one station is one row |
| `YAMNET_SIM_THRESHOLD` | `0.5` | Below this, a window counts as a mismatch |
| `YAMNET_MIN_MISMATCHES` | `3` | Mismatches before a song-change check |
| `YAMNET_HARD_CUTOFF` | `0.4` | Immediate song-change check |
| `RADIO_DISABLE` | empty | Comma-separated station names to skip |
| `AUDIO_ENGINE_DB` | `audio_engine/evaluation.db` | Fingerprint database |

`yt-dlp` is optional. Without it, catalog expansion is skipped and identification still uses the engine and Shazam.

## Layout

```text
fetch.py                          live detector
backend/config/                   Django settings (loads ../.env)
backend/core/                     models, API, load_radio_stations
backend/model/                    put music_classifier_model.h5 here; the file is gitignored
src/                              React pages
audio_engine/                     fingerprint library, API, tests
MusicRecognition/Notebooks/       BiLSTM music/non-music notebook
MusicRecognition/Essentials/      trim, clean, and download scripts
```
