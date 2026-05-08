import { basename } from 'node:path'

export const SEEDED_SELF_VERSION = '0.0.0-sandbox-old'

export interface SelfManagedRegistryPackageManifest extends Record<string, unknown> {
  name: string
  version: string
}

export function buildSelfManagedRegistryMetadata(options: {
  latestPackageManifest: SelfManagedRegistryPackageManifest
  origin: string
  seededPackageManifest: SelfManagedRegistryPackageManifest
  latestTarballName: string
  seededTarballName: string
}): {
  'dist-tags': { latest: string }
  name: string
  versions: Record<string, SelfManagedRegistryPackageManifest & { dist: { tarball: string } }>
} {
  const latestVersion = options.latestPackageManifest.version
  const seededVersion = options.seededPackageManifest.version

  return {
    'dist-tags': {
      latest: latestVersion,
    },
    name: options.latestPackageManifest.name,
    versions: {
      [seededVersion]: buildRegistryVersionEntry(
        options.seededPackageManifest,
        options.origin,
        options.seededTarballName,
      ),
      [latestVersion]: buildRegistryVersionEntry(
        options.latestPackageManifest,
        options.origin,
        options.latestTarballName,
      ),
    },
  }
}

export function parsePackedTarballName(output: string): string | undefined {
  const lastLine = output
    .trim()
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .at(-1)

  return lastLine ? basename(lastLine) : undefined
}

function buildRegistryVersionEntry(
  manifest: SelfManagedRegistryPackageManifest,
  origin: string,
  tarballName: string,
): SelfManagedRegistryPackageManifest & { dist: { tarball: string } } {
  return {
    ...manifest,
    dist: {
      tarball: `${origin}/${tarballName}`,
    },
  }
}
