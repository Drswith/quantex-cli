import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const englishReadme = readFileSync('README.md', 'utf8')
const chineseReadme = readFileSync('README.zh-CN.md', 'utf8')

describe('product README configuration contract', () => {
  it('documents uv as a non-bootstrapping defaultPackageManager preference in both languages', () => {
    expect(englishReadme).toContain('`bun`, `npm`, `mise`, or `uv`')
    expect(englishReadme).toContain('must already be available')
    expect(englishReadme).toContain('does not install it for you')

    expect(chineseReadme).toContain('`bun`、`npm`、`mise` 或 `uv`')
    expect(chineseReadme).toContain('必须已经存在')
    expect(chineseReadme).toContain('不会自动替你安装')
  })
})
