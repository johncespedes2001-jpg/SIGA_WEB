$ErrorActionPreference = 'Stop'
$project = Split-Path $PSScriptRoot -Parent
. (Join-Path $PSScriptRoot 'mariadb-local-common.ps1')
Start-SigaMariaDbLocal
Set-SigaMariaDbLocalEnvironment -Administrative
Push-Location $project
try { & node operations/restore-mariadb-test.js; if ($LASTEXITCODE -ne 0) { throw 'La restauración de prueba MariaDB local no pudo completarse.' } }
finally { Pop-Location }
