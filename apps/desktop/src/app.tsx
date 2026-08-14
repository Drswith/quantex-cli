import type {
  AgentDetails,
  AgentSummary,
  AppearancePreference,
  DesktopPreferences,
  DesktopSnapshot,
  DiagnosticsSnapshot,
  LifecycleAction,
  LifecycleExecution,
  QuantexConfig,
} from './lib/types'
import { setTheme as setNativeTheme } from '@tauri-apps/api/app'
import { useEffect, useState } from 'react'
import { ActivityPage } from './components/activity-page'
import { AgentsPage } from './components/agents-page'
import { AppSidebar, type DesktopPage } from './components/app-sidebar'
import { DiagnosticsPage } from './components/diagnostics-page'
import { OverviewPage } from './components/overview-page'
import { SettingsPage } from './components/settings-page'
import { SiteHeader } from './components/site-header'
import { Alert, AlertDescription, AlertTitle } from './components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './components/ui/alert-dialog'
import { SidebarInset, SidebarProvider } from './components/ui/sidebar'
import { TooltipProvider } from './components/ui/tooltip'
import { UpdatesPage } from './components/updates-page'
import { desktopClient, isBrowserPreview } from './lib/desktop-client'
import { observeAppearance } from './lib/theme'

const initialPreferences: DesktopPreferences = {
  appearance: 'system',
  checkFrequency: 'daily',
  launchAtLogin: false,
  notificationsEnabled: true,
}

interface Confirmation {
  action: LifecycleAction | 'update-batch'
  names: string[]
}

const pageTitles: Record<DesktopPage, string> = {
  activity: 'Activity',
  agents: 'Agents',
  diagnostics: 'Diagnostics',
  overview: 'Overview',
  settings: 'Settings',
  updates: 'Updates',
}

