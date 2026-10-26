@echo off
setlocal

REM Change to the directory of this script
cd /d "%~dp0"

echo ========================================
echo    FairPlay AI - Install Requirements
echo ========================================
echo.

REM Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH.
    echo Install Python 3.11+ from https://www.python.org/downloads/
    pause
    exit /b 1
)

REM Prefer py launcher if available
where py >nul 2>&1
if %errorlevel%==0 (
    set PY=py -3
) else (
    set PY=python
)

REM Create venv if missing
if not exist ".venv" (
    echo Creating virtual environment .venv ...
    %PY% -m venv .venv
    if errorlevel 1 (
        echo ERROR: Failed to create virtual environment.
        pause
        exit /b 1
    )
)

REM Activate venv for this session
call .\.venv\Scripts\activate.bat
if errorlevel 1 (
    echo ERROR: Failed to activate virtual environment.
    pause
    exit /b 1
)

REM Upgrade pip and wheel
python -m pip install --upgrade pip wheel setuptools
if errorlevel 1 (
    echo ERROR: Failed to upgrade pip/wheel/setuptools.
    pause
    exit /b 1
)

REM Install requirements
echo Installing Python requirements...
pip install -r requirements.txt
if errorlevel 1 (
    echo ERROR: Failed to install Python requirements.
    echo If TensorFlow fails on Windows, ensure you have a compatible Python version and CPU AVX support.
    pause
    exit /b 1
)

echo.
echo ========================================
echo    Requirements Installed Successfully
echo ========================================
echo.
echo To use the environment in this shell, it remains activated.
echo To deactivate later, run: deactivate
pause
exit /b 0



