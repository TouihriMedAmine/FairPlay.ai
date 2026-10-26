@echo off
echo ========================================
echo    FairPlay AI - Stop Server
echo ========================================
echo.

echo Stopping Django server...

REM Kill Python processes running Django
taskkill /f /im python.exe >nul 2>&1

echo Server stopped successfully!
echo.
pause


