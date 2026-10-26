@echo off
echo ========================================
echo    FairPlay AI - Local Server Startup
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

REM Check if we're in the right directory
if not exist "backend\manage.py" (
    echo ERROR: manage.py not found
    echo Please run this script from the project root directory
    pause
    exit /b 1
)

echo Starting Django server...
echo.
echo Server will be available at:
echo - Local: http://localhost:8000
echo - Network: http://your-local-ip:8000
echo.
echo Press Ctrl+C to stop the server
echo.

REM Change to Django project directory
cd backend

REM Start Django server
python manage.py runserver 0.0.0.0:8000

echo.
echo Server stopped.
pause


