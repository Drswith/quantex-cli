import type { AgentDefinition } from '../src/agents'
import { resetCliContext, setCliContext } from '../src/cli-context'
import { executeCommandWithRuntime } from '../src/command-runtime'
import { createErrorResult, createSuccessResult } from '../src/output'
import { installAgentOutcome } from '../src/package-manager'
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
      // Assert interruption before the v1 boolean projection intentionally drops its typed cause.
      const install = await installAgentOutcome(agent)

      if (install.kind === 'success') {
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

      if (install.kind === 'timed-out') {
        return createErrorResult({
          action: 'install',
          data: {
            installed: false,
          },
          error: {
            code: 'TIMEOUT',
            details: {
              timeoutMs: install.timeoutMs,
            },
            message: `Managed installer timed out after ${install.timeoutMs}ms.`,
          },
          target: {
            kind: 'agent',
            name: agent.name,
          },
        })
      }

      if (install.kind === 'cancelled') {
        return createErrorResult({
          action: 'install',
          data: {
            installed: false,
          },
          error: {
            code: 'CANCELLED',
            message: 'Managed installer was cancelled.',
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
