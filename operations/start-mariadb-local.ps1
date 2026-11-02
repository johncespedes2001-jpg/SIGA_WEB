param([int]$Port = 3000)

$ErrorActionPreference = 'Stop'
$project = Split-Path $PSScriptRoot -Parent
. (Join-Path $PSScriptRoot 'mariadb-local-common.ps1')
$driver = Join-Path $project 'node_modules\mysql2\package.json'
if (-not (Test-Path -LiteralPath $driver -PathType Leaf)) {
  throw 'Falta mysql2. Ejecute "npm install" desde la raiz del proyecto y vuelva a intentarlo.'
}

Start-SigaMariaDbLocal
Set-SigaMariaDbLocalEnvironment -EnsureAppUser
$env:NODE_ENV = 'development'
$env:PORT = [string]$Port

Push-Location $project
try {
  & node --env-file-if-exists=.env server.js
  if ($LASTEXITCODE -ne 0) { throw "SIGA termino con codigo $LASTEXITCODE." }
} finally {
  Pop-Location
}
