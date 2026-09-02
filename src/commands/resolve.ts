import type { CommandResult } from '../output/types'
import { createErrorResult, createSuccessResult, emitCommandResult } from '../output'
import { getHumanTerminalWidth, renderHumanFields, renderHumanWrapped } from '../output/human'
import { resolveCliReadObservation } from '../services/core-read-observations'
import { pc } from '../utils/color'
import { projectCliReadObservation, projectInstallMethods } from './cli-read-projection'

interface ResolveCommandData {
  agent: {
    binaryName: string
    displayName: string
    name: string
  }
  resolution: {
    binaryPath: string
    installGuidance?: {
      docsRef: string
      installMethods: Array<{
        command: string
        label: string
        type: string
      }>
      suggestedAction: 'ensure-agent-installed'
      suggestedEnsureCommand: string
    }
    installed: boolean
    installSource: string
    installedVersion?: string
    lifecycle: 'managed' | 'unmanaged'
    sourceLabel: string
    suggestedLaunchCommand: string[]
  }
}

export async function resolveCommand(agentName: string): Promise<CommandResult<ResolveCommandData>> {
  // Core read ports already back resolve; project the richer v1 CLI payload rather than
  // wrapping the narrower public SDK inspect() descriptors into a second CLI-shaped API.
  const resolved = await resolveCliReadObservation(agentName)
  if (!resolved) {
    return emitCommandResult(
      createErrorResult<ResolveCommandData>({
        action: 'resolve',
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
      renderResolveHuman,
    )
  }

  const { agent, inspection } = projectCliReadObservation(resolved)
  if (!inspection.inPath || !inspection.binaryPath) {
    const installMethods = projectInstallMethods(agent, inspection.methods).filter(method => method.command)

    return emitCommandResult(
      createErrorResult<ResolveCommandData>({
        action: 'resolve',
        data: {
          agent: {
            binaryName: agent.binaryName,
            displayName: agent.displayName,
            name: agent.name,
          },
          resolution: {
            binaryPath: '',
            installGuidance: {
              docsRef: 'skills/quantex-cli/references/command-recipes.md',
              installMethods,
              suggestedAction: 'ensure-agent-installed',
              suggestedEnsureCommand: `quantex ensure ${agent.name}`,
            },
            installed: false,
            installSource: 'not-installed',
            lifecycle: 'unmanaged',
            sourceLabel: 'not installed',
            suggestedLaunchCommand: [],
          },
        },
        error: {
          code: 'AGENT_NOT_INSTALLED',
          details: {
            docsRef: 'skills/quantex-cli/references/command-recipes.md',
            installMethods,
            suggestedAction: 'ensure-agent-installed',
            suggestedEnsureCommand: `quantex ensure ${agent.name}`,
          },
          message: `${agent.displayName} is not installed.`,
        },
        target: {
          kind: 'agent',
          name: agent.name,
        },
      }),
      renderResolveHuman,
    )
  }

  return emitCommandResult(
    createSuccessResult<ResolveCommandData>({
      action: 'resolve',
      data: {
        agent: {
          binaryName: agent.binaryName,
          displayName: agent.displayName,
          name: agent.name,
        },
        resolution: {
          binaryPath: inspection.binaryPath,
          installed: true,
          installSource: inspection.installedState?.installType ?? 'detected-in-path',
          installedVersion: inspection.installedVersion,
          lifecycle: inspection.lifecycle,
          sourceLabel: inspection.sourceLabel,
          suggestedLaunchCommand: [inspection.binaryPath],
        },
      },
      target: {
        kind: 'agent',
        name: agent.name,
      },
    }),
    renderResolveHuman,
  )
}

function renderResolveHuman(result: { data?: ResolveCommandData; error: { message: string } | null }): void {
  const width = getHumanTerminalWidth()
  if (result.error) {
    for (const line of renderHumanWrapped(pc.red(result.error.message), { width })) console.log(line)
    const guidance = result.data?.resolution.installGuidance
    if (guidance) {
      for (const line of renderHumanWrapped(pc.dim(`Try: ${guidance.suggestedEnsureCommand}`), {
        continuationIndent: '     ',
        width,
      })) {
        console.log(line)
      }
      for (const method of guidance.installMethods) {
        for (const line of renderHumanWrapped(pc.dim(`[${method.label}] ${method.command}`), {
          continuationIndent: '         ',
          indent: 'Install: ',
          width,
        })) {
          console.log(line)
        }
      }
    }
    return
  }

  if (!result.data) return

  console.log(pc.bold(`\n${result.data.agent.displayName}\n`))
  const fields = [
    { label: 'Name', value: result.data.agent.name },
    { label: 'Binary', value: result.data.agent.binaryName },
    { label: 'Path', value: result.data.resolution.binaryPath },
    { label: 'Source', value: result.data.resolution.sourceLabel },
    { label: 'Lifecycle', value: result.data.resolution.lifecycle },
    { label: 'Install type', value: result.data.resolution.installSource },
    ...(result.data.resolution.installedVersion
      ? [{ label: 'Version', value: result.data.resolution.installedVersion }]
      : []),
    { label: 'Launch', value: result.data.resolution.suggestedLaunchCommand.join(' ') },
  ]
  for (const line of renderHumanFields(fields, { labelStyle: pc.bold, width })) console.log(line)
  console.log()
}
