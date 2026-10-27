param(
  [string]$TaskName = 'SIGA-Monitoreo',
  [Parameter(Mandatory = $true)][ValidatePattern('^https://')][string]$HealthUrl,
  [string]$AlertWebhook = ''
)

$ErrorActionPreference = 'Stop'
$script = (Resolve-Path (Join-Path $PSScriptRoot 'check-health.ps1')).Path
$arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$script`" -Url `"$HealthUrl`""
if ($AlertWebhook) { $arguments += " -AlertWebhook `"$AlertWebhook`"" }
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arguments
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 1)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Description 'Monitoreo HTTPS de disponibilidad de SIGA.' -Force | Out-Null
Write-Host "Monitoreo instalado para $HealthUrl" -ForegroundColor Green
