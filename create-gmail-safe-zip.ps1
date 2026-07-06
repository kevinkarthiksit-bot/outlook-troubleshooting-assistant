$root = $PSScriptRoot
$zipPath = Join-Path $root "OutLook-Assistant-GmailSafe.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

# No .bat files — Gmail often blocks zips that contain scripts/executables.
$toZip = @(
  "admin-login.html", "admin.html", "case.html", "guide.html", "index.html",
  "login.html", "troubleshooting-guide.html", "troubleshooting.html",
  "README.md", "START_HERE.txt", "PACKAGE_FOR_EMAIL.txt",
  "css", "js", "data", "assets"
) | ForEach-Object { Join-Path $root $_ } | Where-Object { Test-Path $_ }

Compress-Archive -Path $toZip -DestinationPath $zipPath -Force
$mb = [math]::Round((Get-Item $zipPath).Length / 1MB, 2)
Write-Host ""
Write-Host "Gmail-safe zip (no .bat files): $mb MB"
Write-Host "File: OutLook-Assistant-GmailSafe.zip"
Write-Host ""
Write-Host "If Gmail still blocks it, use Google Drive (see PACKAGE_FOR_EMAIL.txt)."
Write-Host ""
