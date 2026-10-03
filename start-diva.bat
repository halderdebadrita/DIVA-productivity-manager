@echo off
title Diva
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is not installed. Get the LTS version from https://nodejs.org then run this again. & pause & exit /b 1)
if not exist node_modules (
  echo Installing dependencies - first run only, takes a few minutes...
  call npm install || (echo npm install failed & pause & exit /b 1)
)
echo Starting Diva at http://localhost:3000 ...
start "" cmd /c "timeout /t 15 >nul & start http://localhost:3000/dashboard"
call npm run dev
pause
