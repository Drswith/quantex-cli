import { describe, expect, it } from 'vitest'
import { insertQueueRow } from '../scripts/project-memory-utils'

const queueFixture = `# Autonomy Queue

This queue is the prioritized entry point for future agent-driven work.

## Active queue

No active tasks are currently queued. Add the next executable task contract in \`autonomy/tasks/\` before reopening this section.

| ID | Status | Priority | Title | Depends on |
|---|---|---|---|---|

## Completed milestones

| ID | Status | Priority | Title | Depends on |
|---|---|---|---|---|
| [qtx-0001](./tasks/qtx-0001-example.md) | \`done\` | \`high\` | Example | - |

## Intake rules
`

describe('insertQueueRow', () => {
  it('inserts non-done tasks into the active queue when it is empty', () => {
    const row = '| [qtx-0024](./tasks/qtx-0024-example.md) | `ready` | `high` | Example task | - |'
    const updated = insertQueueRow(queueFixture, row, 'ready')

    expect(updated).toContain('## Active queue')
    expect(updated).not.toContain('No active tasks are currently queued')
    expect(updated).toContain(`${'|---|---|---|---|---|'}\n${row}`)
    expect(updated.indexOf(row)).toBeLessThan(updated.indexOf('## Completed milestones'))
  })

  it('inserts done tasks into completed milestones', () => {
    const row = '| [qtx-0024](./tasks/qtx-0024-example.md) | `done` | `high` | Example task | - |'
    const updated = insertQueueRow(queueFixture, row, 'done')

    const completedIndex = updated.indexOf('## Completed milestones')
    const rowIndex = updated.indexOf(row)

    expect(rowIndex).toBeGreaterThan(completedIndex)
    expect(updated).toContain(`${'|---|---|---|---|---|'}\n${row}\n| [qtx-0001](./tasks/qtx-0001-example.md) | \`done\` | \`high\` | Example | - |`)
  })
})
