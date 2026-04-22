import { describe, expect, it } from 'vitest'
import { parseDurationToMs } from '../../src/utils/duration'

describe('parseDurationToMs', () => {
  it('parses milliseconds by default', () => {
    expect(parseDurationToMs('500')).toBe(500)
  })

  it('parses supported duration suffixes', () => {
    expect(parseDurationToMs('250ms')).toBe(250)
    expect(parseDurationToMs('30s')).toBe(30000)
    expect(parseDurationToMs('5m')).toBe(300000)
    expect(parseDurationToMs('2h')).toBe(7200000)
  })

  it('rejects invalid duration values', () => {
    expect(parseDurationToMs('1.5s')).toBeUndefined()
    expect(parseDurationToMs('ten seconds')).toBeUndefined()
  })
})
