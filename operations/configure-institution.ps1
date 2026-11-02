param(
  [string]$LegalName = 'Instituto de Educación Superior Tecnológico Público Contralmirante Manuel Villar Olivera',
  [string]$LegalAddress = 'Carretera Panamericana Norte Km 1235, Los Pinos Sur, Zorritos, Contralmirante Villar, Tumbes',
  [string]$PrivacyEmail = 'istpcmvo@hotmail.com',
  [string]$RetentionNotice = 'Los datos se conservan durante la relación académica y los plazos exigidos por la normativa y el archivo institucional.',
  [string]$DataRecipients = 'Áreas académicas, administrativas y de seguridad autorizadas de la institución; no se realizan transferencias comerciales.'
)

$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path $PSScriptRoot -Parent
$environmentPath = Join-Path $projectDirectory '.env'
if (-not (Test-Path -LiteralPath $environmentPath -PathType Leaf)) { throw 'No se encontró el archivo .env.' }
if ($PrivacyEmail -notmatch '^[^\s@]+@[^\s@]+\.[^\s@]+$') { throw 'PrivacyEmail debe ser un correo válido.' }

$values = [ordered]@{
  SIGA_LEGAL_NAME = $LegalName.Trim()
  SIGA_LEGAL_ADDRESS = $LegalAddress.Trim()
  SIGA_PRIVACY_EMAIL = $PrivacyEmail.Trim().ToLowerInvariant()
  SIGA_RETENTION_NOTICE = $RetentionNotice.Trim()
  SIGA_DATA_RECIPIENTS = $DataRecipients.Trim()
}
if ($values.Values | Where-Object { -not $_ }) { throw 'Los cinco datos institucionales son obligatorios.' }

$lines = [System.Collections.Generic.List[string]]::new()
Get-Content -LiteralPath $environmentPath | ForEach-Object { [void]$lines.Add($_) }
foreach ($entry in $values.GetEnumerator()) {
  $prefix = "$($entry.Key)="
  $index = -1
  for ($position = 0; $position -lt $lines.Count; $position++) {
    if ($lines[$position].StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) { $index = $position; break }
  }
  $line = "$($entry.Key)=$($entry.Value)"
  if ($index -ge 0) { $lines[$index] = $line } else { [void]$lines.Add($line) }
}

[IO.File]::WriteAllLines($environmentPath, $lines, [Text.UTF8Encoding]::new($false))
Write-Host 'Datos institucionales guardados en .env.' -ForegroundColor Green
Write-Host 'La dirección y el correo proceden de publicaciones institucionales; la autoridad responsable debe aprobar formalmente los textos de retención y destinatarios.' -ForegroundColor Yellow
