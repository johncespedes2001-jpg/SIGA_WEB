param(
  [string]$TaskName = 'SIGA-Backup-Diario',
  [string]$ServerInstance = '.\SIGA2025',
  [Parameter(Mandatory = $true)][string]$BackupDirectory,
  [Parameter(Mandatory = $true)][string]$OffsiteDirectory,
  [ValidatePattern('^([01]\d|2[0-3]):[0-5]\d$')][string]$DailyAt = '02:00',
  [ValidateRange(1,3650)][int]$RetentionDays = 30
)

$ErrorActionPreference = 'Stop'
$backupScript = (Resolve-Path (Join-Path $PSScriptRoot 'backup.ps1')).Path
$arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$backupScript`" -ServerInstance `"$ServerInstance`" -BackupDirectory `"$BackupDirectory`" -OffsiteDirectory `"$OffsiteDirectory`" -RequireOffsite -RetentionDays $RetentionDays"
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arguments
$trigger = New-ScheduledTaskTrigger -Daily -At $DailyAt
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 10) -ExecutionTimeLimit (New-TimeSpan -Hours 3)
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Description 'Copia diaria verificada de SIGA con réplica externa obligatoria.' -Force | Out-Null
Write-Host "Tarea instalada: $TaskName, todos los días a las $DailyAt." -ForegroundColor Green
