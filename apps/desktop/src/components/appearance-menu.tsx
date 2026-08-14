import type { AppearancePreference } from '../lib/types'
import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react'
import { Button } from './ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'

const icons = {
  dark: MoonIcon,
  light: SunIcon,
  system: MonitorIcon,
} satisfies Record<AppearancePreference, typeof MonitorIcon>

export function AppearanceMenu({
  appearance,
  onChange,
}: {
  appearance: AppearancePreference
  onChange: (appearance: AppearancePreference) => void
}) {
  const Icon = icons[appearance]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label="Change appearance" size="icon" title="Appearance" variant="ghost">
          <Icon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup onValueChange={value => onChange(value as AppearancePreference)} value={appearance}>
          <DropdownMenuRadioItem value="system">
            <MonitorIcon />
            Automatic
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="light">
            <SunIcon />
            Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <MoonIcon />
            Dark
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
