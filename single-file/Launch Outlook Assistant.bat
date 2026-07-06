@echo off
title Outlook Assistant (single file)
cd /d "%~dp0"

where py >nul 2>&1
if not errorlevel 1 (
  echo Starting local server for best compatibility...
  start /b py -3 -m http.server 8090
  timeout /t 2 /nobreak >nul
  start "" "http://localhost:8090/outlook-assistant.html#login"
  echo.
  echo  App opened at http://localhost:8090/outlook-assistant.html
  echo  Leave this window open. Press Ctrl+C to stop the server.
  echo.
  py -3 -m http.server 8090
  exit /b 0
)

where python >nul 2>&1
if not errorlevel 1 (
  echo Starting local server for best compatibility...
  start /b python -m http.server 8090
  timeout /t 2 /nobreak >nul
  start "" "http://localhost:8090/outlook-assistant.html#login"
  echo.
  echo  App opened at http://localhost:8090/outlook-assistant.html
  py -3 -m http.server 8090 2>nul || python -m http.server 8090
  exit /b 0
)

echo Opening outlook-assistant.html directly (file mode)...
start "" "%~dp0outlook-assistant.html#login"
echo.
echo  If the page is blank, install Python and run this file again.
echo.
timeout /t 4 >nul