export function App() {
  const [activePage, setActivePage] = useState<DesktopPage>('overview')
  const [activity, setActivity] = useState<LifecycleExecution[]>([])
  const [agents, setAgents] = useState<AgentSummary[]>([])
  const [busy, setBusy] = useState(false)
  const [confirmation, setConfirmation] = useState<Confirmation>()
  const [config, setConfig] = useState<QuantexConfig>()
  const [details, setDetails] = useState<AgentDetails>()
  const [diagnostics, setDiagnostics] = useState<DiagnosticsSnapshot>()
  const [message, setMessage] = useState<string>()
  const [openAgent, setOpenAgent] = useState<string>()
  const [preferences, setPreferences] = useState(initialPreferences)
  const [snapshot, setSnapshot] = useState<DesktopSnapshot>({ results: [] })

  const loadAgents = async () => setAgents(await desktopClient.getAgents())
  const loadDiagnostics = async () => setDiagnostics(await desktopClient.getDiagnostics())

  useEffect(() => {
    void Promise.all([
      desktopClient.getAgents(),
      desktopClient.getPreferences(),
      desktopClient.getQuantexConfig(),
      desktopClient.getSnapshot(),
    ])
      .then(([nextAgents, nextPreferences, nextConfig, nextSnapshot]) => {
        setAgents(nextAgents)
        setPreferences(nextPreferences)
        setConfig(nextConfig)
        setSnapshot(nextSnapshot)
        return undefined
      })
      .catch(error => setMessage(error instanceof Error ? error.message : 'Unable to load Quantex Desktop.'))
  }, [])

  useEffect(() => {
    const stopObserving = observeAppearance(preferences.appearance)
    if (!isBrowserPreview) {
      void setNativeTheme(preferences.appearance === 'system' ? null : preferences.appearance).catch(() => undefined)
    }
    return stopObserving
  }, [preferences.appearance])

  useEffect(() => {
    if (activePage === 'diagnostics' && !diagnostics) void loadDiagnostics()
  }, [activePage, diagnostics])

  const selectAgent = async (name?: string) => {
    setOpenAgent(name)
    setDetails(undefined)
    if (!name) return
    try {
      setDetails(await desktopClient.getAgent(name))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to inspect agent.')
    }
  }

  const executeLifecycle = async (action: LifecycleAction, name: string) => {
    if (action === 'uninstall' || action === 'update') {
      setConfirmation({ action, names: [name] })
      return
    }
    await runLifecycle(action, name)
  }

  const runLifecycle = async (action: LifecycleAction, name: string) => {
    setBusy(true)
    setMessage(undefined)
    try {
      const execution = await desktopClient.runLifecycleAction(action, name)
      setActivity(current => [execution, ...current])
      setMessage(execution.message)
      await loadAgents()
      if (openAgent === name) setDetails(await desktopClient.getAgent(name))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `Unable to ${action} ${name}.`)
    } finally {
      setBusy(false)
    }
  }

  const openTerminal = async (name: string) => {
    try {
      const execution = await desktopClient.openAgentTerminal(name)
      setActivity(current => [execution, ...current])
      setMessage('Opened the agent in Terminal.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to open Terminal.')
    }
  }

  const refreshUpdates = async () => {
    setBusy(true)
    try {
      setSnapshot(await desktopClient.refreshUpdates())
      setMessage('Managed update check completed.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to check updates.')
    } finally {
      setBusy(false)
    }
  }

  const applyUpdates = async (names: string[]) => {
    setConfirmation(undefined)
    setBusy(true)
    try {
      const executions = await desktopClient.applyUpdates(names)
      const timestamp = new Date().toISOString()
      const entries: LifecycleExecution[] = executions.map(execution => ({
        action: 'update',
        changed: !execution.error,
        error: execution.error,
        message: execution.error ?? `${execution.name}: update completed.`,
        name: execution.name,
        ok: !execution.error,
        timestamp,
      }))
      setActivity(current => [...entries, ...current])
      setSnapshot(await desktopClient.getSnapshot())
      await loadAgents()
      setMessage(
        executions.some(execution => execution.error) ? 'Some updates need attention.' : 'Selected updates completed.',
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to apply updates.')
    } finally {
      setBusy(false)
    }
  }

  const saveConfig = async (next: QuantexConfig) => {
    setBusy(true)
    try {
      let saved = config
      for (const key of Object.keys(next) as Array<keyof QuantexConfig>) {
        if (next[key] === config?.[key] || next[key] === undefined) continue
        saved = await desktopClient.setQuantexConfig(key, next[key] as number | string)
      }
      setConfig(saved ?? next)
      setMessage('Quantex configuration saved.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save Quantex configuration.')
    } finally {
      setBusy(false)
    }
  }

  const savePreferences = async (next: DesktopPreferences) => {
    const previous = preferences
    setPreferences(next)
    try {
      setPreferences(await desktopClient.updatePreferences(next))
    } catch (error) {
      setPreferences(previous)
      setMessage(error instanceof Error ? error.message : 'Unable to save Desktop preferences.')
    }
  }

  const setAppearance = (appearance: AppearancePreference) => {
    void savePreferences({ ...preferences, appearance })
  }

  const content = (() => {
    switch (activePage) {
      case 'overview':
        return <OverviewPage agents={agents} onNavigateToUpdates={() => setActivePage('updates')} snapshot={snapshot} />
      case 'agents':
        return (
          <AgentsPage
            agents={agents}
            busy={busy}
            details={details}
            onAction={(action, name) => void executeLifecycle(action, name)}
            onOpenAgent={name => void selectAgent(name)}
            onRefresh={() => void loadAgents()}
            onRun={name => void openTerminal(name)}
            openAgent={openAgent}
          />
        )
      case 'updates':
        return (
          <UpdatesPage
            busy={busy}
            onApply={names => setConfirmation({ action: 'update-batch', names })}
            onCancel={() => void desktopClient.cancelUpdates()}
            onRefresh={() => void refreshUpdates()}
            snapshot={snapshot}
          />
        )
      case 'diagnostics':
        return <DiagnosticsPage busy={busy} diagnostics={diagnostics} onRefresh={() => void loadDiagnostics()} />
      case 'activity':
        return <ActivityPage activity={activity} />
      case 'settings':
        return (
          <SettingsPage
            busy={busy}
            config={config}
            onPreferencesChange={next => void savePreferences(next)}
            onResetConfig={() => void desktopClient.resetQuantexConfig().then(setConfig)}
            onSaveConfig={next => void saveConfig(next)}
            preferences={preferences}
          />
        )
    }
  })()

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar activePage={activePage} browserPreview={isBrowserPreview} onNavigate={setActivePage} />
        <SidebarInset>
          <SiteHeader
            appearance={preferences.appearance}
            browserPreview={isBrowserPreview}
            onAppearanceChange={setAppearance}
            title={pageTitles[activePage]}
          />
          <main className="grid gap-4 p-6">
            {message ? (
              <Alert>
                <AlertTitle>Quantex Desktop</AlertTitle>
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            ) : null}
            {content}
          </main>
        </SidebarInset>
      </SidebarProvider>

      <AlertDialog onOpenChange={open => !open && setConfirmation(undefined)} open={Boolean(confirmation)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmation?.action === 'uninstall'
                ? 'Uninstall this agent?'
                : confirmation?.action === 'update'
                  ? 'Update this agent?'
                  : 'Update selected agents?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmation?.action === 'uninstall'
                ? 'Quantex will verify the recorded source before removing the managed installation.'
                : confirmation?.action === 'update'
                  ? 'Quantex will re-check the installed source and available version before updating.'
                  : `Quantex will re-check and update ${confirmation?.names.length ?? 0} agents one at a time.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!confirmation) return
                if (confirmation.action === 'update-batch') void applyUpdates(confirmation.names)
                else void runLifecycle(confirmation.action, confirmation.names[0]!)
                setConfirmation(undefined)
              }}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  )
}
