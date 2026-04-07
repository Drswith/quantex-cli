import type { AgentDefinition, InstallMethod } from '../agents/types'
import { getPlatform, isBunAvailable, isNpmAvailable } from '../utils/detect'
import { runBinaryInstall } from './binary'
import * as bunPm from './bun'
import * as npmPm from './npm'

function getAvailableMethods(methods: InstallMethod[]): InstallMethod[] {
  const platform = getPlatform()
  return [...methods]
    .filter(m => m.supportedPlatforms.includes(platform))
    .sort((a, b) => a.priority - b.priority)
}

export async function installAgent(agent: AgentDefinition): Promise<boolean> {
  const methods = getAvailableMethods(agent.installMethods)

  for (const method of methods) {
    if (method.type === 'bun') {
      if (!await isBunAvailable())
        continue
      if (await bunPm.install(agent.package))
        return true
    }
    else if (method.type === 'npm') {
      if (!await isNpmAvailable())
        continue
      if (await npmPm.install(agent.package))
        return true
    }
    else if (method.type === 'binary') {
      if (await runBinaryInstall(method.command))
        return true
    }
  }

  return false
}

export async function updateAgent(agent: AgentDefinition): Promise<boolean> {
  const methods = getAvailableMethods(agent.installMethods)

  for (const method of methods) {
    if (method.type === 'bun') {
      if (!await isBunAvailable())
        continue
      if (await bunPm.update(agent.package))
        return true
    }
    else if (method.type === 'npm') {
      if (!await isNpmAvailable())
        continue
      if (await npmPm.update(agent.package))
        return true
    }
    else if (method.type === 'binary') {
      if (await runBinaryInstall(method.command))
        return true
    }
  }

  return false
}

export async function uninstallAgent(agent: AgentDefinition): Promise<boolean> {
  let anySuccess = false

  if (await isBunAvailable()) {
    const result = await bunPm.uninstall(agent.package)
    anySuccess = anySuccess || result
  }

  if (await isNpmAvailable()) {
    const result = await npmPm.uninstall(agent.package)
    anySuccess = anySuccess || result
  }

  return anySuccess
}
