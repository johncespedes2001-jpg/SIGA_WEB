$ErrorActionPreference = 'Stop'
$project = Split-Path $PSScriptRoot -Parent
. (Join-Path $PSScriptRoot 'mariadb-local-common.ps1')
Start-SigaMariaDbLocal
Set-SigaMariaDbLocalEnvironment -EnsureAppUser
$env:NODE_ENV = 'development'
Push-Location $project
try {
  & node --env-file-if-exists=.env operations/official-data-preflight.js
  if ($LASTEXITCODE -ne 0) { throw 'La prevalidación de datos oficiales no fue aprobada.' }
} finally {
  Pop-Location
}
