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

REM Iniciar el servicio
sc start "%ServiceName%"
if %errorLevel% neq 0 (
    echo No se pudo iniciar el servicio "%ServiceName%". Puede que no exista.
) else (
    echo Servicio "%ServiceName%" iniciado exitosamente.
)

pause
endlocal
