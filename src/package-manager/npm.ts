import type { RegistryUpdateStrategy } from './bun'

export async function install(packageName: string): Promise<boolean> {
  try {
    const proc = Bun.spawn(['npm', 'i', '-g', packageName], {
      stdio: ['inherit', 'inherit', 'inherit'] as const,
    })
    await proc.exited
    return proc.exitCode === 0
  }
  catch {
    return false
  }
}

export async function update(
  packageName: string,
  strategy: RegistryUpdateStrategy = 'latest-major',
  distTag: string = 'latest',
): Promise<boolean> {
  try {
    const proc = Bun.spawn(
      strategy === 'latest-major'
        ? ['npm', 'install', '-g', `${packageName}@${distTag}`]
        : ['npm', 'update', '-g', packageName],
      {
        stdio: ['inherit', 'inherit', 'inherit'] as const,
      },
    )
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
    const proc = Bun.spawn(
      strategy === 'latest-major'
        ? ['npm', 'install', '-g', ...packageNames.map(packageName => `${packageName}@latest`)]
        : ['npm', 'update', '-g', ...packageNames],
      {
        stdio: ['inherit', 'inherit', 'inherit'] as const,
      },
    )
    await proc.exited
    return proc.exitCode === 0
  }
  catch {
    return false
  }
}

export async function uninstall(packageName: string): Promise<boolean> {
  try {
    const proc = Bun.spawn(['npm', 'uninstall', '-g', packageName], {
      stdio: ['inherit', 'inherit', 'inherit'] as const,
    })
    await proc.exited
    return proc.exitCode === 0
  }
  catch {
    return false
  }
}
