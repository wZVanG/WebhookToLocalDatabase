@echo off
:: Check for Administrator privileges
openfiles >nul 2>&1
if %errorlevel% neq 0 (
    echo Solicitud de privilegios de administrador...
    powershell start-process "%~0" -verb runas
    exit /b
)

rem Function to check for errors and exit if any command fails
:check_error
if %errorlevel% neq 0 (
    echo Error en el comando: %1
    pause
    exit /b %errorlevel%
)

rem Stop the service
nssm stop ChangSincronizador
call :check_error "nssm stop ChangSincronizador"

echo Servicio detenido exitosamente.
pause
