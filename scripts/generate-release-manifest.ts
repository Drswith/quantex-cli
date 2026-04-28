import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { createReleaseManifest, normalizeRepositoryUrl, parseChecksums } from '../src/release-artifacts'

interface PackageJsonShape {
  name?: string
  repository?: string | { url?: string }
  version?: string
}

const packageJson = (await Bun.file(new URL('../package.json', import.meta.url)).json()) as PackageJsonShape
const version = packageJson.version ?? '0.0.0'
const binDir = new URL('../dist/bin/', import.meta.url)
const checksumContents = await readFile(new URL('../dist/bin/SHA256SUMS.txt', import.meta.url), 'utf8')
const checksums = parseChecksums(checksumContents)
const files = await readdir(binDir)
const binaryFiles = await Promise.all(
  files
    .filter(name => name.startsWith('quantex-'))
    .map(async name => ({
      name,
      size: (await stat(new URL(name, binDir))).size,
    })),
)
const manifest = createReleaseManifest({
  checksums,
  files: binaryFiles,
  repositoryUrl: normalizeRepositoryUrl(
    typeof packageJson.repository === 'string' ? packageJson.repository : packageJson.repository?.url,
  ),
  version,
})

await writeFile(new URL('../dist/bin/manifest.json', import.meta.url), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
