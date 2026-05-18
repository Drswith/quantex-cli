import { readProcessOutput, spawnCommand, spawnWithQuantexStdio, waitForSpawnedCommand } from '../utils/child-process'

let resolvedPipCommand: string[] | null = null

async function resolvePipCommand(): Promise<string[]> {
  if (resolvedPipCommand) return resolvedPipCommand

  const candidates = [['pip'], ['pip3'], ['python', '-m', 'pip'], ['python3', '-m', 'pip']]

  for (const cmd of candidates) {
    try {
      const { exitCode } = await readProcessOutput(spawnCommand([...cmd, '--version']))
      if (exitCode === 0) {
        resolvedPipCommand = cmd
        return cmd
      }
    } catch {
      /* continue to next candidate */
    }
  }

  resolvedPipCommand = ['pip']
  return resolvedPipCommand
}

async function runPipCommand(args: string[]): Promise<boolean> {
  try {
    const pipCmd = await resolvePipCommand()
    return (await waitForSpawnedCommand(spawnWithQuantexStdio([...pipCmd, ...args]))) === 0
  } catch {
    return false
  }
}

export async function install(packageName: string): Promise<boolean> {
  return runPipCommand(['install', packageName])
}

export async function update(packageName: string): Promise<boolean> {
  return runPipCommand(['install', '--upgrade', packageName])
}

export async function updateMany(packages: Array<{ packageName: string }>): Promise<boolean> {
  if (packages.length === 0) return true

  for (const pkg of packages) {
    if (!(await update(pkg.packageName))) return false
  }

  return true
}

export async function uninstall(packageName: string): Promise<boolean> {
  return runPipCommand(['uninstall', '-y', packageName])
}
