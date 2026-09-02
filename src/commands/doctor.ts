import type { DoctorData } from '../core/doctor-diagnosis'
import type { CommandResult } from '../output/types'
import { createSuccessResult, emitCommandResult } from '../output'
import { getHumanTerminalWidth, renderHumanFields, renderHumanTable, renderHumanWrapped } from '../output/human'
import { observeAndDiagnoseDoctorEnvironment } from '../services/doctor-diagnosis-production'
import { pc } from '../utils/color'

export type { DoctorData } from '../core/doctor-diagnosis'

export async function doctorCommand(): Promise<CommandResult<DoctorData>> {
  // Core owns diagnosis synthesis; gather CLI-coupled observations through the
  // production bridge rather than wrapping a published SDK doctor() method.
  const data = await observeAndDiagnoseDoctorEnvironment()

  return emitCommandResult(
    createSuccessResult<DoctorData>({
      action: 'doctor',
      data,
      target: {
        kind: 'system',
        name: 'doctor',
      },
    }),
    renderDoctorHuman,
  )
}

function renderDoctorHuman(result: { data?: DoctorData }): void {
  if (!result.data) return

  const width = getHumanTerminalWidth()
  console.log(pc.bold('\nQuantex CLI Environment Check\n'))

  const installers = Object.entries(result.data.installers).map(([name, available]) => ({ available, name }))
  console.log(pc.bold('Managed Installers\n'))
  for (const line of renderHumanTable(
    installers,
    [
      { header: 'Installer', value: installer => installer.name },
      {
        header: 'Status',
        value: installer => (installer.available ? pc.green('available') : pc.red('not found')),
      },
    ],
    { headerStyle: pc.bold, width },
  )) {
    console.log(line)
  }

  const selfFields = [
    { label: 'Version', value: result.data.self.currentVersion },
    { label: 'Source', value: result.data.self.installSource },
    {
      label: 'Auto-update',
      value: result.data.self.canAutoUpdate ? pc.green('supported') : pc.yellow('unsupported'),
    },
    ...(result.data.self.latestVersion
      ? [
          {
            label: 'Latest',
            value: `${result.data.self.latestVersion}${result.data.self.outdated ? pc.yellow(' (update available)') : ''}`,
          },
        ]
      : []),
    ...(result.data.self.recoveryHint ? [{ label: 'Recovery', value: result.data.self.recoveryHint }] : []),
  ]
  console.log(`\n${pc.bold('Quantex CLI')}\n`)
  for (const line of renderHumanFields(selfFields, { labelStyle: pc.bold, width })) console.log(line)

  console.log(`\n${pc.bold('Installed Agents')}\n`)
  if (result.data.agents.length === 0) {
    console.log(pc.dim('  No agents installed'))
  } else {
    for (const line of renderHumanTable(
      result.data.agents,
      [
        { header: 'Agent', minWidth: 8, value: agent => agent.displayName },
        {
          header: 'Version',
          maxWidth: 24,
          value: agent =>
            agent.outdated && agent.latestVersion
              ? pc.yellow(`${agent.installedVersion ?? 'unknown'} → ${agent.latestVersion}`)
              : (agent.installedVersion ?? 'unknown'),
        },
        { header: 'Lifecycle', optional: true, priority: 2, value: agent => agent.lifecycle },
        { header: 'Source', optional: true, priority: 1, value: agent => pc.dim(agent.sourceLabel) },
      ],
      { headerStyle: pc.bold, width },
    )) {
      console.log(line)
    }
  }

  console.log(`\n${pc.bold('Issues')}\n`)
  if (result.data.issues.length === 0) {
    console.log(pc.green('  No issues found.'))
  } else {
    for (const issue of result.data.issues) {
      for (const line of renderHumanWrapped(pc.yellow(issue.message), {
        continuationIndent: '    ',
        indent: '  - ',
        width,
      })) {
        console.log(line)
      }
      if (issue.suggestedCommands.length > 0) {
        for (const line of renderHumanWrapped(pc.dim(`Next: ${issue.suggestedCommands.join(' | ')}`), {
          indent: '    ',
          width,
        })) {
          console.log(line)
        }
      }
    }
  }

  console.log()
}
