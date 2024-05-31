@echo off
setlocal

REM Configuración del servicio
set "ServiceName=ChangSincronizador"
set "DisplayName=Chang Sincronizador de Ecommerce y tienda local."
set "Description=Servicio de sincronización de Ecommerce y tienda local con el fin de mantener actualizados los productos e inventario."
set "ExecutablePath=C:\ChangSync\ChangEcommerceSync.exe"
set "StartType=auto"

REM Verificar privilegios de administrador
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Este script requiere privilegios de administrador. Por favor, ejecútelo como administrador.
    pause
    exit /b 1
)

REM Verificar si el servicio ya existe
sc query "%ServiceName%" | find "STATE" > nul
if %errorLevel% equ 0 (
    echo El servicio "%ServiceName%" ya está instalado.
    pause
    exit /b 1
)

REM Crear el servicio
sc create "%ServiceName%" binPath= "\"%ExecutablePath%\"" DisplayName= "%DisplayName%" start= "%StartType%"
if %errorLevel% neq 0 (
    echo No se pudo crear el servicio "%ServiceName%". Puede que ya exista o haya un problema con la configuración.
    pause
    exit /b 1
)

sc description "%ServiceName%" "%Description%"
if %errorLevel% neq 0 (
    echo No se pudo establecer la descripción para el servicio "%ServiceName%". Puede que haya un problema con la configuración.
    pause
    exit /b 1
)

echo Servicio "%ServiceName%" creado exitosamente. El ejecutable debe estar en la ruta: "%ExecutablePath%"

pause
endlocal
