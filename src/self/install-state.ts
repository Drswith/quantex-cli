import type { SelfInstallSource } from './types'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import process from 'node:process'

interface PersistedState {
  installedAgents?: Record<string, unknown>
  self?: {
    installSource?: SelfInstallSource
  }
}

export function detectPackageManagerSelfInstallSource(env: NodeJS.ProcessEnv = process.env): SelfInstallSource | undefined {
  if (!isGlobalPackageInstall(env))
    return undefined

  const userAgent = env.npm_config_user_agent?.toLowerCase() ?? ''

  if (userAgent.startsWith('bun/'))
    return 'bun'

  if (userAgent.startsWith('npm/'))
    return 'npm'

  return undefined
}

export async function persistDetectedPackageManagerInstallSource(env: NodeJS.ProcessEnv = process.env): Promise<boolean> {
  const installSource = detectPackageManagerSelfInstallSource(env)

  if (!installSource)
    return false

  await persistSelfInstallSourceToState(installSource, env)
  return true
}

export async function persistSelfInstallSourceToState(
  installSource: SelfInstallSource,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const stateFilePath = getStateFilePathFromEnv(env)
  const state = await readStateFile(stateFilePath)

  state.installedAgents ??= {}
  state.self ??= {}
  state.self.installSource = installSource

  await mkdir(dirname(stateFilePath), { recursive: true })
  await writeFile(stateFilePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
}

export function getStateFilePathFromEnv(env: NodeJS.ProcessEnv = process.env): string {
  return join(getConfigDirFromEnv(env), 'state.json')
}

export function getConfigDirFromEnv(env: NodeJS.ProcessEnv = process.env): string {
  return join(resolveHomeDir(env), '.quantex')
}

function isGlobalPackageInstall(env: NodeJS.ProcessEnv): boolean {
  return env.npm_config_global === 'true' || env.npm_config_location === 'global'
}

function resolveHomeDir(env: NodeJS.ProcessEnv): string {
  return env.HOME || env.USERPROFILE || homedir()
}

async function readStateFile(stateFilePath: string): Promise<PersistedState> {
  try {
    return JSON.parse(await readFile(stateFilePath, 'utf8')) as PersistedState
  }
  catch {
    return {}
  }
}
