import { readdir, readFile, stat, writeFile } from 'node:fs/promises'

interface PackageJsonShape {
  name?: string
  repository?: string | { url?: string }
  version?: string
}

const packageJson = await Bun.file(new URL('../package.json', import.meta.url)).json() as PackageJsonShape
const repositoryUrl = normalizeRepositoryUrl(typeof packageJson.repository === 'string' ? packageJson.repository : packageJson.repository?.url)
const version = packageJson.version ?? '0.0.0'
const channel = version.includes('beta') ? 'beta' : 'stable'
const binDir = new URL('../dist/bin/', import.meta.url)
const checksumContents = await readFile(new URL('../dist/bin/SHA256SUMS.txt', import.meta.url), 'utf8')
const checksums = parseChecksums(checksumContents)
const files = await readdir(binDir)

const assets = await Promise.all(
  files
    .filter(name => name.startsWith('quantex-'))
    .map(async (name) => {
      const target = parseBinaryTarget(name)
      if (!target)
        return undefined

      return {
        arch: target.arch,
        checksum: checksums.get(name) ?? '',
        downloadUrl: `${repositoryUrl}/releases/download/v${version}/${name}`,
        name,
        platform: target.platform,
        size: (await stat(new URL(name, binDir))).size,
      }
    }),
)

const manifest = {
  assets: assets.filter(Boolean),
  channel,
  version,
}

await writeFile(new URL('../dist/bin/manifest.json', import.meta.url), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

function parseChecksums(contents: string): Map<string, string> {
  const checksums = new Map<string, string>()

  for (const line of contents.split(/\r?\n/)) {
    const trimmedLine = line.trim()
    if (!trimmedLine)
      continue

    const [checksum, fileName] = trimmedLine.split(/\s+/, 2)
    const normalizedFileName = fileName?.replace(/^\*/, '')

    if (checksum && normalizedFileName)
      checksums.set(normalizedFileName, checksum)
  }

  return checksums
}

function parseBinaryTarget(name: string): { arch: 'arm64' | 'x64', platform: 'darwin' | 'linux' | 'win32' } | undefined {
  const match = name.match(/^quantex-(darwin|linux|windows)-(arm64|x64)(?:\.exe)?$/)
  if (!match)
    return undefined

  return {
    arch: match[2] === 'arm64' ? 'arm64' : 'x64',
    platform: match[1] === 'windows'
      ? 'win32'
      : match[1] === 'darwin'
        ? 'darwin'
        : 'linux',
  }
}

function normalizeRepositoryUrl(repositoryUrl?: string): string {
  if (!repositoryUrl)
    return 'https://github.com/Drswith/quantex-cli'

  if (repositoryUrl.startsWith('git+'))
    return repositoryUrl.slice(4).replace(/\.git$/, '')

  if (repositoryUrl.startsWith('git@github.com:'))
    return repositoryUrl.replace('git@github.com:', 'https://github.com/').replace(/\.git$/, '')

  return repositoryUrl.replace(/\.git$/, '')
}
