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
set "MYSQLD=%ROOT%\mariadb\bin\mysqld.exe"
set "MYSQLADMIN=%ROOT%\mariadb\bin\mysqladmin.exe"
set "DATA=%ROOT%\data"
set "WWW=%ROOT%\www"
set "LOGS=%ROOT%\logs"
set "RUN=%ROOT%\run"
set "PHP_PID_FILE=%RUN%\php.pid"
set "PORTS_FILE=%RUN%\portable-ports.bat"

if not exist "%PHP_EXE%" (
  echo ERROR: No se encontro php\php.exe.
  pause
  exit /b 1
)
if not exist "%MYSQLD%" (
  echo ERROR: No se encontro mariadb\bin\mysqld.exe.
  pause
  exit /b 1
)
if not exist "%MYSQLADMIN%" (
  echo ERROR: No se encontro mariadb\bin\mysqladmin.exe.
  pause
  exit /b 1
)
if not exist "%DATA%\ibdata1" (
  echo ERROR: La base portable no esta inicializada.
  pause
  exit /b 1
)
if not exist "%WWW%\frontend\dist\index.html" (
  echo ERROR: Falta www\frontend\dist\index.html.
  pause
  exit /b 1
)
if not exist "%WWW%\backend\api.php" (
  echo ERROR: Falta www\backend\api.php.
  pause
  exit /b 1
)
if not exist "%LOGS%" mkdir "%LOGS%"
if not exist "%RUN%" mkdir "%RUN%"
if not exist "%RUN%\sessions" mkdir "%RUN%\sessions"

set "PHPRC=%ROOT%\php\php.ini"
set "PHP_INI_SCAN_DIR="
set "PORTS_FILE=%PORTS_FILE%"
set "PORTABLE_DATA_DIR=%DATA%"
set "PORTABLE_WWW_DIR=%WWW%"
set "PHP_EXE=%PHP_EXE%"

set "WEB_INSTANCE_CHECK="
for /f "delims=" %%A in ('powershell -NoProfile -Command "$www=[IO.Path]::GetFullPath($env:PORTABLE_WWW_DIR).TrimEnd('\'); $p=Get-CimInstance Win32_Process -ErrorAction Stop | Where-Object { $_.Name -ieq 'php.exe' -and $_.ExecutablePath -ieq $env:PHP_EXE -and $_.CommandLine -and $_.CommandLine.IndexOf($www,[StringComparison]::OrdinalIgnoreCase) -ge 0 } | Select-Object -First 1; if (-not $p) { 'CLEAR' } elseif ($p.CommandLine -match '127\.0\.0\.1:(\d+)') { $Matches[1] } else { 'UNKNOWN' }"') do set "WEB_INSTANCE_CHECK=%%A"
if not defined WEB_INSTANCE_CHECK (
  echo ERROR: No se pudo comprobar si la aplicacion ya esta ejecutandose.
  pause
  exit /b 1
)
if not "%WEB_INSTANCE_CHECK%"=="CLEAR" (
  if "%WEB_INSTANCE_CHECK%"=="UNKNOWN" (
    echo ERROR: La aplicacion ya esta ejecutandose, pero no se pudo identificar su puerto.
    pause
    exit /b 1
  )
  start "" "http://127.0.0.1:%WEB_INSTANCE_CHECK%/frontend/dist/"
  echo La aplicacion ya estaba iniciada: http://127.0.0.1:%WEB_INSTANCE_CHECK%/frontend/dist/
  exit /b 0
)

set "DB_INSTANCE_CHECK="
for /f "delims=" %%A in ('powershell -NoProfile -Command "$data=[IO.Path]::GetFullPath($env:PORTABLE_DATA_DIR).TrimEnd('\'); $p=Get-CimInstance Win32_Process -ErrorAction Stop | Where-Object { $_.Name -ieq 'mysqld.exe' -and $_.CommandLine -and $_.CommandLine.IndexOf($data,[StringComparison]::OrdinalIgnoreCase) -ge 0 } | Select-Object -First 1; if (-not $p) { 'CLEAR' } elseif ($p.CommandLine -match '--port=(\d+)') { $Matches[1] } else { 'UNKNOWN' }"') do set "DB_INSTANCE_CHECK=%%A"
if not defined DB_INSTANCE_CHECK (
  echo ERROR: No se pudo comprobar si MariaDB ya esta ejecutandose.
  pause
  exit /b 1
)
if not "%DB_INSTANCE_CHECK%"=="CLEAR" (
  echo ERROR: MariaDB ya esta en ejecucion para esta carpeta.
  if not "%DB_INSTANCE_CHECK%"=="UNKNOWN" echo Puerto actual: %DB_INSTANCE_CHECK%.
  echo No inicies otra instancia. Para reiniciar, ejecuta CERRAR.bat primero.
  pause
  exit /b 1
)

