import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveExecutableFromPath } from '../scripts/resolve-executable'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { force: true, recursive: true })))
})

describe('resolveExecutableFromPath', () => {
  it('honors PATHEXT when resolving a Windows executable', async () => {
    const root = await mkdtemp(join(tmpdir(), 'quantex-executable-'))
    const executable = join(root, 'bun.EXE')
    roots.push(root)
    await writeFile(executable, '')

    expect(
      resolveExecutableFromPath('bun', {
        path: root,
        pathExt: '.EXE;.CMD',
        platform: 'win32',
      }),
    ).toBe(executable)
  })
})
