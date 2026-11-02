param(
  [string]$Remote = 'origin',
  [string]$Branch = 'main',
  [string]$Message = 'feat: migrar SIGA a MariaDB y preparar despliegue cPanel'
)

$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $projectRoot

if (-not (Test-Path (Join-Path $projectRoot '.git'))) {
  throw 'No se encontro el repositorio Git de SIGA.'
}

git diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
  throw 'Ya existen archivos preparados manualmente en Git. Publiquelos o retirelos antes de ejecutar este script para no mezclar cambios.'
}

$sourcePaths = @(
  '.env.example',
  '.gitignore',
  '.npmignore',
  'README.md',
  'THIRD_PARTY_NOTICES.md',
  'database',
  'deployment',
  'operations',
  'package.json',
  'package-lock.json',
  'npm-shrinkwrap.json',
  'public',
  'server.js',
  'study-plan-catalog.js',
  'templates',
  'tests'
)

Write-Host 'Comprobando el repositorio remoto...'
git fetch $Remote
if ($LASTEXITCODE -ne 0) {
  throw 'No se pudo consultar GitHub. Revise Internet y la autenticacion de Git.'
}

$divergence = (git rev-list --left-right --count "HEAD...$Remote/$Branch").Trim() -split '\s+'
if ($LASTEXITCODE -ne 0 -or $divergence.Count -lt 2) {
  throw 'No se pudo comparar la rama local con GitHub.'
}

$remoteAhead = [int]$divergence[1]
if ($remoteAhead -gt 0) {
  throw "GitHub tiene $remoteAhead cambio(s) que no estan en esta carpeta. Integre esos cambios antes de publicar; el script no usara force push."
}

Write-Host 'Preparando solamente codigo, pruebas y archivos de despliegue...'
git add -A -- $sourcePaths
if ($LASTEXITCODE -ne 0) {
  throw 'No se pudieron preparar los archivos para el commit.'
}

$staged = @(git diff --cached --name-only)
if ($staged.Count -eq 0) {
  Write-Host 'GitHub ya esta actualizado: no hay cambios de codigo pendientes.'
  exit 0
}

$forbidden = $staged | Where-Object {
  $_ -match '(^|/)(\.env|data|outputs|release|tmp|backups|node_modules|\.playwright-browsers|informe_trabajo)(/|$)' -or
  $_ -match '\.(bak|log)$'
}
if ($forbidden) {
  throw "Se detectaron archivos privados o generados. No se creara el commit:`n$($forbidden -join "`n")"
}

git diff --cached --check
if ($LASTEXITCODE -ne 0) {
  throw 'La validacion del cambio encontro errores de formato. No se creo el commit.'
}

Write-Host "Archivos preparados: $($staged.Count)"
git diff --cached --stat

git commit -m $Message
if ($LASTEXITCODE -ne 0) {
  throw 'No se pudo crear el commit.'
}

git push $Remote "HEAD:$Branch"
if ($LASTEXITCODE -ne 0) {
  throw 'El commit se creo localmente, pero GitHub rechazo la publicacion. No se uso force push.'
}

$commit = (git rev-parse --short HEAD).Trim()
Write-Host "GitHub actualizado correctamente. Commit: $commit"
