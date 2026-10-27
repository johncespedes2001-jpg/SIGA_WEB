param(
  [string]$InstanceName = 'SIGA2025',
  [int]$TcpPort = 1433
)

$ErrorActionPreference = 'Stop'

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw 'Abra PowerShell o Visual Studio Code como Administrador y vuelva a ejecutar este comando.'
}
if ($InstanceName -notmatch '^[A-Za-z][A-Za-z0-9_]{0,63}$') {
  throw 'InstanceName no es valido.'
}
if ($TcpPort -lt 1 -or $TcpPort -gt 65535) {
  throw 'TcpPort no es valido.'
}

$instanceRegistryPath = 'HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\Instance Names\SQL'
$instanceMap = Get-ItemProperty -LiteralPath $instanceRegistryPath
$instanceId = $instanceMap.$InstanceName
if (-not $instanceId) {
  throw "No se encontro la instancia SQL Server $InstanceName."
}

$listeners = @(Get-NetTCPConnection -State Listen -LocalPort $TcpPort -ErrorAction SilentlyContinue)
if ($listeners.Count -gt 0) {
  $sqlProcessIds = @(Get-Process sqlservr -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
  $foreignListener = $listeners | Where-Object { $_.OwningProcess -notin $sqlProcessIds } | Select-Object -First 1
  if ($foreignListener) {
    throw "El puerto $TcpPort ya esta ocupado por el proceso $($foreignListener.OwningProcess)."
  }
}

$tcpRegistryPath = "HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\$instanceId\MSSQLServer\SuperSocketNetLib\Tcp"
$ipAllRegistryPath = Join-Path $tcpRegistryPath 'IPAll'
if (-not (Test-Path -LiteralPath $tcpRegistryPath) -or -not (Test-Path -LiteralPath $ipAllRegistryPath)) {
  throw "No se encontro la configuracion TCP de $InstanceName."
}

Set-ItemProperty -LiteralPath $tcpRegistryPath -Name Enabled -Type DWord -Value 1
Set-ItemProperty -LiteralPath $tcpRegistryPath -Name ListenOnAllIPs -Type DWord -Value 1
Set-ItemProperty -LiteralPath $ipAllRegistryPath -Name TcpDynamicPorts -Value ''
Set-ItemProperty -LiteralPath $ipAllRegistryPath -Name TcpPort -Value ([string]$TcpPort)

$serviceName = "MSSQL`$$InstanceName"
Restart-Service -Name $serviceName -Force
$service = Get-Service -Name $serviceName
$service.WaitForStatus([System.ServiceProcess.ServiceControllerStatus]::Running, [TimeSpan]::FromSeconds(30))

$deadline = [DateTime]::UtcNow.AddSeconds(30)
do {
  $tcpReady = Test-NetConnection -ComputerName '127.0.0.1' -Port $TcpPort -InformationLevel Quiet -WarningAction SilentlyContinue
  if (-not $tcpReady) { Start-Sleep -Milliseconds 500 }
} while (-not $tcpReady -and [DateTime]::UtcNow -lt $deadline)

if (-not $tcpReady) {
  throw "El servicio se reinicio, pero el puerto $TcpPort aun no responde. Revise el ERRORLOG de SQL Server."
}

Write-Host "TCP/IP habilitado para $InstanceName en 127.0.0.1:$TcpPort." -ForegroundColor Green
