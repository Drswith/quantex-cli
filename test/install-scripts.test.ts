import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const installSh = readFileSync('install.sh', 'utf8')
const installPs1 = readFileSync('install.ps1', 'utf8')

// Every GitHub-hosted runner image ships PowerShell, so the architecture cases
// below execute in CI. A developer machine without it skips them rather than
// failing, the same way the python3 cases degrade.
const hasPwsh =
  spawnSync('pwsh', ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.Major'], {
    encoding: 'utf8',
  }).status === 0

function extractInstallShStateRecorder(): string {
  const start = installSh.indexOf("<<'PY'\n")
  const end = installSh.indexOf('\nPY\n', start)
  expect(start).toBeGreaterThan(-1)
  expect(end).toBeGreaterThan(start)
  return installSh.slice(start + "<<'PY'\n".length, end)
}

// The prefix ends before the first filesystem write, so running it resolves the
// asset name without downloading or installing anything.
function extractInstallPs1AssetResolver(): string {
  const end = installPs1.indexOf('\nNew-Item -ItemType Directory -Force -Path $InstallDir')
  expect(end).toBeGreaterThan(-1)
  return `${installPs1.slice(0, end)}\nWrite-Output $asset\n`
}

function resolvePs1Asset(processorArchitecture: string, architew6432?: string): { asset: string; status: number } {
  const scriptPath = join(mkdtempSync(join(tmpdir(), 'quantex-install-ps1-')), 'resolve-asset.ps1')
  writeFileSync(scriptPath, extractInstallPs1AssetResolver(), 'utf8')

  const env: Record<string, string | undefined> = {
    ...process.env,
    PROCESSOR_ARCHITECTURE: processorArchitecture,
  }
  if (architew6432) env.PROCESSOR_ARCHITEW6432 = architew6432
  else delete env.PROCESSOR_ARCHITEW6432

  const result = spawnSync('pwsh', ['-NoProfile', '-File', scriptPath], { encoding: 'utf8', env })
  return { asset: result.stdout.trim(), status: result.status ?? -1 }
}

