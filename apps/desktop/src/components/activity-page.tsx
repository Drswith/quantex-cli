import type { LifecycleExecution } from '../lib/types'
import { Badge } from './ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from './ui/empty'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table'

export function ActivityPage({ activity }: { activity: LifecycleExecution[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity</CardTitle>
        <CardDescription>Recent lifecycle actions from this Desktop session.</CardDescription>
      </CardHeader>
      <CardContent>
        {activity.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No recent activity</EmptyTitle>
              <EmptyDescription>Install, update, run, or remove an agent to see the result here.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Result</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activity.map((entry, index) => (
                <TableRow key={`${entry.timestamp}-${entry.name}-${index}`}>
                  <TableCell>{new Date(entry.timestamp).toLocaleTimeString()}</TableCell>
                  <TableCell className="font-medium">{entry.name}</TableCell>
                  <TableCell>{entry.action}</TableCell>
                  <TableCell>
                    <Badge variant={entry.ok ? 'default' : 'destructive'}>{entry.ok ? 'Completed' : 'Failed'}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
