import type { AgentVersionProbe } from '../agents'
import { realpath } from 'node:fs/promises'
import process from 'node:process'
import { readProcessOutput, spawnCommand } from './child-process'
import { fetchJsonWithCache } from './network'
import { buildRegistryPackageVersionUrl, OFFICIAL_NPM_REGISTRY, normalizeRegistryUrl } from './registry'

// 通用版本号提取正则，匹配 v1.2.3 或 1.2.3 等格式
const VERSION_PATTERN = /v?(\d+\.\d+\.\d+(?:-[a-z0-9.]+)?)/i

function parseInstalledVersionOutput(text: string, parser?: AgentVersionProbe['parser']): string | undefined {
  if (parser) return parser(text)

  const firstLine = text.trim().split('\n')[0]
  const match = firstLine.match(VERSION_PATTERN)
  return match ? match[1] : firstLine || undefined
}

export async function getInstalledVersion(
  binaryName: string,
  versionProbe?: AgentVersionProbe,
): Promise<string | undefined> {
  const command = versionProbe?.command ?? [binaryName, '--version']

  try {
    const { exitCode, stdout } = await readProcessOutput(spawnCommand(command))
    if (exitCode !== 0) return undefined
    const text = stdout
    return parseInstalledVersionOutput(text, versionProbe?.parser)
  } catch {
    return undefined
  }
}

export async function getLatestVersion(
  packageName: string,
  distTag: string = 'latest',
  options: { registry?: string } = {},
): Promise<string | undefined> {
  try {
    const registry = normalizeRegistryUrl(options.registry) ?? OFFICIAL_NPM_REGISTRY
    const data = await fetchJsonWithCache<{ version: string }>(
      buildRegistryPackageVersionUrl(packageName, distTag, registry),
      `npm:${registry}:${packageName}:${distTag}`,
    )
    return data?.version
  } catch {
    return undefined
  }
}

export async function getBinaryPath(binaryName: string): Promise<string | undefined> {
  try {
    const cmd = process.platform === 'win32' ? 'where' : 'which'
    const { exitCode, stdout } = await readProcessOutput(spawnCommand([cmd, binaryName]))
    if (exitCode !== 0) return undefined
    const text = stdout
    return text.trim().split('\n')[0]
  } catch {
    return undefined
  }
}

export async function getResolvedBinaryPath(binaryPath?: string): Promise<string | undefined> {
  if (!binaryPath) return undefined

  try {
    return await realpath(binaryPath)
  } catch {
    return binaryPath
  }
}
