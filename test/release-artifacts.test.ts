import { gzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import {
  createReleaseArchive,
  createReleaseManifest,
  extractReleaseArchive,
  formatChecksums,
  getReleaseArchiveFormat,
  getReleaseArchiveName,
  getReleaseBinaryName,
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
    expect(parseBinaryTarget('quantex-darwin-arm64.tar.gz')).toEqual({ arch: 'arm64', platform: 'darwin' })
    expect(parseBinaryTarget('quantex-linux-x64.tar.gz')).toEqual({ arch: 'x64', platform: 'linux' })
    expect(parseBinaryTarget('quantex-windows-x64.exe.zip')).toEqual({ arch: 'x64', platform: 'win32' })
    expect(parseBinaryTarget('quantex-windows-x64.exe.tar.gz')).toBeUndefined()
    expect(parseBinaryTarget('manifest.json')).toBeUndefined()
  })

  it('maps compressed release assets to their executable names', () => {
    expect(getReleaseArchiveName('quantex-linux-x64')).toBe('quantex-linux-x64.tar.gz')
    expect(getReleaseArchiveFormat('quantex-windows-x64.exe')).toBe('zip')
    expect(getReleaseArchiveName('quantex-windows-x64.exe')).toBe('quantex-windows-x64.exe.zip')
    expect(getReleaseBinaryName('quantex-windows-x64.exe.zip')).toBe('quantex-windows-x64.exe')
    expect(getReleaseBinaryName('quantex-windows-x64.exe.tar.gz')).toBeUndefined()
    expect(getReleaseBinaryName('quantex-linux-x64')).toBeUndefined()
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
        ['quantex-darwin-arm64.tar.gz', 'a'.repeat(64)],
        ['quantex-linux-x64.tar.gz', 'b'.repeat(64)],
      ]),
      files: [
        { name: 'quantex-linux-x64.tar.gz', size: 22 },
        { name: 'quantex-darwin-arm64.tar.gz', size: 11 },
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
          downloadUrl:
            'https://github.com/Drswith/quantex-cli/releases/download/v1.2.3-beta.1/quantex-darwin-arm64.tar.gz',
          name: 'quantex-darwin-arm64.tar.gz',
          platform: 'darwin',
          size: 11,
        },
        {
          arch: 'x64',
          checksum: 'b'.repeat(64),
          downloadUrl:
            'https://github.com/Drswith/quantex-cli/releases/download/v1.2.3-beta.1/quantex-linux-x64.tar.gz',
          name: 'quantex-linux-x64.tar.gz',
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
        files: [{ name: 'quantex-darwin-arm64.tar.gz', size: 11 }],
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
    mismatchedChecksums.set('quantex-darwin-arm64.tar.gz', 'z'.repeat(64))

    expect(() => validateReleaseManifest(manifest, mismatchedChecksums)).toThrow(
      'manifest.json checksum mismatch for quantex-darwin-arm64.tar.gz.',
    )
  })

  it('requires the complete release asset matrix', () => {
    const manifest = createReleaseManifest({
      checksums: new Map([['quantex-darwin-arm64.tar.gz', 'a'.repeat(64)]]),
      files: [{ name: 'quantex-darwin-arm64.tar.gz', size: 11 }],
      version: '1.2.3',
    })

    expect(() => validateReleaseManifest(manifest, new Map([['quantex-darwin-arm64', 'a'.repeat(64)]]))).toThrow(
      'manifest.json is missing required release asset: quantex-darwin-x64.tar.gz.',
    )
  })

  it('extracts only the expected regular-file archive entry', () => {
    expect(
      Array.from(extractReleaseArchive(createTarArchive('quantex-linux-x64', 'binary'), 'quantex-linux-x64')),
    ).toEqual(Array.from(new TextEncoder().encode('binary')))
    expect(() => extractReleaseArchive(createTarArchive('../qtx', 'binary'), 'quantex-linux-x64')).toThrow(
      'Release archive must contain exactly quantex-linux-x64.',
    )
  })

  it('creates and extracts a Windows ZIP archive with integrity checks', () => {
    const binary = new TextEncoder().encode('binary'.repeat(100))
    const archive = createReleaseArchive('quantex-windows-x64.exe', binary)

    expect(Array.from(archive.subarray(0, 2))).toEqual([0x50, 0x4b])
    expect(Array.from(extractReleaseArchive(archive, 'quantex-windows-x64.exe'))).toEqual(Array.from(binary))

    const corrupted = archive.slice()
    corrupted[30 + 'quantex-windows-x64.exe'.length] ^= 0xff
    expect(() => extractReleaseArchive(corrupted, 'quantex-windows-x64.exe')).toThrow(
      'Release archive contains an invalid zip entry.',
    )

    const duplicateEntry = createReleaseArchive(
      'quantex-windows-x64.exe',
      new TextEncoder().encode('other'.repeat(100)),
    )
    const withExtraEntry = appendZipLocalEntry(archive, duplicateEntry)
    expect(() => extractReleaseArchive(withExtraEntry, 'quantex-windows-x64.exe')).toThrow(
      'Release archive must contain exactly quantex-windows-x64.exe.',
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

function createTarArchive(name: string, contents: string): Uint8Array {
  const encodedName = new TextEncoder().encode(name)
  const body = new TextEncoder().encode(contents)
  const header = new Uint8Array(512)
  header.set(encodedName, 0)
  header.set(new TextEncoder().encode(`${body.length.toString(8).padStart(11, '0')}\0`), 124)
  header[156] = '0'.charCodeAt(0)
  const padding = new Uint8Array(Math.ceil(body.length / 512) * 512)
  padding.set(body)
  const tar = new Uint8Array(512 + padding.length + 1024)
  tar.set(header, 0)
  tar.set(padding, 512)
  return gzipSync(tar)
}

function appendZipLocalEntry(archive: Uint8Array, extraArchive: Uint8Array): Uint8Array {
  const firstEntryLength = getZipLocalEntryLength(archive)
  const extraEntryLength = getZipLocalEntryLength(extraArchive)
  const result = new Uint8Array(archive.length + extraEntryLength)

  result.set(archive.subarray(0, firstEntryLength), 0)
  result.set(extraArchive.subarray(0, extraEntryLength), firstEntryLength)
  result.set(archive.subarray(firstEntryLength), firstEntryLength + extraEntryLength)
  return result
}

function getZipLocalEntryLength(archive: Uint8Array): number {
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength)
  return 30 + view.getUint16(26, true) + view.getUint16(28, true) + view.getUint32(18, true)
}
