import pc from 'picocolors'
import { getAllAgents } from '../agents'
import { getInstalledAgentState } from '../state'
import { isBinaryInPath, isBrewAvailable, isBunAvailable, isNpmAvailable, isWingetAvailable } from '../utils/detect'
import { formatInstalledSource, getInstallLifecycle } from '../utils/install'
import { getInstalledVersion, getLatestVersion } from '../utils/version'

export async function doctorCommand(): Promise<void> {
  console.log(pc.bold('\nSilver CLI Environment Check\n'))

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
  const agents = getAllAgents()
  let anyInstalled = false

  for (const agent of agents) {
    const inPath = await isBinaryInPath(agent.binaryName)
    if (inPath) {
      anyInstalled = true
      const installedState = await getInstalledAgentState(agent.name)
      const version = await getInstalledVersion(agent.binaryName)
      const latest = await getLatestVersion(agent.package)
      const outdated = version && latest && version !== latest
      const source = formatInstalledSource(installedState)
      const lifecycle = installedState ? getInstallLifecycle(installedState.installType) : 'unmanaged'

      console.log(`  ${agent.displayName}: ${version ?? 'unknown'} [${lifecycle}; ${source}]${outdated ? pc.yellow(` (update available: ${latest})`) : ''}`)
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
