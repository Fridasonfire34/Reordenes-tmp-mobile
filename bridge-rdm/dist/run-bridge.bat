@echo off
rem run-bridge.bat - inicia bridge-rdm.exe desde la carpeta del script
setlocal enabledelayedexpansion
pushd "%~dp0"

echo [%DATE% %TIME%] Iniciando bridge-rdm >> bridge-rdm.log

rem Si se pasa "interactive" ejecuta en primer plano (útil para depuración)
if /I "%1"=="interactive" (
    echo Ejecutando en modo interactive...
    "%~dp0bridge-rdm.exe" >> "%~dp0bridge-rdm.log" 2>&1
) else (
    rem Inicia en segundo plano (ventana de cmd se cierra pero el proceso queda)
    start "bridge-rdm" "%~dp0bridge-rdm.exe" >> "%~dp0bridge-rdm.log" 2>&1
)

popd
endlocal
