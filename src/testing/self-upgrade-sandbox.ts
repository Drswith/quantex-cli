import { basename } from 'node:path'

export const SEEDED_SELF_VERSION = '0.0.0-sandbox-old'

export function buildSelfManagedRegistryMetadata(options: {
  latestTarballName: string
  latestVersion: string
  origin: string
  packageName: string
  seededTarballName: string
  seededVersion?: string
}): {
  'dist-tags': { latest: string }
  name: string
  versions: Record<
    string,
    {
      dist: {
        tarball: string
      }
      name: string
      version: string
    }
  >
} {
  const seededVersion = options.seededVersion ?? SEEDED_SELF_VERSION

  return {
    'dist-tags': {
      latest: options.latestVersion,
    },
    name: options.packageName,
    versions: {
      [seededVersion]: {
        dist: {
          tarball: `${options.origin}/${options.seededTarballName}`,
        },
        name: options.packageName,
        version: seededVersion,
      },
      [options.latestVersion]: {
        dist: {
          tarball: `${options.origin}/${options.latestTarballName}`,
        },
        name: options.packageName,
        version: options.latestVersion,
      },
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
