$ErrorActionPreference = 'Stop'

$Repo = if ($env:QUANTEX_REPO) { $env:QUANTEX_REPO } else { 'Drswith/quantex-cli' }
$InstallDir = if ($env:QUANTEX_INSTALL_DIR) { $env:QUANTEX_INSTALL_DIR } else { Join-Path $HOME '.local\bin' }
$Version = if ($env:QUANTEX_VERSION) { $env:QUANTEX_VERSION } else { 'latest' }

$arch = switch ($env:PROCESSOR_ARCHITECTURE.ToLowerInvariant()) {
  'amd64' { 'x64' }
  'arm64' { 'arm64' }
  default { throw "Unsupported architecture: $env:PROCESSOR_ARCHITECTURE" }
}

$asset = "quantex-windows-$arch.exe"
$downloadUrl = if ($Version -eq 'latest') {
  "https://github.com/$Repo/releases/latest/download/$asset"
}
else {
  "https://github.com/$Repo/releases/download/$Version/$asset"
}

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

$targetPath = Join-Path $InstallDir 'quantex.exe'
$aliasPath = Join-Path $InstallDir 'qtx.exe'

Invoke-WebRequest -Uri $downloadUrl -OutFile $targetPath
Copy-Item $targetPath $aliasPath -Force

Write-Host "Installed quantex to $targetPath"
Write-Host "Installed qtx copy to $aliasPath"
Write-Host "Make sure $InstallDir is in your PATH"
