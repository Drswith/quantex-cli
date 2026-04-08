import process from 'node:process'

// 通用版本号提取正则，匹配 v1.2.3 或 1.2.3 等格式
const VERSION_PATTERN = /v?(\d+\.\d+\.\d+(?:-[a-z0-9.]+)?)/i

export async function getInstalledVersion(binaryName: string): Promise<string | undefined> {
  try {
    const proc = Bun.spawn([binaryName, '--version'], { stdout: 'pipe', stderr: 'pipe' })
    await proc.exited
    if (proc.exitCode !== 0)
      return undefined
    const text = await new Response(proc.stdout).text()
    const firstLine = text.trim().split('\n')[0]

    // 尝试提取版本号，失败则返回第一行原始内容
    const match = firstLine.match(VERSION_PATTERN)
    return match ? match[1] : (firstLine || undefined)
  }
  catch {
    return undefined
  }
}

export async function getLatestVersion(packageName: string): Promise<string | undefined> {
  try {
    const res = await fetch(`https://registry.npmjs.org/${packageName}/latest`)
    if (!res.ok)
      return undefined
    const data = await res.json() as { version: string }
    return data.version
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