describe('standalone install scripts', () => {
  it('records binary install source with fail-closed parse handling and atomic replace', () => {
    expect(installSh).toContain('leaving existing state.json untouched')
    expect(installSh).toContain('tempfile.mkstemp')
    expect(installSh).toContain('os.replace(tmp_name, state_path)')
    expect(installSh).not.toContain('state_path.write_text(')
    expect(installSh).toMatch(/except Exception(?: as error)?:/)
  })

  // Both spawning cases carry an explicit timeout because the first python3
  // spawn on a Windows runner costs seconds, not milliseconds: the same file
  // took 98ms on ubuntu, 1091ms on one windows run, and 8971ms on the next.
  // Vitest's 5s default sits inside that spread, so whichever case spawns first
  // fails at random and takes a required check down with it.
  it('leaves corrupt state.json untouched when recording installSource', () => {
    const home = mkdtempSync(join(tmpdir(), 'quantex-install-sh-'))
    const stateDir = join(home, '.quantex')
    mkdirSync(stateDir, { recursive: true })
    const statePath = join(stateDir, 'state.json')
    const corrupt = '{ "installedAgents": { "claude": { "agentName": "claude" } },'
    writeFileSync(statePath, corrupt, { encoding: 'utf8', flag: 'w' })

    const result = spawnSync('python3', ['-', statePath], {
      cwd: process.cwd(),
      encoding: 'utf8',
      input: extractInstallShStateRecorder(),
    })

    expect(result.status).toBe(0)
    expect(readFileSync(statePath, 'utf8')).toBe(corrupt)
    expect(result.stderr).toContain('leaving existing state.json untouched')
  }, 30_000)

  it('atomically records installSource while preserving installed agents', () => {
    const home = mkdtempSync(join(tmpdir(), 'quantex-install-sh-'))
    const stateDir = join(home, '.quantex')
    mkdirSync(stateDir, { recursive: true })
    const statePath = join(stateDir, 'state.json')
    const original = {
      installedAgents: {
        claude: {
          agentName: 'claude',
          installType: 'npm',
          packageName: '@anthropic-ai/claude-code',
        },
      },
      lifecycleReceipts: {
        claude: {
          kind: 'lifecycle-receipt',
          providerId: 'npm',
          providerTargetId: '@anthropic-ai/claude-code',
          providerTargetKind: 'package',
          schemaVersion: 1,
          targetId: 'claude',
          verifiedAt: '2026-07-01T00:00:00.000Z',
        },
      },
      schemaVersion: 2,
      self: {},
    }
    writeFileSync(statePath, `${JSON.stringify(original, null, 2)}\n`, 'utf8')

    const result = spawnSync('python3', ['-', statePath], {
      cwd: process.cwd(),
      encoding: 'utf8',
      input: extractInstallShStateRecorder(),
    })

    expect(result.status).toBe(0)
    const updated = JSON.parse(readFileSync(statePath, 'utf8')) as typeof original & {
      self: { installSource?: string }
    }
    expect(updated.installedAgents).toEqual(original.installedAgents)
    expect(updated.lifecycleReceipts).toEqual(original.lifecycleReceipts)
    expect(updated.schemaVersion).toBe(2)
    expect(updated.self.installSource).toBe('binary')
  }, 30_000)

  it('resolves the published archive assets rather than raw binary names', () => {
    // Releases stopped publishing uncompressed binaries in v1.8.0; requesting the
    // bare binary name 404s on every platform.
    expect(installSh).toContain('binary="quantex-$platform-$arch"')
    expect(installSh).toContain('asset="$binary.tar.gz"')
    expect(installPs1).toContain('$binary = "quantex-windows-$arch.exe"')
    expect(installPs1).toContain('$asset = "$binary.zip"')
  })

  it('verifies downloaded archives against the published checksums', () => {
    expect(installSh).toContain('download "$release_url/SHA256SUMS.txt" "$tmp_checksums"')
    expect(installSh).toContain('QUANTEX_DOWNLOAD_BASE')
    expect(installPs1).toContain('QUANTEX_DOWNLOAD_BASE')
    expect(installSh).toMatch(/if \[ -z "\$expected_checksum" \]/)
    expect(installSh).toMatch(/if \[ "\$actual_checksum" != "\$expected_checksum" \]/)

    expect(installPs1).toContain('Invoke-WebRequest -Uri "$releaseUrl/SHA256SUMS.txt"')
    expect(installPs1).toContain('Get-FileHash -LiteralPath $archivePath -Algorithm SHA256')
    expect(installPs1).toMatch(/if \(\$actualChecksum -ne \$expectedChecksum\)/)
    expect(installPs1).toMatch(/if \(-not \$expectedChecksum\)/)
  })

  it('replaces installed executables only from verified staged content', () => {
    expect(installSh).toContain('tar -xzf "$tmp_archive" -C "$tmp_dir" "$binary"')
    expect(installSh).toContain('mv "$tmp_dir/$binary" "$INSTALL_DIR/quantex"')
    expect(installSh).toContain('ln -sf "$INSTALL_DIR/quantex" "$INSTALL_DIR/qtx"')

    expect(installPs1).toContain('Expand-Archive -LiteralPath $archivePath -DestinationPath $extractDir -Force')
    expect(installPs1).toContain('Move-Item -LiteralPath $stagedPath -Destination $targetPath -Force')
    expect(installPs1).toContain('Copy-Item -LiteralPath $targetPath -Destination $aliasPath -Force')
    expect(installPs1).toContain('Remove-Item -LiteralPath $tmpDir -Force -Recurse -ErrorAction SilentlyContinue')
    // Network bytes must never land on the live executable path.
    expect(installPs1).not.toMatch(/Invoke-WebRequest[^\n]*-OutFile\s+\$targetPath\b/)
  })

  it.skipIf(!hasPwsh)(
    'resolves Windows hosts to the published x64 archive',
    () => {
      expect(resolvePs1Asset('AMD64')).toEqual({ asset: 'quantex-windows-x64.exe.zip', status: 0 })
      // The release matrix publishes no Windows ARM64 asset; ARM64 hosts run the
      // x64 build through built-in emulation.
      expect(resolvePs1Asset('ARM64')).toEqual({ asset: 'quantex-windows-x64.exe.zip', status: 0 })
    },
    30_000,
  )

  it.skipIf(!hasPwsh)(
    'resolves the host architecture from a 32-bit PowerShell process',
    () => {
      // PROCESSOR_ARCHITECTURE describes the process; a 32-bit shell on a 64-bit
      // host reports x86 and exposes the host through PROCESSOR_ARCHITEW6432.
      expect(resolvePs1Asset('x86', 'AMD64')).toEqual({ asset: 'quantex-windows-x64.exe.zip', status: 0 })
      expect(resolvePs1Asset('x86', 'ARM64')).toEqual({ asset: 'quantex-windows-x64.exe.zip', status: 0 })
    },
    30_000,
  )

  it.skipIf(!hasPwsh)(
    'fails closed on architectures with no published asset',
    () => {
      expect(resolvePs1Asset('x86').status).not.toBe(0)
      expect(resolvePs1Asset('IA64').status).not.toBe(0)
    },
    30_000,
  )
})
