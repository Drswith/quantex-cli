import { describe, expect, it } from 'vitest'
import {
  createReleaseManifest,
  formatChecksums,
  normalizeRepositoryUrl,
  parseBinaryTarget,
  parseChecksums,
  REQUIRED_RELEASE_ASSET_NAMES,
  resolveReleaseChannel,
  validateReleaseManifest,
} from '../src/release-artifacts'

describe('release artifacts helpers', () => {
  it('normalizes repository URLs', () => {
    expect(normalizeRepositoryUrl('git+https://github.com/Drswith/quantex-cli.git')).toBe(
      'https://github.com/Drswith/quantex-cli',
    )
    expect(normalizeRepositoryUrl('git@github.com:Drswith/quantex-cli.git')).toBe(
      'https://github.com/Drswith/quantex-cli',
    )
    expect(normalizeRepositoryUrl(undefined)).toBe('https://github.com/Drswith/quantex-cli')
  })

  it('parses binary targets from release filenames', () => {
    expect(parseBinaryTarget('quantex-darwin-arm64')).toEqual({ arch: 'arm64', platform: 'darwin' })
    expect(parseBinaryTarget('quantex-linux-x64')).toEqual({ arch: 'x64', platform: 'linux' })
    expect(parseBinaryTarget('quantex-windows-x64.exe')).toEqual({ arch: 'x64', platform: 'win32' })
    expect(parseBinaryTarget('manifest.json')).toBeUndefined()
  })

  it('parses checksum files', () => {
    expect(parseChecksums(`abc  quantex-darwin-arm64\n123 *quantex-linux-x64\n`)).toEqual(
      new Map([
        ['quantex-darwin-arm64', 'abc'],
        ['quantex-linux-x64', '123'],
      ]),
    )
  })

  it('formats checksum files deterministically', () => {
    expect(
      formatChecksums([
        { checksum: 'b', name: 'quantex-linux-x64' },
        { checksum: 'a', name: 'quantex-darwin-arm64' },
      ]),
    ).toBe('a  quantex-darwin-arm64\nb  quantex-linux-x64\n')
  })

  it('resolves release channel from version', () => {
    expect(resolveReleaseChannel('1.0.0')).toBe('stable')
    expect(resolveReleaseChannel('1.0.0-beta.1')).toBe('beta')
  })

  it('creates a release manifest from binaries and checksums', () => {
    const manifest = createReleaseManifest({
      checksums: new Map([
        ['quantex-darwin-arm64', 'a'.repeat(64)],
        ['quantex-linux-x64', 'b'.repeat(64)],
      ]),
      files: [
        { name: 'quantex-linux-x64', size: 22 },
        { name: 'quantex-darwin-arm64', size: 11 },
        { name: 'manifest.json', size: 5 },
      ],
      repositoryUrl: 'git+https://github.com/Drswith/quantex-cli.git',
      version: '1.2.3-beta.1',
    })

    expect(manifest).toEqual({
      assets: [
        {
          arch: 'arm64',
          checksum: 'a'.repeat(64),
          downloadUrl: 'https://github.com/Drswith/quantex-cli/releases/download/v1.2.3-beta.1/quantex-darwin-arm64',
          name: 'quantex-darwin-arm64',
          platform: 'darwin',
          size: 11,
        },
        {
          arch: 'x64',
          checksum: 'b'.repeat(64),
          downloadUrl: 'https://github.com/Drswith/quantex-cli/releases/download/v1.2.3-beta.1/quantex-linux-x64',
          name: 'quantex-linux-x64',
          platform: 'linux',
          size: 22,
        },
      ],
      channel: 'beta',
      version: '1.2.3-beta.1',
    })
  })

  it('fails manifest generation when a checksum is missing', () => {
    expect(() =>
      createReleaseManifest({
        checksums: new Map(),
        files: [{ name: 'quantex-darwin-arm64', size: 11 }],
        version: '1.2.3',
      }),
    ).toThrow('Missing checksum entry for quantex-darwin-arm64.')
  })

  it('validates manifest/checksum consistency', () => {
    const checksums = createRequiredChecksums()
    const manifest = createReleaseManifest({
      checksums,
      files: createRequiredFiles(),
      version: '1.2.3',
    })

    expect(() => validateReleaseManifest(manifest, checksums)).not.toThrow()

    const mismatchedChecksums = new Map(checksums)
    mismatchedChecksums.set('quantex-darwin-arm64', 'z'.repeat(64))

    expect(() => validateReleaseManifest(manifest, mismatchedChecksums)).toThrow(
      'manifest.json checksum mismatch for quantex-darwin-arm64.',
    )
  })

  it('requires the complete release asset matrix', () => {
    const manifest = createReleaseManifest({
      checksums: new Map([['quantex-darwin-arm64', 'a'.repeat(64)]]),
      files: [{ name: 'quantex-darwin-arm64', size: 11 }],
      version: '1.2.3',
    })

    expect(() => validateReleaseManifest(manifest, new Map([['quantex-darwin-arm64', 'a'.repeat(64)]]))).toThrow(
      'manifest.json is missing required release asset: quantex-darwin-x64.',
    )
  })
})

function createRequiredChecksums(): Map<string, string> {
  return new Map(REQUIRED_RELEASE_ASSET_NAMES.map((name, index) => [name, String(index + 1).repeat(64)]))
}

function createRequiredFiles(): Array<{ name: string; size: number }> {
  return REQUIRED_RELEASE_ASSET_NAMES.map((name, index) => ({
    name,
    size: index + 1,
  }))
}
