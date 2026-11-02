$ErrorActionPreference = 'Stop'
$project = Split-Path $PSScriptRoot -Parent
. (Join-Path $PSScriptRoot 'mariadb-local-common.ps1')
Start-SigaMariaDbLocal
Set-SigaMariaDbLocalEnvironment -EnsureAppUser

Push-Location $project
try {
  & node database/verify-mariadb.js
  if ($LASTEXITCODE -ne 0) { throw "La verificación MariaDB terminó con código $LASTEXITCODE." }
} finally {
  Pop-Location
}
