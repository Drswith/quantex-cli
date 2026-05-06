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

export function compareVersions(left: string, right: string): number | undefined {
  const leftVersion = parseVersion(left)
  const rightVersion = parseVersion(right)

  if (!leftVersion || !rightVersion) return undefined

  for (let index = 0; index < 3; index += 1) {
    const difference = leftVersion.core[index]! - rightVersion.core[index]!
    if (difference !== 0) return difference > 0 ? 1 : -1
  }

  return comparePrerelease(leftVersion.prerelease, rightVersion.prerelease)
}

export function isVersionNewer(candidate: string, current: string): boolean {
  return compareVersions(candidate, current) === 1
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

interface ParsedVersion {
  core: [number, number, number]
  prerelease: string[]
}

function parseVersion(value: string): ParsedVersion | undefined {
  const match = value.trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9a-z.-]+))?$/i)
  if (!match) return undefined

  return {
    core: [Number(match[1]), Number(match[2]), Number(match[3])],
    prerelease: match[4] ? match[4].split('.') : [],
  }
}

function comparePrerelease(left: string[], right: string[]): number {
  if (left.length === 0 && right.length === 0) return 0
  if (left.length === 0) return 1
  if (right.length === 0) return -1

  const maxLength = Math.max(left.length, right.length)

  for (let index = 0; index < maxLength; index += 1) {
    const leftPart = left[index]
    const rightPart = right[index]

    if (leftPart === undefined) return -1
    if (rightPart === undefined) return 1
    if (leftPart === rightPart) continue

    const leftNumeric = /^\d+$/.test(leftPart)
    const rightNumeric = /^\d+$/.test(rightPart)

    if (leftNumeric && rightNumeric) return Number(leftPart) > Number(rightPart) ? 1 : -1
    if (leftNumeric) return -1
    if (rightNumeric) return 1

    return leftPart > rightPart ? 1 : -1
  }

  return 0
}
