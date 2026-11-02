param([switch]$IncludeOfficialDataPreflight)

$ErrorActionPreference = 'Stop'
$utf8 = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = $utf8
$OutputEncoding = $utf8
$project = Split-Path $PSScriptRoot -Parent
. (Join-Path $PSScriptRoot 'mariadb-local-common.ps1')

Start-SigaMariaDbLocal
Write-Host '1/7 Instalando y actualizando el esquema MariaDB...' -ForegroundColor Cyan
Set-SigaMariaDbLocalEnvironment -Administrative
Push-Location $project
try {
  & node database/setup-mariadb.js
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo instalar el esquema MariaDB.' }
  Initialize-SigaMariaDbLocalAppUser

  Write-Host '2/7 Cifrando estado, archivos nuevos y proyección relacional...' -ForegroundColor Cyan
  Set-SigaMariaDbLocalEnvironment
  & node operations/protect-mariadb-state.js
  if ($LASTEXITCODE -ne 0) { throw 'La protección cifrada de MariaDB no fue aprobada.' }

  Write-Host 'Verificando esquema, proyección e integridad...' -ForegroundColor Cyan
  & node database/verify-mariadb.js
  if ($LASTEXITCODE -ne 0) { throw 'La verificación MariaDB no fue aprobada.' }

  Write-Host '3/7 Creando respaldo verificable...' -ForegroundColor Cyan
  Set-SigaMariaDbLocalEnvironment -Administrative
  & node operations/backup-mariadb.js '--retention-days=30'
  if ($LASTEXITCODE -ne 0) { throw 'El respaldo MariaDB no fue aprobado.' }

  Write-Host '4/7 Restaurando la copia en una base temporal...' -ForegroundColor Cyan
  & node operations/restore-mariadb-test.js
  if ($LASTEXITCODE -ne 0) { throw 'La restauración MariaDB no fue aprobada.' }

  Write-Host '5/7 Ejecutando pruebas funcionales, visuales y de páginas...' -ForegroundColor Cyan
  & npm run qa
  if ($LASTEXITCODE -ne 0) { throw 'La batería QA no fue aprobada.' }

  Write-Host '6/7 Auditando dependencias de producción...' -ForegroundColor Cyan
  & npm audit --offline --omit=dev
  if ($LASTEXITCODE -ne 0) { throw 'La auditoría de dependencias no fue aprobada.' }

  Write-Host '7/7 Inspeccionando el paquete de publicación...' -ForegroundColor Cyan
  & npm run release:inspect
  if ($LASTEXITCODE -ne 0) { throw 'El paquete de publicación no fue aprobado.' }

  if ($IncludeOfficialDataPreflight) {
    Write-Host 'Validando autorización para datos oficiales...' -ForegroundColor Cyan
    Set-SigaMariaDbLocalEnvironment
    & node --env-file-if-exists=.env operations/official-data-preflight.js
    if ($LASTEXITCODE -ne 0) { throw 'La carga oficial aún no está autorizada.' }
  }
  Write-Host 'AUDITORÍA LOCAL COMPLETADA: APROBADA.' -ForegroundColor Green
} finally {
  Pop-Location
}
