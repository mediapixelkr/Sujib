@echo off
setlocal EnableDelayedExpansion
title Installation Extension Sujib Firefox

:: Check Administrator privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Demande d'elevation Administrateur pour configurer Firefox...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

echo ===================================================
echo   Installation Automatique Extension Sujib Firefox
echo ===================================================
echo.

set "FX_PATH="
if exist "C:\Program Files\Mozilla Firefox" set "FX_PATH=C:\Program Files\Mozilla Firefox"
if not defined FX_PATH if exist "C:\Program Files (x86)\Mozilla Firefox" set "FX_PATH=C:\Program Files (x86)\Mozilla Firefox"
if not defined FX_PATH if exist "%LOCALAPPDATA%\Mozilla Firefox" set "FX_PATH=%LOCALAPPDATA%\Mozilla Firefox"

if not defined FX_PATH (
    echo [ERREUR] Mozilla Firefox n'a pas ete trouve dans vos dossiers d'installation.
    echo Veuillez installer Firefox ou verifier son repertoire.
    echo.
    pause
    exit /b 1
)

echo Dossier Firefox detecte : "!FX_PATH!"
echo Creation du dossier distribution...
if not exist "!FX_PATH!\distribution" mkdir "!FX_PATH!\distribution" 2>nul

echo Configuration de la politique Firefox pour Sujib...
(
  echo {
  echo   "policies": {
  echo     "ExtensionSettings": {
  echo       "sujib-downloader@mediapixel.kr": {
  echo         "installation_mode": "normal_installed",
  echo         "install_url": "http://192.168.200.15/sujib/static/sujib-firefox-extension.xpi"
  echo       }
  echo     }
  echo   }
  echo }
) > "!FX_PATH!\distribution\policies.json"

echo.
echo ===================================================
echo [SUCCES] L'extension Sujib a ete configuree avec succes !
echo Veuillez redemarrer Firefox. L'extension sera active automatiquement.
echo ===================================================
echo.
pause
