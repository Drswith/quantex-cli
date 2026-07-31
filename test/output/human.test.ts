import stringWidth from 'string-width'
import { describe, expect, it } from 'vitest'
import { getHumanTerminalWidth, renderHumanFields, renderHumanTable, renderHumanWrapped } from '../../src/output/human'

interface Row {
  name: string
  status: string
  update: string
  version: string
}

const rows: Row[] = [
  { name: 'Codex CLI', status: '\u001B[32myes\u001B[39m', update: 'managed', version: '0.145.0' },
  { name: '通义代理', status: '\u001B[2mno\u001B[22m', update: '—', version: '—' },
]

const columns = [
  { header: 'Agent', minWidth: 8, value: (row: Row) => row.name },
  { header: 'Installed', minWidth: 5, value: (row: Row) => row.status },
  { header: 'Version', optional: true, priority: 2, value: (row: Row) => row.version },
  { header: 'Update', optional: true, priority: 1, value: (row: Row) => row.update },
] as const

describe('human output layout', () => {
  it('aligns colored and wide-character table cells by visible width', () => {
    expect(renderHumanTable(rows, columns, { indent: 0, width: 60 })).toEqual([
      'Agent      Installed  Version  Update',
      'Codex CLI  \u001B[32myes\u001B[39m        0.145.0  managed',
      '通义代理   \u001B[2mno\u001B[22m         —        —',
    ])
  })

  it('drops lower-priority optional columns before higher-priority columns', () => {
    const output = renderHumanTable(rows, columns, { indent: 0, width: 29 }).join('\n')
    expect(output).toContain('Version')
    expect(output).not.toContain('Update')
    expect(output.split('\n').every(line => stringWidth(line) <= 29)).toBe(true)
  })

  it('bounds required columns when the terminal is extremely narrow', () => {
    const output = renderHumanTable(rows, columns, { indent: 0, width: 14 })
    expect(output.every(line => stringWidth(line) <= 14)).toBe(true)
    expect(output.some(line => line.includes('…'))).toBe(true)
  })

  it('wraps field values with hanging indentation', () => {
    expect(
      renderHumanFields([{ label: 'Path', value: '/a/very/long/path/to/an/agent/binary' }], {
        indent: 2,
        width: 28,
      }),
    ).toEqual(['  Path:  /a/very/long/path/t', '         o/an/agent/binary'])
  })

  it('wraps prose using distinct first and continuation indents', () => {
    expect(
      renderHumanWrapped('This issue has a deliberately long explanation.', {
        continuationIndent: '    ',
        indent: '  - ',
        width: 26,
      }),
    ).toEqual(['  - This issue has a', '    deliberately long', '    explanation.'])
  })

  it('uses a deterministic fallback for missing or invalid terminal widths', () => {
    expect(getHumanTerminalWidth(undefined)).toBe(80)
    expect(getHumanTerminalWidth(Number.NaN)).toBe(80)
    expect(getHumanTerminalWidth(5)).toBe(8)
  })
})
