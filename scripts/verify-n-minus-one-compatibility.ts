import { strict as assert } from 'node:assert'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, delimiter, dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const FIXTURE_ROOT = join(REPOSITORY_ROOT, 'test', 'fixtures', 'compatibility', 'n-minus-one')
const FIXTURE_MANIFEST = join(FIXTURE_ROOT, '1.1.3-to-1.2.0.json')
const IDEMPOTENCY_RECORD_KEYS = [
  'createdAt',
  'expiresAt',
  'postcondition',
  'receipt',
  'request',
  'resolvedPlan',
  'result',
  'schemaVersion',
] as const

interface CliOptions {
  readonly candidateCli: string
  readonly previousCli: string
}

interface CompatibilityFixture {
  readonly fixtureVersion: number
  readonly previous: ReleaseIdentity & { readonly commit: string; readonly tag: string }
  readonly candidate: ReleaseIdentity
  readonly schemas: {
    readonly idempotency: number
    readonly lifecycleReceipt: number
    readonly state: number
  }
  readonly agent: {
    readonly binaryName: string
    readonly name: string
    readonly providerId: string
    readonly providerTargetId: string
    readonly providerTargetKind: string
    readonly version: string
  }
  readonly failClosedCases: readonly FailClosedCase[]
}

interface ReleaseIdentity {
  readonly version: string
}

type FailClosedCase =
  | {
      readonly errorCode: string
      readonly file: string
      readonly name: string
      readonly type: 'state'
    }
  | {
      readonly errorCode: string
      readonly file: string
      readonly invalidReason: string
      readonly name: string
      readonly type: 'idempotency'
    }

interface CliRelease extends ReleaseIdentity {
  readonly cliPath: string
  readonly packageRoot: string
}

interface Sandbox {
  readonly agentExecutable: string
  readonly binDir: string
  readonly configDir: string
  readonly env: NodeJS.ProcessEnv
  readonly fakeNpmModule: string
  readonly homeDir: string
  readonly mutationLog: string
  readonly networkLog: string
  readonly providerState: string
  readonly root: string
}

interface ProcessResult {
  readonly exitCode: number | null
  readonly signal: NodeJS.Signals | null
  readonly stderr: string
  readonly stdout: string
}

interface CliExecution extends ProcessResult {
  readonly result: JsonObject
}

type JsonValue = boolean | null | number | string | JsonValue[] | JsonObject
type JsonObject = { [key: string]: JsonValue }

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2))
  const fixture = await loadFixture()
  const [previous, candidate] = await Promise.all([
    validateCliRelease(options.previousCli, fixture.previous, fixture.previous.commit),
    validateCliRelease(options.candidateCli, fixture.candidate),
  ])
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'quantex-n-minus-one-'))

  try {
    const oldToNew = await createSandbox(join(temporaryRoot, 'old-to-new'), fixture)
    const newToOldToNew = await createSandbox(join(temporaryRoot, 'new-to-old-to-new'), fixture)

    await verifyOldToNew(oldToNew, previous, candidate, fixture)
    await verifyNewToOldToNew(newToOldToNew, previous, candidate, fixture)
    await verifyFailClosedInputs(oldToNew, previous, candidate, fixture)
    await assertOffline(oldToNew)
    await assertOffline(newToOldToNew)
    await assertNoTemporaryArtifacts(oldToNew)
    await assertNoTemporaryArtifacts(newToOldToNew)

    process.stdout.write(
      `Verified offline N/N-1 compatibility: v${fixture.previous.version} (${fixture.previous.commit}) <-> v${fixture.candidate.version}; state schema ${fixture.schemas.state}, idempotency schema ${fixture.schemas.idempotency}.\n`,
    )
  } finally {
    await rm(temporaryRoot, { force: true, recursive: true })
  }
}

function parseCliOptions(args: readonly string[]): CliOptions {
  let candidateCli: string | undefined
  let previousCli: string | undefined

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    const value = args[index + 1]
    if ((argument === '--candidate-cli' || argument === '--previous-cli') && value && !value.startsWith('--')) {
      if (argument === '--candidate-cli') candidateCli = resolve(value)
      else previousCli = resolve(value)
      index += 1
      continue
    }
    throw new Error(`Unknown or incomplete argument: ${argument ?? '<missing>'}`)
  }

  if (!candidateCli || !previousCli) {
    throw new Error(
      'Usage: bun run compat:n-minus-one -- --previous-cli <v1.1.3/dist/cli.mjs> --candidate-cli <v1.2.0/dist/cli.mjs>',
    )
  }
  return { candidateCli, previousCli }
}

