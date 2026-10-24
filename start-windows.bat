@echo off
title LearnLoop - Personalized Study Coach
cd /d "%~dp0"
echo ========================================
echo   LearnLoop - Personalized Study Coach
echo ========================================
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js 18 or newer from https://nodejs.org/
  pause
  exit /b 1
)
if not exist "node_modules" (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo Dependency installation failed.
    pause
    exit /b 1
  )
)
echo Starting LearnLoop...
echo Open http://localhost:3000 in your browser.
call npm start
pause
