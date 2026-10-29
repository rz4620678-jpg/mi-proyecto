@echo off
setlocal EnableExtensions DisableDelayedExpansion

for %%I in ("%~dp0.") do set "ROOT=%%~fI"
cd /d "%ROOT%"
if not exist "%ROOT%\portable-config.bat" (
  echo ERROR: Falta portable-config.bat.
  pause
  exit /b 1
)
call "%ROOT%\portable-config.bat"

set "PHP_EXE=%ROOT%\php\php.exe"
set "PHP_PID_FILE=%ROOT%\run\php.pid"
set "PORTS_FILE=%ROOT%\run\portable-ports.bat"
set "MYSQLADMIN=%ROOT%\mariadb\bin\mysqladmin.exe"
set "PORTABLE_DATA_DIR=%ROOT%\data"
set "PORTABLE_WWW_DIR=%ROOT%\www"

if exist "%PORTS_FILE%" call "%PORTS_FILE%"

set "DB_INSTANCE_CHECK="
for /f "delims=" %%A in ('powershell -NoProfile -Command "$data=[IO.Path]::GetFullPath($env:PORTABLE_DATA_DIR).TrimEnd('\'); $p=Get-CimInstance Win32_Process -ErrorAction Stop | Where-Object { $_.Name -ieq 'mysqld.exe' -and $_.CommandLine -and $_.CommandLine.IndexOf($data,[StringComparison]::OrdinalIgnoreCase) -ge 0 } | Select-Object -First 1; if (-not $p) { 'CLEAR' } elseif ($p.CommandLine -match '--port=(\d+)') { $Matches[1] } else { 'UNKNOWN' }"') do set "DB_INSTANCE_CHECK=%%A"
if not defined DB_INSTANCE_CHECK (
  echo ERROR: No se pudo identificar MariaDB de esta carpeta.
  pause
  exit /b 1
)
if "%DB_INSTANCE_CHECK%"=="CLEAR" (
  echo MariaDB de esta carpeta no esta ejecutandose.
  exit /b 0
)
if "%DB_INSTANCE_CHECK%"=="UNKNOWN" (
  echo ERROR: No se pudo determinar el puerto de MariaDB de esta carpeta.
  pause
  exit /b 1
)
set "PORTABLE_DB_PORT=%DB_INSTANCE_CHECK%"

if exist "%PHP_PID_FILE%" (
  powershell -NoProfile -Command "$id=[int](Get-Content -LiteralPath $env:PHP_PID_FILE); $p=Get-CimInstance Win32_Process -Filter ('ProcessId='+$id); if ($p -and $p.ExecutablePath -ieq $env:PHP_EXE -and $p.CommandLine -and $p.CommandLine.IndexOf($env:PORTABLE_WWW_DIR,[StringComparison]::OrdinalIgnoreCase) -ge 0) { Stop-Process -Id $id -Force }; Remove-Item -LiteralPath $env:PHP_PID_FILE -Force"
)

"%MYSQLADMIN%" --connect-timeout=3 --protocol=tcp --host=127.0.0.1 --port=%PORTABLE_DB_PORT% --user=root --password=%PORTABLE_ROOT_PASSWORD% shutdown >nul 2>&1
if errorlevel 1 (
  echo No se pudo confirmar el cierre de MariaDB.
  echo Si el sistema no estaba iniciado, no hay nada que cerrar.
  pause
  exit /b 1
)

if exist "%PORTS_FILE%" del "%PORTS_FILE%"
echo Sistema cerrado.
exit /b 0
