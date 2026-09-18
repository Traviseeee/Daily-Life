@echo off
setlocal

cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel% equ 0 (
  node server.js
  pause
  exit /b 0
)

echo Node.js was not found. Install Node.js or open index.html directly.
pause
exit /b 1
