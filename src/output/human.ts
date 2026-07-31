import process from 'node:process'
import sliceAnsi from 'slice-ansi'
import stringWidth from 'string-width'
import wrapAnsi from 'wrap-ansi'

const DEFAULT_TERMINAL_WIDTH = 80
const MIN_TERMINAL_WIDTH = 8

export interface HumanTableColumn<Row> {
  align?: 'left' | 'right'
  header: string
  maxWidth?: number
  minWidth?: number
  optional?: boolean
  priority?: number
  value(row: Row): string
  wrap?: boolean
}

export interface HumanTableOptions {
  gap?: number
  headerStyle?: (value: string) => string
  indent?: number
  width?: number
}

export interface HumanField {
  label: string
  value: string
}

export interface HumanFieldsOptions {
  gap?: number
  indent?: number
  labelStyle?: (value: string) => string
  minValueWidth?: number
  width?: number
}

export interface HumanWrapOptions {
  continuationIndent?: string
  indent?: string
  width?: number
}

export function getHumanTerminalWidth(columns: number | undefined = process.stdout.columns): number {
  if (columns === undefined || !Number.isFinite(columns) || columns <= 0) return DEFAULT_TERMINAL_WIDTH
  return Math.max(MIN_TERMINAL_WIDTH, Math.floor(columns))
}

export function renderHumanTable<Row>(
  rows: readonly Row[],
  columns: readonly HumanTableColumn<Row>[],
  options: HumanTableOptions = {},
): string[] {
  if (columns.length === 0) return []

  const width = getHumanTerminalWidth(options.width)
  const indent = Math.max(0, options.indent ?? 2)
  const gap = Math.max(1, options.gap ?? 2)
  const availableWidth = Math.max(1, width - indent)
  const naturalWidths = columns.map(column => getNaturalColumnWidth(rows, column))
  const visibleIndexes = selectVisibleColumns(columns, naturalWidths, availableWidth, gap)
  const visibleColumns = visibleIndexes.map(index => columns[index]!)
  const visibleNaturalWidths = visibleIndexes.map(index => naturalWidths[index]!)
  const contentWidth = Math.max(1, availableWidth - gap * Math.max(0, visibleColumns.length - 1))
  const columnWidths = fitColumnWidths(visibleColumns, visibleNaturalWidths, contentWidth)
  const prefix = ' '.repeat(indent)
  const gapText = ' '.repeat(gap)
  const headerStyle = options.headerStyle ?? (value => value)
  const output = [
    prefix +
      visibleColumns
        .map((column, index) => alignCell(headerStyle(column.header), columnWidths[index]!, column.align))
        .join(gapText)
        .trimEnd(),
  ]

  for (const row of rows) {
    const cells = visibleColumns.map((column, index) => {
      const value = column.value(row)
      const cellWidth = columnWidths[index]!
      if (!column.wrap) return [truncateVisible(value, cellWidth)]
      return wrapAnsi(value, cellWidth, { hard: true }).split('\n')
    })
    const rowHeight = Math.max(...cells.map(lines => lines.length))

    for (let lineIndex = 0; lineIndex < rowHeight; lineIndex += 1) {
      output.push(
        prefix +
          visibleColumns
            .map((column, columnIndex) =>
              alignCell(cells[columnIndex]?.[lineIndex] ?? '', columnWidths[columnIndex]!, column.align),
            )
            .join(gapText)
            .trimEnd(),
      )
    }
  }

  return output
}

export function renderHumanFields(fields: readonly HumanField[], options: HumanFieldsOptions = {}): string[] {
  if (fields.length === 0) return []

  const width = getHumanTerminalWidth(options.width)
  const indent = Math.max(0, options.indent ?? 2)
  const gap = Math.max(1, options.gap ?? 2)
  const minValueWidth = Math.max(1, options.minValueWidth ?? 16)
  const labelStyle = options.labelStyle ?? (value => value)
  const labelWidth = Math.max(...fields.map(field => stringWidth(`${field.label}:`)))
  const inlineValueWidth = width - indent - labelWidth - gap

  if (inlineValueWidth < minValueWidth) {
    return fields.flatMap(field => [
      `${' '.repeat(indent)}${labelStyle(`${field.label}:`)}`,
      ...renderHumanWrapped(field.value, {
        indent: ' '.repeat(Math.min(width - 1, indent + 2)),
        width,
      }),
    ])
  }

  const prefix = ' '.repeat(indent)
  const valuePrefix = ' '.repeat(indent + labelWidth + gap)
  const valueWidth = Math.max(1, width - stringWidth(valuePrefix))

  return fields.flatMap(field => {
    const label = alignCell(labelStyle(`${field.label}:`), labelWidth)
    const valueLines = wrapAnsi(field.value, valueWidth, { hard: true }).split('\n')
    return valueLines.map((line, index) =>
      index === 0 ? `${prefix}${label}${' '.repeat(gap)}${line}` : `${valuePrefix}${line}`,
    )
  })
}

