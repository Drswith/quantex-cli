import type { Colors } from 'picocolors/types'
import { createColors, isColorSupported } from 'picocolors'
import { getCliContext } from '../cli-context'

function getColors(): Colors {
  const mode = getCliContext().colorMode ?? 'auto'
  return createColors(mode === 'always' ? true : mode === 'never' ? false : isColorSupported)
}

export const pc = new Proxy({} as Colors, {
  get(_target, property) {
    const colors = getColors()
    const value = colors[property as keyof Colors]
    return typeof value === 'function' ? value.bind(colors) : value
  },
})
