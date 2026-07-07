$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
Set-Location $root

$port = 8080
$url = "http://localhost:$port/case.html"

function Get-PythonCommand {
  if (Get-Command py -ErrorAction SilentlyContinue) {
    try {
      & py -3 --version 2>$null | Out-Null
      if ($LASTEXITCODE -eq 0) { return @{ File = "py"; Args = @("-3") } }
    } catch {}
  }
  foreach ($name in @("python", "python3")) {
    if (Get-Command $name -ErrorAction SilentlyContinue) {
      try {
        & $name --version 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) { return @{ File = $name; Args = @() } }
      } catch {}
    }
  }
  return $null
}

function Test-ServerPort([int]$p) {
  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $client.Connect("127.0.0.1", $p)
    $client.Close()
    return $true
  } catch {
    return $false
  }
}

function Wait-ForServer([int]$p, [int]$seconds = 20) {
  $deadline = (Get-Date).AddSeconds($seconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-ServerPort $p) { return $true }
    Start-Sleep -Milliseconds 250
  }
  return $false
}

Write-Host ""
Write-Host "  Outlook Troubleshooting Assistant"
Write-Host "  ================================="
Write-Host ""

if (Test-ServerPort $port) {
  Write-Host "  Server already running on port $port."
  Write-Host "  Opening $url"
  Write-Host ""
  Start-Process $url
  Write-Host "  Press any key to close this window."
  $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
  exit 0
}

$py = Get-PythonCommand
if (-not $py) {
  Write-Host "  Python was not found on this PC." -ForegroundColor Red
  Write-Host ""
  Write-Host "  Install from https://www.python.org/downloads/"
  Write-Host "  During setup, tick 'Add Python to PATH', then run this again."
  Write-Host ""
  Read-Host "  Press Enter to exit"
  exit 1
}

Write-Host "  Starting local server (port $port)..."
$serverArgs = @($py.Args) + @("-m", "http.server", [string]$port)
$server = Start-Process -FilePath $py.File -ArgumentList $serverArgs -WorkingDirectory $root -PassThru -NoNewWindow

if (-not (Wait-ForServer $port)) {
  Write-Host "  Could not start the server on port $port." -ForegroundColor Red
  try { Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue } catch {}
  Read-Host "  Press Enter to exit"
  exit 1
}

Write-Host "  Opening $url"
Write-Host ""
Write-Host "  Leave this window open while using the app."
Write-Host "  Close this window or press Ctrl+C to stop the server."
Write-Host ""

Start-Process $url

try {
  Wait-Process -Id $server.Id
} catch {
  # User closed window
}
