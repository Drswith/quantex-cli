import { Badge } from './ui/badge'
import { Separator } from './ui/separator'
import { SidebarTrigger } from './ui/sidebar'

export function SiteHeader({ browserPreview, title }: { browserPreview: boolean; title: string }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b">
      <div className="flex w-full items-center gap-2 px-4">
        <SidebarTrigger />
        <Separator orientation="vertical" />
        <h1 className="font-medium">{title}</h1>
        {browserPreview ? <Badge variant="secondary">Browser preview</Badge> : null}
      </div>
    </header>
  )
}
