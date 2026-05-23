import type { AgentDefinition } from '../src/agents'
import { resetCliContext, setCliContext } from '../src/cli-context'
import { executeCommandWithRuntime } from '../src/command-runtime'
import { createErrorResult, createSuccessResult } from '../src/output'
import { installAgent } from '../src/package-manager'
import { getInstalledAgentState } from '../src/state'

const agent: AgentDefinition = {
  binaryName: 'cargo-cancel-smoke-agent',
  displayName: 'Cargo Cancel Smoke Agent',
  homepage: 'https://example.com/cargo-cancel-smoke-agent',
  name: 'cargo-cancel-smoke-agent',
  packages: {
    cargo: 'cargo-cancel-smoke-agent',
  },
  platforms: {
    linux: [{ type: 'cargo' }],
    macos: [{ type: 'cargo' }],
    windows: [{ type: 'cargo' }],
  },
}

setCliContext({
  interactive: false,
  outputMode: 'json',
  runId: 'managed-installer-cancellation-smoke',
  timeoutMs: Number(process.env.QTX_CANCELLATION_SMOKE_TIMEOUT_MS ?? 250),
})

try {
  const result = await executeCommandWithRuntime({
    action: 'install',
    run: async () => {
      const install = await installAgent(agent)

      if (install.success) {
        return createSuccessResult({
          action: 'install',
          data: {
            installed: true,
          },
          target: {
            kind: 'agent',
            name: agent.name,
          },
        })
      }

      return createErrorResult({
        action: 'install',
        data: {
          installed: false,
        },
        error: {
          code: 'INSTALL_FAILED',
          message: 'Managed installer returned failure.',
        },
        target: {
          kind: 'agent',
          name: agent.name,
        },
      })
    },
    target: {
      kind: 'agent',
      name: agent.name,
    },
  })

  if (result.ok || result.error?.code !== 'TIMEOUT') {
    throw new Error(`Expected timeout cancellation, received ${result.error?.code ?? 'success'}.`)
  }

  const persistedState = await getInstalledAgentState(agent.name)
  if (persistedState) {
    throw new Error('Cancelled managed install must not persist installed-agent state.')
  }
} finally {
  resetCliContext()
}
