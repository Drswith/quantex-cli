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

export async function update(packageName: string): Promise<boolean> {
  try {
    const proc = Bun.spawn(['bun', 'update', '-g', packageName], {
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
