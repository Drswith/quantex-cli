// Kept after P0 (#702) / P1 / P5 zero-ref scans: still used by Core uninstall-executor.
// Keep: product-path touch so pure openspec archive PRs still run the macOS test matrix.
// Keep: product-path touch so the post-1.12 openspec/changes/archive cleanup PR still runs the macOS test matrix.
// Keep: product-path touch so the post-1.12 runbook/ADR wording PR still runs the macOS test matrix.
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
