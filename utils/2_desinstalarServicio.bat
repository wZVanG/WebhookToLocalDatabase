@echo off
setlocal

REM Configuración del servicio
set "ServiceName=ChangSincronizador"

REM Verificar privilegios de administrador
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Este script requiere privilegios de administrador. Por favor, ejecútelo como administrador.
    pause
    exit /b 1
)

REM Detener el servicio antes de eliminarlo
sc stop "%ServiceName%"
if %errorLevel% neq 0 (
    echo No se pudo detener el servicio "%ServiceName%". Puede que no esté en ejecución o no exista.
)

REM Eliminar el servicio
sc delete "%ServiceName%"
if %errorLevel% neq 0 (
    echo No se pudo eliminar el servicio "%ServiceName%". Puede que no exista.
) else (
    echo Servicio "%ServiceName%" eliminado exitosamente.
)

pause
endlocal
