'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CalendarPlus, Send, Sparkles } from 'lucide-react'
import { api, type Business, type BookingDraft, type Message } from '@/lib/api'
import ChatThread from './ChatThread'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

const SUGGESTIONS = [
  'Do you have availability on Saturday?',
  'How much does a haircut cost?',
  'Can I book a keratin treatment tomorrow at 2pm?',
]

interface DemoState {
  inquiryId: string | null
  messages: Message[]
  draft: BookingDraft | null
}

export default function WebChatDemo({
  open,
  onOpenChange,
  business,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  business?: Business
}) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('Alex')
  const [input, setInput] = useState('')
  const [state, setState] = useState<DemoState>({ inquiryId: null, messages: [], draft: null })
  const endRef = useRef<HTMLDivElement>(null)

  const servicesQuery = useQuery({
    queryKey: ['services'],
    queryFn: api.services,
    enabled: open,
  })

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [state.messages.length])

  // Live availability for the proposed slot (the AI may propose a taken time)
  const [pickedSlot, setPickedSlot] = useState<{ sig: string; time: string; startsAt: string } | null>(null)
  const draft = state.draft
  const draftSig = draft ? `${draft.serviceName ?? ''}|${draft.date ?? ''}|${draft.time ?? ''}` : ''

  const draftService = useMemo(() => {
    if (!draft) return null
    const services = servicesQuery.data ?? []
    const wanted = (draft.serviceName ?? '').toLowerCase()
    return (
      services.find((s) => s.name.toLowerCase().includes(wanted) || wanted.includes(s.name.toLowerCase().split(' ')[0])) ??
      services[0] ??
      null
    )
  }, [draft, servicesQuery.data])

  const draftDateValid = Boolean(draft?.date && /^\d{4}-\d{2}-\d{2}$/.test(draft.date))
  const draftAvailQuery = useQuery({
    queryKey: ['chat-availability', draft?.date, draftService?.id],
    queryFn: () => api.availability(draft!.date!, draftService!.id),
    enabled: Boolean(draft && draftDateValid && draftService),
  })
  const aiTime = draft?.time && /^\d{2}:\d{2}$/.test(draft.time) ? draft.time : null
  const aiSlot = draftAvailQuery.data?.slots.find((s) => s.time === aiTime) ?? null
  const selectedSlot = pickedSlot && pickedSlot.sig === draftSig ? pickedSlot : aiSlot
  const proposedTimeTaken = Boolean(aiTime && draftAvailQuery.data && !aiSlot)

  const sendMutation = useMutation({
    mutationFn: (text: string) =>
      api.chat({ inquiryId: state.inquiryId, message: text, customerName: name.trim() || undefined }),
    onSuccess: (data) => {
      const messages: Message[] = [data.customerMessage]
      if (data.assistantMessage) messages.push(data.assistantMessage)
      setState((s) => ({
        inquiryId: data.inquiryId,
        messages: [...s.messages, ...messages],
        draft: data.ai?.bookingDraft ?? null,
      }))
      queryClient.invalidateQueries({ queryKey: ['inquiries'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const confirmMutation = useMutation({
    mutationFn: async () => {
      const draft = state.draft
      if (!draft) throw new Error('No booking proposal')
      const services = servicesQuery.data ?? []
      const wanted = (draft.serviceName ?? '').toLowerCase()
      const service =
        services.find((s) => s.name.toLowerCase().includes(wanted) || wanted.includes(s.name.toLowerCase().split(' ')[0])) ??
        services[0]
      if (!service) throw new Error('No services configured')
      const fallbackStart =
        draft.date && /^\d{4}-\d{2}-\d{2}$/.test(draft.date) && draft.time && /^\d{2}:\d{2}$/.test(draft.time)
          ? `${draft.date}T${draft.time}:00Z`
          : null
      const startsAt = selectedSlot?.startsAt ?? fallbackStart
      if (!startsAt) {
        throw new Error('The AI proposal is missing a valid date/time — pick a slot manually in Bookings')
      }
      return api.createBooking({
        serviceId: service.id,
        customerName: draft.customerName || name || 'Web visitor',
        customerPhone: draft.customerPhone || null,
        startsAt,
        source: 'AI',
      })
    },
    onSuccess: (booking) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success(`Booking created for ${booking.customerName} — see it in Bookings`)
      setState((s) => ({ ...s, draft: null }))
      setPickedSlot(null)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const send = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || sendMutation.isPending) return
    setInput('')
    sendMutation.mutate(trimmed)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Customer web chat
          </DialogTitle>
          <DialogDescription>
            Chat as a customer of {business?.name ?? 'the business'} — the AI replies using its knowledge base and can propose bookings.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <label htmlFor="wc-name" className="text-xs font-medium text-muted-foreground">
            Your name
          </label>
          <Input id="wc-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex" className="h-9" />
        </div>

        <div className="max-h-[38vh] min-h-[220px] overflow-y-auto rounded-lg border bg-muted/30 p-3">
          {state.messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 py-8 text-center">
              <Sparkles className="h-6 w-6 text-primary/60" />
              <p className="max-w-[240px] text-xs text-muted-foreground">
                Say hello, ask about prices, or try to book something — the AI handles it.
              </p>
            </div>
          ) : (
            <ChatThread messages={state.messages} />
          )}
          <div ref={endRef} />
        </div>

        {draft && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-xs font-semibold">
                  <CalendarPlus className="h-3.5 w-3.5 text-primary" /> Booking proposed
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {draft.serviceName ?? 'Service'}
                  {draft.date ? ` · ${draft.date}` : ''}
                  {aiTime ? ` at ${aiTime}` : ''}
                </p>
              </div>
              <Button
                size="sm"
                className="shrink-0"
                onClick={() => confirmMutation.mutate()}
                disabled={confirmMutation.isPending || (draftAvailQuery.isSuccess && !selectedSlot)}
              >
                {confirmMutation.isPending ? 'Booking…' : 'Confirm'}
              </Button>
            </div>
            {!draft.date || !aiTime ? (
              <p className="mt-1 text-[10px] text-amber-600">The AI needs a date & time — ask it to pick one.</p>
            ) : proposedTimeTaken ? (
              <p className="mt-1 text-[10px] text-amber-600">That time is already booked — pick another slot:</p>
            ) : null}
            {draftAvailQuery.data && draftAvailQuery.data.slots.length > 0 && (
              <div className="mt-2 flex max-h-20 flex-wrap gap-1.5 overflow-y-auto">
                {draftAvailQuery.data.slots.slice(0, 14).map((s) => (
                  <button
                    key={s.startsAt}
                    onClick={() => setPickedSlot({ sig: draftSig, time: s.time, startsAt: s.startsAt })}
                    className={`rounded-full border px-2 py-0.5 text-[11px] tabular-nums transition-colors ${
                      selectedSlot?.time === s.time
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'bg-background text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    {s.time}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              disabled={sendMutation.isPending}
              className="rounded-full border px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>

        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            send(input)
          }}
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message…"
            aria-label="Message"
            className="h-10"
          />
          <Button type="submit" size="icon" className="h-10 w-10 shrink-0" disabled={!input.trim() || sendMutation.isPending} aria-label="Send message">
            <Send className="h-4 w-4" />
          </Button>
        </form>

        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>AI replies also appear in the Inquiries inbox.</span>
          {business && <Badge variant="secondary" className="text-[9px]">sandbox demo</Badge>}
        </div>
      </DialogContent>
    </Dialog>
  )
}
