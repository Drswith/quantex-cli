import type { DesktopPreferences } from '../lib/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Label } from './ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Switch } from './ui/switch'

export function SettingsPanel({
  preferences,
  onChange,
}: {
  preferences: DesktopPreferences
  onChange: (preferences: DesktopPreferences) => void
}) {
  const update = (changes: Partial<DesktopPreferences>) => onChange({ ...preferences, ...changes })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Desktop preferences</CardTitle>
        <CardDescription>These preferences are stored by Desktop, not Quantex CLI.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="appearance">Appearance</Label>
            <Select
              onValueChange={appearance => update({ appearance: appearance as DesktopPreferences['appearance'] })}
              value={preferences.appearance}
            >
              <SelectTrigger id="appearance">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">Automatic</SelectItem>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="check-frequency">Frequency</Label>
            <Select
              onValueChange={checkFrequency =>
                update({ checkFrequency: checkFrequency as DesktopPreferences['checkFrequency'] })
              }
              value={preferences.checkFrequency}
            >
              <SelectTrigger id="check-frequency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="6h">Every 6 hours</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <PreferenceSwitch
            checked={preferences.notificationsEnabled}
            id="notifications-enabled"
            label="Notify me about new updates"
            onCheckedChange={notificationsEnabled => update({ notificationsEnabled })}
          />
          <PreferenceSwitch
            checked={preferences.launchAtLogin}
            id="launch-at-login"
            label="Launch Quantex Desktop at login"
            onCheckedChange={launchAtLogin => update({ launchAtLogin })}
          />
        </div>
      </CardContent>
    </Card>
  )
}

function PreferenceSwitch({
  checked,
  id,
  label,
  onCheckedChange,
}: {
  checked: boolean
  id: string
  label: string
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <Label htmlFor={id}>{label}</Label>
      <Switch checked={checked} id={id} onCheckedChange={onCheckedChange} />
    </div>
  )
}
