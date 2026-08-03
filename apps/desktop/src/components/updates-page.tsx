import type { DesktopSnapshot } from '../lib/types'
import { RefreshCw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { AgentTable } from './agent-table'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card'

export function UpdatesPage({
  busy,
  onApply,
  onCancel,
  onRefresh,
  snapshot,
}: {
  busy: boolean
  onApply: (names: string[]) => void
  onCancel: () => void
  onRefresh: () => void
  snapshot: DesktopSnapshot
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const selectedNames = useMemo(() => [...selected], [selected])
  const updateCount = snapshot.results.filter(result => result.status === 'planned').length

  return (
    <Card>
      <CardHeader>
        <CardTitle>Managed updates</CardTitle>
        <CardDescription>
          {snapshot.checkedAt
            ? `Last checked ${new Date(snapshot.checkedAt).toLocaleString()}`
            : 'No update check has completed yet.'}
        </CardDescription>
        <Badge variant={updateCount > 0 ? 'default' : 'secondary'}>{updateCount} available</Badge>
      </CardHeader>
      <CardContent>
        <AgentTable onSelectedChange={setSelected} results={snapshot.results} selected={selected} />
      </CardContent>
      <CardFooter className="justify-between gap-2">
        <p className="text-sm text-muted-foreground">Background checks never install updates.</p>
        <div className="flex gap-2">
          {busy ? (
            <Button onClick={onCancel} variant="outline">
              Cancel
            </Button>
          ) : null}
          <Button disabled={busy} onClick={onRefresh} variant="outline">
            <RefreshCw data-icon="inline-start" /> Check now
          </Button>
          <Button disabled={busy || selectedNames.length === 0} onClick={() => onApply(selectedNames)}>
            Update selected ({selectedNames.length})
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}