async function loadFixture(): Promise<CompatibilityFixture> {
  const value = JSON.parse(await readFile(FIXTURE_MANIFEST, 'utf8')) as CompatibilityFixture
  assert.equal(value.fixtureVersion, 1, 'Unsupported N/N-1 fixture manifest version.')
  assert.equal(value.previous.version, '1.1.3', 'The released previous fixture must remain pinned to v1.1.3.')
  assert.equal(value.candidate.version, '1.2.0', 'The candidate fixture must target v1.2.0.')
  assert.match(value.previous.commit, /^[0-9a-f]{40}$/)
  assert.equal(value.schemas.state, 2)
  assert.equal(value.schemas.lifecycleReceipt, 1)
  assert.equal(value.schemas.idempotency, 1)
  return value
}

async function validateCliRelease(
  cliPath: string,
  expected: ReleaseIdentity,
  expectedCommit?: string,
): Promise<CliRelease> {
  assert.equal((await stat(cliPath)).isFile(), true, `CLI build does not exist: ${cliPath}`)
  const packageRoot = resolve(dirname(cliPath), '..')
  const packageManifest = parseJsonObject(await readFile(join(packageRoot, 'package.json'), 'utf8'))
  assert.equal(packageManifest.version, expected.version, `${cliPath} belongs to an unexpected package version.`)

  const versionResult = await runProcess('node', [cliPath, '--version'], { env: process.env })
  assert.equal(versionResult.exitCode, 0, formatProcessFailure('CLI version check failed', versionResult))
  assert.equal(versionResult.stdout.trim(), expected.version, `${cliPath} contains stale build metadata.`)

  if (expectedCommit) {
    const head = await runProcess('git', ['-C', packageRoot, 'rev-parse', 'HEAD'], { env: process.env })
    assert.equal(head.exitCode, 0, formatProcessFailure('Unable to verify the previous release checkout', head))
    assert.equal(
      head.stdout.trim(),
      expectedCommit,
      `Previous CLI must be built from the pinned full commit ${expectedCommit}.`,
    )
  }

  return { cliPath, packageRoot, version: expected.version }
}

async function createSandbox(root: string, fixture: CompatibilityFixture): Promise<Sandbox> {
  const homeDir = join(root, 'home')
  const binDir = join(root, 'bin')
  const configDir = join(homeDir, '.quantex')
  const providerState = join(root, 'provider-state.txt')
  const mutationLog = join(root, 'provider-mutations.jsonl')
  const networkLog = join(root, 'network-attempts.log')
  const fakeNpmModule = join(root, 'fake-npm.mjs')
  const offlineGuard = join(root, 'offline-guard.cjs')
  const agentExecutable = join(binDir, executableFileName(fixture.agent.binaryName))
  await mkdir(binDir, { recursive: true })
  await mkdir(homeDir, { recursive: true })
  await writeFile(fakeNpmModule, createFakeNpmSource(fixture))
  await writeFile(offlineGuard, createOfflineGuardSource())
  await writeExecutable(join(binDir, executableFileName('npm')), createNpmWrapper())

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    BUN_CONFIG_NO_NETWORK: '1',
    CI: 'true',
    FORCE_COLOR: '0',
    HOME: homeDir,
    NO_COLOR: '1',
    NODE_OPTIONS: `--require=${JSON.stringify(offlineGuard)}`,
    PATH: `${binDir}${delimiter}${process.env.PATH ?? ''}`,
    QTX_N_MINUS_ONE_AGENT_EXECUTABLE: agentExecutable,
    QTX_N_MINUS_ONE_FAKE_NPM: fakeNpmModule,
    QTX_N_MINUS_ONE_MUTATION_LOG: mutationLog,
    QTX_N_MINUS_ONE_NETWORK_LOG: networkLog,
    QTX_N_MINUS_ONE_PROVIDER_STATE: providerState,
    USERPROFILE: homeDir,
    npm_config_audit: 'false',
    npm_config_fund: 'false',
    npm_config_offline: 'true',
    npm_config_update_notifier: 'false',
  }

  const sandbox = {
    agentExecutable,
    binDir,
    configDir,
    env,
    fakeNpmModule,
    homeDir,
    mutationLog,
    networkLog,
    providerState,
    root,
  }
  await resetSandbox(sandbox, fixture)
  return sandbox
}

