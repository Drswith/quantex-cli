import process from 'node:process'

export async function getInstalledVersion(binaryName: string): Promise<string | undefined> {
  try {
    const proc = Bun.spawn([binaryName, '--version'], { stdout: 'pipe', stderr: 'pipe' })
    await proc.exited
    if (proc.exitCode !== 0)
      return undefined
    const text = await new Response(proc.stdout).text()
    return text.trim() || undefined
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
