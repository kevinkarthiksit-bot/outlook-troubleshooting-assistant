@echo off
title Outlook Troubleshooting Assistant
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0launch.ps1"
if errorlevel 1 exit /b 1
