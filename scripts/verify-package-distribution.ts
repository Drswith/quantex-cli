import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'

interface PackedFile {
  path: string
}

interface PackedPackage {
  files?: PackedFile[]
  filename?: string
}

const proc = Bun.spawn(['npm', 'pack', '--dry-run', '--json'], {
  cwd: process.cwd(),
  env: process.env,
  stdio: ['ignore', 'pipe', 'pipe'] as const,
})

const [stdout, stderr, exitCode] = await Promise.all([
  proc.stdout ? new Response(proc.stdout).text() : Promise.resolve(''),
  proc.stderr ? new Response(proc.stderr).text() : Promise.resolve(''),
  proc.exited,
])

if (exitCode !== 0) {
  throw new Error(`npm pack --dry-run --json failed with exit code ${exitCode}.\n${stderr.trim() || stdout.trim()}`)
}

const packedPackages = parsePackOutput(stdout)
const packedPackage = packedPackages[0]

if (!packedPackage) throw new Error('npm pack --dry-run --json did not return package metadata.')

const packedFiles = packedPackage.files ?? []
const forbiddenFiles = packedFiles.filter(file => file.path.startsWith('dist/bin/'))

if (forbiddenFiles.length > 0) {
  throw new Error(
    `Managed-install package unexpectedly includes standalone release artifacts:\n${forbiddenFiles
      .map(file => `- ${file.path}`)
      .join('\n')}`,
  )
}

const requiredFiles = ['dist/cli.mjs', 'dist/index.mjs', 'scripts/postinstall.cjs']
const missingFiles = requiredFiles.filter(requiredPath => !packedFiles.some(file => file.path === requiredPath))

if (missingFiles.length > 0) {
  throw new Error(`Managed-install package is missing required runtime files:\n${missingFiles.join('\n')}`)
}

if (packedPackage.filename) {
  await rm(join(process.cwd(), packedPackage.filename), { force: true })
}

console.log(`Managed-install package excludes dist/bin and keeps runtime files (${requiredFiles.join(', ')}).`)

function parsePackOutput(packStdout: string): PackedPackage[] {
  const jsonStart = packStdout.lastIndexOf('\n[')
  const jsonText = (jsonStart >= 0 ? packStdout.slice(jsonStart + 1) : packStdout).trim()

  return JSON.parse(jsonText) as PackedPackage[]
}
