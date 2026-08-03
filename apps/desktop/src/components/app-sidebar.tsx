import { Activity, Bot, CircleGauge, LayoutDashboard, RefreshCw, Settings2 } from 'lucide-react'
import { NavMain } from './nav-main'
import { Badge } from './ui/badge'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from './ui/sidebar'

export type DesktopPage = 'activity' | 'agents' | 'diagnostics' | 'overview' | 'settings' | 'updates'

const navigation = [
  { icon: LayoutDashboard, title: 'Overview', value: 'overview' },
  { icon: Bot, title: 'Agents', value: 'agents' },
  { icon: RefreshCw, title: 'Updates', value: 'updates' },
  { icon: CircleGauge, title: 'Diagnostics', value: 'diagnostics' },
  { icon: Activity, title: 'Activity', value: 'activity' },
  { icon: Settings2, title: 'Settings', value: 'settings' },
] satisfies Array<{ icon: typeof Bot; title: string; value: DesktopPage }>

export function AppSidebar({
  activePage,
  browserPreview,
  onNavigate,
}: {
  activePage: DesktopPage
  browserPreview: boolean
  onNavigate: (page: DesktopPage) => void
}) {
  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => onNavigate('agents')}>
              <Bot />
              <span>Quantex Desktop</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain activeItem={activePage} items={navigation} onSelect={onNavigate} />
      </SidebarContent>
      <SidebarFooter>{browserPreview ? <Badge variant="secondary">Mock data</Badge> : null}</SidebarFooter>
    </Sidebar>
  )
}
