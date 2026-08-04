import type { DesktopPreferences, DesktopSnapshot, UpdateExecution } from './lib/types'
import { RefreshCw, Settings2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { AgentTable } from './components/agent-table'
import { SettingsPanel } from './components/settings-panel'
import { Badge } from './components/ui/badge'
import { Button } from './components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './components/ui/card'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './components/ui/dialog'
import { desktopClient, isBrowserPreview } from './lib/desktop-client'

const initialPreferences: DesktopPreferences = {
  checkFrequency: 'daily',
  launchAtLogin: false,
  notificationsEnabled: true,
}

export function App() {
  const [preferences, setPreferences] = useState(initialPreferences)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [snapshot, setSnapshot] = useState<DesktopSnapshot>({ results: [] })
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string>()

  const updateCount = useMemo(
    () => snapshot.results.filter(result => result.status === 'planned').length,
    [snapshot.results],
  )
  const selectedNames = useMemo(() => [...selected], [selected])
  const selectedResults = useMemo(
    () => snapshot.results.filter(result => selected.has(result.name)),
    [selected, snapshot.results],
  )

  const refresh = async () => {
    setBusy(true)
    setMessage(undefined)
    try {
      setSnapshot(await desktopClient.refreshUpdates())
      setSelected(new Set())
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to refresh updates.')
    } finally {
      setBusy(false)
    }
  }

  const savePreferences = async (next: DesktopPreferences) => {
    setPreferences(next)
    try {
      setPreferences(await desktopClient.updatePreferences(next))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save preferences.')
    }
  }

  const apply = async () => {
    setConfirmOpen(false)
    setBusy(true)
    try {
      const executions = await desktopClient.applyUpdates(selectedNames)
      const failures = executions.filter((execution: UpdateExecution) => execution.error)
      setMessage(
        failures.length === 0
          ? 'Selected updates completed.'
          : `${failures.length} update${failures.length === 1 ? '' : 's'} need attention.`,
      )
      setSelected(new Set())
      setSnapshot(await desktopClient.getSnapshot())
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to apply updates.')
    } finally {
      setBusy(false)
    }
  }

  const cancel = async () => {
    try {
      await desktopClient.cancelUpdates()
      setMessage('Cancelling the current update. Remaining updates will not start.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to cancel the current update.')
    }
  }

  useEffect(() => {
    void Promise.all([desktopClient.getPreferences(), desktopClient.getSnapshot()])
      .then(([loadedPreferences, nextSnapshot]) => {
        setPreferences(loadedPreferences)
        setSnapshot(nextSnapshot)
        return undefined
      })
      .catch(() => setMessage('Open Quantex Desktop after its bundled CLI has been prepared.'))
  }, [])

  return (
    <main className="min-h-screen">
      <div className="container mx-auto max-w-7xl px-6 py-10">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">Quantex Desktop</h1>
              {isBrowserPreview ? <Badge variant="secondary">Browser preview · mock data</Badge> : null}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Review managed agent updates. Every update requires confirmation.
            </p>
          </div>
          <div className="flex gap-2">
            {busy ? (
              <Button onClick={() => void cancel()} variant="ghost">
                Cancel task
              </Button>
            ) : null}
            <Button disabled={busy} onClick={() => setSettingsOpen(open => !open)} variant="ghost">
              <Settings2 data-icon="inline-start" /> Settings
            </Button>
            <Button disabled={busy} onClick={() => void refresh()} variant="outline">
              <RefreshCw data-icon="inline-start" /> Refresh
            </Button>
          </div>
        </header>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Card>
            <CardHeader>
              <CardTitle>Update inventory</CardTitle>
              <CardDescription>
                {snapshot.checkedAt
                  ? `Last checked ${new Date(snapshot.checkedAt).toLocaleString()}`
                  : 'Not checked yet'}
              </CardDescription>
              <CardAction>
                <Badge variant={updateCount > 0 ? 'default' : 'secondary'}>{updateCount} available</Badge>
              </CardAction>
            </CardHeader>
            <CardContent>
              <AgentTable onSelectedChange={setSelected} results={snapshot.results} selected={selected} />
            </CardContent>
            <CardFooter>
              <div className="flex w-full items-center justify-between gap-4">
                <p className="text-sm text-muted-foreground">{message ?? snapshot.error}</p>
                <Button disabled={busy || selectedNames.length === 0} onClick={() => setConfirmOpen(true)}>
                  Update selected ({selectedNames.length})
                </Button>
              </div>
            </CardFooter>
          </Card>
          {settingsOpen ? (
            <div className="self-start">
              <SettingsPanel
                onChange={nextPreferences => void savePreferences(nextPreferences)}
                preferences={preferences}
              />
            </div>
          ) : null}
        </div>
      </div>

      <Dialog onOpenChange={setConfirmOpen} open={confirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm updates</DialogTitle>
            <DialogDescription>
              Quantex will re-check and update {selectedNames.length} selected managed agent
              {selectedNames.length === 1 ? '' : 's'} one at a time.
            </DialogDescription>
          </DialogHeader>
          <ul className="grid gap-2 text-sm">
            {selectedResults.map(result => (
              <li className="flex items-center justify-between gap-4" key={result.name}>
                <span>{result.displayName}</span>
                <span className="font-mono text-muted-foreground">
                  {result.installedVersion ?? 'Unknown'} → {result.latestVersion ?? 'Latest'}
                </span>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={() => void apply()}>Update {selectedNames.length} agents</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
