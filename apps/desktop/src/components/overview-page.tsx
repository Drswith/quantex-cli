import type { AgentSummary, DesktopSnapshot } from '../lib/types'
import { ArrowRight, Bot, CircleCheck, RefreshCw, ShieldCheck } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from './ui/chart'

const chartConfig = {
  count: { color: 'var(--chart-1)', label: 'Agents' },
} satisfies ChartConfig

export function OverviewPage({
  agents,
  onNavigateToUpdates,
  snapshot,
}: {
  agents: AgentSummary[]
  onNavigateToUpdates: () => void
  snapshot: DesktopSnapshot
}) {
  const installed = agents.filter(agent => agent.installed).length
  const managed = agents.filter(agent => agent.lifecycle === 'managed').length
  const updates = snapshot.results.filter(result => result.status === 'planned').length
  const attention = snapshot.results.filter(result =>
    ['failed', 'locked', 'manual-required'].includes(result.status),
  ).length
  const chartData = [
    { count: managed, state: 'Managed' },
    { count: installed - managed, state: 'Detected' },
    { count: agents.length - installed, state: 'Not installed' },
    { count: updates, state: 'Updates' },
  ]

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard description="Supported agents" icon={Bot} title={String(agents.length)} />
        <MetricCard description="Installed on this Mac" icon={CircleCheck} title={String(installed)} />
        <MetricCard description="Tracked by Quantex" icon={ShieldCheck} title={String(managed)} />
        <MetricCard description="Ready for confirmation" icon={RefreshCw} title={String(updates)} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card>
          <CardHeader>
            <CardTitle>Agent inventory</CardTitle>
            <CardDescription>Current lifecycle state reported by Quantex.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig}>
              <BarChart accessibilityLayer data={chartData}>
                <CartesianGrid vertical={false} />
                <XAxis axisLine={false} dataKey="state" tickLine={false} />
                <ChartTooltip content={<ChartTooltipContent hideLabel />} cursor={false} />
                <Bar dataKey="count" fill="var(--color-count)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Update status</CardTitle>
            <CardDescription>
              {snapshot.checkedAt ? `Checked ${new Date(snapshot.checkedAt).toLocaleString()}` : 'Not checked yet'}
            </CardDescription>
            <CardAction>
              <Badge variant={attention > 0 ? 'destructive' : 'secondary'}>{attention} need attention</Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div>
              <div className="text-2xl font-semibold">{updates}</div>
              <p className="text-sm text-muted-foreground">Managed updates available</p>
            </div>
            <Button onClick={onNavigateToUpdates} variant="outline">
              Review updates <ArrowRight data-icon="inline-end" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function MetricCard({ description, icon: Icon, title }: { description: string; icon: typeof Bot; title: string }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{description}</CardDescription>
        <CardTitle className="text-2xl">{title}</CardTitle>
        <CardAction>
          <Icon />
        </CardAction>
      </CardHeader>
    </Card>
  )
}
