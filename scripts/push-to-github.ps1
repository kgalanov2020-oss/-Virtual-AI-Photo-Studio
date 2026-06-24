$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

Write-Host "GitHub push for Virtual-AI-Photo-Studio"
Write-Host "Use a GitHub Personal Access Token, not your account password."
Write-Host ""

$user = Read-Host "GitHub username"
$secure = Read-Host "GitHub token" -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)

try {
    $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    $cred = "protocol=https`nhost=github.com`nusername=$user`npassword=$token`n`n"
    $cred | git credential approve
    Remove-Variable token -ErrorAction SilentlyContinue

    Write-Host ""
    Write-Host "Credentials saved. Pushing main..."
    git config --global --add safe.directory $ProjectRoot
    git push -u origin main

    Write-Host ""
    Write-Host "Finished. Check the result above."
} finally {
    if ($ptr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
}

Write-Host ""
Read-Host "Press Enter to close"
