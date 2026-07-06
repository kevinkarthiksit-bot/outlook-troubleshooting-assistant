$root = $PSScriptRoot
$zipPath = Join-Path $root "OutLook-Assistant.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

$toZip = @(
  "admin-login.html", "admin.html", "case.html", "guide.html", "index.html",
  "login.html", "troubleshooting-guide.html", "troubleshooting.html",
  "README.md", "START_HERE.txt", "PACKAGE_FOR_EMAIL.txt",
  "Launch Outlook Assistant.bat", "Start-Outlook-Assistant.bat",
  "Health-Check.bat", "launch.ps1", "health-check.ps1",
  "css", "js", "data", "assets"
) | ForEach-Object { Join-Path $root $_ } | Where-Object { Test-Path $_ }

Compress-Archive -Path $toZip -DestinationPath $zipPath -Force
$mb = [math]::Round((Get-Item $zipPath).Length / 1MB, 2)
Write-Host ""
Write-Host "Done. Zip size: $mb MB"
Write-Host "Attach OutLook-Assistant.zip to your email."
Write-Host ""
