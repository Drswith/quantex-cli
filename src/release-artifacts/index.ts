import { deflateRawSync, gunzipSync, gzipSync, inflateRawSync } from 'node:zlib'

export type ReleaseChannel = 'beta' | 'stable'
export type ReleaseArchiveFormat = 'tar.gz' | 'zip'

export interface ReleaseArtifactTarget {
  arch: 'arm64' | 'x64'
  platform: 'darwin' | 'linux' | 'win32'
}

export interface ReleaseManifestAsset extends ReleaseArtifactTarget {
  checksum: string
  downloadUrl: string
  name: string
  size: number
}

export interface ReleaseManifest {
  assets: ReleaseManifestAsset[]
  channel: ReleaseChannel
  version: string
}

export const REQUIRED_RELEASE_BINARY_NAMES = [
  'quantex-darwin-arm64',
  'quantex-darwin-x64',
  'quantex-linux-arm64',
  'quantex-linux-x64',
  'quantex-windows-x64.exe',
] as const

export const REQUIRED_RELEASE_ASSET_NAMES = REQUIRED_RELEASE_BINARY_NAMES.map(getReleaseArchiveName)

export function getReleaseArchiveName(binaryName: string): string {
  return `${binaryName}.${getReleaseArchiveFormat(binaryName)}`
}

export function getReleaseArchiveFormat(binaryName: string): ReleaseArchiveFormat {
  return parseBinaryTargetName(binaryName)?.platform === 'win32' ? 'zip' : 'tar.gz'
}

export function getReleaseBinaryName(assetName: string): string | undefined {
  const suffix = assetName.endsWith('.zip') ? '.zip' : assetName.endsWith('.tar.gz') ? '.tar.gz' : undefined
  if (!suffix) return undefined

  const binaryName = assetName.slice(0, -suffix.length)
  const target = parseBinaryTargetName(binaryName)
  const format = suffix === '.zip' ? 'zip' : 'tar.gz'
  return target && getReleaseArchiveFormat(binaryName) === format ? binaryName : undefined
}

export function formatChecksums(entries: Array<{ checksum: string; name: string }>): string {
  return `${entries
    .sort((left, right) => left.name.localeCompare(right.name))
    .map(entry => `${entry.checksum}  ${entry.name}`)
    .join('\n')}\n`
}

export function parseChecksums(contents: string): Map<string, string> {
  const checksums = new Map<string, string>()

  for (const line of contents.split(/\r?\n/)) {
    const trimmedLine = line.trim()
    if (!trimmedLine) continue

    const [checksum, fileName] = trimmedLine.split(/\s+/, 2)
    const normalizedFileName = fileName?.replace(/^\*/, '')

    if (checksum && normalizedFileName) checksums.set(normalizedFileName, checksum)
  }

  return checksums
}

export function parseBinaryTarget(name: string): ReleaseArtifactTarget | undefined {
  const binaryName = getReleaseBinaryName(name) ?? name
  return parseBinaryTargetName(binaryName)
}

export function normalizeRepositoryUrl(repositoryUrl?: string): string {
  if (!repositoryUrl) return 'https://github.com/Drswith/quantex-cli'

  if (repositoryUrl.startsWith('git+')) return repositoryUrl.slice(4).replace(/\.git$/, '')

  if (repositoryUrl.startsWith('git@github.com:'))
    return repositoryUrl.replace('git@github.com:', 'https://github.com/').replace(/\.git$/, '')

  return repositoryUrl.replace(/\.git$/, '')
}

export function resolveReleaseChannel(version: string): ReleaseChannel {
  return version.includes('beta') ? 'beta' : 'stable'
}

export function createReleaseManifest(input: {
  checksums: Map<string, string>
  files: Array<{ name: string; size: number }>
  repositoryUrl?: string
  version: string
}): ReleaseManifest {
  const repositoryUrl = normalizeRepositoryUrl(input.repositoryUrl)
  const channel = resolveReleaseChannel(input.version)
  const assets = input.files
    .map(file => {
      const target = parseBinaryTarget(file.name)
      if (!target) return undefined

      const checksum = input.checksums.get(file.name)
      if (!checksum) throw new Error(`Missing checksum entry for ${file.name}.`)

      if (!getReleaseBinaryName(file.name))
        throw new Error(`Release asset is not a compressed binary archive: ${file.name}.`)

      return {
        arch: target.arch,
        checksum,
        downloadUrl: `${repositoryUrl}/releases/download/v${input.version}/${file.name}`,
        name: file.name,
        platform: target.platform,
        size: file.size,
      } satisfies ReleaseManifestAsset
    })
    .filter((asset): asset is ReleaseManifestAsset => asset !== undefined)
    .sort((left, right) => left.name.localeCompare(right.name))

  if (assets.length === 0) throw new Error('No release binaries were found when creating manifest.json.')

  return {
    assets,
    channel,
    version: input.version,
  }
}

