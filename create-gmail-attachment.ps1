# Builds a Gmail-friendly attachment that still includes .bat files inside.
$root = $PSScriptRoot
& (Join-Path $root "create-email-zip.ps1") | Out-Null

$zipPath = Join-Path $root "OutLook-Assistant.zip"
$txtPath = Join-Path $root "OutLook-Assistant.zip.txt"

if (-not (Test-Path $zipPath)) {
  Write-Host "Error: OutLook-Assistant.zip was not created."
  exit 1
}

Copy-Item -Path $zipPath -Destination $txtPath -Force
$mb = [math]::Round((Get-Item $txtPath).Length / 1MB, 2)

Write-Host ""
Write-Host "========================================"
Write-Host "  GMAIL ATTACHMENT READY (includes .bat)"
Write-Host "========================================"
Write-Host ""
Write-Host "Attach this file in Gmail:"
Write-Host "  OutLook-Assistant.zip.txt  ($mb MB)"
Write-Host ""
Write-Host "Paste this in your email to the recipient:"
Write-Host ""
Write-Host @"
This attachment is the Outlook Assistant demo (includes Start-Outlook-Assistant.bat).

After download:
1. Rename  OutLook-Assistant.zip.txt  to  OutLook-Assistant.zip
2. Right-click the .zip → Extract All
3. Double-click  Start-Outlook-Assistant.bat
4. Open  http://localhost:8080/login.html  if the browser does not open automatically

See START_HERE.txt inside the folder for help.
"@
Write-Host ""
Write-Host "Why .txt? Gmail blocks .zip files that contain .bat scripts."
Write-Host "The .txt rename lets Gmail accept the attachment; contents are unchanged."
Write-Host ""

# Optional: password-protected 7z if 7-Zip is installed
$7z = @(
  "${env:ProgramFiles}\7-Zip\7z.exe",
  "${env:ProgramFiles(x86)}\7-Zip\7z.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($7z) {
  $archive = Join-Path $root "OutLook-Assistant.7z"
  $password = "OutlookDemo2026"
  if (Test-Path $archive) { Remove-Item $archive -Force }
  & $7z a -t7z -mx=9 "-p$password" -mem=AES256 $archive $zipPath | Out-Null
  if (Test-Path $archive) {
    $mb7 = [math]::Round((Get-Item $archive).Length / 1MB, 2)
    Write-Host "Alternative (password-protected 7z, may attach as .7z):"
    Write-Host "  OutLook-Assistant.7z  ($mb7 MB)"
    Write-Host "  Password: $password"
    Write-Host "  Recipient needs 7-Zip from https://www.7-zip.org"
    Write-Host ""
  }
}
