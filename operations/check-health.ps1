param(
  [Parameter(Mandatory = $true)][ValidatePattern('^https://')][string]$Url,
  [string]$AlertWebhook = '',
  [string]$StatePath = ''
)

$ErrorActionPreference = 'Stop'
if (-not $StatePath) { $StatePath = Join-Path $PSScriptRoot 'health-state.json' }
$status = 'down'
$detail = ''
try {
  $response = Invoke-RestMethod -Uri $Url -Method Get -TimeoutSec 15
  if ($response.status -ne 'ok') { throw "Estado inesperado: $($response.status)" }
  $status = 'up'
} catch { $detail = $_.Exception.Message }
$previous = if (Test-Path -LiteralPath $StatePath) { Get-Content -LiteralPath $StatePath -Raw | ConvertFrom-Json } else { $null }
$state = [ordered]@{ status = $status; checkedAt = (Get-Date).ToUniversalTime().ToString('o'); detail = $detail }
$state | ConvertTo-Json | Set-Content -LiteralPath $StatePath -Encoding utf8
if ($status -eq 'down' -and $previous.status -ne 'down' -and $AlertWebhook) {
  Invoke-RestMethod -Uri $AlertWebhook -Method Post -ContentType 'application/json' -Body (@{ text = "SIGA no disponible: $detail" } | ConvertTo-Json) -TimeoutSec 15 | Out-Null
}
if ($status -ne 'up') { throw "SIGA no disponible: $detail" }
Write-Host "SIGA disponible: $Url" -ForegroundColor Green
