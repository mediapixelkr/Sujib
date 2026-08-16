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
echo Creation des dossiers distribution et extensions...
if not exist "!FX_PATH!\distribution" mkdir "!FX_PATH!\distribution" 2>nul
if not exist "!FX_PATH!\distribution\extensions" mkdir "!FX_PATH!\distribution\extensions" 2>nul

echo Telechargement du paquet extension dans distribution...
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'http://192.168.200.15/sujib/static/sujib-firefox-extension.xpi' -OutFile '!FX_PATH!\distribution\extensions\sujib-downloader@mediapixel.kr.xpi' -UseBasicParsing"

echo Configuration du fichier distribution\policies.json...
(
  echo {
  echo   "policies": {
  echo     "ExtensionSettings": {
  echo       "sujib-downloader@mediapixel.kr": {
  echo         "installation_mode": "force_installed",
  echo         "install_url": "http://192.168.200.15/sujib/static/sujib-firefox-extension.xpi"
  echo       }
  echo     }
  echo   }
  echo }
) > "!FX_PATH!\distribution\policies.json"

echo Inscription dans le Registre Windows (Politiques d'entreprise)...
reg add "HKLM\SOFTWARE\Policies\Mozilla\Firefox\ExtensionSettings\sujib-downloader@mediapixel.kr" /v installation_mode /t REG_SZ /d "force_installed" /f >nul 2>&1
reg add "HKLM\SOFTWARE\Policies\Mozilla\Firefox\ExtensionSettings\sujib-downloader@mediapixel.kr" /v install_url /t REG_SZ /d "http://192.168.200.15/sujib/static/sujib-firefox-extension.xpi" /f >nul 2>&1

echo.
echo ===================================================
echo [SUCCES] L'extension Sujib a ete installee avec succes !
echo.
echo IMPORTANT :
echo 1. Fermez completement TOUTES les fenetres de Firefox.
echo 2. Relancez Firefox. L'extension sera activee par politique.
echo ===================================================
echo.
pause
