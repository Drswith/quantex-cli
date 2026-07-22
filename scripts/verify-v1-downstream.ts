import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'

interface DownstreamRuntimeResult {
  readonly agent: string
  readonly exitCode: number
  readonly ok: boolean
  readonly version: string
}

interface PackageManifest {
  readonly version: string
}

interface DownstreamCompatibilityOptions {
  readonly consumerRoot?: string
  readonly packageRoot?: string
}

export async function verifyV1DownstreamCompatibility(options: DownstreamCompatibilityOptions = {}): Promise<void> {
  const root = process.cwd()
  const fixtureRoot = join(root, 'test', 'fixtures', 'compatibility', 'v1', 'downstream')
  const consumerRoot = options.consumerRoot ?? fixtureRoot
  const packageRoot = options.packageRoot ?? root
  const tsc = join(root, 'node_modules', 'typescript', 'bin', 'tsc')

  if (consumerRoot !== fixtureRoot) {
    await mkdir(consumerRoot, { recursive: true })
    await Promise.all(['consumer.ts', 'runtime.mjs'].map(file => cp(join(fixtureRoot, file), join(consumerRoot, file))))
  }

  const semanticRuntimeExportConsumer = join(consumerRoot, `all-runtime-exports.${process.pid}.ts`)
  await writeFile(semanticRuntimeExportConsumer, await createSemanticRuntimeExportConsumer(root))

  try {
    await runChecked(
      [
        process.execPath,
        tsc,
        '--noEmit',
        '--module',
        'NodeNext',
        '--moduleResolution',
        'NodeNext',
        '--target',
        'ES2022',
        '--strict',
        '--skipLibCheck',
        join(consumerRoot, 'consumer.ts'),
        semanticRuntimeExportConsumer,
      ],
      consumerRoot,
    )
  } finally {
    await rm(semanticRuntimeExportConsumer, { force: true })
  }

  const runtime = await runChecked(['node', join(consumerRoot, 'runtime.mjs')], consumerRoot)
  const actual = JSON.parse(runtime.stdout) as DownstreamRuntimeResult
  const packageManifest = (await Bun.file(join(packageRoot, 'package.json')).json()) as PackageManifest

  const expected: DownstreamRuntimeResult = {
    agent: 'codex',
    exitCode: 0,
    ok: true,
    version: packageManifest.version,
  }
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Built root runtime changed the v1 downstream contract.\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`,
    )
  }
}

async function createSemanticRuntimeExportConsumer(root: string): Promise<string> {
  const fixturePath = join(root, 'test', 'fixtures', 'compatibility', 'v1', 'root-exports.json')
  const exportNames = JSON.parse(await readFile(fixturePath, 'utf8')) as unknown
  if (
    !Array.isArray(exportNames) ||
    exportNames.some(name => typeof name !== 'string' || !/^[$A-Z_a-z][$\w]*$/u.test(name))
  ) {
    throw new Error('The maintained v1 root export fixture must contain TypeScript identifiers.')
  }

  return [
    "import * as quantex from 'quantex-cli'",
    '',
    'const maintainedRuntimeExports = {',
    ...exportNames.map(name => `  ${name}: quantex.${name},`),
    '} as const',
    '',
    'void maintainedRuntimeExports',
    '',
  ].join('\n')
}

if (import.meta.main) {
  await verifyV1DownstreamCompatibility()
  console.log('Built root declarations and ESM runtime preserve the v1 downstream compatibility fixture.')
}

async function runChecked(command: readonly string[], cwd: string): Promise<{ readonly stdout: string }> {
  const proc = Bun.spawn([...command], {
    cwd,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  if (exitCode !== 0) {
    throw new Error(
      `Downstream compatibility command failed (${command.join(' ')}) with exit code ${exitCode}.\n${stderr.trim() || stdout.trim()}`,
    )
  }
  return { stdout }
}
