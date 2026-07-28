import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const installSh = readFileSync('install.sh', 'utf8')

function extractInstallShStateRecorder(): string {
  const start = installSh.indexOf("<<'PY'\n")
  const end = installSh.indexOf('\nPY\n', start)
  expect(start).toBeGreaterThan(-1)
  expect(end).toBeGreaterThan(start)
  return installSh.slice(start + "<<'PY'\n".length, end)
}

describe('standalone install scripts', () => {
  it('records binary install source with fail-closed parse handling and atomic replace', () => {
    expect(installSh).toContain('leaving existing state.json untouched')
    expect(installSh).toContain('tempfile.mkstemp')
    expect(installSh).toContain('os.replace(tmp_name, state_path)')
    expect(installSh).not.toContain('state_path.write_text(')
    expect(installSh).toMatch(/except Exception(?: as error)?:/)
  })

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
  })

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
  })
})
