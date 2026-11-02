param(
  [string]$DailyAt = '02:00',
  [int]$RetentionDays = 30,
  [string]$TaskName = 'SIGA-MariaDB-Backup-Diario'
)

$ErrorActionPreference = 'Stop'
$project = Split-Path $PSScriptRoot -Parent
$powerShell = (Get-Command powershell.exe -ErrorAction Stop).Source
$script = Join-Path $PSScriptRoot 'backup-mariadb-local.ps1'
$arguments = '-NoProfile -ExecutionPolicy Bypass -File "{0}" -RetentionDays {1}' -f $script, $RetentionDays
$action = New-ScheduledTaskAction -Execute $powerShell -Argument $arguments -WorkingDirectory $project
$trigger = New-ScheduledTaskTrigger -Daily -At $DailyAt
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 2)
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Description 'Respaldo diario verificado de SIGA MariaDB.' -Force | Out-Null
Write-Host "Tarea instalada: $TaskName, todos los días a las $DailyAt." -ForegroundColor Green