export function renderHumanWrapped(value: string, options: HumanWrapOptions = {}): string[] {
  const width = getHumanTerminalWidth(options.width)
  const indent = options.indent ?? ''
  const continuationIndent = options.continuationIndent ?? indent
  const firstWidth = Math.max(1, width - stringWidth(indent))
  const continuationWidth = Math.max(1, width - stringWidth(continuationIndent))
  const paragraphs = value.split('\n')
  const output: string[] = []

  for (const paragraph of paragraphs) {
    const firstPass = wrapAnsi(paragraph, firstWidth, { hard: true }).split('\n')
    const firstLine = firstPass.shift() ?? ''
    output.push(`${indent}${firstLine}`)

    const remainder = firstPass.join(' ')
    if (!remainder) continue
    for (const line of wrapAnsi(remainder, continuationWidth, { hard: true }).split('\n')) {
      output.push(`${continuationIndent}${line}`)
    }
  }

  return output
}

function selectVisibleColumns<Row>(
  columns: readonly HumanTableColumn<Row>[],
  widths: readonly number[],
  availableWidth: number,
  gap: number,
): number[] {
  const visible = columns.map((_column, index) => index)
  const optionalIndexes = columns
    .map((column, index) => ({ index, optional: column.optional, priority: column.priority ?? 0 }))
    .filter(candidate => candidate.optional)
    .sort((left, right) => left.priority - right.priority || right.index - left.index)

  for (const candidate of optionalIndexes) {
    if (tableWidth(visible, widths, gap) <= availableWidth) break
    visible.splice(visible.indexOf(candidate.index), 1)
  }

  return visible
}

function getNaturalColumnWidth<Row>(rows: readonly Row[], column: HumanTableColumn<Row>): number {
  const naturalWidth = Math.max(stringWidth(column.header), ...rows.map(row => stringWidth(column.value(row))))
  return column.maxWidth === undefined ? naturalWidth : Math.min(naturalWidth, column.maxWidth)
}

function tableWidth(indexes: readonly number[], widths: readonly number[], gap: number): number {
  return indexes.reduce((total, index) => total + widths[index]!, 0) + gap * Math.max(0, indexes.length - 1)
}

function fitColumnWidths<Row>(
  columns: readonly HumanTableColumn<Row>[],
  naturalWidths: readonly number[],
  availableWidth: number,
): number[] {
  const widths = [...naturalWidths]
  const minimums = columns.map((column, index) =>
    Math.max(1, Math.min(widths[index]!, column.minWidth ?? Math.min(stringWidth(column.header), 8))),
  )
  let overflow = widths.reduce((total, width) => total + width, 0) - availableWidth

  while (overflow > 0) {
    let candidate = -1
    let reducible = 0
    for (let index = 0; index < widths.length; index += 1) {
      const currentReducible = widths[index]! - minimums[index]!
      if (currentReducible > reducible) {
        candidate = index
        reducible = currentReducible
      }
    }

    if (candidate === -1) break
    widths[candidate] -= 1
    overflow -= 1
  }

  while (overflow > 0) {
    const candidate = widths.reduce(
      (widest, current, index) => (current > widths[widest]! && current > 1 ? index : widest),
      0,
    )
    if (widths[candidate] === 1) break
    widths[candidate] -= 1
    overflow -= 1
  }

  return widths
}

function alignCell(value: string, width: number, align: 'left' | 'right' = 'left'): string {
  const bounded = truncateVisible(value, width)
  const padding = ' '.repeat(Math.max(0, width - stringWidth(bounded)))
  return align === 'right' ? `${padding}${bounded}` : `${bounded}${padding}`
}

function truncateVisible(value: string, width: number): string {
  if (stringWidth(value) <= width) return value
  if (width <= 1) return '…'
  return `${sliceAnsi(value, 0, width - 1)}…`
}
