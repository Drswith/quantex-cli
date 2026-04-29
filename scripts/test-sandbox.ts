import process from 'node:process'
import {
  buildModalSandboxInvocation,
  getMissingModalCliMessage,
  parseModalRemoteExitCode,
} from '../src/testing/modal-sandbox'

const invocation = buildModalSandboxInvocation({
  smokeArgs: process.argv.slice(2),
})
const defaultLifecycleAgents = 'pi,qoder'

await ensureModalCliAvailable()

console.log(`Running Modal sandbox validation with image ${invocation.image}`)
console.log(`Mounted repository path: ${invocation.mountPath}`)
console.log(
  `Lifecycle smoke agents: ${invocation.smokeArgs.length > 0 ? invocation.smokeArgs.join(', ') : process.env.QTX_ISOLATION_AGENTS || defaultLifecycleAgents}`,
)

const sandboxExitCode = await runModalSandboxCommand(invocation.command)
process.exit(sandboxExitCode)

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

async function ensureModalCliAvailable(): Promise<void> {
  let proc: ReturnType<typeof Bun.spawn>

  try {
    proc = Bun.spawn(['modal', '--version'], {
      stdio: ['ignore', 'ignore', 'pipe'] as const,
    })
  } catch {
    throw new Error(getMissingModalCliMessage())
  }

  const [modalExitCode, stderr] = await Promise.all([proc.exited, readStreamText(proc.stderr)])

  if (modalExitCode !== 0) {
    const details = stderr.trim()
    throw new Error(details ? `${getMissingModalCliMessage()}\n\n${details}` : getMissingModalCliMessage())
  }
}

async function readStreamText(
  stream: ReturnType<typeof Bun.spawn>['stderr'] | ReturnType<typeof Bun.spawn>['stdout'],
): Promise<string> {
  if (!stream || typeof stream === 'number') return ''
  return new Response(stream).text()
}
