param([string]$EnvPath = '')

$ErrorActionPreference = 'Stop'
$project = Split-Path $PSScriptRoot -Parent
if (-not $EnvPath) { $EnvPath = Join-Path $project '.env' }
$resolvedEnv = (Resolve-Path -LiteralPath $EnvPath).Path
$values = @{}
Get-Content -LiteralPath $resolvedEnv | ForEach-Object {
  if ($_ -match '^\s*([^#][^=]*)=(.*)$') { $values[$matches[1].Trim()] = $matches[2].Trim() }
}
$required = 'NODE_ENV','SIGA_STORAGE','SIGA_SQL_ENCRYPT','SIGA_SQL_TRUST_CERTIFICATE','SIGA_REQUIRE_RELATIONAL_SYNC','SIGA_SESSION_SECRET','SIGA_TRUST_PROXY','SIGA_PUBLIC_BASE_URL','SIGA_ANTIMALWARE_COMMAND','SIGA_ALERT_WEBHOOK','SIGA_LEGAL_NAME','SIGA_LEGAL_ADDRESS','SIGA_PRIVACY_EMAIL','SIGA_RETENTION_NOTICE','SIGA_DATA_RECIPIENTS'
$errors = [System.Collections.Generic.List[string]]::new()
foreach ($name in $required) {
  if (-not $values.ContainsKey($name) -or -not $values[$name] -or $values[$name] -match 'CAMBIAR|PENDIENTE|EJEMPLO|example\.') { $errors.Add("$name no contiene un valor definitivo.") }
}
if ($values['NODE_ENV'] -ne 'production') { $errors.Add('NODE_ENV debe ser production.') }
if ($values['SIGA_STORAGE'] -ne 'sqlserver') { $errors.Add('SIGA_STORAGE debe ser sqlserver.') }
if ($values['SIGA_SQL_ENCRYPT'] -ne 'true') { $errors.Add('SIGA_SQL_ENCRYPT debe ser true.') }
if ($values['SIGA_SQL_TRUST_CERTIFICATE'] -ne 'false') { $errors.Add('SIGA_SQL_TRUST_CERTIFICATE debe ser false.') }
if ($values['SIGA_TRUST_PROXY'] -in @('','0','false','no','off')) { $errors.Add('SIGA_TRUST_PROXY debe identificar el proxy confiable.') }
if ($values['SIGA_PUBLIC_BASE_URL'] -notmatch '^https://') { $errors.Add('SIGA_PUBLIC_BASE_URL debe usar HTTPS.') }
$nodeMajor = [int]((& node -p "process.versions.node.split('.')[0]").Trim())
if ($nodeMajor -lt 22) { $errors.Add('Producción requiere Node.js 22 LTS o posterior.') }
$acl = Get-Acl -LiteralPath $resolvedEnv
foreach ($entry in $acl.Access) {
  if ($entry.IdentityReference -match 'Usuarios autentificados|Authenticated Users|BUILTIN\\Usuarios$|BUILTIN\\Users$' -and $entry.FileSystemRights.ToString() -match 'Modify|Write|FullControl') { $errors.Add(".env permite escritura a $($entry.IdentityReference).") }
}
Push-Location $project
try {
  & npm run check
  if ($LASTEXITCODE -ne 0) { $errors.Add('npm run check falló.') }
  & npm audit --offline --audit-level=moderate
  if ($LASTEXITCODE -ne 0) { $errors.Add('npm audit detectó vulnerabilidades o no pudo completarse.') }
  $pack = (& npm pack --dry-run --json 2>$null | Out-String | ConvertFrom-Json)[0]
  $forbidden = $pack.files.path | Where-Object { $_ -match '(^|/)(data|backups|tests|tmp|outputs|informe_trabajo|\.env|\.vscode|\.github)(/|$)|\.docx$|\.inspect\.ndjson$' }
  if ($forbidden) { $errors.Add('El paquete contiene archivos prohibidos: ' + ($forbidden -join ', ')) }
} finally { Pop-Location }
if ($errors.Count) { throw "Preflight rechazado:`n- $($errors -join "`n- ")" }
Write-Host 'Preflight de producción aprobado.' -ForegroundColor Green
