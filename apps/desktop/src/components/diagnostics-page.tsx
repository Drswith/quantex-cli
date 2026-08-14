import type { DiagnosticsSnapshot } from '../lib/types'
import { AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from './ui/alert'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table'

export function DiagnosticsPage({
  busy,
  diagnostics,
  onRefresh,
}: {
  busy: boolean
  diagnostics?: DiagnosticsSnapshot
  onRefresh: () => void
}) {
  const available = Object.values(diagnostics?.installers ?? {}).filter(value => value.available).length

  return (
    <div className="grid gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Diagnostics</h2>
          <p className="text-sm text-muted-foreground">Environment health reported by the bundled Quantex CLI.</p>
        </div>
        <Button disabled={busy} onClick={onRefresh} variant="outline">
          <RefreshCw data-icon="inline-start" /> Run diagnostics
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Platform</CardDescription>
            <CardTitle>{diagnostics ? `${diagnostics.platform.os} / ${diagnostics.platform.arch}` : '—'}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Quantex sidecar</CardDescription>
            <CardTitle>{diagnostics?.self.currentVersion ?? '—'}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Available installers</CardDescription>
            <CardTitle>{available} detected</CardTitle>
          </CardHeader>
        </Card>
      </div>
      {diagnostics?.issues.length ? (
        diagnostics.issues.map(issue => (
          <Alert key={issue.code} variant={issue.blocking ? 'destructive' : 'default'}>
            <AlertCircle />
            <AlertTitle>{issue.code}</AlertTitle>
            <AlertDescription>{issue.message}</AlertDescription>
          </Alert>
        ))
      ) : (
        <Alert>
          <CheckCircle2 />
          <AlertTitle>No issues found</AlertTitle>
          <AlertDescription>The current environment is ready for managed lifecycle operations.</AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Installers</CardTitle>
          <CardDescription>Package managers visible to Quantex.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Installer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(diagnostics?.installers ?? {}).map(([name, status]) => (
                <TableRow key={name}>
                  <TableCell className="font-medium">{name}</TableCell>
                  <TableCell>
                    <Badge variant={status.available ? 'default' : 'secondary'}>
                      {status.available ? 'Available' : 'Unavailable'}
                    </Badge>
                  </TableCell>
                  <TableCell>{status.reason ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