export function validateReleaseManifest(manifest: ReleaseManifest, checksums: Map<string, string>): void {
  if (manifest.assets.length === 0) throw new Error('manifest.json must contain at least one binary asset.')

  const assetNames = new Set(manifest.assets.map(asset => asset.name))

  for (const requiredName of REQUIRED_RELEASE_ASSET_NAMES) {
    if (!assetNames.has(requiredName))
      throw new Error(`manifest.json is missing required release asset: ${requiredName}.`)
  }

  for (const asset of manifest.assets) {
    const expectedChecksum = checksums.get(asset.name)

    if (!expectedChecksum)
      throw new Error(`manifest.json references ${asset.name}, but it is missing from SHA256SUMS.txt.`)

    if (asset.checksum !== expectedChecksum) throw new Error(`manifest.json checksum mismatch for ${asset.name}.`)

    if (!parseBinaryTarget(asset.name))
      throw new Error(`manifest.json contains an invalid binary asset name: ${asset.name}.`)
  }
}

export function createReleaseArchive(binaryName: string, binary: Uint8Array): Uint8Array {
  if (getReleaseBinaryName(getReleaseArchiveName(binaryName)) !== binaryName)
    throw new Error(`Invalid release binary name: ${binaryName}.`)

  return getReleaseArchiveFormat(binaryName) === 'zip'
    ? createZipArchive(binaryName, binary)
    : gzipSync(createTarArchive(binaryName, binary))
}

export function extractReleaseArchive(archive: Uint8Array, expectedBinaryName: string): Uint8Array {
  if (getReleaseBinaryName(getReleaseArchiveName(expectedBinaryName)) !== expectedBinaryName)
    throw new Error(`Invalid expected release binary name: ${expectedBinaryName}.`)

  return getReleaseArchiveFormat(expectedBinaryName) === 'zip'
    ? extractZipArchive(archive, expectedBinaryName)
    : extractTarGzipArchive(archive, expectedBinaryName)
}

function parseBinaryTargetName(name: string): ReleaseArtifactTarget | undefined {
  const match = name.match(/^quantex-(darwin|linux|windows)-(arm64|x64)(?:\.exe)?$/)
  if (!match) return undefined

  return {
    arch: match[2] === 'arm64' ? 'arm64' : 'x64',
    platform: match[1] === 'windows' ? 'win32' : match[1] === 'darwin' ? 'darwin' : 'linux',
  }
}

function createTarArchive(name: string, binary: Uint8Array): Uint8Array {
  const header = new Uint8Array(512)
  writeTarField(header, 0, 100, name)
  writeTarField(header, 100, 8, '0000755\0')
  writeTarField(header, 108, 8, '0000000\0')
  writeTarField(header, 116, 8, '0000000\0')
  writeTarField(header, 124, 12, `${binary.length.toString(8).padStart(11, '0')}\0`)
  writeTarField(header, 136, 12, '00000000000\0')
  header[156] = '0'.charCodeAt(0)
  writeTarField(header, 257, 8, 'ustar\0')
  writeTarField(header, 263, 2, '00')
  header.fill(0x20, 148, 156)

  const checksum = header.reduce((total, byte) => total + byte, 0)
  writeTarField(header, 148, 8, `${checksum.toString(8).padStart(6, '0')}\0 `)

  const paddingLength = (512 - (binary.length % 512)) % 512
  const paddedBinary = new Uint8Array(binary.length + paddingLength)
  paddedBinary.set(binary)

  return concatBytes(header, paddedBinary, new Uint8Array(1024))
}

