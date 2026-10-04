@echo off
title AI Finance OS
cd /d "%~dp0"

echo.
echo ================================================
echo   AI Finance OS - Hybrid RAG Platform
echo ================================================
echo.

:: Check Python venv
if not exist "backend\venv\Scripts\python.exe" (
    echo Setting up Python environment...
    cd backend
    py -3.12 -m venv venv
    venv\Scripts\pip install -r requirements.txt --quiet
    cd ..
)

:: Start Backend
echo [1/3] Starting Backend on port 8000...
start "Backend-8000" cmd /k "cd /d %~dp0backend && venv\Scripts\python main.py"

:: Wait 8 seconds for backend
ping -n 9 127.0.0.1 > NUL

:: Start Frontend
echo [2/3] Starting Frontend on port 3000...
start "Frontend-3000" cmd /k "cd /d %~dp0 && npm run dev"

:: Wait 15 seconds for Next.js compilation before opening browser
echo [..] Waiting for Next.js to compile before opening browser...
ping -n 16 127.0.0.1 > NUL

:: Open browser at login
echo [3/3] Opening browser...
start "" http://localhost:3000/login

echo.
echo ================================================
echo  Backend  : http://127.0.0.1:8000
echo  Frontend : http://localhost:3000
echo ================================================
echo.
echo Login with Google to access the dashboard.
echo.
pause > NUL
