import type { createReleaseManifest } from '../src/release-artifacts'
import { readFile } from 'node:fs/promises'
import { parseChecksums, validateReleaseManifest } from '../src/release-artifacts'

const checksumContents = await readFile(new URL('../dist/bin/SHA256SUMS.txt', import.meta.url), 'utf8')
const manifestContents = await readFile(new URL('../dist/bin/manifest.json', import.meta.url), 'utf8')

const checksums = parseChecksums(checksumContents)
const manifest = JSON.parse(manifestContents) as ReturnType<typeof createReleaseManifest>

validateReleaseManifest(manifest, checksums)
