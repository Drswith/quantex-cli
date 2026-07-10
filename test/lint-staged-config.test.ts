import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const sourceGlob = '*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}'
const configGlob = '*.{json,jsonc,json5,html,css,scss,less}'
const tolerantFormatCommand = 'oxfmt --write --no-error-on-unmatched-pattern'

describe('lint-staged formatter configuration', () => {
  it('treats formatter-ignored fixture groups as a no-op without weakening supported source checks', async () => {
    const packageJson = await readJson<{
      'lint-staged': Record<string, string[]>
    }>('package.json')
    const formatConfig = await readJson<{
      ignorePatterns: string[]
    }>('.oxfmtrc.json')

    expect(formatConfig.ignorePatterns).toContain('test/fixtures')
    expect(packageJson['lint-staged'][sourceGlob]).toEqual([tolerantFormatCommand, 'oxlint --fix'])
    expect(packageJson['lint-staged'][configGlob]).toEqual([tolerantFormatCommand])
  })
})

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8')) as T
}
