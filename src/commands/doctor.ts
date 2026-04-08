import pc from 'picocolors'
import { getAllAgents } from '../agents'
import { inspectAllAgents } from '../agents/inspection'
import { isBrewAvailable, isBunAvailable, isNpmAvailable, isWingetAvailable } from '../utils/detect'

export async function doctorCommand(): Promise<void> {
  console.log(pc.bold('\nQuantex CLI Environment Check\n'))

  console.log(pc.bold('Managed Installers:'))

  const bunAvailable = await isBunAvailable()
  console.log(`  Bun:   ${bunAvailable ? pc.green('available') : pc.red('not found')}`)

  const npmAvailable = await isNpmAvailable()
  console.log(`  npm:   ${npmAvailable ? pc.green('available') : pc.red('not found')}`)

  const brewAvailable = await isBrewAvailable()
  console.log(`  brew:  ${brewAvailable ? pc.green('available') : pc.red('not found')}`)

  const wingetAvailable = await isWingetAvailable()
  console.log(`  winget:${wingetAvailable ? pc.green('available') : pc.red('not found')}`)

  console.log(`\n${pc.bold('Installed Agents:')}`)
  const inspections = await inspectAllAgents(getAllAgents())
  let anyInstalled = false

  for (const inspection of inspections) {
    if (inspection.inPath) {
      anyInstalled = true
      const outdated = inspection.installedVersion && inspection.latestVersion && inspection.installedVersion !== inspection.latestVersion

      console.log(`  ${inspection.agent.displayName}: ${inspection.installedVersion ?? 'unknown'} [${inspection.lifecycle}; ${inspection.sourceLabel}]${outdated ? pc.yellow(` (update available: ${inspection.latestVersion})`) : ''}`)
    }
  }

  if (!anyInstalled) {
    console.log(pc.dim('  No agents installed'))
  }

  console.log(`\n${pc.bold('Issues:')}`)
  const issues: string[] = []

  if (!bunAvailable && !npmAvailable && !brewAvailable && !wingetAvailable) {
    issues.push('No managed installer found. Install bun, npm, brew, or winget.')
  }

  if (issues.length === 0) {
    console.log(pc.green('  No issues found.'))
  }
  else {
    for (const issue of issues) {
      console.log(pc.yellow(`  - ${issue}`))
    }
  }

  console.log()
}
