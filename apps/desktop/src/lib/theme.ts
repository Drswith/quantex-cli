import type { AppearancePreference } from './types'

export type ResolvedAppearance = Exclude<AppearancePreference, 'system'>

interface ThemeRoot {
  classList: { toggle: (token: string, force?: boolean) => boolean }
  style: { colorScheme: string }
}

interface SystemAppearanceQuery {
  addEventListener: (type: 'change', listener: () => void) => void
  matches: boolean
  removeEventListener: (type: 'change', listener: () => void) => void
}

export function resolveAppearance(appearance: AppearancePreference, systemPrefersDark: boolean): ResolvedAppearance {
  if (appearance === 'system') return systemPrefersDark ? 'dark' : 'light'
  return appearance
}

export function applyResolvedAppearance(appearance: ResolvedAppearance, root: ThemeRoot) {
  root.classList.toggle('dark', appearance === 'dark')
  root.style.colorScheme = appearance
}

export function observeAppearance(
  appearance: AppearancePreference,
  root: ThemeRoot = document.documentElement,
  systemAppearance: SystemAppearanceQuery = window.matchMedia('(prefers-color-scheme: dark)'),
) {
  const apply = () => applyResolvedAppearance(resolveAppearance(appearance, systemAppearance.matches), root)
  apply()

  if (appearance !== 'system') return () => undefined

  systemAppearance.addEventListener('change', apply)
  return () => systemAppearance.removeEventListener('change', apply)
}
