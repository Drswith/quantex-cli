import { createHash } from 'node:crypto'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { formatChecksums } from '../src/release-artifacts'

const binDir = new URL('../dist/bin/', import.meta.url)
const files = (await readdir(binDir))
  .filter(name => name.startsWith('quantex-'))
  .sort((left, right) => left.localeCompare(right))

if (files.length === 0)
  throw new Error('No release binaries were found when generating SHA256SUMS.txt.')

const checksums = await Promise.all(files.map(async name => ({
  checksum: createHash('sha256').update(await readFile(new URL(name, binDir))).digest('hex'),
  name,
})))

await writeFile(new URL('../dist/bin/SHA256SUMS.txt', import.meta.url), formatChecksums(checksums), 'utf8')
