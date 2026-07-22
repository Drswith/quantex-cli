import type { AgentVersionProbe } from '../agents'
import type { ProviderOperationContext } from '../providers'
import type { NetworkPort } from '../runtime/ports'
import { realpath } from 'node:fs/promises'
import process from 'node:process'
import {
  isProcessInterruptionError,
  ProcessInterruptionError,
  readProcessOutput,
  readProcessOutputWithContext,
  spawnCommand,
} from './child-process'
import { compareVersions } from './compare-versions'
import { fetchJsonWithCache } from './network'
import { buildRegistryPackageVersionUrl, OFFICIAL_NPM_REGISTRY, normalizeRegistryUrl } from './registry'

export { compareVersions } from './compare-versions'

// 通用版本号提取正则，匹配 v1.2.3 或 1.2.3 等格式
const VERSION_PATTERN = /v?(\d+\.\d+\.\d+(?:-[a-z0-9.]+)?)/i

function parseInstalledVersionOutput(text: string, parser?: AgentVersionProbe['parser']): string | undefined {
  if (parser) return parser(text)

  const firstLine = text.trim().split('\n')[0]
  const match = firstLine.match(VERSION_PATTERN)
  return match ? match[1] : firstLine || undefined
}

export function isVersionNewer(candidate: string, current: string): boolean {
  return compareVersions(candidate, current) === 1
}

export async function getInstalledVersion(
  binaryName: string,
  versionProbe?: AgentVersionProbe,
  context?: ProviderOperationContext,
): Promise<string | undefined> {
  const command = versionProbe?.command ?? [binaryName, '--version']

  try {
    const proc = spawnCommand(command, { detached: context !== undefined && process.platform !== 'win32' })
    const { exitCode, stdout } = context
      ? await readProcessOutputWithContext(proc, context)
      : await readProcessOutput(proc)
    if (exitCode !== 0) return undefined
    const text = stdout
    return parseInstalledVersionOutput(text, versionProbe?.parser)
  } catch (error) {
    if (isProcessInterruptionError(error)) throw error
    return undefined
  }
}

export async function getLatestVersion(
  packageName: string,
  distTag: string = 'latest',
  options: { context?: ProviderOperationContext; networkPort?: NetworkPort; registry?: string } = {},
): Promise<string | undefined> {
  try {
    const registry = normalizeRegistryUrl(options.registry) ?? OFFICIAL_NPM_REGISTRY
    const data = await fetchJsonWithCache<{ version: string }>(
      buildRegistryPackageVersionUrl(packageName, distTag, registry),
      `npm:${registry}:${packageName}:${distTag}`,
      { context: options.context, networkPort: options.networkPort },
    )
    if (options.context?.signal.aborted) throw cancelledError(options.context.signal)
    return data?.version
  } catch (error) {
    if (isProcessInterruptionError(error)) throw error
    if (options.context?.signal.aborted) throw cancelledError(options.context.signal)
    return undefined
  }
}

export async function getBinaryPath(
  binaryName: string,
  context?: ProviderOperationContext,
): Promise<string | undefined> {
  try {
    const cmd = process.platform === 'win32' ? 'where' : 'which'
    const proc = spawnCommand([cmd, binaryName], {
      detached: context !== undefined && process.platform !== 'win32',
    })
    const { exitCode, stdout } = context
      ? await readProcessOutputWithContext(proc, context)
      : await readProcessOutput(proc)
    if (exitCode !== 0) return undefined
    const text = stdout
    return text.trim().split('\n')[0]
  } catch (error) {
    if (isProcessInterruptionError(error)) throw error
    return undefined
  }
}

export async function getResolvedBinaryPath(
  binaryPath?: string,
  context?: ProviderOperationContext,
): Promise<string | undefined> {
  if (!binaryPath) return undefined
  if (context?.signal.aborted) throw cancelledError(context.signal)

  try {
    const path = await realpath(binaryPath)
    if (context?.signal.aborted) throw cancelledError(context.signal)
    return path
  } catch {
    if (context?.signal.aborted) throw cancelledError(context.signal)
    return binaryPath
  }
}

function cancelledError(signal: AbortSignal): ProcessInterruptionError {
  const reason = typeof signal.reason === 'string' ? signal.reason : undefined
  return new ProcessInterruptionError({ kind: 'cancelled', reason })
}
