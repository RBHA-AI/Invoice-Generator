@echo off
echo ================================================
echo R Bhargava ^& Associates - Invoice Generator
echo Deployment Script
echo ================================================
echo.

REM Check if Node.js is installed
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo X Node.js is not installed. Please install Node.js v16 or higher.
    echo Download from: https://nodejs.org/
    pause
    exit /b 1
)

echo [OK] Node.js version:
node --version
echo.

REM Install root dependencies
echo [*] Installing server dependencies...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install server dependencies
    pause
    exit /b 1
)
echo [OK] Server dependencies installed
echo.

REM Install client dependencies
echo [*] Installing client dependencies...
cd client
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install client dependencies
    pause
    exit /b 1
)
echo [OK] Client dependencies installed
echo.

REM Build the React app
echo [*] Building React application...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Failed to build React application
    pause
    exit /b 1
)
echo [OK] React application built successfully
cd ..
echo.

echo ================================================
echo [SUCCESS] Deployment Complete!
echo ================================================
echo.
echo To start the application:
echo   npm start
echo.
echo The server will run on: http://localhost:5000
echo.
echo For development mode (hot reload):
echo   npm run dev
echo.
echo ================================================
pause
