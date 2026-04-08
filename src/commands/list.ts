import pc from 'picocolors'
import { inspectRegisteredAgents } from '../services/agents'

export async function listCommand(): Promise<void> {
  const inspections = await inspectRegisteredAgents()

  console.log(pc.bold('\nAI Agents:\n'))

  for (const inspection of inspections) {
    const nameStr = inspection.agent.displayName.padEnd(18)
    const statusStr = inspection.inPath ? pc.green('installed') : pc.gray('not installed')
    const versionStr = inspection.inPath ? pc.dim(inspection.installedVersion ?? 'unknown version') : ''
    const updateStr = inspection.inPath ? pc.cyan(inspection.updateLabel) : ''
    const sourceStr = inspection.inPath ? pc.dim(inspection.sourceLabel) : ''

    console.log(`  ${nameStr} ${statusStr}  ${versionStr}${updateStr ? `  ${updateStr}` : ''}${sourceStr ? `  ${sourceStr}` : ''}`)
  }

  console.log()
}
