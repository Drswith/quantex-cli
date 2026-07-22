import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const manifest = JSON.parse(readFileSync('package.json', 'utf8')) as {
  devDependencies?: Record<string, string>
  packageManager?: string
}
const bunfig = readFileSync('bunfig.toml', 'utf8')

describe('workspace package-manager contract', () => {
  it('keeps clean installs script-free and Bun types directly resolvable', () => {
    const bunVersion = manifest.packageManager?.replace(/^bun@/u, '')

    expect(bunfig).toMatch(/^\[install\]\nignoreScripts = true\n$/u)
    expect(bunVersion).toBe('1.3.11')
    expect(manifest.devDependencies?.['bun-types']).toBe(bunVersion)
  })
})