powershell -NoProfile -Command "$busy=@(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | ForEach-Object { [int]$_.LocalPort }); $db=[int]$env:PORTABLE_DB_PORT; while($db -in $busy){$db++}; $web=[int]$env:PORTABLE_WEB_PORT; while(($web -in $busy) -or $web -eq $db){$web++}; if($db -gt 65535 -or $web -gt 65535){exit 1}; [IO.File]::WriteAllText($env:PORTS_FILE, ('set PORTABLE_DB_PORT='+$db+[Environment]::NewLine+'set PORTABLE_WEB_PORT='+$web), [Text.Encoding]::ASCII)"
if errorlevel 1 (
  echo ERROR: No se encontraron puertos libres para iniciar el sistema.
  pause
  exit /b 1
)
call "%PORTS_FILE%"
if not "%PORTABLE_DB_PORT%"=="3307" echo MariaDB usara el puerto %PORTABLE_DB_PORT% porque el puerto habitual esta ocupado.
if not "%PORTABLE_WEB_PORT%"=="8080" echo La aplicacion usara el puerto %PORTABLE_WEB_PORT% porque el puerto habitual esta ocupado.

set "FACTURAS_DB_HOST=127.0.0.1"
set "FACTURAS_DB_PORT=%PORTABLE_DB_PORT%"
set "FACTURAS_DB_NAME=facturas_cobrar"
set "FACTURAS_DB_USER=facturas_app"
set "FACTURAS_DB_PASSWORD=%PORTABLE_APP_PASSWORD%"

start "" /b "%MYSQLD%" --no-defaults --basedir="%ROOT%\mariadb" --datadir="%DATA%" --port=%PORTABLE_DB_PORT% --bind-address=127.0.0.1 --pid-file="%RUN%\mariadb.pid" --log-error="%LOGS%\mariadb.err"

set "DB_READY="
for /L %%I in (1,1,30) do (
  "%MYSQLADMIN%" --connect-timeout=2 --protocol=tcp --host=127.0.0.1 --port=%PORTABLE_DB_PORT% --user=root --password=%PORTABLE_ROOT_PASSWORD% ping >nul 2>&1
  if not errorlevel 1 set "DB_READY=1"
  if defined DB_READY goto DB_OK
  timeout /t 1 /nobreak >nul
)

echo ERROR: MariaDB no inicio. Revisa logs\mariadb.err.
pause
exit /b 1

:DB_OK
"%PHP_EXE%" -r "exit(extension_loaded('pdo_mysql') && extension_loaded('mbstring') ? 0 : 1);"
if errorlevel 1 (
  echo ERROR: PHP requiere las extensiones pdo_mysql y mbstring.
  pause
  exit /b 1
)

start "" /b "%PHP_EXE%" -d "session.save_path=%RUN%\sessions" -d "sys_temp_dir=%RUN%" -d "upload_tmp_dir=%RUN%" -S 127.0.0.1:%PORTABLE_WEB_PORT% -t "%WWW%" >> "%LOGS%\php.log" 2>&1
set "PORTABLE_WWW=%WWW%"
set "PHP_EXE=%PHP_EXE%"
set "PHP_PID_FILE=%PHP_PID_FILE%"
timeout /t 1 /nobreak >nul
powershell -NoProfile -Command "$p=Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'php.exe' -and $_.ExecutablePath -ieq $env:PHP_EXE -and $_.CommandLine -like ('*127.0.0.1:'+ $env:PORTABLE_WEB_PORT +'*') -and $_.CommandLine -like ('*'+$env:PORTABLE_WWW+'*') } | Select-Object -First 1; if (-not $p) { exit 1 }; [IO.File]::WriteAllText($env:PHP_PID_FILE,[string]$p.ProcessId)"
if errorlevel 1 (
  echo ERROR: PHP no inicio. Revisa logs\php.log.
  pause
  exit /b 1
)

start "" "http://127.0.0.1:%PORTABLE_WEB_PORT%/frontend/dist/"
echo Direccion local: http://127.0.0.1:%PORTABLE_WEB_PORT%/frontend/dist/
echo Sistema iniciado. Para cerrarlo, ejecuta CERRAR.bat.
exit /b 0
