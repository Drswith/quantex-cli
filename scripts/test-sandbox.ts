import process from 'node:process'
import { buildModalSandboxInvocation, getMissingModalCliMessage } from '../src/testing/modal-sandbox'

const invocation = buildModalSandboxInvocation({
  smokeArgs: process.argv.slice(2),
})

await ensureModalCliAvailable()

console.log(`Running Modal sandbox validation with image ${invocation.image}`)
console.log(`Mounted repository path: ${invocation.mountPath}`)
console.log(
  `Lifecycle smoke agents: ${invocation.smokeArgs.length > 0 ? invocation.smokeArgs.join(', ') : process.env.QTX_ISOLATION_AGENTS || 'pi'}`,
)

const sandboxProc = Bun.spawn(invocation.command, {
  stdio: ['inherit', 'inherit', 'inherit'] as const,
})

const sandboxExitCode = await sandboxProc.exited
process.exit(sandboxExitCode === 0 ? 0 : (sandboxExitCode ?? 1))

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

async function readStreamText(stream: ReturnType<typeof Bun.spawn>['stderr']): Promise<string> {
  if (!stream || typeof stream === 'number') return ''
  return new Response(stream).text()
}
