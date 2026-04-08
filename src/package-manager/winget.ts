async function runWingetCommand(action: 'install' | 'upgrade' | 'uninstall', packageName: string): Promise<boolean> {
  try {
    const proc = Bun.spawn(['winget', action, '--id', packageName, '-e'], {
      stdio: ['inherit', 'inherit', 'inherit'] as const,
    })
    await proc.exited
    return proc.exitCode === 0
  }
  catch {
    return false
  }
}

export async function install(packageName: string): Promise<boolean> {
  return runWingetCommand('install', packageName)
}

export async function update(packageName: string): Promise<boolean> {
  return runWingetCommand('upgrade', packageName)
}

export async function updateMany(packages: Array<{ packageName: string }>): Promise<boolean> {
  for (const pkg of packages) {
    if (!await update(pkg.packageName))
      return false
  }

  return true
}

export async function uninstall(packageName: string): Promise<boolean> {
  return runWingetCommand('uninstall', packageName)
}
