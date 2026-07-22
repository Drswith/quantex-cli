import type { AgentDefinition } from '../agents'
import type { CommandResult } from '../output/types'
import { getCliContext } from '../cli-context'
import {
  observeLifecycleProvider,
  resolveReceiptProviderBinding,
  resolveStateProviderBinding,
  type LifecycleProviderBinding,
} from '../lifecycle'
import { waitForUninstallAbsence } from '../lifecycle/uninstall-postcondition'
import { createErrorResult, createSuccessResult, emitCommandResult } from '../output'
import { uninstallInstalledAgentOutcome, withAgentLifecycleLock } from '../package-manager'
import { resolveAgent } from '../services/agents'
import {
  getInstalledAgentState,
  getLifecycleReceipt,
  removeInstalledAgentState,
  removeLifecycleReceipt,
  setInstalledAgentState,
  setLifecycleReceipt,
} from '../state'
import { pc } from '../utils/color'
import { isBinaryInPath } from '../utils/detect'
import { canUninstallInstallType } from '../utils/install'
import { createResourceLockedError } from '../utils/lifecycle-errors'
import { isResourceLockError } from '../utils/lock'
import { isDryRunEnabled, printError, printInfo, printWarn } from '../utils/user-output'

interface UninstallCommandData {
  agent: {
    displayName: string
    name: string
  }
  changed: boolean
}

export async function uninstallCommand(agentName: string): Promise<CommandResult<UninstallCommandData>> {
  const agent = resolveAgent(agentName)
  if (!agent) {
    return emitCommandResult(
      createErrorResult<UninstallCommandData>({
        action: 'uninstall',
        error: {
          code: 'AGENT_NOT_FOUND',
          details: {
            input: agentName,
          },
          message: `Unknown agent: ${agentName}`,
        },
        target: {
          kind: 'agent',
          name: agentName,
        },
      }),
      renderUninstallHuman,
    )
  }

  try {
    return await withAgentLifecycleLock(async () => {
      const [installedState, receipt] = await Promise.all([
        getInstalledAgentState(agent.name),
        getLifecycleReceipt(agent.name),
      ])
      if (!installedState && !receipt) {
        return emitCommandResult(createUnmanagedUninstallResult(agentName, agent), renderUninstallHuman)
      }

      const liveBefore = await isBinaryInPath(agent.binaryName)
      const stateBinding = installedState ? resolveStateProviderBinding(agent, installedState) : undefined
      const receiptBinding = receipt ? resolveReceiptProviderBinding(receipt) : undefined
      if ((installedState && !stateBinding) || (receipt && !receiptBinding)) {
        return emitCommandResult(
          createUninstallFailure(
            agent,
            'indeterminate-source',
            `Cannot resolve provider evidence for ${agent.displayName}.`,
          ),
          renderUninstallHuman,
        )
      }
      if (stateBinding && receiptBinding && !providerBindingsMatch(stateBinding, receiptBinding)) {
        return emitCommandResult(
          createUninstallFailure(agent, 'conflicting-source', `Recorded sources disagree for ${agent.displayName}.`),
          renderUninstallHuman,
        )
      }

      const binding = stateBinding ?? receiptBinding!
      const providerBefore = await observeBoundProvider(binding)
      if (providerBefore.kind !== 'success') {
        return emitCommandResult(
          createUninstallFailure(
            agent,
            'indeterminate-source',
            `Cannot verify provider state for ${agent.displayName}.`,
          ),
          renderUninstallHuman,
        )
      }

      if (providerBefore.value.kind === 'absent') {
        if (liveBefore) {
          return emitCommandResult(
            createUninstallFailure(
              agent,
              'conflicting-source',
              `${agent.displayName} is on PATH but its recorded provider target is absent.`,
            ),
            renderUninstallHuman,
          )
        }
        if (isDryRunEnabled()) {
          return emitCommandResult(
            createDryRunUninstallResult(agent, 'would reconcile stale lifecycle evidence'),
            renderUninstallHuman,
          )
        }
        if (installedState) await removeInstalledAgentState(agent.name)
        if (receipt) await removeLifecycleReceipt(agent.name)
        return emitCommandResult(createGhostReconciledResult(agent), renderUninstallHuman)
      }

      if (!installedState) {
        return emitCommandResult(
          createUninstallFailure(
            agent,
            'indeterminate-source',
            `Cannot safely reconstruct ${agent.displayName}'s uninstall source.`,
          ),
          renderUninstallHuman,
        )
      }

      if (isDryRunEnabled()) {
        return emitCommandResult(
          createDryRunUninstallResult(agent, `would uninstall ${agent.displayName}`),
          renderUninstallHuman,
        )
      }

      // Script/binary installs are state-only: Quantex untracks them without removing the
      // upstream executable, so managed receipt synthesis and PATH absence polling do not apply.
      if (!canUninstallInstallType(installedState.installType)) {
        const uninstallOutcome = await uninstallInstalledAgentOutcome(agent, installedState)
        if (uninstallOutcome.kind !== 'success') {
          return emitCommandResult(
            createUninstallFailure(agent, 'provider-failure', `Failed to uninstall ${agent.displayName}.`),
            renderUninstallHuman,
          )
        }

        await removeLifecycleReceipt(agent.name)
        return emitCommandResult(
          createSuccessResult<UninstallCommandData>({
            action: 'uninstall',
            data: {
              agent: {
                displayName: agent.displayName,
                name: agent.name,
              },
              changed: true,
            },
            target: {
              kind: 'agent',
              name: agent.name,
            },
          }),
          renderUninstallHuman,
        )
      }

      if (!receipt) {
        await setLifecycleReceipt({
          ...(binding.target.binaryName ? { executableName: binding.target.binaryName } : {}),
          kind: 'lifecycle-receipt',
          providerId: binding.providerId,
          providerTargetId: binding.target.id,
          providerTargetKind: binding.target.kind,
          schemaVersion: 1,
          targetId: agent.name,
          verifiedAt: new Date().toISOString(),
          ...(providerBefore.value.executablePath ? { executablePath: providerBefore.value.executablePath } : {}),
          ...(providerBefore.value.version ? { version: providerBefore.value.version } : {}),
        })
      }

      const uninstallOutcome = await uninstallInstalledAgentOutcome(agent, installedState)

      if (uninstallOutcome.kind === 'success') {
        const postconditionSatisfied = await waitForUninstallAbsence(
          async () => {
            const providerAfter = await observeBoundProvider(binding)
            if (providerAfter.kind !== 'success' || providerAfter.value.kind !== 'absent') return false
            return !(await isBinaryInPath(agent.binaryName))
          },
          { isCancelled: () => Boolean(getCliContext().cancelled) },
        )
        if (!postconditionSatisfied) {
          await setInstalledAgentState(installedState)
          return emitCommandResult(
            createUninstallFailure(
              agent,
              'verification-failed',
              `${agent.displayName} is still present after provider removal.`,
            ),
            renderUninstallHuman,
          )
        }

        await removeLifecycleReceipt(agent.name)
        return emitCommandResult(
          createSuccessResult<UninstallCommandData>({
            action: 'uninstall',
            data: {
              agent: {
                displayName: agent.displayName,
                name: agent.name,
              },
              changed: true,
            },
            target: {
              kind: 'agent',
              name: agent.name,
            },
          }),
          renderUninstallHuman,
        )
      }

      return emitCommandResult(
        createUninstallFailure(agent, 'provider-failure', `Failed to uninstall ${agent.displayName}.`),
        renderUninstallHuman,
      )
    })
  } catch (error) {
    if (isResourceLockError(error)) {
      return emitCommandResult(
        createErrorResult<UninstallCommandData>({
          action: 'uninstall',
          data: {
            agent: {
              displayName: agent.displayName,
              name: agent.name,
            },
            changed: false,
          },
          ...createResourceLockedError(error, {
            kind: 'agent',
            name: agent.name,
          }),
        }),
        renderUninstallHuman,
      )
    }
    throw error
  }
}

