import { writeFile } from 'node:fs/promises'

const packageJson = (await Bun.file(new URL('../package.json', import.meta.url)).json()) as {
  name?: string
  repository?: string | { url?: string }
  version?: string
}

const repositoryUrl = typeof packageJson.repository === 'string' ? packageJson.repository : packageJson.repository?.url

const content = [
  `export const BUILD_PACKAGE_NAME = '${escapeSingleQuotedString(packageJson.name ?? 'quantex-cli')}'`,
  `export const BUILD_REPOSITORY_URL = '${escapeSingleQuotedString(normalizeRepositoryUrl(repositoryUrl) ?? '')}'`,
  `export const BUILD_VERSION = '${escapeSingleQuotedString(packageJson.version ?? '0.0.0')}' // x-release-please-version`,
  '',
].join('\n')

await writeFile(new URL('../src/generated/build-meta.ts', import.meta.url), content, 'utf8')

function normalizeRepositoryUrl(inputUrl?: string): string | undefined {
  if (!inputUrl) return undefined

  if (inputUrl.startsWith('git+')) return inputUrl.slice(4).replace(/\.git$/, '')

  if (inputUrl.startsWith('git@github.com:'))
    return inputUrl.replace('git@github.com:', 'https://github.com/').replace(/\.git$/, '')

  return inputUrl.replace(/\.git$/, '')
}

function escapeSingleQuotedString(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")
}
