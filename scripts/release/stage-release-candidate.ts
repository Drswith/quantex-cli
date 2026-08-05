import { createHash } from 'node:crypto'
import { cp, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import process from 'node:process'
import { REQUIRED_RELEASE_ASSET_NAMES } from '../../src/release-artifacts'

export interface CandidateFile {
  name: string
  sha256: string
  size: number
}

export interface ReleaseCandidateManifest {
  assets: CandidateFile[]
  commitSha: string
  npm: CandidateFile & { integrity: string }
  releaseNotes: CandidateFile
  tag: string
  version: string
}

export function extractReleaseNotes(changelog: string, version: string): string {
  const escapedVersion = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const heading = new RegExp(`^## \\[${escapedVersion}\\].*$`, 'm')
  const match = heading.exec(changelog)
  if (!match) throw new Error(`CHANGELOG.md has no release section for ${version}.`)
  const sectionStart = match.index
  const remaining = changelog.slice(sectionStart + match[0].length)
  const nextHeading = remaining.search(/^## \[/m)
  return `${changelog.slice(sectionStart, nextHeading === -1 ? changelog.length : sectionStart + match[0].length + nextHeading).trim()}\n`
}

if (import.meta.main) await stageReleaseCandidate(process.argv[2] ?? 'release-candidate')

async function stageReleaseCandidate(candidateRoot: string): Promise<void> {
  const packageJson = (await Bun.file(new URL('../../package.json', import.meta.url)).json()) as {
    name?: string
    version?: string
  }
  const version = packageJson.version ?? ''
  const tag = `v${version}`
  const commitSha = (await runChecked(['git', 'rev-parse', 'HEAD'])).trim()
  const assetsRoot = join(candidateRoot, 'assets')
  const npmRoot = join(candidateRoot, 'npm')
  await mkdir(assetsRoot, { recursive: true })
  await mkdir(npmRoot, { recursive: true })

  const expectedAssets = [...REQUIRED_RELEASE_ASSET_NAMES, 'manifest.json', 'SHA256SUMS.txt']
  for (const name of expectedAssets) await cp(join('dist', 'bin', name), join(assetsRoot, name))

  const packOutput = await runChecked(['npm', 'pack', '--ignore-scripts', '--json', '--pack-destination', npmRoot])
  const packed = (JSON.parse(packOutput) as Array<{ filename?: string }>)[0]
  if (!packed?.filename) throw new Error('npm pack did not return a candidate tarball filename.')
  const npmPath = join(npmRoot, basename(packed.filename))

  const assets = await Promise.all(expectedAssets.map(name => describeFile(join(assetsRoot, name), name)))
  const npmFile = await describeFile(npmPath, basename(npmPath))
  const npmContents = await readFile(npmPath)
  const releaseNotesPath = join(candidateRoot, 'release-notes.md')
  const changelog = await readFile('CHANGELOG.md', 'utf8')
  await writeFile(releaseNotesPath, extractReleaseNotes(changelog, version), 'utf8')
  const manifest: ReleaseCandidateManifest = {
    assets,
    commitSha,
    npm: {
      ...npmFile,
      integrity: `sha512-${createHash('sha512').update(npmContents).digest('base64')}`,
    },
    releaseNotes: await describeFile(releaseNotesPath, 'release-notes.md'),
    tag,
    version,
  }
  await writeFile(join(candidateRoot, 'candidate.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  await verifyReleaseCandidate(candidateRoot)
}

export async function verifyReleaseCandidate(candidateRoot: string): Promise<ReleaseCandidateManifest> {
  const manifest = JSON.parse(await readFile(join(candidateRoot, 'candidate.json'), 'utf8')) as ReleaseCandidateManifest
  for (const [directory, files] of [
    ['assets', manifest.assets],
    ['npm', [manifest.npm]],
    ['', [manifest.releaseNotes]],
  ] as const) {
    for (const file of files) {
      const filePath = join(candidateRoot, directory, file.name)
      const actual = await describeFile(filePath, file.name)
      if (actual.size !== file.size || actual.sha256 !== file.sha256)
        throw new Error(`Release candidate file does not match candidate.json: ${file.name}.`)
    }
  }
  const npmContents = await readFile(join(candidateRoot, 'npm', manifest.npm.name))
  const integrity = `sha512-${createHash('sha512').update(npmContents).digest('base64')}`
  if (integrity !== manifest.npm.integrity) throw new Error('Release candidate npm integrity does not match.')
  return manifest
}

async function describeFile(path: string, name: string): Promise<CandidateFile> {
  const contents = await readFile(path)
  return {
    name,
    sha256: createHash('sha256').update(contents).digest('hex'),
    size: (await stat(path)).size,
  }
}

async function runChecked(command: string[]): Promise<string> {
  const child = Bun.spawn(command, { stderr: 'inherit', stdout: 'pipe' })
  const output = await new Response(child.stdout).text()
  const exitCode = await child.exited
  if (exitCode !== 0) throw new Error(`Command failed with exit code ${exitCode}: ${command.join(' ')}`)
  return output
}
