import type { AgentVersionProbe } from '../agents'
import process from 'node:process'
import { fetchJsonWithCache } from './network'

// 通用版本号提取正则，匹配 v1.2.3 或 1.2.3 等格式
const VERSION_PATTERN = /v?(\d+\.\d+\.\d+(?:-[a-z0-9.]+)?)/i

function parseInstalledVersionOutput(text: string, parser?: AgentVersionProbe['parser']): string | undefined {
  if (parser)
    return parser(text)

  const firstLine = text.trim().split('\n')[0]
  const match = firstLine.match(VERSION_PATTERN)
  return match ? match[1] : (firstLine || undefined)
}

export async function getInstalledVersion(binaryName: string, versionProbe?: AgentVersionProbe): Promise<string | undefined> {
  const command = versionProbe?.command ?? [binaryName, '--version']

  try {
    const proc = Bun.spawn(command, { stdout: 'pipe', stderr: 'pipe' })
    await proc.exited
    if (proc.exitCode !== 0)
      return undefined
    const text = await new Response(proc.stdout).text()
    return parseInstalledVersionOutput(text, versionProbe?.parser)
  }
  catch {
    return undefined
  }
}

export async function getLatestVersion(packageName: string, distTag: string = 'latest'): Promise<string | undefined> {
  try {
    const data = await fetchJsonWithCache<{ version: string }>(
      `https://registry.npmjs.org/${packageName}/${distTag}`,
      `npm:${packageName}:${distTag}`,
    )
    return data?.version
  }
  catch {
    return undefined
  }
}

export async function getBinaryPath(binaryName: string): Promise<string | undefined> {
  try {
    const cmd = process.platform === 'win32' ? 'where' : 'which'
    const proc = Bun.spawn([cmd, binaryName], { stdout: 'pipe', stderr: 'pipe' })
    await proc.exited
    if (proc.exitCode !== 0)
      return undefined
    const text = await new Response(proc.stdout).text()
    return text.trim().split('\n')[0]
  }
  catch {
    return undefined
  }
}
