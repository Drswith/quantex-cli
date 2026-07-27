import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const installPs1 = readFileSync('install.ps1', 'utf8')

describe('standalone install scripts', () => {
  it('maps Windows ARM64 hosts to the published x64 release asset', () => {
    expect(installPs1).toMatch(/'amd64'\s*\{\s*'x64'\s*\}/)
    expect(installPs1).toMatch(/'arm64'\s*\{\s*'x64'\s*\}/)
    expect(installPs1).not.toMatch(/'arm64'\s*\{\s*'arm64'\s*\}/)
    expect(installPs1).toContain('$asset = "quantex-windows-$arch.exe"')
    expect(installPs1).not.toContain('quantex-windows-arm64.exe')
  })
})
