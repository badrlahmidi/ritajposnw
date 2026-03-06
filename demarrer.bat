@echo off
title RITAJ SMART POS
echo ========================================
echo   RITAJ SMART POS - Demarrage
echo ========================================
echo.

echo [1/2] Demarrage du serveur...
cd /d "%~dp0server"

echo [2/2] Ouverture de l'application (http://localhost:3000/pos)...
:: Lancer le navigateur apres 2.5 secondes
start /b cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:3000/pos"

echo.
echo ========================================
echo Serveur en cours... (Ne fermez pas cette fenetre)
echo Appuyez sur Ctrl+C pour arreter proprement.
echo ========================================
echo.

node server.js
