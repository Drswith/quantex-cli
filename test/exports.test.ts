import { describe, expect, it } from 'vitest'
import { getPackageExportsManifest } from 'vitest-package-exports'
import yaml from 'yaml'

const IS_READY = false

describe.runIf(IS_READY)('exports-snapshot', async () => {
  it('silver-cli', async () => {
    const manifest = await getPackageExportsManifest({
      importMode: 'src',
      cwd: process.cwd(),
    })
    await expect(yaml.stringify(manifest.exports))
      .toMatchFileSnapshot('./exports/silver-cli.yaml')
  })
})
