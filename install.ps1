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
$tmpDir = Join-Path ([System.IO.Path]::GetTempPath()) ("quantex-install-" + [guid]::NewGuid().ToString('N'))
$tmpFile = Join-Path $tmpDir $asset

New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null
try {
  Invoke-WebRequest -Uri $downloadUrl -OutFile $tmpFile
  if (-not (Test-Path -LiteralPath $tmpFile) -or ((Get-Item -LiteralPath $tmpFile).Length -le 0)) {
    throw "Downloaded Quantex binary is missing or empty: $tmpFile"
  }

  Move-Item -LiteralPath $tmpFile -Destination $targetPath -Force
  Copy-Item -LiteralPath $targetPath -Destination $aliasPath -Force
}
finally {
  Remove-Item -LiteralPath $tmpDir -Force -Recurse -ErrorAction SilentlyContinue
}

Write-Host "Installed quantex to $targetPath"
Write-Host "Installed qtx copy to $aliasPath"
Write-Host "Make sure $InstallDir is in your PATH"
