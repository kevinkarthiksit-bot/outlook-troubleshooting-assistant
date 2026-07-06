@echo off
title Create email zip — Outlook Assistant
cd /d "%~dp0"

set "ZIPNAME=OutLook-Assistant.zip"
if exist "%ZIPNAME%" del "%ZIPNAME%"

echo.
echo  Creating %ZIPNAME% ...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0create-email-zip.ps1"

echo.
pause
