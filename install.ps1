$ErrorActionPreference = 'Stop'

$Repo = if ($env:QUANTEX_REPO) { $env:QUANTEX_REPO } else { 'Drswith/quantex-cli' }
$InstallDir = if ($env:QUANTEX_INSTALL_DIR) { $env:QUANTEX_INSTALL_DIR } else { Join-Path $HOME '.local\bin' }
$Version = if ($env:QUANTEX_VERSION) { $env:QUANTEX_VERSION } else { 'latest' }

# PROCESSOR_ARCHITECTURE describes the current process, not the host: a 32-bit
# PowerShell on a 64-bit host reports x86 and exposes the host architecture
# through PROCESSOR_ARCHITEW6432.
$hostArch = if ($env:PROCESSOR_ARCHITEW6432) { $env:PROCESSOR_ARCHITEW6432 } else { $env:PROCESSOR_ARCHITECTURE }

# The release matrix ships one Windows binary (`quantex-windows-x64.exe`), which
# Windows on ARM runs through built-in x64 emulation. Genuine 32-bit hosts have
# no published asset and still fail closed.
$arch = switch ($hostArch.ToLowerInvariant()) {
  'amd64' { 'x64' }
  'arm64' { 'x64' }
  default { throw "Unsupported architecture: $hostArch" }
}

# Releases publish compressed archives; the archive entry is the binary name.
$binary = "quantex-windows-$arch.exe"
$asset = "$binary.zip"
$releaseUrl = if ($Version -eq 'latest') {
  "https://github.com/$Repo/releases/latest/download"
}
else {
  "https://github.com/$Repo/releases/download/$Version"
}

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

$targetPath = Join-Path $InstallDir 'quantex.exe'
$aliasPath = Join-Path $InstallDir 'qtx.exe'
$tmpDir = Join-Path ([System.IO.Path]::GetTempPath()) ("quantex-install-" + [guid]::NewGuid().ToString('N'))
$archivePath = Join-Path $tmpDir $asset
$checksumsPath = Join-Path $tmpDir 'SHA256SUMS.txt'
$extractDir = Join-Path $tmpDir 'extracted'
$stagedPath = Join-Path $extractDir $binary

New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null
$previousProgressPreference = $ProgressPreference
try {
  # Windows PowerShell renders a per-chunk progress bar that dominates wall-clock
  # on a multi-megabyte download and makes the installer look hung.
  $ProgressPreference = 'SilentlyContinue'
  Invoke-WebRequest -Uri "$releaseUrl/$asset" -OutFile $archivePath -UseBasicParsing
  Invoke-WebRequest -Uri "$releaseUrl/SHA256SUMS.txt" -OutFile $checksumsPath -UseBasicParsing
  $ProgressPreference = $previousProgressPreference

  # SHA256SUMS.txt lists archive names; a leading "*" marks binary mode.
  $expectedChecksum = $null
  foreach ($line in Get-Content -LiteralPath $checksumsPath) {
    $fields = $line.Trim() -split '\s+', 2
    if ($fields.Count -eq 2 -and $fields[1].TrimStart('*') -eq $asset) {
      $expectedChecksum = $fields[0].ToLowerInvariant()
      break
    }
  }

  if (-not $expectedChecksum) {
    throw "SHA256SUMS.txt does not list $asset"
  }

  $actualChecksum = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actualChecksum -ne $expectedChecksum) {
    throw "Checksum mismatch for ${asset}: expected $expectedChecksum, got $actualChecksum. Re-run the installer; a release published mid-download can cause this."
  }

  Expand-Archive -LiteralPath $archivePath -DestinationPath $extractDir -Force

  if (-not (Test-Path -LiteralPath $stagedPath) -or ((Get-Item -LiteralPath $stagedPath).Length -le 0)) {
    throw "Release archive did not contain $binary"
  }

  Move-Item -LiteralPath $stagedPath -Destination $targetPath -Force
  Copy-Item -LiteralPath $targetPath -Destination $aliasPath -Force
}
finally {
  $ProgressPreference = $previousProgressPreference
  Remove-Item -LiteralPath $tmpDir -Force -Recurse -ErrorAction SilentlyContinue
}

Write-Host "Installed quantex to $targetPath"
Write-Host "Installed qtx copy to $aliasPath"
Write-Host "Make sure $InstallDir is in your PATH"
