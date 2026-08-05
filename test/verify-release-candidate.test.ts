import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { downloadCheck, verifyCandidateAssets } from '../scripts/release/verify-release-candidate'

const ORIGINAL_ENV = { ...process.env }

let candidateRoot = ''

beforeEach(async () => {
  candidateRoot = await mkdtemp(join(tmpdir(), 'quantex-candidate-'))
})

afterEach(async () => {
  process.env = { ...ORIGINAL_ENV }
  await rm(candidateRoot, { force: true, recursive: true })
})

async function stageCandidate(options?: { tamper?: boolean }): Promise<void> {
  const assetContents = 'asset-bytes'
  const onDiskAssetContents = options?.tamper ? `${assetContents}-tampered` : assetContents
  const npmContents = 'npm-tarball-bytes'
  const notesContents = '# notes\n'

  await mkdir(join(candidateRoot, 'assets'), { recursive: true })
  await mkdir(join(candidateRoot, 'npm'), { recursive: true })
  await writeFile(join(candidateRoot, 'assets', 'qtx-linux-x64.tar.gz'), onDiskAssetContents)
  await writeFile(join(candidateRoot, 'npm', 'quantex-cli-1.8.2.tgz'), npmContents)
  await writeFile(join(candidateRoot, 'release-notes.md'), notesContents)

  const describeFile = (name: string, contents: string) => ({
    name,
    sha256: createHash('sha256').update(contents).digest('hex'),
    size: Buffer.byteLength(contents),
  })

  const manifest = {
    assets: [describeFile('qtx-linux-x64.tar.gz', assetContents)],
    commitSha: 'a'.repeat(40),
    npm: {
      ...describeFile('quantex-cli-1.8.2.tgz', npmContents),
      integrity: `sha512-${createHash('sha512').update(npmContents).digest('base64')}`,
    },
    releaseNotes: describeFile('release-notes.md', notesContents),
    tag: 'v1.8.2',
    version: '1.8.2',
  }

  await writeFile(join(candidateRoot, 'candidate.json'), `${JSON.stringify(manifest, null, 2)}\n`)
}

describe('verify-release-candidate download-check', () => {
  it('accepts a downloaded candidate that matches candidate.json', async () => {
    await stageCandidate()
    process.env.RELEASE_TAG = 'v1.8.2'
    process.env.RELEASE_VERSION = '1.8.2'

    await expect(downloadCheck(candidateRoot)).resolves.toBeUndefined()
  })

  it('rejects a tampered candidate file', async () => {
    await stageCandidate({ tamper: true })
    process.env.RELEASE_TAG = 'v1.8.2'
    process.env.RELEASE_VERSION = '1.8.2'

    await expect(downloadCheck(candidateRoot)).rejects.toThrow(/does not match candidate\.json/)
  })

  it('rejects an identity mismatch against the validated job outputs', async () => {
    await stageCandidate()
    process.env.RELEASE_TAG = 'v1.8.3'
    process.env.RELEASE_VERSION = '1.8.3'

    await expect(downloadCheck(candidateRoot)).rejects.toThrow(/identity/)
  })
})

describe('verify-release-candidate assets-check', () => {
  const manifest = {
    assets: [{ name: 'qtx-linux-x64.tar.gz', sha256: 'abc123', size: 42 }],
    tag: 'v1.8.2',
  } as never

  it('accepts release assets that match the candidate', () => {
    expect(() =>
      verifyCandidateAssets(manifest, {
        assets: [{ digest: 'sha256:abc123', name: 'qtx-linux-x64.tar.gz', size: 42 }],
        tagName: 'v1.8.2',
      }),
    ).not.toThrow()
  })

  it('rejects a missing or mismatched asset', () => {
    expect(() => verifyCandidateAssets(manifest, { assets: [], tagName: 'v1.8.2' })).toThrow(
      /missing or does not match/,
    )
    expect(() =>
      verifyCandidateAssets(manifest, {
        assets: [{ digest: 'sha256:deadbeef', name: 'qtx-linux-x64.tar.gz', size: 42 }],
        tagName: 'v1.8.2',
      }),
    ).toThrow(/missing or does not match/)
  })

  it('rejects a release tag that differs from the candidate', () => {
    expect(() => verifyCandidateAssets(manifest, { assets: [], tagName: 'v9.9.9' })).toThrow(/does not match/)
  })
})
