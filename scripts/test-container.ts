import process from 'node:process'
import { buildContainerSandboxInvocation, getMissingDockerCliMessage } from '../src/testing/container-sandbox'

const invocation = buildContainerSandboxInvocation({
  smokeArgs: process.argv.slice(2),
})
const defaultLifecycleAgents = 'pi,qoder'

await ensureDockerCliAvailable()

console.log(`Running container isolation validation with image ${invocation.image}`)
console.log(`Mounted repository path: ${invocation.mountPath}`)
console.log(
  `Lifecycle smoke agents: ${invocation.smokeArgs.length > 0 ? invocation.smokeArgs.join(', ') : process.env.QTX_ISOLATION_AGENTS || defaultLifecycleAgents}`,
)

const containerProc = Bun.spawn(invocation.command, {
  stdio: ['inherit', 'inherit', 'inherit'] as const,
})

const containerExitCode = await containerProc.exited
process.exit(containerExitCode === 0 ? 0 : (containerExitCode ?? 1))

async function ensureDockerCliAvailable(): Promise<void> {
  let proc: ReturnType<typeof Bun.spawn>

  try {
    proc = Bun.spawn(['docker', 'info'], {
      stdio: ['ignore', 'ignore', 'pipe'] as const,
    })
  } catch {
    throw new Error(getMissingDockerCliMessage())
  }

  const [dockerExitCode, stderr] = await Promise.all([proc.exited, readStreamText(proc.stderr)])

  if (dockerExitCode !== 0) {
    const details = stderr.trim()
    throw new Error(details ? `${getMissingDockerCliMessage()}\n\n${details}` : getMissingDockerCliMessage())
  }
}

async function readStreamText(stream: ReturnType<typeof Bun.spawn>['stderr']): Promise<string> {
  if (!stream || typeof stream === 'number') return ''
  return new Response(stream).text()
}
