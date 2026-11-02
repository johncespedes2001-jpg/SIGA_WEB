param(
  [string]$XamppRoot = 'C:\xampp'
)

$ErrorActionPreference = 'Stop'
$project = Split-Path $PSScriptRoot -Parent
$dataDir = Join-Path $XamppRoot 'mysql\data'
$systemDbDir = Join-Path $dataDir 'mysql'
$ariaCheck = Join-Path $XamppRoot 'mysql\bin\aria_chk.exe'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$evidenceDir = Join-Path $project "backups\mariadb\aria-repair-$stamp"
$systemBackup = Join-Path $evidenceDir 'mysql-system-tables'
$logBackup = Join-Path $evidenceDir 'aria-logs'

if (Get-Process mysqld, mariadbd -ErrorAction SilentlyContinue) {
  throw 'MySQL/MariaDB sigue ejecutándose. Deténgalo completamente desde XAMPP antes de reparar Aria.'
}
if (-not (Test-Path $ariaCheck -PathType Leaf)) {
  throw "No se encontró aria_chk.exe en $ariaCheck."
}
if (-not (Test-Path $systemDbDir -PathType Container)) {
  throw "No se encontró la base del sistema de MariaDB en $systemDbDir."
}

$ariaTables = @(Get-ChildItem $systemDbDir -Filter '*.MAI' -File)
if (-not $ariaTables.Count) {
  throw 'No se encontraron tablas Aria para reparar.'
}

New-Item -ItemType Directory -Path $systemBackup -Force | Out-Null
New-Item -ItemType Directory -Path $logBackup -Force | Out-Null

Write-Host "Copia preventiva: $evidenceDir" -ForegroundColor Cyan
Copy-Item (Join-Path $systemDbDir '*') $systemBackup -Recurse -Force
Get-ChildItem $dataDir -Filter 'aria_log*' -File -ErrorAction SilentlyContinue |
  Copy-Item -Destination $logBackup -Force

foreach ($table in $ariaTables) {
  Write-Host "Reparando $($table.Name)..."
  # MariaDB está detenido y el propio aria_log_control está dañado. La
  # recuperación segura trabaja con keycache, evita el límite de sort buffer
  # de XAMPP y no intenta abrir el control corrupto.
  & $ariaCheck '--safe-recover' '--force' '--ignore-control-file' $table.FullName
  if ($LASTEXITCODE -ne 0) {
    throw "aria_chk no pudo reparar $($table.FullName). Se conservó la copia preventiva en $evidenceDir."
  }
}

# El control y los segmentos dañados se archivan, no se eliminan. MariaDB los
# vuelve a crear al arrancar, y la copia permite una recuperación manual.
Get-ChildItem $dataDir -Filter 'aria_log*' -File -ErrorAction SilentlyContinue |
  Move-Item -Destination $logBackup -Force

Write-Host 'REPARACIÓN ARIA COMPLETADA.' -ForegroundColor Green
Write-Host "Archivos anteriores conservados en: $evidenceDir"
Write-Host 'Ahora pulse Start en la fila MySQL del panel XAMPP.'
