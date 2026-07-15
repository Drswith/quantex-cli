import type { AgentProcessPortDependencies } from './agent-process'
import type { ProcessPort } from './ports'
import { spawnCommand, terminateProcessTree } from '../utils/child-process'
import { createAgentProcessPort } from './agent-process'

export type ChildProcessPortDependencies = AgentProcessPortDependencies

const defaultDependencies: ChildProcessPortDependencies = {
  platform: process.platform,
  spawn: (argv, options) =>
    spawnCommand(argv, {
      ...options,
      stdio: options.stdio ? [...options.stdio] : undefined,
    }),
  terminate: terminateProcessTree,
  writeStderr: value => {
    process.stderr.write(value)
  },
}

export function createChildProcessPort(dependencies: ChildProcessPortDependencies = defaultDependencies): ProcessPort {
  const processPort = createAgentProcessPort(dependencies)
  return {
    run: request => processPort.run({ ...request, forwardPipedOutput: request.forwardPipedOutput ?? false }),
  }
}
