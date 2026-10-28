# Checks that an installed v1 Windows binary can `quantex upgrade` to a release built
# here. The Windows-only parts: v1's own zip extraction, and the delayed replacement
# that swaps the executable once the upgrading process exits.
#
# Usage: v1-upgrade-check.ps1 -Assets <dir> -V1Binary <quantex-windows-x64.exe> -Expected <version>

param(
  [Parameter(Mandatory = $true)][string]$Assets,
  [Parameter(Mandatory = $true)][string]$V1Binary,
  [Parameter(Mandatory = $true)][string]$Expected
)

$ErrorActionPreference = 'Stop'

$Assets = (Resolve-Path $Assets).Path
$work = Join-Path ([System.IO.Path]::GetTempPath()) ('quantex-v1-' + [guid]::NewGuid().ToString('N'))
$homeDir = Join-Path $work 'home'
$app = Join-Path $work 'app'
New-Item -ItemType Directory -Force -Path (Join-Path $homeDir '.quantex\cache'), $app | Out-Null

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
$listener.Start()
$port = $listener.LocalEndpoint.Port
$listener.Stop()
$server = Start-Process python -ArgumentList '-m', 'http.server', '--bind', '127.0.0.1', '--directory', $Assets, "$port" -PassThru -WindowStyle Hidden

try {
  Start-Sleep -Seconds 3
  $exe = Join-Path $app 'quantex.exe'
  Copy-Item -LiteralPath $V1Binary -Destination $exe
  Set-Content -LiteralPath (Join-Path $homeDir '.quantex\config.json') -Value '{"networkRetries": 0, "networkTimeoutMs": 1}'

  $manifest = Get-Content -LiteralPath (Join-Path $Assets 'manifest.json') -Raw | ConvertFrom-Json
  foreach ($asset in $manifest.assets) {
    $asset.downloadUrl = "http://127.0.0.1:$port/$($asset.name)"
  }
  $now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  $cache = @{
    entries = @{
      'self:manifest:stable' = @{
        body      = ($manifest | ConvertTo-Json -Depth 10 -Compress)
        expiresAt = $now + 3600000
        fetchedAt = $now
      }
    }
  }
  Set-Content -LiteralPath (Join-Path $homeDir '.quantex\cache\versions.json') -Value ($cache | ConvertTo-Json -Depth 10)

  $env:HOME = $homeDir
  $env:USERPROFILE = $homeDir
  $before = & $exe --version
  Write-Host "v1 binary reports $before; upgrading to $Expected"
  $output = & $exe upgrade --json | Out-String
  $result = $output | ConvertFrom-Json
  if (-not $result.ok -or $result.data.status -ne 'updated') {
    throw "upgrade did not succeed: $output"
  }

  # The swap happens after the upgrading process exits. Running the binary while the
  # helper moves it would make the move fail, so the first check waits a while.
  Start-Sleep -Seconds 10
  $after = ''
  for ($attempt = 0; $attempt -lt 25; $attempt++) {
    try { $after = (& $exe --version).Trim() } catch { $after = '' }
    if ($after -eq $Expected) { break }
    Start-Sleep -Seconds 2
  }
  if ($after -ne $Expected) {
    Write-Host 'Files next to the binary:'
    Get-ChildItem -LiteralPath $app -Recurse -Force | ForEach-Object { Write-Host "  $($_.FullName.Substring($app.Length))" }
    Write-Host 'PowerShell processes:'
    Get-Process powershell, pwsh -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "  $($_.Id) $($_.ProcessName) $($_.StartTime)" }
    Write-Host "upgrade output: $output"
    throw "upgraded binary reports '$after', expected $Expected"
  }
  for ($attempt = 0; $attempt -lt 20; $attempt++) {
    $leftovers = Get-ChildItem -LiteralPath $app -Force | Where-Object { $_.Name -ne 'quantex.exe' }
    if (-not $leftovers) { break }
    Start-Sleep -Seconds 1
  }
  if ($leftovers) {
    throw "upgrade left files behind: $($leftovers.Name -join ', ')"
  }
  Write-Host "v1 upgraded to $after"
}
finally {
  Stop-Process -Id $server.Id -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $work -Recurse -Force -ErrorAction SilentlyContinue
}
