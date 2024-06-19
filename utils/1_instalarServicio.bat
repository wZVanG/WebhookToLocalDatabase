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

rem Function to check for errors and exit if any command fails
:check_error
if %errorlevel% neq 0 (
    echo Error en el comando: %1
    pause
    exit /b %errorlevel%
)

rem Check if service is already installed
%NSSM_PATH% status ChangSincronizador >nul 2>&1
if %errorlevel% equ 0 (
    echo El servicio ChangSincronizador ya está instalado.
    rem Optional: Pause here if you want to review the status before continuing
    pause
    exit /b
)

rem Install the service
%NSSM_PATH% install ChangSincronizador "C:\ChangSync\ChangEcommerceSync.exe"
call :check_error "%NSSM_PATH% install ChangSincronizador"

rem Set AppDirectory
%NSSM_PATH% set ChangSincronizador AppDirectory C:\ChangSync
call :check_error "%NSSM_PATH% set ChangSincronizador AppDirectory C:\ChangSync"

rem Set DisplayName
%NSSM_PATH% set ChangSincronizador DisplayName "Chang Sincronizador de Ecommerce y tienda local"
call :check_error "%NSSM_PATH% set ChangSincronizador DisplayName \"Chang Sincronizador de Ecommerce y tienda local\""

rem Set Description
%NSSM_PATH% set ChangSincronizador Description "Servicio de sincronización de Ecommerce y tienda local con el fin de mantener actualizados los productos e inventario."
call :check_error "%NSSM_PATH% set ChangSincronizador Description \"Servicio de sincronización de Ecommerce y tienda local con el fin de mantener actualizados los productos e inventario.\""

rem Set Start type
%NSSM_PATH% set ChangSincronizador Start SERVICE_AUTO_START
call :check_error "%NSSM_PATH% set ChangSincronizador Start SERVICE_AUTO_START"

rem Set stdout and stderr log files
%NSSM_PATH% set ChangSincronizador AppStdout C:\ChangSync\logs\server.log
call :check_error "%NSSM_PATH% set ChangSincronizador AppStdout C:\ChangSync\logs\server.log"

%NSSM_PATH% set ChangSincronizador AppStderr C:\ChangSync\logs\stderr.log
call :check_error "%NSSM_PATH% set ChangSincronizador AppStderr C:\ChangSync\logs\stderr.log"


echo Servicio ChangSincronizador instalado exitosamente.
echo Iniciando servicio...

rem Start the service
%NSSM_PATH% start ChangSincronizador
call :check_error "%NSSM_PATH% start ChangSincronizador"

echo Servicio ChangSincronizador iniciado exitosamente!

pause
exit /b

:check_error
if %errorlevel% neq 0 (
    echo Error en el comando: %1
    pause
    exit /b %errorlevel%
)
