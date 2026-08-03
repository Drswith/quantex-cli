import { beforeEach, describe, expect, it } from 'vitest'
import { mockDesktopClient } from './mock-desktop-client'

describe('browser mock desktop client', () => {
  beforeEach(async () => {
    await mockDesktopClient.refreshUpdates()
  })

  it('provides updateable and non-updateable inventory rows without Tauri', async () => {
    const snapshot = await mockDesktopClient.getSnapshot()

    expect(snapshot.results.filter(result => result.status === 'planned').map(result => result.name)).toEqual([
      'codex',
      'cursor',
    ])
    expect(snapshot.results.some(result => result.status === 'failed')).toBe(true)
  })

  it('updates only selected planned agents in the browser preview', async () => {
    const executions = await mockDesktopClient.applyUpdates(['codex'])
    const snapshot = await mockDesktopClient.getSnapshot()

    expect(executions).toHaveLength(1)
    expect(snapshot.results.find(result => result.name === 'codex')).toMatchObject({ status: 'updated' })
    expect(snapshot.results.find(result => result.name === 'cursor')).toMatchObject({ status: 'planned' })
  })
})
