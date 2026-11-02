param([string]$EnvPath = '')

$ErrorActionPreference = 'Stop'
$project = Split-Path $PSScriptRoot -Parent
if (-not $EnvPath) { $EnvPath = Join-Path $project '.env' }
$resolvedEnv = (Resolve-Path -LiteralPath $EnvPath).Path
$values = @{}
Get-Content -LiteralPath $resolvedEnv | ForEach-Object {
  if ($_ -match '^\s*([^#][^=]*)=(.*)$') { $values[$matches[1].Trim()] = $matches[2].Trim() }
}
$required = 'NODE_ENV','SIGA_STORAGE','SIGA_SESSION_SECRET','SIGA_DATA_ENCRYPTION_KEY','SIGA_RETENTION_DAYS','SIGA_TRUST_PROXY','SIGA_PUBLIC_BASE_URL','SIGA_ANTIMALWARE_COMMAND','SIGA_ALERT_WEBHOOK','SIGA_LEGAL_NAME','SIGA_LEGAL_ADDRESS','SIGA_PRIVACY_EMAIL','SIGA_RETENTION_NOTICE','SIGA_DATA_RECIPIENTS'
$errors = [System.Collections.Generic.List[string]]::new()
if ($values['SIGA_STORAGE'] -eq 'mariadb') {
  $required += 'SIGA_MARIADB_HOST','SIGA_MARIADB_DATABASE','SIGA_MARIADB_USER','SIGA_MARIADB_PASSWORD'
}
foreach ($name in $required) {
  if (-not $values.ContainsKey($name) -or -not $values[$name] -or $values[$name] -match 'CAMBIAR|PENDIENTE|EJEMPLO|example\.') { $errors.Add("$name no contiene un valor definitivo.") }
}
if ($values['NODE_ENV'] -ne 'production') { $errors.Add('NODE_ENV debe ser production.') }
$parsedRetentionDays = 0
if (-not [int]::TryParse($values['SIGA_RETENTION_DAYS'], [ref]$parsedRetentionDays) -or $parsedRetentionDays -lt 30 -or $parsedRetentionDays -gt 3650) { $errors.Add('SIGA_RETENTION_DAYS debe estar entre 30 y 3650.') }
if ($values['SIGA_STORAGE'] -ne 'mariadb') { $errors.Add('SIGA_STORAGE debe ser mariadb.') }
if ($values['SIGA_STORAGE'] -eq 'mariadb' -and $values['SIGA_MARIADB_HOST'] -notin @('localhost','127.0.0.1','::1') -and $values['SIGA_MARIADB_SSL'] -ne 'true') {
  $errors.Add('SIGA_MARIADB_SSL debe ser true cuando la base de datos está en otro servidor.')
}
if ($values['SIGA_STORAGE'] -eq 'mariadb' -and $values['SIGA_MARIADB_USER'] -eq 'root') { $errors.Add('SIGA_MARIADB_USER no puede ser root en producción.') }
if ($values['SIGA_TRUST_PROXY'] -in @('','0','false','no','off')) { $errors.Add('SIGA_TRUST_PROXY debe identificar el proxy confiable.') }
if ($values['SIGA_PUBLIC_BASE_URL'] -notmatch '^https://') { $errors.Add('SIGA_PUBLIC_BASE_URL debe usar HTTPS.') }
$nodeMajor = [int]((& node -p "process.versions.node.split('.')[0]").Trim())
if ($nodeMajor -lt 20) { $errors.Add('Producción requiere Node.js 20 LTS o posterior.') }
$acl = Get-Acl -LiteralPath $resolvedEnv
foreach ($entry in $acl.Access) {
  if ($entry.IdentityReference -match 'Usuarios autentificados|Authenticated Users|BUILTIN\\Usuarios$|BUILTIN\\Users$' -and $entry.FileSystemRights.ToString() -match 'Modify|Write|FullControl') { $errors.Add(".env permite escritura a $($entry.IdentityReference).") }
}
Push-Location $project
try {
  & npm run build:assets
  if ($LASTEXITCODE -ne 0) { $errors.Add('La construcción de recursos comprimidos falló.') }
  & npm run check
  if ($LASTEXITCODE -ne 0) { $errors.Add('npm run check falló.') }
  & npm audit --offline --audit-level=moderate
  if ($LASTEXITCODE -ne 0) { $errors.Add('npm audit detectó vulnerabilidades o no pudo completarse.') }
  $pack = (& npm pack --dry-run --json 2>$null | Out-String | ConvertFrom-Json)[0]
  $forbidden = $pack.files.path | Where-Object { $_ -match '(^|/)(data|backups|tests|tmp|outputs|informe_trabajo|logs|\.codex-sheet-audit|\.playwright-browsers|\.env|\.vscode|\.github)(/|$)|\.docx$|\.inspect\.ndjson$' }
  if ($forbidden) { $errors.Add('El paquete contiene archivos prohibidos: ' + ($forbidden -join ', ')) }
  if ($pack.files.path -notcontains 'npm-shrinkwrap.json') { $errors.Add('El paquete no contiene npm-shrinkwrap.json; la instalación de dependencias no sería reproducible.') }
} finally { Pop-Location }
if ($errors.Count) { throw "Preflight rechazado:`n- $($errors -join "`n- ")" }
Write-Host 'Preflight de producción aprobado.' -ForegroundColor Green
