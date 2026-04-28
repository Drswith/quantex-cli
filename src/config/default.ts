export const defaultConfig = {
  defaultPackageManager: 'bun' as const,
  networkRetries: 2 as const,
  networkTimeoutMs: 10000 as const,
  npmBunUpdateStrategy: 'latest-major' as const,
  selfUpdateChannel: 'stable' as const,
  selfUpdateRegistry: undefined,
  versionCacheTtlHours: 6 as const,
}
