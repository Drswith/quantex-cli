import type { UpdateResultItem } from '../lib/types'
import { CheckCircle2, CircleAlert, Download, LockKeyhole, RefreshCw } from 'lucide-react'
import { Checkbox } from './ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table'

const statusLabel: Record<UpdateResultItem['status'], string> = {
  failed: 'Check failed',
  locked: 'Busy',
  'manual-required': 'Manual action',
  planned: 'Update available',
  'up-to-date': 'Up to date',
  updated: 'Updated',
}

function StatusIcon({ status }: { status: UpdateResultItem['status'] }) {
  if (status === 'planned') return <Download className="size-4" />
  if (status === 'up-to-date' || status === 'updated') return <CheckCircle2 className="size-4" />
  if (status === 'locked') return <LockKeyhole className="size-4" />
  return <CircleAlert className="size-4" />
}

export function AgentTable({
  selected,
  results,
  onSelectedChange,
}: {
  results: UpdateResultItem[]
  selected: Set<string>
  onSelectedChange: (next: Set<string>) => void
}) {
  const selectable = results.filter(result => result.status === 'planned')
  const allSelected = selectable.length > 0 && selectable.every(result => selected.has(result.name))
  const toggleAll = (checked: boolean) =>
    onSelectedChange(new Set(checked ? selectable.map(result => result.name) : []))

  if (results.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">No managed agents have been checked yet.</p>
  }

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                aria-label="Select all available updates"
                checked={allSelected}
                onCheckedChange={checked => toggleAll(Boolean(checked))}
              />
            </TableHead>
            <TableHead>Agent</TableHead>
            <TableHead>Installed</TableHead>
            <TableHead>Available</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {results.map(result => {
            const selectableResult = result.status === 'planned'
            return (
              <TableRow key={result.name}>
                <TableCell>
                  <Checkbox
                    aria-label={`Select ${result.displayName}`}
                    checked={selected.has(result.name)}
                    disabled={!selectableResult}
                    onCheckedChange={checked => {
                      const next = new Set(selected)
                      if (checked) next.add(result.name)
                      else next.delete(result.name)
                      onSelectedChange(next)
                    }}
                  />
                </TableCell>
                <TableCell className="font-medium">{result.displayName}</TableCell>
                <TableCell className="font-mono text-xs">{result.installedVersion ?? 'Unknown'}</TableCell>
                <TableCell className="font-mono text-xs">{result.latestVersion ?? '—'}</TableCell>
                <TableCell className="text-muted-foreground">{result.strategy ?? '—'}</TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-2" title={result.hint ?? result.message}>
                    <StatusIcon status={result.status} />
                    {statusLabel[result.status]}
                  </span>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <RefreshCw className="size-3" />
        Planned updates are only executed after confirmation.
      </div>
    </div>
  )
}
