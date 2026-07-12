export interface ExecutableAbsenceWaitOptions {
  readonly attempts?: number
  readonly delay?: (milliseconds: number) => Promise<void>
  readonly delayMs?: number
  readonly isCancelled?: () => boolean
  readonly signal?: AbortSignal
}

const defaultDelay = (milliseconds: number) => new Promise<void>(resolve => setTimeout(resolve, milliseconds))

export async function waitForUninstallAbsence(
  isAbsent: () => Promise<boolean>,
  options: ExecutableAbsenceWaitOptions = {},
): Promise<boolean> {
  const attempts = Math.max(1, options.attempts ?? 6)
  const delay = options.delay ?? defaultDelay
  const delayMs = Math.max(0, options.delayMs ?? 100)

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (options.signal?.aborted || options.isCancelled?.()) return false
    const absent = await isAbsent()
    if (options.signal?.aborted || options.isCancelled?.()) return false
    if (absent) return true
    if (attempt + 1 < attempts) await delay(delayMs)
  }

  return false
}
