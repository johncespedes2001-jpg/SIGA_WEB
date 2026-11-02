function Test-SigaMariaDbLocal {
  $client = [System.Net.Sockets.TcpClient]::new()
  try {
    $attempt = $client.BeginConnect('127.0.0.1', 3306, $null, $null)
    if (-not $attempt.AsyncWaitHandle.WaitOne(750)) { return $false }
    $client.EndConnect($attempt)
    return $client.Connected
  } catch {
    return $false
  } finally {
    $client.Dispose()
  }
}

function Start-SigaMariaDbLocal {
  # Get-NetTCPConnection puede no devolver procesos iniciados por XAMPP desde
  # otra sesión o con privilegios distintos. Una conexión TCP real evita
  # intentar abrir una segunda instancia sobre los mismos archivos InnoDB.
  if (Test-SigaMariaDbLocal) { return }

  $mariaExecutable = 'C:\xampp\mysql\bin\mysqld.exe'
  $mariaConfiguration = 'C:\xampp\mysql\bin\my.ini'
  if (-not (Test-Path -LiteralPath $mariaExecutable -PathType Leaf) -or -not (Test-Path -LiteralPath $mariaConfiguration -PathType Leaf)) {
    throw 'MariaDB no esta activo y no se encontro la instalacion de XAMPP en C:\xampp.'
  }

  Write-Host 'Iniciando MariaDB de XAMPP...'
  Start-Process -FilePath $mariaExecutable `
    -ArgumentList "--defaults-file=$mariaConfiguration", '--standalone' `
    -WorkingDirectory 'C:\xampp' -WindowStyle Hidden
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    Start-Sleep -Milliseconds 500
    if (Test-SigaMariaDbLocal) { break }
  }
  if (-not (Test-SigaMariaDbLocal)) {
    throw 'MariaDB de XAMPP no pudo iniciar en el puerto 3306. Si XAMPP ya aparece en verde, cierre las instancias duplicadas y vuelva a iniciar MySQL desde el panel. Revise C:\xampp\mysql\data\mysql_error.log.'
  }
  Write-Host 'MariaDB de XAMPP iniciado correctamente.'
}

function New-SigaBase64UrlSecret([int]$Length = 32) {
  $bytes = New-Object byte[] $Length
  $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $generator.GetBytes($bytes) } finally { $generator.Dispose() }
  return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

function Get-SigaLocalSecret([string]$FileName, [int]$Length = 32) {
  $project = Split-Path $PSScriptRoot -Parent
  $dataDirectory = Join-Path $project 'data'
  $secretPath = Join-Path $dataDirectory $FileName
  if (-not (Test-Path -LiteralPath $dataDirectory -PathType Container)) {
    New-Item -ItemType Directory -Path $dataDirectory -Force | Out-Null
  }
  if (-not (Test-Path -LiteralPath $secretPath -PathType Leaf)) {
    $secret = New-SigaBase64UrlSecret -Length $Length
    [System.IO.File]::WriteAllText($secretPath, $secret, [System.Text.UTF8Encoding]::new($false))
  }
  $value = (Get-Content -LiteralPath $secretPath -Raw).Trim()
  if (-not $value) { throw "El secreto local $FileName está vacío." }
  return $value
}

function Initialize-SigaMariaDbLocalAppUser {
  $project = Split-Path $PSScriptRoot -Parent
  $appPassword = Get-SigaLocalSecret -FileName '.mariadb-local-app-password' -Length 24
  $env:SIGA_MARIADB_ADMIN_HOST = '127.0.0.1'
  $env:SIGA_MARIADB_ADMIN_PORT = '3306'
  $env:SIGA_MARIADB_ADMIN_USER = 'root'
  $env:SIGA_MARIADB_ADMIN_PASSWORD = ''
  $env:SIGA_MARIADB_DATABASE = 'siga'
  $env:SIGA_MARIADB_APP_USER = 'siga_app'
  $env:SIGA_MARIADB_APP_PASSWORD = $appPassword
  Push-Location $project
  try {
    & node operations/configure-mariadb-app-user.js
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo configurar el usuario local siga_app.' }
  } finally {
    Pop-Location
  }
}

function Set-SigaMariaDbLocalEnvironment([switch]$Administrative, [switch]$EnsureAppUser) {
  $env:SIGA_STORAGE = 'mariadb'
  $env:SIGA_MARIADB_HOST = '127.0.0.1'
  $env:SIGA_MARIADB_PORT = '3306'
  $env:SIGA_MARIADB_DATABASE = 'siga'
  $env:SIGA_MARIADB_SSL = 'false'
  $env:SIGA_DATA_ENCRYPTION_KEY = Get-SigaLocalSecret -FileName '.mariadb-local-encryption-key' -Length 32
  $env:SIGA_RETENTION_DAYS = '365'
  if ($Administrative) {
    $env:SIGA_MARIADB_USER = 'root'
    $env:SIGA_MARIADB_PASSWORD = ''
    return
  }
  if ($EnsureAppUser) { Initialize-SigaMariaDbLocalAppUser }
  $passwordPath = Join-Path (Join-Path (Split-Path $PSScriptRoot -Parent) 'data') '.mariadb-local-app-password'
  if (-not (Test-Path -LiteralPath $passwordPath -PathType Leaf)) {
    throw 'Falta el usuario local de aplicación. Ejecute npm run db:mariadb-configure-app-user.'
  }
  $env:SIGA_MARIADB_USER = 'siga_app'
  $env:SIGA_MARIADB_PASSWORD = (Get-Content -LiteralPath $passwordPath -Raw).Trim()
}