function providerBindingsMatch(left: LifecycleProviderBinding, right: LifecycleProviderBinding): boolean {
  return (
    left.providerId === right.providerId &&
    left.target.id === right.target.id &&
    left.target.kind === right.target.kind &&
    left.target.binaryName === right.target.binaryName
  )
}

async function observeBoundProvider(binding: LifecycleProviderBinding) {
  const context = getCliContext()
  const controller = new AbortController()
  if (context.cancelled) controller.abort('cli-cancelled')
  return observeLifecycleProvider(binding, {
    signal: controller.signal,
    timeoutMs: context.timeoutMs,
  })
}

function createUninstallFailure(
  agent: AgentDefinition,
  lifecycle: 'conflicting-source' | 'indeterminate-source' | 'provider-failure' | 'verification-failed',
  message: string,
): CommandResult<UninstallCommandData> {
  return createErrorResult({
    action: 'uninstall',
    data: {
      agent: { displayName: agent.displayName, name: agent.name },
      changed: false,
    },
    error: {
      code: 'UNINSTALL_FAILED',
      details: { lifecycle },
      message,
    },
    target: { kind: 'agent', name: agent.name },
  })
}

function createDryRunUninstallResult(agent: AgentDefinition, action: string): CommandResult<UninstallCommandData> {
  return createSuccessResult({
    action: 'uninstall',
    data: {
      agent: { displayName: agent.displayName, name: agent.name },
      changed: false,
    },
    target: { kind: 'agent', name: agent.name },
    warnings: [{ code: 'DRY_RUN', message: `Dry run: ${action}.` }],
  })
}

function createGhostReconciledResult(agent: AgentDefinition): CommandResult<UninstallCommandData> {
  return createSuccessResult({
    action: 'uninstall',
    data: {
      agent: { displayName: agent.displayName, name: agent.name },
      changed: true,
    },
    target: { kind: 'agent', name: agent.name },
    warnings: [
      {
        code: 'GHOST_STATE_RECONCILED',
        message: `${agent.displayName} was already absent; stale lifecycle evidence was removed.`,
      },
    ],
  })
}

function createUnmanagedUninstallResult(agentName: string, agent: AgentDefinition) {
  return createErrorResult<UninstallCommandData>({
    action: 'uninstall',
    data: {
      agent: {
        displayName: agent.displayName,
        name: agent.name,
      },
      changed: false,
    },
    error: {
      code: 'UNINSTALL_UNMANAGED',
      details: {
        canAutoUninstall: false,
        displayName: agent.displayName,
        input: agentName,
        lifecycle: 'unmanaged',
        name: agent.name,
      },
      message: `${agent.displayName} is not managed by qtx, so qtx cannot auto-uninstall it. Run qtx inspect ${agent.name} for details.`,
    },
    target: {
      kind: 'agent',
      name: agent.name,
    },
  })
}

function renderUninstallHuman(result: {
  data?: UninstallCommandData
  error: { message: string } | null
  warnings?: Array<{ message: string }>
}): void {
  if (result.error) {
    printError(pc.red(result.error.message))
    return
  }

  if (!result.data) return

  if (result.warnings && result.warnings.length > 0) {
    for (const warning of result.warnings) printWarn(pc.yellow(warning.message))
    return
  }

  printInfo(pc.cyan(`Uninstalling ${result.data.agent.displayName}...`))
  printInfo(pc.green(`${result.data.agent.displayName} uninstalled successfully!`))
}
