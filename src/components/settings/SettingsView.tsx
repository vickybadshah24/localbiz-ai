'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Bot, Globe2 } from 'lucide-react'
import { api, type Business, type WorkingHours } from '@/lib/api'
import KnowledgePanel from './KnowledgePanel'
import IntegrationsPanel from './IntegrationsPanel'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

const DAY_LABELS: Array<[string, string]> = [
  ['mon', 'Monday'],
  ['tue', 'Tuesday'],
  ['wed', 'Wednesday'],
  ['thu', 'Thursday'],
  ['fri', 'Friday'],
  ['sat', 'Saturday'],
  ['sun', 'Sunday'],
]

function WorkingHoursEditor({
  hours,
  onChange,
}: {
  hours: WorkingHours
  onChange: (h: WorkingHours) => void
}) {
  const update = (key: string, patch: Partial<{ closed: boolean; open: string; close: string }>) => {
    onChange({ ...hours, [key]: { ...hours[key], ...patch } })
  }
  return (
    <div className="space-y-2">
      {DAY_LABELS.map(([key, label]) => {
        const day = hours[key] ?? { closed: false, open: '09:00', close: '18:00' }
        return (
          <div key={key} className="flex items-center gap-3 rounded-lg border p-2.5">
            <span className="w-24 shrink-0 text-sm">{label}</span>
            <Switch
              checked={!day.closed}
              onCheckedChange={(open) => update(key, { closed: !open })}
              aria-label={`${label} open`}
            />
            <span className="w-10 text-xs text-muted-foreground">{day.closed ? 'Off' : 'Open'}</span>
            <Input
              type="time"
              value={day.open}
              disabled={day.closed}
              onChange={(e) => update(key, { open: e.target.value })}
              className="h-8 w-[110px]"
              aria-label={`${label} opening time`}
            />
            <span className="text-xs text-muted-foreground">–</span>
            <Input
              type="time"
              value={day.close}
              disabled={day.closed}
              onChange={(e) => update(key, { close: e.target.value })}
              className="h-8 w-[110px]"
              aria-label={`${label} closing time`}
            />
          </div>
        )
      })}
    </div>
  )
}

export default function SettingsView() {
  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: api.settings })

  if (settingsQuery.isLoading || !settingsQuery.data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72 rounded-lg" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    )
  }

  return <SettingsTabs business={settingsQuery.data.business} />
}

function SettingsTabs({ business }: { business: Business }) {
  const queryClient = useQueryClient()

  // Editing state initialised from the loaded business (component mounts only after load)
  const [profile, setProfile] = useState(() => ({
    name: business.name,
    industry: business.industry,
    phone: business.phone ?? '',
    email: business.email ?? '',
    address: business.address ?? '',
    timezone: business.timezone,
  }))
  const [hours, setHours] = useState<WorkingHours>(() => business.workingHours)
  const [persona, setPersona] = useState<string>(business.aiPersona)
  const [autoReply, setAutoReply] = useState<boolean>(business.autoReply)

  const saveMutation = useMutation({
    mutationFn: () => {
      const patch: Parameters<typeof api.updateSettings>[0] = {
        workingHours: hours,
        aiPersona: persona,
        autoReply,
      }
      if (profile.name && profile.name !== business.name) patch.name = profile.name
      if (profile.industry !== business.industry) patch.industry = profile.industry
      if (profile.phone !== (business.phone ?? '')) patch.phone = profile.phone || null
      if (profile.email !== (business.email ?? '')) patch.email = profile.email || null
      if (profile.address !== (business.address ?? '')) patch.address = profile.address || null
      if (profile.timezone !== business.timezone) patch.timezone = profile.timezone
      return api.updateSettings(patch)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      toast.success('Settings saved')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Tabs defaultValue="business" className="space-y-4">
      <TabsList className="h-9 w-full justify-start overflow-x-auto sm:w-auto">
        <TabsTrigger value="business" className="text-xs">Business</TabsTrigger>
        <TabsTrigger value="ai" className="text-xs">AI Assistant</TabsTrigger>
        <TabsTrigger value="knowledge" className="text-xs">Knowledge base</TabsTrigger>
        <TabsTrigger value="integrations" className="text-xs">Integrations</TabsTrigger>
      </TabsList>

      {/* Business profile */}
      <TabsContent value="business" className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe2 className="h-4 w-4 text-primary" /> Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="st-name">Business name</Label>
              <Input id="st-name" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="st-industry">Industry</Label>
              <Input id="st-industry" value={profile.industry} onChange={(e) => setProfile({ ...profile, industry: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="st-phone">Phone</Label>
              <Input id="st-phone" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="st-email">Email</Label>
              <Input id="st-email" type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
            </div>
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="st-address">Address</Label>
              <Input id="st-address" value={profile.address} onChange={(e) => setProfile({ ...profile, address: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="st-tz">Timezone (display)</Label>
              <Input id="st-tz" value={profile.timezone} onChange={(e) => setProfile({ ...profile, timezone: e.target.value })} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Working hours</CardTitle>
          </CardHeader>
          <CardContent>
            <WorkingHoursEditor hours={hours} onChange={setHours} />
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </TabsContent>

      {/* AI assistant */}
      <TabsContent value="ai" className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="h-4 w-4 text-primary" /> Assistant behaviour
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="text-sm font-medium">Auto-reply to customers</p>
                <p className="text-xs text-muted-foreground">
                  The AI instantly answers new WhatsApp and web-chat messages using your services and knowledge base.
                </p>
              </div>
              <Switch checked={autoReply ?? false} onCheckedChange={setAutoReply} aria-label="Toggle auto-reply" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="st-persona">AI persona</Label>
              <Textarea
                id="st-persona"
                rows={4}
                value={persona ?? ''}
                onChange={(e) => setPersona(e.target.value)}
                placeholder="Describe how the assistant should talk…"
              />
              <p className="text-xs text-muted-foreground">
                Tip: use the “Try customer chat” button in the top bar to test the assistant after saving.
              </p>
            </div>
          </CardContent>
        </Card>
        <div className="flex justify-end">
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </TabsContent>

      <TabsContent value="knowledge">
        <KnowledgePanel />
      </TabsContent>

      <TabsContent value="integrations">
        <IntegrationsPanel business={business} />
      </TabsContent>
    </Tabs>
  )
}
