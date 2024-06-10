@echo off
:: Check for Administrator privileges
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Este script requiere privilegios de administrador para ejecutarse.
    pause
    exit /b
)

rem Ruta completa a nssm.exe
set NSSM_PATH=C:\ChangSync\nssm.exe

:restart_service
rem Restart the service
%NSSM_PATH% restart ChangSincronizador
pause
exit /b