async function resetSandbox(sandbox: Sandbox, fixture: CompatibilityFixture): Promise<void> {
  await rm(sandbox.configDir, { force: true, recursive: true })
  await Promise.all([
    rm(sandbox.agentExecutable, { force: true }),
    rm(sandbox.mutationLog, { force: true }),
    rm(sandbox.networkLog, { force: true }),
    rm(sandbox.providerState, { force: true }),
  ])
  const now = Date.now()
  const cacheFile = join(sandbox.configDir, 'cache', 'versions.json')
  await mkdir(dirname(cacheFile), { recursive: true })
  await writeFile(
    cacheFile,
    `${JSON.stringify(
      {
        entries: {
          [`npm:https://registry.npmjs.org:${fixture.agent.providerTargetId}:latest`]: {
            body: JSON.stringify({ version: fixture.agent.version }),
            expiresAt: now + 7 * 24 * 60 * 60 * 1000,
            fetchedAt: now,
          },
        },
      },
      null,
      2,
    )}\n`,
  )
}

async function verifyOldToNew(
  sandbox: Sandbox,
  previous: CliRelease,
  candidate: CliRelease,
  fixture: CompatibilityFixture,
): Promise<void> {
  await resetSandbox(sandbox, fixture)
  const ensureKey = 'compat/v1.1.3-to-v1.2.0/ensure'
  const uninstallKey = 'compat/v1.1.3-to-v1.2.0/uninstall'

  assertSuccessfulCommand(
    await runCli(previous, sandbox, 'ensure', fixture.agent.name, ensureKey, 'old-to-new-old-ensure'),
    previous,
    'ensure',
  )
  await assertManagedState(sandbox, fixture)
  const previousState = await readFile(join(sandbox.configDir, 'state.json'))
  const previousRecordPath = idempotencyFilePath(sandbox, ensureKey)
  const previousRecord = await readFile(previousRecordPath)
  await assertIdempotencyRecord(previousRecordPath, fixture, 'ensure', 'package-present', previous.version)
  await assertMutationSequence(sandbox, ['install'])

  assertSuccessfulCommand(
    await runCli(candidate, sandbox, 'ensure', fixture.agent.name, ensureKey, 'old-to-new-candidate-replay'),
    candidate,
    'ensure',
    previous.version,
  )
  assert.deepEqual(
    await readFile(join(sandbox.configDir, 'state.json')),
    previousState,
    'Replay rewrote released state.',
  )
  assert.deepEqual(await readFile(previousRecordPath), previousRecord, 'Replay rewrote released idempotency evidence.')
  await assertMutationSequence(sandbox, ['install'])

  assertSuccessfulCommand(
    await runCli(candidate, sandbox, 'uninstall', fixture.agent.name, uninstallKey, 'old-to-new-candidate-uninstall'),
    candidate,
    'uninstall',
  )
  await assertUnmanagedState(sandbox, fixture)
  await assertIdempotencyRecord(
    idempotencyFilePath(sandbox, uninstallKey),
    fixture,
    'uninstall',
    'package-absent',
    candidate.version,
  )
  await assertMutationSequence(sandbox, ['install', 'uninstall'])
  await assertOffline(sandbox)
  await assertNoTemporaryArtifacts(sandbox)
}

async function verifyNewToOldToNew(
  sandbox: Sandbox,
  previous: CliRelease,
  candidate: CliRelease,
  fixture: CompatibilityFixture,
): Promise<void> {
  await resetSandbox(sandbox, fixture)
  const ensureKey = 'compat/v1.2.0-to-v1.1.3-to-v1.2.0/ensure'
  const uninstallKey = 'compat/v1.2.0-to-v1.1.3-to-v1.2.0/uninstall'
  const reensureKey = 'compat/v1.2.0-to-v1.1.3-to-v1.2.0/reensure'

  assertSuccessfulCommand(
    await runCli(candidate, sandbox, 'ensure', fixture.agent.name, ensureKey, 'new-old-new-candidate-ensure'),
    candidate,
    'ensure',
  )
  await assertManagedState(sandbox, fixture)
  const candidateState = await readFile(join(sandbox.configDir, 'state.json'))
  const candidateRecordPath = idempotencyFilePath(sandbox, ensureKey)
  const candidateRecord = await readFile(candidateRecordPath)
  await assertIdempotencyRecord(candidateRecordPath, fixture, 'ensure', 'package-present', candidate.version)
  await assertMutationSequence(sandbox, ['install'])

  assertSuccessfulCommand(
    await runCli(previous, sandbox, 'ensure', fixture.agent.name, ensureKey, 'new-old-new-previous-replay'),
    previous,
    'ensure',
    candidate.version,
  )
  assert.deepEqual(
    await readFile(join(sandbox.configDir, 'state.json')),
    candidateState,
    'Downgrade replay rewrote state.',
  )
  assert.deepEqual(
    await readFile(candidateRecordPath),
    candidateRecord,
    'Downgrade replay rewrote idempotency evidence.',
  )
  await assertMutationSequence(sandbox, ['install'])

  assertSuccessfulCommand(
    await runCli(previous, sandbox, 'uninstall', fixture.agent.name, uninstallKey, 'new-old-new-previous-uninstall'),
    previous,
    'uninstall',
  )
  await assertUnmanagedState(sandbox, fixture)
  const previousUninstallRecordPath = idempotencyFilePath(sandbox, uninstallKey)
  const previousUninstallRecord = await readFile(previousUninstallRecordPath)
  await assertIdempotencyRecord(previousUninstallRecordPath, fixture, 'uninstall', 'package-absent', previous.version)
  await assertMutationSequence(sandbox, ['install', 'uninstall'])

  assertSuccessfulCommand(
    await runCli(candidate, sandbox, 'uninstall', fixture.agent.name, uninstallKey, 'new-old-new-candidate-replay'),
    candidate,
    'uninstall',
    previous.version,
  )
  assert.deepEqual(
    await readFile(previousUninstallRecordPath),
    previousUninstallRecord,
    'Upgrade replay rewrote downgrade idempotency evidence.',
  )
  await assertUnmanagedState(sandbox, fixture)
  await assertMutationSequence(sandbox, ['install', 'uninstall'])

  assertSuccessfulCommand(
    await runCli(candidate, sandbox, 'ensure', fixture.agent.name, reensureKey, 'new-old-new-candidate-reensure'),
    candidate,
    'ensure',
  )
  await assertManagedState(sandbox, fixture)
  await assertIdempotencyRecord(
    idempotencyFilePath(sandbox, reensureKey),
    fixture,
    'ensure',
    'package-present',
    candidate.version,
  )
  await assertMutationSequence(sandbox, ['install', 'uninstall', 'install'])
  await assertOffline(sandbox)
  await assertNoTemporaryArtifacts(sandbox)
}

async function verifyFailClosedInputs(
  sandbox: Sandbox,
  previous: CliRelease,
  candidate: CliRelease,
  fixture: CompatibilityFixture,
): Promise<void> {
  for (const failureCase of fixture.failClosedCases) {
    await resetSandbox(sandbox, fixture)
    const fixtureBytes = await readFile(join(FIXTURE_ROOT, failureCase.file))
    const statePath = join(sandbox.configDir, 'state.json')
    let protectedPath: string
    let key: string

    if (failureCase.type === 'state') {
      await mkdir(sandbox.configDir, { recursive: true })
      await writeFile(statePath, fixtureBytes)
      protectedPath = statePath
      key = `compat/fail-closed/${failureCase.name}`
    } else {
      await writeEmptyState(statePath, fixture)
      key = `compat/fail-closed/${failureCase.name}`
      protectedPath = idempotencyFilePath(sandbox, key)
      await mkdir(dirname(protectedPath), { recursive: true })
      await writeFile(protectedPath, fixtureBytes)
    }

    const stateBefore = await readFile(statePath)
    for (const release of [previous, candidate]) {
      const execution = await runCli(
        release,
        sandbox,
        'ensure',
        fixture.agent.name,
        key,
        `fail-closed-${failureCase.name}-${release.version}`,
      )
      assertFailedCommand(execution, release, 'ensure', failureCase.errorCode, failureCase)
      assert.deepEqual(await readFile(protectedPath), fixtureBytes, `${release.version} rewrote ${failureCase.name}.`)
      assert.deepEqual(
        await readFile(statePath),
        stateBefore,
        `${release.version} changed state for ${failureCase.name}.`,
      )
      await assertMutationSequence(sandbox, [])
    }
  }
}

async function runCli(
  release: CliRelease,
  sandbox: Sandbox,
  action: 'ensure' | 'uninstall',
  agentName: string,
  idempotencyKey: string,
  runId: string,
): Promise<CliExecution> {
  const processResult = await runProcess(
    'node',
    [
      release.cliPath,
      '--json',
      '--non-interactive',
      '--yes',
      '--quiet',
      '--color',
      'never',
      '--run-id',
      runId,
      '--idempotency-key',
      idempotencyKey,
      action,
      agentName,
    ],
    { env: sandbox.env },
  )
  let result: JsonObject
  try {
    result = parseJsonObject(processResult.stdout)
  } catch (error) {
    throw new Error(
      formatProcessFailure(`Invalid structured output from v${release.version}: ${String(error)}`, processResult),
      { cause: error },
    )
  }
  return { ...processResult, result }
}

function assertSuccessfulCommand(
  execution: CliExecution,
  release: CliRelease,
  action: string,
  resultVersion = release.version,
): void {
  assert.equal(execution.exitCode, 0, formatProcessFailure(`v${release.version} ${action} failed`, execution))
  assert.equal(execution.result.ok, true)
  assert.equal(execution.result.action, action)
  assertCommandMetadata(execution.result, resultVersion)
}

function assertFailedCommand(
  execution: CliExecution,
  release: CliRelease,
  action: string,
  errorCode: string,
  failureCase: FailClosedCase,
): void {
  assert.notEqual(execution.exitCode, 0, `v${release.version} unexpectedly accepted ${failureCase.name}.`)
  assert.equal(execution.result.ok, false)
  assert.equal(execution.result.action, action)
  const error = requireObject(execution.result.error, 'command error')
  assert.equal(error.code, errorCode)
  if (failureCase.type === 'idempotency') {
    const details = requireObject(error.details, 'idempotency error details')
    assert.equal(details.invalidReason, failureCase.invalidReason)
    assert.equal(details.reason, 'invalid-evidence')
  }
  assertCommandMetadata(execution.result, release.version)
}

function assertCommandMetadata(result: JsonObject, expectedVersion: string): void {
  const metadata = requireObject(result.meta, 'command metadata')
  assert.equal(metadata.version, expectedVersion, 'Stored replay metadata changed across releases.')
  assert.equal(metadata.mode, 'json')
  assert.equal(typeof metadata.runId, 'string')
}

async function assertManagedState(sandbox: Sandbox, fixture: CompatibilityFixture): Promise<void> {
  const state = parseJsonObject(await readFile(join(sandbox.configDir, 'state.json'), 'utf8'))
  assert.deepEqual(Object.keys(state).sort(), ['installedAgents', 'lifecycleReceipts', 'schemaVersion', 'self'])
  assert.equal(state.schemaVersion, fixture.schemas.state)
  const installedAgents = requireObject(state.installedAgents, 'installedAgents')
  const installed = requireObject(installedAgents[fixture.agent.name], 'managed installed agent')
  assert.equal(installed.agentName, fixture.agent.name)
  assert.equal(installed.installType, fixture.agent.providerId)
  assert.equal(installed.packageName, fixture.agent.providerTargetId)
  if (installed.binaryName !== undefined) assert.equal(installed.binaryName, fixture.agent.binaryName)
  if (installed.packageTargetKind !== undefined) {
    assert.equal(installed.packageTargetKind, fixture.agent.providerTargetKind)
  }

  const receipts = requireObject(state.lifecycleReceipts, 'lifecycleReceipts')
  const receipt = requireObject(receipts[fixture.agent.name], 'managed lifecycle receipt')
  assert.equal(receipt.kind, 'lifecycle-receipt')
  assert.equal(receipt.schemaVersion, fixture.schemas.lifecycleReceipt)
  assert.equal(receipt.targetId, fixture.agent.name)
  assert.equal(receipt.providerId, fixture.agent.providerId)
  assert.equal(receipt.providerTargetId, fixture.agent.providerTargetId)
  assert.equal(receipt.providerTargetKind, fixture.agent.providerTargetKind)
  if (receipt.executableName !== undefined) assert.equal(receipt.executableName, fixture.agent.binaryName)
  assert.equal(receipt.version, fixture.agent.version)
  assert.equal(Number.isFinite(Date.parse(String(receipt.verifiedAt))), true)
}

async function assertUnmanagedState(sandbox: Sandbox, fixture: CompatibilityFixture): Promise<void> {
  const state = parseJsonObject(await readFile(join(sandbox.configDir, 'state.json'), 'utf8'))
  assert.deepEqual(Object.keys(state).sort(), ['installedAgents', 'lifecycleReceipts', 'schemaVersion', 'self'])
  assert.equal(state.schemaVersion, fixture.schemas.state)
  assert.equal(Object.hasOwn(requireObject(state.installedAgents, 'installedAgents'), fixture.agent.name), false)
  assert.equal(Object.hasOwn(requireObject(state.lifecycleReceipts, 'lifecycleReceipts'), fixture.agent.name), false)
}

async function assertIdempotencyRecord(
  path: string,
  fixture: CompatibilityFixture,
  action: 'ensure' | 'uninstall',
  postconditionKind: 'package-absent' | 'package-present',
  writerVersion: string,
): Promise<void> {
  const record = parseJsonObject(await readFile(path, 'utf8'))
  assert.deepEqual(Object.keys(record).sort(), [...IDEMPOTENCY_RECORD_KEYS].sort())
  assert.equal(record.schemaVersion, fixture.schemas.idempotency)
  assert.equal(Number.isFinite(Date.parse(String(record.createdAt))), true)
  assert.equal(Number.isFinite(Date.parse(String(record.expiresAt))), true)
  assert.equal(Date.parse(String(record.expiresAt)) > Date.parse(String(record.createdAt)), true)

  for (const field of ['postcondition', 'receipt', 'request', 'resolvedPlan'] as const) {
    const evidence = requireObject(record[field], field)
    assert.match(String(evidence.fingerprint), /^[0-9a-f]{64}$/)
    assert.equal(evidence.fingerprint, fingerprintCanonicalValue(evidence.payload), `${field} fingerprint drifted.`)
  }

  const request = requireObject(requireObject(record.request, 'request').payload, 'request payload')
  assert.deepEqual(request, { action, options: {}, targets: [fixture.agent.name] })
  const postcondition = requireObject(
    requireObject(record.postcondition, 'postcondition').payload,
    'postcondition payload',
  )
  assert.equal(postcondition.kind, postconditionKind)
  assert.equal(postcondition.agentTargetId, fixture.agent.name)
  assert.equal(postcondition.providerId, fixture.agent.providerId)
  assert.equal(postcondition.targetId, fixture.agent.providerTargetId)
  const receipt = requireObject(requireObject(record.receipt, 'receipt').payload, 'receipt payload')
  assert.equal(receipt.agentTargetId, fixture.agent.name)
  assert.equal(receipt.executableName, fixture.agent.binaryName)
  assert.equal(receipt.providerId, fixture.agent.providerId)
  assert.equal(receipt.providerTargetKind, fixture.agent.providerTargetKind)
  assert.equal(receipt.schemaVersion, fixture.schemas.lifecycleReceipt)
  assert.equal(receipt.targetId, fixture.agent.providerTargetId)
  if (postconditionKind === 'package-present') assert.equal(receipt.version, fixture.agent.version)
  else assert.equal(receipt.version, undefined)

  const resolvedPlan = requireObject(
    requireObject(record.resolvedPlan, 'resolvedPlan').payload,
    'resolved plan payload',
  )
  assert.equal(resolvedPlan.kind, action === 'ensure' ? 'agent-presence' : 'agent-absence')
  assert.equal(resolvedPlan.targetId, fixture.agent.name)

  const result = requireObject(record.result, 'stored result')
  assert.equal(result.ok, true)
  assert.equal(result.action, action)
  assert.equal(requireObject(result.meta, 'stored result metadata').version, writerVersion)
}

async function assertMutationSequence(sandbox: Sandbox, expected: readonly string[]): Promise<void> {
  let serialized = ''
  try {
    serialized = await readFile(sandbox.mutationLog, 'utf8')
  } catch (error) {
    if (!isMissingFileError(error)) throw error
  }
  const actual = serialized
    .split('\n')
    .filter(Boolean)
    .map(line => requireObject(JSON.parse(line) as JsonValue, 'provider mutation').operation)
  assert.deepEqual(actual, expected, 'Cross-release replay caused an unexpected provider side effect.')
}

async function assertOffline(sandbox: Sandbox): Promise<void> {
  let attempts = ''
  try {
    attempts = await readFile(sandbox.networkLog, 'utf8')
  } catch (error) {
    if (!isMissingFileError(error)) throw error
  }
  assert.equal(attempts, '', `Compatibility execution attempted network access:\n${attempts}`)
}

async function assertNoTemporaryArtifacts(sandbox: Sandbox): Promise<void> {
  const paths = await listDescendants(sandbox.configDir)
  const residue = paths.filter(path => {
    const name = basename(path)
    return name.includes('.tmp-') || name.includes('.restore-') || name.endsWith('.tmp') || name.endsWith('.lock')
  })
  assert.deepEqual(residue, [], `Compatibility execution left lock or recovery residue: ${residue.join(', ')}`)
}

async function listDescendants(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true })
  const paths: string[] = []
  for (const entry of entries) {
    const path = join(root, entry.name)
    paths.push(path)
    if (entry.isDirectory()) paths.push(...(await listDescendants(path)))
  }
  return paths
}

async function writeEmptyState(path: string, fixture: CompatibilityFixture): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(
    path,
    `${JSON.stringify(
      {
        installedAgents: {},
        lifecycleReceipts: {},
        schemaVersion: fixture.schemas.state,
        self: {},
      },
      null,
      2,
    )}\n`,
  )
}

function idempotencyFilePath(sandbox: Sandbox, key: string): string {
  const digest = createHash('sha256').update(key, 'utf8').digest('hex')
  return join(sandbox.configDir, 'idempotency', `${digest}.json`)
}

function createOfflineGuardSource(): string {
  return [
    "const { appendFileSync } = require('node:fs')",
    'globalThis.fetch = async function blockedCompatibilityFetch(input) {',
    "  const target = typeof input === 'string' ? input : input?.url ?? String(input)",
    "  appendFileSync(process.env.QTX_N_MINUS_ONE_NETWORK_LOG, `${target}\\n`, 'utf8')",
    '  throw new Error(`Network access is disabled during N/N-1 compatibility execution: ${target}`)',
    '}',
    '',
  ].join('\n')
}

function createFakeNpmSource(fixture: CompatibilityFixture): string {
  const agentScript =
    process.platform === 'win32'
      ? `@echo off\r\necho ${fixture.agent.binaryName} ${fixture.agent.version}\r\n`
      : `#!/bin/sh\nprintf '%s\\n' '${fixture.agent.binaryName} ${fixture.agent.version}'\n`
  return [
    "import { appendFileSync, chmodSync, existsSync, rmSync, writeFileSync } from 'node:fs'",
    `const packageName = ${JSON.stringify(fixture.agent.providerTargetId)}`,
    `const packageVersion = ${JSON.stringify(fixture.agent.version)}`,
    `const agentScript = ${JSON.stringify(agentScript)}`,
    'const args = process.argv.slice(2)',
    'const providerState = process.env.QTX_N_MINUS_ONE_PROVIDER_STATE',
    'const mutationLog = process.env.QTX_N_MINUS_ONE_MUTATION_LOG',
    'const agentExecutable = process.env.QTX_N_MINUS_ONE_AGENT_EXECUTABLE',
    "if (!providerState || !mutationLog || !agentExecutable) throw new Error('Missing fake npm fixture environment.')",
    "if (args.includes('--version') || args[0] === '-v') { process.stdout.write('10.0.0\\n'); process.exit(0) }",
    "if (args[0] === 'list') {",
    '  const dependencies = existsSync(providerState) ? { [packageName]: { version: packageVersion } } : {}',
    '  process.stdout.write(`${JSON.stringify({ dependencies })}\\n`)',
    '  process.exit(0)',
    '}',
    "const operation = args[0] === 'install' ? 'install' : args[0] === 'uninstall' ? 'uninstall' : undefined",
    "if (!operation) { process.stderr.write(`Unsupported fake npm invocation: ${args.join(' ')}\\n`); process.exit(64) }",
    'if (!args.some(argument => argument === packageName || argument.startsWith(`${packageName}@`))) {',
    "  process.stderr.write(`Unexpected fake npm target: ${args.join(' ')}\\n`)",
    '  process.exit(65)',
    '}',
    "appendFileSync(mutationLog, `${JSON.stringify({ operation, packageName })}\\n`, 'utf8')",
    "if (operation === 'install') {",
    "  writeFileSync(providerState, `${packageVersion}\\n`, 'utf8')",
    "  writeFileSync(agentExecutable, agentScript, 'utf8')",
    "  if (process.platform !== 'win32') chmodSync(agentExecutable, 0o755)",
    '} else {',
    '  rmSync(providerState, { force: true })',
    '  rmSync(agentExecutable, { force: true })',
    '}',
    '',
  ].join('\n')
}

