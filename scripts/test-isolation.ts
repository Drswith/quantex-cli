import process from 'node:process'
import { buildContainerSandboxInvocation, getMissingDockerCliMessage } from '../src/testing/container-sandbox'
import {
  buildModalSandboxInvocation,
  getMissingModalCliMessage,
  parseModalRemoteExitCode,
} from '../src/testing/modal-sandbox'

type IsolationBackend = 'docker' | 'modal'

const backend = process.argv[2] as IsolationBackend | undefined
if (backend !== 'docker' && backend !== 'modal') {
  throw new Error('Usage: bun run scripts/test-isolation.ts <docker|modal> [smoke-args...]')
}

const smokeArgs = process.argv.slice(3)
const defaultLifecycleAgents = 'pi,qoder'

const invocation =
  backend === 'docker' ? buildContainerSandboxInvocation({ smokeArgs }) : buildModalSandboxInvocation({ smokeArgs })

await ensureBackendCliAvailable()

console.log(`Running ${backend === 'docker' ? 'container' : 'Modal sandbox'} validation with image ${invocation.image}`)
console.log(`Mounted repository path: ${invocation.mountPath}`)
console.log(
  `Lifecycle smoke agents: ${smokeArgs.length > 0 ? smokeArgs.join(', ') : process.env.QTX_ISOLATION_AGENTS || defaultLifecycleAgents}`,
)

const exitCode =
  backend === 'docker'
    ? await runContainerCommand(invocation.command)
    : await runModalSandboxCommand(invocation.command)
process.exit(exitCode)

async function runContainerCommand(command: string[]): Promise<number> {
  const containerProc = Bun.spawn(command, {
    stdio: ['inherit', 'inherit', 'inherit'] as const,
  })

  const containerExitCode = await containerProc.exited
  return containerExitCode === 0 ? 0 : (containerExitCode ?? 1)
}

async function runModalSandboxCommand(command: string[]): Promise<number> {
  const sandboxProc = Bun.spawn(command, {
    stdio: ['inherit', 'pipe', 'pipe'] as const,
  })

  const [stdout, stderr, modalExitCode] = await Promise.all([
    readStreamText(sandboxProc.stdout),
    readStreamText(sandboxProc.stderr),
    sandboxProc.exited,
  ])

  if (stdout) process.stdout.write(stdout)
  if (stderr) process.stderr.write(stderr)

  const remoteExitCode = parseModalRemoteExitCode(`${stdout}\n${stderr}`)
  if (remoteExitCode !== undefined) return remoteExitCode

  if (modalExitCode !== 0) return modalExitCode ?? 1

  process.stderr.write('Modal sandbox validation did not emit a remote exit-code marker.\n')
  return 1
}

async function ensureBackendCliAvailable(): Promise<void> {
  const probeCommand = backend === 'docker' ? ['docker', 'info'] : ['modal', '--version']
  const missingMessage = backend === 'docker' ? getMissingDockerCliMessage : getMissingModalCliMessage

  let proc: ReturnType<typeof Bun.spawn>

  try {
    proc = Bun.spawn(probeCommand, {
      stdio: ['ignore', 'ignore', 'pipe'] as const,
    })
  } catch {
    throw new Error(missingMessage())
  }

  const [probeExitCode, stderr] = await Promise.all([proc.exited, readStreamText(proc.stderr)])

  if (probeExitCode !== 0) {
    const details = stderr.trim()
    throw new Error(details ? `${missingMessage()}\n\n${details}` : missingMessage())
  }
}

async function readStreamText(
  stream: ReturnType<typeof Bun.spawn>['stderr'] | ReturnType<typeof Bun.spawn>['stdout'],
): Promise<string> {
  if (!stream || typeof stream === 'number') return ''
  return new Response(stream).text()
}
