@echo off
title Gmail attachment — Outlook Assistant (includes .bat)
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0create-gmail-attachment.ps1"
echo.
pause
