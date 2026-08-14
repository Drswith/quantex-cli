import { describe, expect, it, vi } from 'vitest'
import { observeAppearance, resolveAppearance } from './theme'

function createRoot() {
  let dark = false
  return {
    root: {
      classList: {
        toggle: (_token: string, force?: boolean) => {
          dark = Boolean(force)
          return dark
        },
      },
      style: { colorScheme: '' },
    },
    isDark: () => dark,
  }
}

function createSystemAppearance(matches: boolean) {
  let listener: (() => void) | undefined
  return {
    query: {
      addEventListener: vi.fn((_type: 'change', next: () => void) => {
        listener = next
      }),
      matches,
      removeEventListener: vi.fn((_type: 'change', next: () => void) => {
        if (listener === next) listener = undefined
      }),
    },
    setDark(value: boolean) {
      this.query.matches = value
      listener?.()
    },
  }
}

describe('desktop appearance', () => {
  it('resolves fixed and automatic appearance modes', () => {
    expect(resolveAppearance('light', true)).toBe('light')
    expect(resolveAppearance('dark', false)).toBe('dark')
    expect(resolveAppearance('system', false)).toBe('light')
    expect(resolveAppearance('system', true)).toBe('dark')
  })

  it('observes system changes only in automatic mode', () => {
    const { root, isDark } = createRoot()
    const system = createSystemAppearance(false)
    const stop = observeAppearance('system', root, system.query)

    expect(isDark()).toBe(false)
    expect(root.style.colorScheme).toBe('light')
    expect(system.query.addEventListener).toHaveBeenCalledOnce()

    system.setDark(true)
    expect(isDark()).toBe(true)
    expect(root.style.colorScheme).toBe('dark')

    stop()
    expect(system.query.removeEventListener).toHaveBeenCalledOnce()
  })

  it('keeps a fixed mode independent from system changes', () => {
    const { root, isDark } = createRoot()
    const system = createSystemAppearance(false)
    observeAppearance('dark', root, system.query)

    system.setDark(false)
    expect(isDark()).toBe(true)
    expect(root.style.colorScheme).toBe('dark')
    expect(system.query.addEventListener).not.toHaveBeenCalled()
  })
})
