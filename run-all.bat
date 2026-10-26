@echo off
setlocal


REM Start React frontend on a fixed port without opening a browser
start "FairPlay Frontend" cmd /k "set PORT=3000&& set BROWSER=none&& npm start"

REM Open the frontend in the default browser after a short delay
timeout /t 5 /nobreak >nul
start "" http://localhost:3000

REM Start Django backend
start "FairPlay Django (runserver)" cmd /k "cd backend && python manage.py runserver"


REM Start fetcher script with lower priority
start "FairPlay Fetcher (fetch.py)" /low cmd /k "python fetch.py"





