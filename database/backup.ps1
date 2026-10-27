param(
  [string]$ServerInstance = '.\SIGA2025',
  [string]$DatabaseName = 'SIGA',
  [string]$BackupDirectory = '',
  [string]$OffsiteDirectory = '',
  [switch]$RequireOffsite,
  [switch]$TrustServerCertificate,
  [ValidateRange(1, 3650)]
  [int]$RetentionDays = 30
)

$ErrorActionPreference = 'Stop'
if ($DatabaseName -notmatch '^[A-Za-z][A-Za-z0-9_]{0,63}$') {
  throw 'DatabaseName solo puede contener letras, números y guion bajo.'
}

$sqlcmdPath = @(
  (Get-Command sqlcmd -ErrorAction SilentlyContinue).Source
  'C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\180\Tools\Binn\SQLCMD.EXE'
  'C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn\SQLCMD.EXE'
  'C:\Program Files\Microsoft SQL Server\170\Tools\Binn\SQLCMD.EXE'
) | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
if (-not $sqlcmdPath) { throw 'No se encontró sqlcmd.' }
$sqlConnectionArgs = @('-S', $ServerInstance, '-E', '-b')
if ($TrustServerCertificate) { $sqlConnectionArgs += '-C' }

if (-not $BackupDirectory) {
  $BackupDirectory = (& $sqlcmdPath @sqlConnectionArgs -h -1 -W -Q "SET NOCOUNT ON; SELECT CAST(SERVERPROPERTY('InstanceDefaultBackupPath') AS nvarchar(4000));" | Select-Object -First 1).Trim()
}
if (-not $BackupDirectory) { throw 'No se pudo determinar el directorio de copias de SQL Server.' }
$resolvedDirectory = [System.IO.Path]::GetFullPath($BackupDirectory)
if (-not (Test-Path -LiteralPath $resolvedDirectory)) { New-Item -ItemType Directory -Path $resolvedDirectory | Out-Null }

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupPath = Join-Path $resolvedDirectory ("{0}-{1}.bak" -f $DatabaseName, $timestamp)
$escapedPath = $backupPath.Replace("'", "''")
$query = "BACKUP DATABASE [$DatabaseName] TO DISK = N'$escapedPath' WITH COPY_ONLY, INIT, CHECKSUM, STATS = 10; RESTORE VERIFYONLY FROM DISK = N'$escapedPath' WITH CHECKSUM;"
& $sqlcmdPath @sqlConnectionArgs -Q $query
if ($LASTEXITCODE -ne 0) { throw 'SQL Server no pudo crear o verificar la copia de seguridad.' }

if ($RequireOffsite -and -not $OffsiteDirectory) { throw 'RequireOffsite exige indicar OffsiteDirectory.' }
if ($OffsiteDirectory) {
  $resolvedOffsite = [System.IO.Path]::GetFullPath($OffsiteDirectory)
  if ($resolvedOffsite -eq $resolvedDirectory) { throw 'OffsiteDirectory debe ser diferente del directorio local.' }
  if (-not (Test-Path -LiteralPath $resolvedOffsite)) { New-Item -ItemType Directory -Path $resolvedOffsite | Out-Null }
  $offsitePath = Join-Path $resolvedOffsite ([System.IO.Path]::GetFileName($backupPath))
  Copy-Item -LiteralPath $backupPath -Destination $offsitePath -Force
  $localHash = (Get-FileHash -LiteralPath $backupPath -Algorithm SHA256).Hash
  $offsiteHash = (Get-FileHash -LiteralPath $offsitePath -Algorithm SHA256).Hash
  if ($localHash -ne $offsiteHash) { throw 'La copia externa no superó la verificación SHA-256.' }
}

$cutoff = (Get-Date).AddDays(-$RetentionDays)
Get-ChildItem -LiteralPath $resolvedDirectory -Filter "$DatabaseName-*.bak" -File |
  Where-Object { $_.LastWriteTime -lt $cutoff } |
  Remove-Item -Force
if ($OffsiteDirectory) {
  Get-ChildItem -LiteralPath $resolvedOffsite -Filter "$DatabaseName-*.bak" -File |
    Where-Object { $_.LastWriteTime -lt $cutoff } |
    Remove-Item -Force
}

Write-Host "Copia verificada correctamente: $backupPath" -ForegroundColor Green
if ($OffsiteDirectory) { Write-Host "Copia externa verificada: $offsitePath" -ForegroundColor Green }
Write-Host "Retención aplicada: $RetentionDays días." -ForegroundColor DarkGray
