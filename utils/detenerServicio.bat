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

REM Detener el servicio
sc stop "%ServiceName%"
if %errorLevel% neq 0 (
    echo No se pudo detener el servicio "%ServiceName%". Puede que no esté en ejecución o no exista.
) else (
    echo Servicio "%ServiceName%" detenido exitosamente.
)

pause
endlocal
