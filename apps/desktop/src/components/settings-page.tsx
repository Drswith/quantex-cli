import type { DesktopPreferences, QuantexConfig } from '../lib/types'
import { useEffect, useState } from 'react'
import { SettingsPanel } from './settings-panel'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from './ui/field'
import { Input } from './ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'

export function SettingsPage({
  busy,
  config,
  onPreferencesChange,
  onResetConfig,
  onSaveConfig,
  preferences,
}: {
  busy: boolean
  config?: QuantexConfig
  onPreferencesChange: (preferences: DesktopPreferences) => void
  onResetConfig: () => void
  onSaveConfig: (config: QuantexConfig) => void
  preferences: DesktopPreferences
}) {
  const [draft, setDraft] = useState(config)
  useEffect(() => setDraft(config), [config])

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-lg font-semibold">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Quantex CLI configuration and Desktop preferences are stored separately.
        </p>
      </div>
      <Tabs defaultValue="quantex">
        <TabsList>
          <TabsTrigger value="quantex">Quantex</TabsTrigger>
          <TabsTrigger value="desktop">Desktop</TabsTrigger>
        </TabsList>
        <TabsContent value="quantex">
          <Card>
            <CardHeader>
              <CardTitle>Quantex configuration</CardTitle>
              <CardDescription>
                Read and written through the bundled CLI. Desktop never edits the config file directly.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {draft ? (
                <FieldGroup>
                  <div className="grid gap-5 md:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="package-manager">Default package manager</FieldLabel>
                      <Select
                        value={draft.defaultPackageManager}
                        onValueChange={value =>
                          setDraft({ ...draft, defaultPackageManager: value as QuantexConfig['defaultPackageManager'] })
                        }
                      >
                        <SelectTrigger id="package-manager">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bun">Bun</SelectItem>
                          <SelectItem value="npm">npm</SelectItem>
                          <SelectItem value="mise">mise</SelectItem>
                          <SelectItem value="uv">uv</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="update-strategy">npm / Bun update strategy</FieldLabel>
                      <Select
                        value={draft.npmBunUpdateStrategy}
                        onValueChange={value =>
                          setDraft({ ...draft, npmBunUpdateStrategy: value as QuantexConfig['npmBunUpdateStrategy'] })
                        }
                      >
                        <SelectTrigger id="update-strategy">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="latest-major">Latest major</SelectItem>
                          <SelectItem value="respect-semver">Respect semver</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="network-timeout">Network timeout (ms)</FieldLabel>
                      <Input
                        id="network-timeout"
                        min={1}
                        type="number"
                        value={draft.networkTimeoutMs}
                        onChange={event => setDraft({ ...draft, networkTimeoutMs: Number(event.target.value) })}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="network-retries">Network retries</FieldLabel>
                      <Input
                        id="network-retries"
                        min={1}
                        type="number"
                        value={draft.networkRetries}
                        onChange={event => setDraft({ ...draft, networkRetries: Number(event.target.value) })}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="cache-ttl">Version cache TTL (hours)</FieldLabel>
                      <Input
                        id="cache-ttl"
                        min={1}
                        type="number"
                        value={draft.versionCacheTtlHours}
                        onChange={event => setDraft({ ...draft, versionCacheTtlHours: Number(event.target.value) })}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="update-channel">CLI update channel</FieldLabel>
                      <Select
                        value={draft.selfUpdateChannel}
                        onValueChange={value =>
                          setDraft({ ...draft, selfUpdateChannel: value as QuantexConfig['selfUpdateChannel'] })
                        }
                      >
                        <SelectTrigger id="update-channel">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="stable">Stable</SelectItem>
                          <SelectItem value="beta">Beta</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                  <Field>
                    <FieldLabel htmlFor="registry">Self-update registry</FieldLabel>
                    <Input
                      id="registry"
                      value={draft.selfUpdateRegistry ?? ''}
                      onChange={event => setDraft({ ...draft, selfUpdateRegistry: event.target.value || undefined })}
                    />
                    <FieldDescription>
                      The bundled sidecar is replaced only with a Desktop app update; this value remains available for
                      standalone CLI use.
                    </FieldDescription>
                  </Field>
                </FieldGroup>
              ) : null}
            </CardContent>
            <CardFooter className="justify-between">
              <Button disabled={busy} onClick={onResetConfig} variant="outline">
                Reset defaults
              </Button>
              <Button disabled={busy || !draft} onClick={() => draft && onSaveConfig(draft)}>
                Save changes
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        <TabsContent value="desktop">
          <SettingsPanel onChange={onPreferencesChange} preferences={preferences} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
