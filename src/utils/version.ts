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
import { resolveAgentExecutablePath } from './executable-resolution'
import { fetchJsonWithCache } from './network'
import { buildRegistryPackageVersionUrl, OFFICIAL_NPM_REGISTRY, normalizeRegistryUrl } from './registry'

type MetadataCacheMode = 'default' | 'no-cache' | 'refresh'

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

/**
 * Substitutes an already-resolved absolute path for the probe's leading argument
 * so an agent that lives outside the inherited PATH can still be version-probed.
 * A catalog command that leads with something other than the agent executable is
 * a deliberate choice and is invoked unchanged.
 *
 * The path is supplied by the caller rather than resolved here: the observation
 * surfaces already resolve it, and resolving again would add a `which` spawn per
 * agent to every `list`.
 */
function resolveProbeCommand(
  binaryName: string,
  versionProbe: AgentVersionProbe | undefined,
  executablePath: string | undefined,
): string[] {
  const command = versionProbe?.command ?? [binaryName, '--version']
  if (!executablePath || command[0] !== binaryName) return [...command]
  return [executablePath, ...command.slice(1)]
}

// Kept at its exact v1 signature: the packaged root declaration is a byte-pinned
// compatibility contract, so the resolved-path argument lives on
// `probeInstalledVersion` instead of widening this export. Line comments, not JSDoc,
// for the same reason.
export async function getInstalledVersion(
  binaryName: string,
  versionProbe?: AgentVersionProbe,
  context?: ProviderOperationContext,
): Promise<string | undefined> {
  return probeInstalledVersion(binaryName, versionProbe, context)
}

export async function probeInstalledVersion(
  binaryName: string,
  versionProbe?: AgentVersionProbe,
  context?: ProviderOperationContext,
  executablePath?: string,
): Promise<string | undefined> {
  const command = resolveProbeCommand(binaryName, versionProbe, executablePath)

  try {
    const proc = spawnCommand(command, { detached: context !== undefined && process.platform !== 'win32' })
    const { exitCode, stderr, stdout } = context
      ? await readProcessOutputWithContext(proc, context)
      : await readProcessOutput(proc)
    if (exitCode !== 0) return undefined
    return (
      parseInstalledVersionOutput(stdout, versionProbe?.parser) ??
      parseInstalledVersionOutput(stderr, versionProbe?.parser)
    )
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
  return getLatestVersionWithCacheMode(packageName, distTag, options)
}

export async function getLatestVersionWithCacheMode(
  packageName: string,
  distTag: string = 'latest',
  options: {
    cacheMode?: MetadataCacheMode
    context?: ProviderOperationContext
    networkPort?: NetworkPort
    registry?: string
  } = {},
): Promise<string | undefined> {
  try {
    const registry = normalizeRegistryUrl(options.registry) ?? OFFICIAL_NPM_REGISTRY
    const data = await fetchJsonWithCache<{ version: string }>(
      buildRegistryPackageVersionUrl(packageName, distTag, registry),
      `npm:${registry}:${packageName}:${distTag}`,
      { cacheMode: options.cacheMode, context: options.context, networkPort: options.networkPort },
    )
    if (options.context?.signal.aborted) throw cancelledError(options.context.signal)
    return data?.version
  } catch (error) {
    if (isProcessInterruptionError(error)) throw error
    if (options.context?.signal.aborted) throw cancelledError(options.context.signal)
    return undefined
  }
}

// Kept for the v1 compatibility export surface; resolution is PATH-first with a
// known-install-directory fallback. Line comments, not JSDoc: the packaged root
// declaration is a byte-pinned contract.
export async function getBinaryPath(
  binaryName: string,
  context?: ProviderOperationContext,
): Promise<string | undefined> {
  return resolveAgentExecutablePath(binaryName, context)
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
