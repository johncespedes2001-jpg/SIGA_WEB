param(
  [Parameter(Mandatory = $true)][string]$BackupPath,
  [string]$ServerInstance = '.\SIGA2025',
  [switch]$TrustServerCertificate
)

$ErrorActionPreference = 'Stop'
$resolvedBackup = [System.IO.Path]::GetFullPath($BackupPath)
if (-not (Test-Path -LiteralPath $resolvedBackup -PathType Leaf)) { throw 'No se encontró la copia indicada.' }
if ([System.IO.Path]::GetExtension($resolvedBackup) -ne '.bak') { throw 'La prueba solo admite archivos .bak.' }
$sqlcmd = (Get-Command sqlcmd -ErrorAction SilentlyContinue).Source
if (-not $sqlcmd) { throw 'No se encontró sqlcmd.' }
$args = @('-S', $ServerInstance, '-E', '-b')
if ($TrustServerCertificate) { $args += '-C' }
$testDatabase = 'SIGA_RestoreTest_' + (Get-Date -Format 'yyyyMMddHHmmss')
$escapedBackup = $resolvedBackup.Replace("'", "''")
$fileRows = & $sqlcmd @args -h -1 -W -s '|' -Q "RESTORE FILELISTONLY FROM DISK = N'$escapedBackup';"
if ($LASTEXITCODE -ne 0) { throw 'No se pudo leer la lista de archivos de la copia.' }
$dataRow = $fileRows | Where-Object { (($_ -split '\|')[2]).Trim() -eq 'D' } | Select-Object -First 1
$logRow = $fileRows | Where-Object { (($_ -split '\|')[2]).Trim() -eq 'L' } | Select-Object -First 1
if (-not $dataRow -or -not $logRow) { throw 'La copia no contiene archivos de datos y log reconocibles.' }
$logicalData = (($dataRow -split '\|')[0].Trim()).Replace("'", "''")
$logicalLog = (($logRow -split '\|')[0].Trim()).Replace("'", "''")
$query = @"
SET NOCOUNT ON;
RESTORE VERIFYONLY FROM DISK = N'$escapedBackup' WITH CHECKSUM;
DECLARE @Data nvarchar(4000), @Log nvarchar(4000);
SET @Data = CONVERT(nvarchar(4000), SERVERPROPERTY('InstanceDefaultDataPath')) + N'$testDatabase.mdf';
SET @Log = CONVERT(nvarchar(4000), SERVERPROPERTY('InstanceDefaultLogPath')) + N'${testDatabase}_log.ldf';
RESTORE DATABASE [$testDatabase] FROM DISK = N'$escapedBackup' WITH MOVE N'$logicalData' TO @Data, MOVE N'$logicalLog' TO @Log, RECOVERY, REPLACE;
DBCC CHECKDB (N'$testDatabase') WITH NO_INFOMSGS, ALL_ERRORMSGS;
ALTER DATABASE [$testDatabase] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
DROP DATABASE [$testDatabase];
"@
try {
  & $sqlcmd @args -Q $query
  if ($LASTEXITCODE -ne 0) { throw 'La restauración de prueba o DBCC CHECKDB falló.' }
  Write-Host 'Restauración completa y DBCC CHECKDB verificados correctamente.' -ForegroundColor Green
} catch {
  & $sqlcmd @args -Q "IF DB_ID(N'$testDatabase') IS NOT NULL BEGIN ALTER DATABASE [$testDatabase] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [$testDatabase]; END" 2>$null
  throw
}
