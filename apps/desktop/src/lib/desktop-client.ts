import type { DesktopPreferences, DesktopSnapshot, UpdateExecution } from './types'
import { invoke } from '@tauri-apps/api/core'
import { mockDesktopClient } from './mock-desktop-client'

export interface DesktopClient {
  applyUpdates: (names: string[]) => Promise<UpdateExecution[]>
  cancelUpdates: () => Promise<boolean>
  getPreferences: () => Promise<DesktopPreferences>
  getSnapshot: () => Promise<DesktopSnapshot>
  refreshUpdates: () => Promise<DesktopSnapshot>
  updatePreferences: (preferences: DesktopPreferences) => Promise<DesktopPreferences>
}

const tauriDesktopClient: DesktopClient = {
  applyUpdates: (names: string[]) => invoke<UpdateExecution[]>('apply_updates', { names }),
  cancelUpdates: () => invoke<boolean>('cancel_updates'),
  getPreferences: () => invoke<DesktopPreferences>('get_preferences'),
  getSnapshot: () => invoke<DesktopSnapshot>('get_snapshot'),
  refreshUpdates: () => invoke<DesktopSnapshot>('refresh_updates'),
  updatePreferences: (preferences: DesktopPreferences) =>
    invoke<DesktopPreferences>('update_preferences', { preferences }),
}

export const isBrowserPreview = typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)
export const desktopClient = isBrowserPreview ? mockDesktopClient : tauriDesktopClient