function createNpmWrapper(): string {
  return process.platform === 'win32'
    ? '@echo off\r\nnode "%QTX_N_MINUS_ONE_FAKE_NPM%" %*\r\n'
    : '#!/bin/sh\nexec node "$QTX_N_MINUS_ONE_FAKE_NPM" "$@"\n'
}

async function writeExecutable(path: string, source: string): Promise<void> {
  await writeFile(path, source)
  if (process.platform !== 'win32') await chmod(path, 0o755)
}

function executableFileName(name: string): string {
  return process.platform === 'win32' ? `${name}.cmd` : name
}

function parseJsonObject(serialized: string | Buffer): JsonObject {
  return requireObject(JSON.parse(String(serialized)) as JsonValue, 'JSON document')
}

function requireObject(value: JsonValue | undefined, description: string): JsonObject {
  assert.equal(typeof value, 'object', `${description} must be an object.`)
  assert.notEqual(value, null, `${description} must be an object.`)
  assert.equal(Array.isArray(value), false, `${description} must be an object.`)
  return value as JsonObject
}

function fingerprintCanonicalValue(value: JsonValue | undefined): string {
  assert.notEqual(value, undefined, 'Cannot fingerprint an absent payload.')
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(value!)), 'utf8')
    .digest('hex')
}

