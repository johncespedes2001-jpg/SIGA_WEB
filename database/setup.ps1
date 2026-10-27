param(
  [Parameter(Mandatory = $true)]
  [string]$ServerInstance,

  [string]$DatabaseName = 'SIGA',

  [switch]$UseSqlAuthentication,

  [switch]$Recreate
)

$ErrorActionPreference = 'Stop'

if ($DatabaseName -notmatch '^[A-Za-z][A-Za-z0-9_]{0,63}$') {
  throw 'DatabaseName solo puede contener letras, números y guion bajo.'
}

$sqlcmd = Get-Command sqlcmd -ErrorAction SilentlyContinue
$sqlcmdPath = if ($sqlcmd) { $sqlcmd.Source } else { $null }

if (-not $sqlcmdPath) {
  $sqlcmdCandidates = @(
    'C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\180\Tools\Binn\SQLCMD.EXE'
    'C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn\SQLCMD.EXE'
    'C:\Program Files\Microsoft SQL Server\170\Tools\Binn\SQLCMD.EXE'
  )

  $sqlcmdPath = $sqlcmdCandidates |
    Where-Object { Test-Path -LiteralPath $_ } |
    Select-Object -First 1
}

if (-not $sqlcmdPath) {
  throw 'No se encontro sqlcmd. Instale Microsoft SQL Server Command Line Utilities.'
}

$projectDirectory = Split-Path -Parent $PSScriptRoot
$scripts = @(
  Join-Path $PSScriptRoot '01-create-database.sql'
  Join-Path $PSScriptRoot '02-schema.sql'
  Join-Path $PSScriptRoot '03-seed-catalogs.sql'
  Join-Path $PSScriptRoot '05-sync-relational.sql'
  Join-Path $PSScriptRoot '06-migrate-admin-consistency.sql'
  Join-Path $PSScriptRoot '04-verify.sql'
)

$arguments = @(
  '-S', $ServerInstance,
  '-b',
  '-C',
  '-f', 'i:65001',
  '-v', "DatabaseName=$DatabaseName"
)

if ($UseSqlAuthentication) {
  if (-not $env:SIGA_SQL_USER -or -not $env:SIGA_SQL_PASSWORD) {
    throw 'Defina SIGA_SQL_USER y SIGA_SQL_PASSWORD antes de usar -UseSqlAuthentication.'
  }
  $arguments += @('-U', $env:SIGA_SQL_USER, '-P', $env:SIGA_SQL_PASSWORD)
} else {
  $arguments += '-E'
}

if ($Recreate) {
  Write-Host "Eliminando la base de datos incompleta $DatabaseName..." -ForegroundColor Yellow
  $dropDatabaseQuery = @"
IF DB_ID(N'$DatabaseName') IS NOT NULL
BEGIN
  ALTER DATABASE [$DatabaseName] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
  DROP DATABASE [$DatabaseName];
END;
"@

  & $sqlcmdPath @arguments -Q $dropDatabaseQuery
  if ($LASTEXITCODE -ne 0) {
    throw "No se pudo eliminar la base de datos incompleta $DatabaseName."
  }
}

foreach ($script in $scripts) {
  Write-Host "Ejecutando $([System.IO.Path]::GetFileName($script))..." -ForegroundColor Cyan
  & $sqlcmdPath @arguments -i $script
  if ($LASTEXITCODE -ne 0) {
    throw "SQL Server rechazo el script $script."
  }
}

Write-Host "Base de datos $DatabaseName preparada correctamente." -ForegroundColor Green
Write-Host "Proyecto: $projectDirectory"

