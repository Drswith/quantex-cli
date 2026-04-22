export function parseDurationToMs(input: string): number | undefined {
  const value = input.trim()
  const match = value.match(/^(\d+)(ms|[smh])?$/)

  if (!match)
    return undefined

  const amount = Number.parseInt(match[1], 10)
  const unit = match[2] ?? 'ms'

  if (!Number.isFinite(amount))
    return undefined

  switch (unit) {
    case 'ms':
      return amount
    case 's':
      return amount * 1000
    case 'm':
      return amount * 60 * 1000
    case 'h':
      return amount * 60 * 60 * 1000
    default:
      return undefined
  }
}