function canonicalize(value: JsonValue): JsonValue {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(canonicalize)
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map(key => [key, canonicalize(value[key]!)]),
  )
}

function formatProcessFailure(prefix: string, result: ProcessResult): string {
  return `${prefix} (exit=${String(result.exitCode)}, signal=${String(result.signal)})\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
}

function runProcess(
  command: string,
  args: readonly string[],
  options: { readonly env: NodeJS.ProcessEnv },
): Promise<ProcessResult> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      env: options.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const stdout: Buffer[] = []
    const stderr: Buffer[] = []
    const timeout = setTimeout(() => child.kill('SIGKILL'), 30_000)
    child.stdout.on('data', chunk => stdout.push(Buffer.from(chunk)))
    child.stderr.on('data', chunk => stderr.push(Buffer.from(chunk)))
    child.on('error', error => {
      clearTimeout(timeout)
      reject(error)
    })
    child.on('close', (exitCode, signal) => {
      clearTimeout(timeout)
      resolvePromise({
        exitCode,
        signal,
        stderr: Buffer.concat(stderr).toString('utf8'),
        stdout: Buffer.concat(stdout).toString('utf8'),
      })
    })
  })
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && (error.code === 'ENOENT' || error.code === 'ENOTDIR')
}

await main().catch(error => {
  process.stderr.write(`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`)
  process.exitCode = 1
})
