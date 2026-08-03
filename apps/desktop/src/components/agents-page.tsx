import type { AgentDetails, AgentSummary, LifecycleAction } from '../lib/types'
import { MoreHorizontal, Play, RefreshCw, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { Input } from './ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Separator } from './ui/separator'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from './ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table'

type Filter = 'all' | 'installed' | 'managed' | 'not-installed'

function stateBadge(agent: AgentSummary) {
  if (!agent.installed) return <Badge variant="outline">Not installed</Badge>
  if (agent.lifecycle === 'managed') return <Badge>Managed</Badge>
  return <Badge variant="secondary">Detected</Badge>
}

export function AgentsPage({
  agents,
  busy,
  details,
  onAction,
  onOpenAgent,
  onRefresh,
  onRun,
  openAgent,
}: {
  agents: AgentSummary[]
  busy: boolean
  details?: AgentDetails
  onAction: (action: LifecycleAction, name: string) => void
  onOpenAgent: (name?: string) => void
  onRefresh: () => void
  onRun: (name: string) => void
  openAgent?: string
}) {
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const filtered = useMemo(
    () =>
      agents.filter(agent => {
        const matchesQuery = `${agent.displayName} ${agent.name}`.toLowerCase().includes(query.toLowerCase())
        const matchesFilter =
          filter === 'all' ||
          (filter === 'installed' && agent.installed) ||
          (filter === 'managed' && agent.lifecycle === 'managed') ||
          (filter === 'not-installed' && !agent.installed)
        return matchesQuery && matchesFilter
      }),
    [agents, filter, query],
  )

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Agents</CardTitle>
          <CardDescription>Browse, inspect, install, update, run, and uninstall supported agents.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                aria-label="Search agents"
                className="pl-8"
                onChange={event => setQuery(event.target.value)}
                placeholder="Search agents"
                value={query}
              />
            </div>
            <Select onValueChange={value => setFilter(value as Filter)} value={filter}>
              <SelectTrigger aria-label="Filter agents">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All agents</SelectItem>
                <SelectItem value="installed">Installed</SelectItem>
                <SelectItem value="managed">Managed</SelectItem>
                <SelectItem value="not-installed">Not installed</SelectItem>
              </SelectContent>
            </Select>
            <Button disabled={busy} onClick={onRefresh} variant="outline">
              <RefreshCw data-icon="inline-start" /> Refresh
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Source</TableHead>
                <TableHead aria-label="Actions" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(agent => (
                <TableRow key={agent.name} onClick={() => onOpenAgent(agent.name)}>
                  <TableCell>
                    <div className="font-medium">{agent.displayName}</div>
                    <div className="text-muted-foreground">{agent.name}</div>
                  </TableCell>
                  <TableCell>{stateBadge(agent)}</TableCell>
                  <TableCell>{agent.installedVersion ?? '—'}</TableCell>
                  <TableCell>{agent.installed ? agent.sourceLabel : '—'}</TableCell>
                  <TableCell onClick={event => event.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button aria-label={`Actions for ${agent.displayName}`} variant="ghost">
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onOpenAgent(agent.name)}>View details</DropdownMenuItem>
                        {agent.installed ? (
                          <DropdownMenuItem onClick={() => onRun(agent.name)}>
                            <Play /> Open in Terminal
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => onAction('install', agent.name)}>Install</DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onAction('ensure', agent.name)}>
                          Ensure available
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet onOpenChange={open => !open && onOpenAgent()} open={Boolean(openAgent)}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{details?.agent.displayName ?? 'Agent details'}</SheetTitle>
            <SheetDescription>{details?.agent.name ?? 'Loading agent status…'}</SheetDescription>
          </SheetHeader>
          {details ? (
            <div className="grid gap-6 px-4">
              <div className="flex flex-wrap gap-2">
                {details.inspection.installed ? (
                  <Badge>Installed</Badge>
                ) : (
                  <Badge variant="outline">Not installed</Badge>
                )}
                <Badge variant="secondary">{details.inspection.lifecycle}</Badge>
              </div>
              <div className="grid gap-3 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Installed version</span>
                  <span>{details.inspection.installedVersion ?? '—'}</span>
                </div>
                <Separator />
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Latest version</span>
                  <span>{details.inspection.latestVersion ?? 'Unknown'}</span>
                </div>
                <Separator />
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Binary</span>
                  <span>{details.agent.binaryName}</span>
                </div>
                <Separator />
                <div className="grid gap-1">
                  <span className="text-muted-foreground">Path</span>
                  <span className="break-all">{details.inspection.binaryPath ?? 'Not available'}</span>
                </div>
              </div>
              <div className="grid gap-3">
                <h3 className="font-medium">Install methods</h3>
                {details.agent.installMethods.map(method => (
                  <Card key={`${method.type}-${method.command}`}>
                    <CardHeader>
                      <CardTitle>{method.label}</CardTitle>
                      <CardDescription className="break-all">{method.command}</CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </div>
          ) : null}
          <SheetFooter>
            {details?.inspection.installed ? (
              <>
                <Button disabled={busy} onClick={() => onRun(details.agent.name)} variant="outline">
                  <Play data-icon="inline-start" /> Open in Terminal
                </Button>
                <Button disabled={busy} onClick={() => onAction('update', details.agent.name)}>
                  Update
                </Button>
                {details.capabilities.canAutoUninstall ? (
                  <Button
                    disabled={busy}
                    onClick={() => onAction('uninstall', details.agent.name)}
                    variant="destructive"
                  >
                    Uninstall
                  </Button>
                ) : null}
              </>
            ) : (
              <Button disabled={busy || !details} onClick={() => details && onAction('install', details.agent.name)}>
                Install
              </Button>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}
