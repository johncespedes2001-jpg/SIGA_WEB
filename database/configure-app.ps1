param(
  [string]$ServerInstance = '.\SIGA2025',
  [string]$TcpServer = '127.0.0.1',
  [int]$TcpPort = 1433,
  [string]$DatabaseName = 'SIGA',
  [string]$ApplicationLogin = 'siga_app',
  [switch]$Force
)

$ErrorActionPreference = 'Stop'

if ($DatabaseName -notmatch '^[A-Za-z][A-Za-z0-9_]{0,63}$') {
  throw 'DatabaseName solo puede contener letras, numeros y guion bajo.'
}
if ($ApplicationLogin -notmatch '^[A-Za-z][A-Za-z0-9_]{0,63}$') {
  throw 'ApplicationLogin solo puede contener letras, numeros y guion bajo.'
}
if ($TcpPort -lt 1 -or $TcpPort -gt 65535) {
  throw 'TcpPort no es valido.'
}

$sqlcmd = Get-Command sqlcmd -ErrorAction SilentlyContinue
$sqlcmdPath = if ($sqlcmd) { $sqlcmd.Source } else { $null }
if (-not $sqlcmdPath) {
  $sqlcmdPath = @(
    'C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\180\Tools\Binn\SQLCMD.EXE'
    'C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn\SQLCMD.EXE'
    'C:\Program Files\Microsoft SQL Server\170\Tools\Binn\SQLCMD.EXE'
  ) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
}
if (-not $sqlcmdPath) {
  throw 'No se encontro sqlcmd. Instale Microsoft SQL Server Command Line Utilities.'
}

if (-not (Test-NetConnection -ComputerName $TcpServer -Port $TcpPort -InformationLevel Quiet)) {
  throw "SQL Server no escucha en ${TcpServer}:$TcpPort. Habilite TCP/IP para SIGA2025, configure IPAll en el puerto 1433 y reinicie el servicio."
}

$projectDirectory = Split-Path -Parent $PSScriptRoot
$environmentPath = Join-Path $projectDirectory '.env'
if ((Test-Path -LiteralPath $environmentPath) -and -not $Force) {
  throw 'El archivo .env ya existe. Use -Force solo si desea reemplazar su configuracion SQL.'
}

$randomBytes = [byte[]]::new(24)
$randomGenerator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try {
  $randomGenerator.GetBytes($randomBytes)
} finally {
  $randomGenerator.Dispose()
}
$randomSecret = [Convert]::ToBase64String($randomBytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
$applicationPassword = "Sg9!$randomSecret"
$escapedPassword = $applicationPassword.Replace("'", "''")
$sessionBytes = [byte[]]::new(48)
$sessionGenerator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try {
  $sessionGenerator.GetBytes($sessionBytes)
} finally {
  $sessionGenerator.Dispose()
}
$sessionSecret = [Convert]::ToBase64String($sessionBytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')

$temporarySql = Join-Path ([System.IO.Path]::GetTempPath()) ("siga-login-{0}.sql" -f [guid]::NewGuid().ToString('N'))
$loginSql = @"
USE [master];
IF SUSER_ID(N'$ApplicationLogin') IS NULL
  CREATE LOGIN [$ApplicationLogin]
    WITH PASSWORD = N'$escapedPassword', CHECK_POLICY = ON, CHECK_EXPIRATION = OFF;
ELSE
BEGIN
  ALTER LOGIN [$ApplicationLogin] WITH PASSWORD = N'$escapedPassword';
  ALTER LOGIN [$ApplicationLogin] ENABLE;
END;
GO
USE [$DatabaseName];
IF USER_ID(N'$ApplicationLogin') IS NULL
  CREATE USER [$ApplicationLogin] FOR LOGIN [$ApplicationLogin];
GRANT SELECT, INSERT, UPDATE ON dbo.EstadoAplicacion TO [$ApplicationLogin];
GRANT EXECUTE ON dbo.SincronizarEstadoRelacional TO [$ApplicationLogin];
GO
"@

try {
  [System.IO.File]::WriteAllText($temporarySql, $loginSql, [System.Text.UTF8Encoding]::new($true))
  & $sqlcmdPath -S $ServerInstance -E -C -b -i $temporarySql
  if ($LASTEXITCODE -ne 0) {
    throw 'SQL Server rechazo la creacion del usuario de aplicacion.'
  }

  & $sqlcmdPath -S "tcp:$TcpServer,$TcpPort" -U $ApplicationLogin -P $applicationPassword -C -b -d $DatabaseName -Q 'SET NOCOUNT ON; SELECT N''Conexion SIGA OK'' AS Resultado;'
  if ($LASTEXITCODE -ne 0) {
    throw 'No se pudo validar el usuario siga_app mediante TCP/IP.'
  }
} finally {
  if (Test-Path -LiteralPath $temporarySql) {
    Remove-Item -LiteralPath $temporarySql -Force
  }
}

$environmentContent = @"
SIGA_STORAGE=sqlserver
SIGA_SQL_SERVER=$TcpServer
SIGA_SQL_PORT=$TcpPort
SIGA_SQL_DATABASE=$DatabaseName
SIGA_SQL_USER=$ApplicationLogin
SIGA_SQL_PASSWORD=$applicationPassword
SIGA_SQL_ENCRYPT=true
SIGA_SQL_TRUST_CERTIFICATE=true
SIGA_SESSION_SECRET=$sessionSecret
SIGA_REQUIRE_RELATIONAL_SYNC=true
PORT=3000
SIGA_DEMO_MODE=false
"@

[System.IO.File]::WriteAllText($environmentPath, $environmentContent, [System.Text.UTF8Encoding]::new($false))
Write-Host 'Usuario SQL de aplicacion creado y conexion TCP validada.' -ForegroundColor Green
Write-Host "Configuracion privada guardada en $environmentPath" -ForegroundColor Green
Write-Host 'La contrasena no se mostro ni se guardo en el codigo fuente.' -ForegroundColor DarkGray
