$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
Set-Location $root

$fail = 0
$warn = 0
$pass = 0

function Ok($msg) { Write-Host "[OK]   $msg" -ForegroundColor Green; $script:pass++ }
function Bad($msg) { Write-Host "[FAIL] $msg" -ForegroundColor Red; $script:fail++ }
function Note($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow; $script:warn++ }

Write-Host ""
Write-Host "Outlook Assistant - Health Check"
Write-Host "================================="
Write-Host ""

$requiredPages = @(
  "login.html", "case.html", "index.html", "guide.html",
  "troubleshooting.html", "troubleshooting-guide.html",
  "admin-login.html", "admin.html"
)
foreach ($p in $requiredPages) {
  if (Test-Path (Join-Path $root $p)) { Ok "Page $p" } else { Bad "Missing page $p" }
}

$requiredJs = @(
  "js/config.js", "js/storage.js", "js/session.js", "js/sharepoint.js",
  "js/logging.js", "js/app.js", "js/guide.js", "js/kb-loader.js", "js/search.js",
  "js/troubleshooting.js", "js/troubleshooting-guide.js",
  "js/troubleshooting-loader.js", "js/troubleshooting-search.js",
  "js/admin.js", "js/login.js", "js/case.js"
)
foreach ($j in $requiredJs) {
  if (Test-Path (Join-Path $root $j)) { Ok "Script $j" } else { Bad "Missing script $j" }
}

if (Test-Path (Join-Path $root "css/styles.css")) { Ok "Stylesheet css/styles.css" } else { Bad "Missing css/styles.css" }

foreach ($dataFile in @("data/kb-articles.sample.json", "data/troubleshooting-guide.json")) {
  $path = Join-Path $root $dataFile
  if (-not (Test-Path $path)) { Bad "Missing $dataFile"; continue }
  try {
    $json = Get-Content $path -Raw | ConvertFrom-Json
    Ok "Valid JSON $dataFile"
    if ($dataFile -like "*kb-articles*") {
      $n = @($json.articles).Count
      if ($n -gt 0) { Ok "Org KB articles: $n" } else { Bad "Org KB has no articles" }
    } else {
      $g = @($json.guides).Count
      $f = @($json.flows).Count
      if ($g -gt 0) { Ok "Troubleshooting guides: $g" } else { Bad "No troubleshooting guides" }
      if ($f -gt 0) { Ok "Guided flows: $f" } else { Note "No guided flows in troubleshooting JSON" }
    }
  } catch {
    Bad "Invalid JSON $dataFile - $($_.Exception.Message)"
  }
}

$launcher = Join-Path $root "Launch Outlook Assistant.bat"
if (Test-Path $launcher) { Ok "Launcher Launch Outlook Assistant.bat" } else { Bad "Missing single-click launcher" }

$python = $null
foreach ($candidate in @(
  @{ exe = "py"; args = @("-3", "--version") },
  @{ exe = "python"; args = @("--version") },
  @{ exe = "python3"; args = @("--version") }
)) {
  if (Get-Command $candidate.exe -ErrorAction SilentlyContinue) {
    try {
      & $candidate.exe @($candidate.args) 2>$null | Out-Null
      if ($LASTEXITCODE -eq 0) {
        $python = $candidate.exe
        if ($candidate.args[0] -eq "-3") { $python = "py -3" }
        break
      }
    } catch {}
  }
}
if ($python) { Ok "Python available ($python)" } else { Note "Python not found - install from python.org (tick Add to PATH)" }

Write-Host ""
Write-Host "Summary: $pass passed, $warn warnings, $fail failed"
Write-Host ""

if ($fail -gt 0) { exit 1 }
exit 0
