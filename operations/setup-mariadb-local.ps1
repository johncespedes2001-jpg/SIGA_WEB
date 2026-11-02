$ErrorActionPreference = 'Stop'
$project = Split-Path $PSScriptRoot -Parent
. (Join-Path $PSScriptRoot 'mariadb-local-common.ps1')
Start-SigaMariaDbLocal
Set-SigaMariaDbLocalEnvironment -Administrative

Push-Location $project
try {
  & node database/setup-mariadb.js
  if ($LASTEXITCODE -ne 0) { throw "La instalación del esquema MariaDB terminó con código $LASTEXITCODE." }
  Initialize-SigaMariaDbLocalAppUser
} finally {
  Pop-Location
}