function createZipArchive(name: string, binary: Uint8Array): Uint8Array {
  const nameBytes = new TextEncoder().encode(name)
  if (nameBytes.length > 0xffff) throw new Error(`Release archive entry name is too long: ${name}.`)

  const compressedBinary = deflateRawSync(binary)
  const compressionMethod = compressedBinary.length < binary.length ? 8 : 0
  const payload = compressionMethod === 8 ? compressedBinary : binary
  const checksum = crc32(binary)
  const localHeader = new Uint8Array(30 + nameBytes.length)
  const centralHeader = new Uint8Array(46 + nameBytes.length)
  const endOfCentralDirectory = new Uint8Array(22)

  writeUint32LE(localHeader, 0, ZIP_LOCAL_FILE_SIGNATURE)
  writeUint16LE(localHeader, 4, 20)
  writeUint16LE(localHeader, 6, 0)
  writeUint16LE(localHeader, 8, compressionMethod)
  writeUint32LE(localHeader, 14, checksum)
  writeUint32LE(localHeader, 18, payload.length)
  writeUint32LE(localHeader, 22, binary.length)
  writeUint16LE(localHeader, 26, nameBytes.length)
  localHeader.set(nameBytes, 30)

  writeUint32LE(centralHeader, 0, ZIP_CENTRAL_DIRECTORY_SIGNATURE)
  writeUint16LE(centralHeader, 4, 20)
  writeUint16LE(centralHeader, 6, 20)
  writeUint16LE(centralHeader, 8, 0)
  writeUint16LE(centralHeader, 10, compressionMethod)
  writeUint32LE(centralHeader, 16, checksum)
  writeUint32LE(centralHeader, 20, payload.length)
  writeUint32LE(centralHeader, 24, binary.length)
  writeUint16LE(centralHeader, 28, nameBytes.length)
  writeUint32LE(centralHeader, 42, 0)
  centralHeader.set(nameBytes, 46)

  writeUint32LE(endOfCentralDirectory, 0, ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE)
  writeUint16LE(endOfCentralDirectory, 8, 1)
  writeUint16LE(endOfCentralDirectory, 10, 1)
  writeUint32LE(endOfCentralDirectory, 12, centralHeader.length)
  writeUint32LE(endOfCentralDirectory, 16, localHeader.length + payload.length)

  return concatBytes(localHeader, payload, centralHeader, endOfCentralDirectory)
}

function extractTarGzipArchive(archive: Uint8Array, expectedBinaryName: string): Uint8Array {
  let contents: Uint8Array
  try {
    contents = gunzipSync(archive)
  } catch (error) {
    throw new Error('Release archive is not a valid gzip stream.', { cause: error })
  }

  let offset = 0
  let extracted: Uint8Array | undefined
  while (offset + 512 <= contents.length) {
    const header = contents.subarray(offset, offset + 512)
    if (header.every(byte => byte === 0)) break

    const name = readTarString(header.subarray(0, 100))
    const prefix = readTarString(header.subarray(345, 500))
    const entryName = prefix ? `${prefix}/${name}` : name
    const type = header[156]
    const size = readTarSize(header.subarray(124, 136))
    const bodyStart = offset + 512
    const bodyEnd = bodyStart + size

    if (!name || bodyEnd > contents.length) throw new Error('Release archive contains an invalid tar entry.')
    if (type !== 0 && type !== '0'.charCodeAt(0)) throw new Error('Release archive must contain only a regular file.')
    if (entryName !== expectedBinaryName || extracted)
      throw new Error(`Release archive must contain exactly ${expectedBinaryName}.`)

    extracted = contents.slice(bodyStart, bodyEnd)
    offset = bodyStart + Math.ceil(size / 512) * 512
  }

  if (!extracted) throw new Error(`Release archive does not contain ${expectedBinaryName}.`)
  return extracted
}

function extractZipArchive(archive: Uint8Array, expectedBinaryName: string): Uint8Array {
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength)
  let offset = 0
  let extracted: Uint8Array | undefined

  while (offset + 4 <= archive.length) {
    const signature = readUint32LE(view, offset)

    if (signature === ZIP_LOCAL_FILE_SIGNATURE) {
      ensureZipRange(view, offset, 30)
      const flags = readUint16LE(view, offset + 6)
      const compressionMethod = readUint16LE(view, offset + 8)
      const checksum = readUint32LE(view, offset + 14)
      const compressedSize = readUint32LE(view, offset + 18)
      const uncompressedSize = readUint32LE(view, offset + 22)
      const nameLength = readUint16LE(view, offset + 26)
      const extraLength = readUint16LE(view, offset + 28)
      const nameStart = offset + 30
      const dataStart = nameStart + nameLength + extraLength
      ensureZipRange(view, offset, 30 + nameLength + extraLength + compressedSize)

      if ((flags & 0x1) !== 0 || (flags & 0x8) !== 0)
        throw new Error('Release archive contains an unsupported zip entry.')

      const entryName = new TextDecoder().decode(archive.subarray(nameStart, nameStart + nameLength))
      if (entryName !== expectedBinaryName || extracted)
        throw new Error(`Release archive must contain exactly ${expectedBinaryName}.`)

      const compressed = archive.subarray(dataStart, dataStart + compressedSize)
      let binary: Uint8Array
      try {
        if (compressionMethod === 0) binary = compressed
        else if (compressionMethod === 8) binary = inflateRawSync(compressed)
        else throw new Error('unsupported compression method')
      } catch (error) {
        throw new Error('Release archive contains an invalid zip entry.', { cause: error })
      }

      if (binary.length !== uncompressedSize || crc32(binary) !== checksum)
        throw new Error('Release archive contains an invalid zip entry.')

      extracted = binary.slice()
      offset = dataStart + compressedSize
      continue
    }

    if (signature === ZIP_CENTRAL_DIRECTORY_SIGNATURE) {
      if (!extracted) throw new Error(`Release archive does not contain ${expectedBinaryName}.`)
      validateZipCentralDirectory(archive, view, offset, expectedBinaryName)
      return extracted
    }

    throw new Error('Release archive is not a valid zip file.')
  }

  throw new Error(`Release archive does not contain ${expectedBinaryName}.`)
}

