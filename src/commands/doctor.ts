import pc from 'picocolors'
import { getAllAgents } from '../agents'
import { isBinaryInPath, isBunAvailable, isNpmAvailable } from '../utils/detect'
import { getInstalledVersion, getLatestVersion } from '../utils/version'

export async function doctorCommand(): Promise<void> {
  console.log(pc.bold('\nSilver CLI Environment Check\n'))

  console.log(pc.bold('Package Managers:'))

  const bunAvailable = await isBunAvailable()
  console.log(`  Bun:   ${bunAvailable ? pc.green('available') : pc.red('not found')}`)

  const npmAvailable = await isNpmAvailable()
  console.log(`  npm:   ${npmAvailable ? pc.green('available') : pc.red('not found')}`)

  console.log(`\n${pc.bold('Installed Agents:')}`)
  const agents = getAllAgents()
  let anyInstalled = false

  for (const agent of agents) {
    const inPath = await isBinaryInPath(agent.binaryName)
    if (inPath) {
      anyInstalled = true
      const version = await getInstalledVersion(agent.binaryName)
      const latest = await getLatestVersion(agent.package)
      const outdated = version && latest && version !== latest

      console.log(`  ${agent.displayName}: ${version ?? 'unknown'}${outdated ? pc.yellow(` (update available: ${latest})`) : ''}`)
    }
  }

  if (!anyInstalled) {
    console.log(pc.dim('  No agents installed'))
  }

  console.log(`\n${pc.bold('Issues:')}`)
  const issues: string[] = []

  if (!bunAvailable && !npmAvailable) {
    issues.push('No package manager found. Install bun or npm.')
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
