@echo off
title Outlook Assistant — Health Check
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0health-check.ps1"
echo.
pause
