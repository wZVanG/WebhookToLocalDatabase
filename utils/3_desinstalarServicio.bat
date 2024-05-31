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

rem Stop the service if it's running
%NSSM_PATH% stop ChangSincronizador >nul 2>&1

rem Uninstall the service
%NSSM_PATH% remove ChangSincronizador confirm >nul 2>&1

echo Servicio ChangSincronizador eliminado exitosamente.
pause
