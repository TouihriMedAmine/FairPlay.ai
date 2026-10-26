@echo off
echo ========================================
echo    FairPlay AI - Local Hosting Setup
echo ========================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python 3.11+ and try again
    pause
    exit /b 1
)

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js and try again
    pause
    exit /b 1
)

echo Installing Python dependencies...
pip install -r requirements.txt

if errorlevel 1 (
    echo ERROR: Failed to install Python dependencies
    pause
    exit /b 1
)

echo.
echo Installing Node.js dependencies...
cd src
npm install

if errorlevel 1 (
    echo ERROR: Failed to install Node.js dependencies
    pause
    exit /b 1
)

echo.
echo Building React frontend...
npm run build

if errorlevel 1 (
    echo ERROR: Failed to build React frontend
    pause
    exit /b 1
)

cd ..

echo.
echo Collecting Django static files...
cd backend
python manage.py collectstatic --noinput

if errorlevel 1 (
    echo ERROR: Failed to collect static files
    pause
    exit /b 1
)

echo.
echo Running database migrations...
python manage.py migrate

if errorlevel 1 (
    echo ERROR: Failed to run migrations
    pause
    exit /b 1
)

cd ..

echo.
echo ========================================
echo    Setup Complete!
echo ========================================
echo.
echo Your application is ready for local hosting.
echo.
echo Next steps:
echo 1. Run start-server.bat to start the server
echo 2. Configure port forwarding in your router
echo 3. Test access from the internet
echo.
echo For detailed instructions, see local-hosting-guide.md
echo.
pause


