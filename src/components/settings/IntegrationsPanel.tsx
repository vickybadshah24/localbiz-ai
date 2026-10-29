'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Copy, MessageCircle, SendHorizontal } from 'lucide-react'
import { api, type Business } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

function CopyField({ label, value }: { label: string; value: string }) {
  const copy = () => {
    navigator.clipboard?.writeText(value).then(
      () => toast.success('Copied to clipboard'),
      () => toast.error('Could not copy')
    )
  }
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-2.5 py-2 text-xs">{value}</code>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={copy} aria-label={`Copy ${label}`}>
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

export default function IntegrationsPanel({ business }: { business: Business }) {
  const queryClient = useQueryClient()
  const [number, setNumber] = useState(business.whatsappNumber ?? '')
  const [simOpen, setSimOpen] = useState(false)
  const [simName, setSimName] = useState('Sam Tester')
  const [simPhone, setSimPhone] = useState('+1 555 040 00')
  const [simText, setSimText] = useState('Hi! Do you have a slot for a haircut this Friday afternoon?')

  const webhookUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/webhooks/whatsapp` : '/api/webhooks/whatsapp'

  const saveMutation = useMutation({
    mutationFn: (patch: Parameters<typeof api.updateSettings>[0]) => api.updateSettings(patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Integration settings saved')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const simulateMutation = useMutation({
    mutationFn: () =>
      api.sendWebhook({
        entry: [
          {
            changes: [
              {
                value: {
                  contacts: [{ profile: { name: simName }, wa_id: simPhone.replace(/\s/g, '') }],
                  messages: [
                    {
                      from: simPhone.replace(/\s/g, ''),
                      id: `sim.${Date.now()}`,
                      timestamp: String(Math.floor(Date.now() / 1000)),
                      type: 'text',
                      text: { body: simText },
                    },
                  ],
                },
              },
            ],
          },
        ],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inquiries'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      setSimOpen(false)
      toast.success('Message delivered — the AI replied. Check the Inquiries inbox (WhatsApp filter).')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="h-4 w-4 text-primary" /> WhatsApp Business
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="text-sm font-medium">Channel enabled</p>
              <p className="text-xs text-muted-foreground">
                {business.whatsappApiConfigured
                  ? 'Graph API credentials detected — replies are delivered for real.'
                  : 'No API credentials in this sandbox — inbound messages are stored and replies simulated.'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={business.whatsappApiConfigured ? 'default' : 'secondary'} className="text-[10px]">
                {business.whatsappApiConfigured ? 'Live API' : 'Sandbox'}
              </Badge>
              <Switch
                checked={business.whatsappConnected}
                onCheckedChange={(checked) => saveMutation.mutate({ whatsappConnected: checked })}
                aria-label="Toggle WhatsApp channel"
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="wa-number">Business WhatsApp number</Label>
            <div className="flex items-center gap-2">
              <Input
                id="wa-number"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="+1 555 012 3456"
                className="max-w-xs"
              />
              <Button
                variant="outline"
                size="sm"
                disabled={number === (business.whatsappNumber ?? '')}
                onClick={() => saveMutation.mutate({ whatsappNumber: number || null })}
              >
                Save
              </Button>
            </div>
          </div>

          <Separator />

          <div className="grid gap-3">
            <CopyField label="Webhook URL (paste into Meta App dashboard)" value={webhookUrl} />
            <CopyField label="Verify token" value={business.verifyToken ?? ''} />
            <p className="text-xs text-muted-foreground">
              To go live, set these environment variables on the server: <code>WHATSAPP_ACCESS_TOKEN</code>,{' '}
              <code>WHATSAPP_PHONE_NUMBER_ID</code>, <code>WHATSAPP_APP_SECRET</code>. Until then the integration runs in
              sandbox mode — you can still test the full inbound → AI → reply pipeline below.
            </p>
          </div>

          <Button variant="outline" className="gap-2" onClick={() => setSimOpen(true)}>
            <SendHorizontal className="h-3.5 w-3.5" /> Simulate incoming WhatsApp message
          </Button>
        </CardContent>
      </Card>

      {/* Simulator */}
      <Dialog open={simOpen} onOpenChange={setSimOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Simulate inbound WhatsApp message</DialogTitle>
            <DialogDescription>
              Posts a Meta-shaped payload to the webhook endpoint — exactly what a real customer message triggers.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-1.5">
              <Label htmlFor="sim-name">Customer name</Label>
              <Input id="sim-name" value={simName} onChange={(e) => setSimName(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sim-phone">Customer phone</Label>
              <Input id="sim-phone" value={simPhone} onChange={(e) => setSimPhone(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sim-text">Message</Label>
              <Input id="sim-text" value={simText} onChange={(e) => setSimText(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSimOpen(false)}>Cancel</Button>
            <Button onClick={() => simulateMutation.mutate()} disabled={simulateMutation.isPending || !simText.trim()}>
              {simulateMutation.isPending ? 'Delivering…' : 'Send message'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Separator() {
  return <div className="h-px bg-border" role="separator" />
}