function validateZipCentralDirectory(
  archive: Uint8Array,
  view: DataView,
  centralDirectoryOffset: number,
  expectedBinaryName: string,
): void {
  let offset = centralDirectoryOffset
  let entryCount = 0

  while (offset + 4 <= archive.length && readUint32LE(view, offset) === ZIP_CENTRAL_DIRECTORY_SIGNATURE) {
    ensureZipRange(view, offset, 46)
    const nameLength = readUint16LE(view, offset + 28)
    const extraLength = readUint16LE(view, offset + 30)
    const commentLength = readUint16LE(view, offset + 32)
    ensureZipRange(view, offset, 46 + nameLength + extraLength + commentLength)

    const entryName = new TextDecoder().decode(archive.subarray(offset + 46, offset + 46 + nameLength))
    if (entryName !== expectedBinaryName || entryCount > 0)
      throw new Error(`Release archive must contain exactly ${expectedBinaryName}.`)

    entryCount += 1
    offset += 46 + nameLength + extraLength + commentLength
  }

  ensureZipRange(view, offset, 22)
  if (readUint32LE(view, offset) !== ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE || entryCount !== 1)
    throw new Error('Release archive is not a valid zip file.')
  if (readUint16LE(view, offset + 10) !== entryCount) throw new Error('Release archive is not a valid zip file.')
}

function readTarString(bytes: Uint8Array): string {
  const zero = bytes.indexOf(0)
  return new TextDecoder().decode(zero === -1 ? bytes : bytes.subarray(0, zero))
}

function readTarSize(bytes: Uint8Array): number {
  const value = readTarString(bytes).trim()
  if (!/^[0-7]+$/u.test(value)) throw new Error('Release archive contains an invalid tar size.')

  const size = Number.parseInt(value, 8)
  if (!Number.isSafeInteger(size) || size < 0) throw new Error('Release archive contains an unsafe tar size.')
  return size
}

function writeTarField(target: Uint8Array, offset: number, length: number, value: string): void {
  const bytes = new TextEncoder().encode(value)
  if (bytes.length > length) throw new Error('Release archive contains a tar field that is too long.')
  target.set(bytes, offset)
}

function writeUint16LE(target: Uint8Array, offset: number, value: number): void {
  new DataView(target.buffer, target.byteOffset, target.byteLength).setUint16(offset, value, true)
}

function writeUint32LE(target: Uint8Array, offset: number, value: number): void {
  new DataView(target.buffer, target.byteOffset, target.byteLength).setUint32(offset, value, true)
}

function readUint16LE(view: DataView, offset: number): number {
  ensureZipRange(view, offset, 2)
  return view.getUint16(offset, true)
}

function readUint32LE(view: DataView, offset: number): number {
  ensureZipRange(view, offset, 4)
  return view.getUint32(offset, true)
}

function ensureZipRange(view: DataView, offset: number, length: number): void {
  if (offset < 0 || length < 0 || offset + length > view.byteLength)
    throw new Error('Release archive contains an invalid zip entry.')
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0))
  let offset = 0

  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }

  return result
}

function crc32(bytes: Uint8Array): number {
  let checksum = 0xffffffff

  for (const byte of bytes) checksum = CRC32_TABLE[(checksum ^ byte) & 0xff]! ^ (checksum >>> 8)

  return (checksum ^ 0xffffffff) >>> 0
}

const CRC32_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index

  for (let bit = 0; bit < 8; bit += 1) value = (value & 1) === 0 ? value >>> 1 : (value >>> 1) ^ 0xedb88320

  return value >>> 0
})

const ZIP_LOCAL_FILE_SIGNATURE = 0x04034b50
const ZIP_CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50
const ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50
