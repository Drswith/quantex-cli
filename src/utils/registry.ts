export const OFFICIAL_NPM_REGISTRY = 'https://registry.npmjs.org'

export function normalizeRegistryUrl(value: string | undefined): string | undefined {
  if (!value) return undefined

  try {
    return new URL(value.trim()).toString().replace(/\/+$/, '')
  } catch {
    return undefined
  }
}

export function buildRegistryPackageVersionUrl(packageName: string, distTag: string, registryUrl: string): string {
  return `${normalizeRegistryUrl(registryUrl)}/${encodeURIComponent(packageName)}/${encodeURIComponent(distTag)}`
}
