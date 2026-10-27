param(
  [string]$EnvPath = '',
  [Parameter(Mandatory = $true)][string]$ServiceAccount
)

$ErrorActionPreference = 'Stop'
if (-not $EnvPath) { $EnvPath = Join-Path (Split-Path $PSScriptRoot -Parent) '.env' }
$resolved = (Resolve-Path -LiteralPath $EnvPath).Path
$currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
& icacls $resolved /inheritance:r | Out-Null
& icacls $resolved /grant:r "BUILTIN\Administradores:(F)" "NT AUTHORITY\SYSTEM:(F)" "${currentUser}:(R)" "${ServiceAccount}:(R)" | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'No se pudieron aplicar permisos restrictivos a .env.' }
Write-Host "Permisos protegidos en $resolved para $ServiceAccount." -ForegroundColor Green
