export type RegistryUpdateStrategy = 'latest-major' | 'respect-semver'

export async function install(packageName: string): Promise<boolean> {
  try {
    const proc = Bun.spawn(['bun', 'add', '-g', packageName], {
      stdio: ['inherit', 'inherit', 'inherit'] as const,
    })
    await proc.exited
    return proc.exitCode === 0
  }
  catch {
    return false
  }
}

export async function update(packageName: string, strategy: RegistryUpdateStrategy = 'latest-major'): Promise<boolean> {
  try {
    const proc = Bun.spawn(['bun', 'update', '-g', ...(strategy === 'latest-major' ? ['--latest'] : []), packageName], {
      stdio: ['inherit', 'inherit', 'inherit'] as const,
    })
    await proc.exited
    return proc.exitCode === 0
  }
  catch {
    return false
  }
}

export async function updateMany(packageNames: string[], strategy: RegistryUpdateStrategy = 'latest-major'): Promise<boolean> {
  if (packageNames.length === 0)
    return true

  try {
    const proc = Bun.spawn(['bun', 'update', '-g', ...(strategy === 'latest-major' ? ['--latest'] : []), ...packageNames], {
      stdio: ['inherit', 'inherit', 'inherit'] as const,
    })
    await proc.exited
    return proc.exitCode === 0
  }
  catch {
    return false
  }
}

export async function uninstall(packageName: string): Promise<boolean> {
  try {
    const proc = Bun.spawn(['bun', 'remove', '-g', packageName], {
      stdio: ['inherit', 'inherit', 'inherit'] as const,
    })
    await proc.exited
    return proc.exitCode === 0
  }
  catch {
    return false
  }
}
