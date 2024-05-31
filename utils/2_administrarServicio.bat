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

:menu
cls
echo 1. Iniciar servicio ChangSincronizador
echo 2. Detener servicio ChangSincronizador
echo 3. Reiniciar servicio ChangSincronizador
echo 4. Salir

set /p choice=Ingrese el número correspondiente a la opción deseada: 

if "%choice%"=="1" goto start_service
if "%choice%"=="2" goto stop_service
if "%choice%"=="3" goto restart_service
if "%choice%"=="4" goto end

:start_service
rem Start the service
%NSSM_PATH% start ChangSincronizador
pause
goto menu

:stop_service
rem Stop the service
%NSSM_PATH% stop ChangSincronizador
pause
goto menu

:restart_service
rem Restart the service
%NSSM_PATH% restart ChangSincronizador
pause
goto menu

:end
