param([int]$RetentionDays = 30)

$ErrorActionPreference = 'Stop'
$project = Split-Path $PSScriptRoot -Parent
. (Join-Path $PSScriptRoot 'mariadb-local-common.ps1')
Start-SigaMariaDbLocal
Set-SigaMariaDbLocalEnvironment -Administrative
Push-Location $project
try { & node operations/backup-mariadb.js "--retention-days=$RetentionDays"; if ($LASTEXITCODE -ne 0) { throw 'El respaldo MariaDB local no pudo completarse.' } }
finally { Pop-Location }
