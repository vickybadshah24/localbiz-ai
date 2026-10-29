'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CalendarClock } from 'lucide-react'
import { api, type Service } from '@/lib/api'
import { fmtMoney, todayKey } from '@/lib/format'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'

export default function NewBookingDialog({
  open,
  onOpenChange,
  services,
  defaultDate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  services: Service[]
  defaultDate?: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <BookingForm services={services} defaultDate={defaultDate} onDone={() => onOpenChange(false)} />
        </DialogContent>
      )}
    </Dialog>
  )
}

function BookingForm({
  services,
  defaultDate,
  onDone,
}: {
  services: Service[]
  defaultDate?: string
  onDone: () => void
}) {
  const queryClient = useQueryClient()
  const [serviceId, setServiceId] = useState<string>('')
  const [date, setDate] = useState<string>(defaultDate ?? todayKey())
  const [slot, setSlot] = useState<{ time: string; startsAt: string } | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')

  const availabilityQuery = useQuery({
    queryKey: ['availability', date, serviceId],
    queryFn: () => api.availability(date, serviceId),
    enabled: Boolean(serviceId && date),
  })

  const createMutation = useMutation({
    mutationFn: () =>
      api.createBooking({
        serviceId,
        customerName: name.trim(),
        customerPhone: phone.trim() || null,
        startsAt: slot!.startsAt,
        notes: notes.trim() || null,
        source: 'MANUAL',
      }),
    onSuccess: (booking) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success(`Booked ${booking.customerName} at ${slot?.time}`)
      onOpenChange(false)
      setSlot(null)
      setName('')
      setPhone('')
      setNotes('')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const canSubmit = Boolean(serviceId && slot && name.trim().length > 1)

  return (
    <>
      <DialogHeader>
        <DialogTitle>New booking</DialogTitle>
        <DialogDescription>Pick a service, an open slot, and the customer details.</DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="nb-service">Service</Label>
          <Select value={serviceId} onValueChange={(v) => { setServiceId(v); setSlot(null) }}>
            <SelectTrigger id="nb-service" aria-label="Select service">
              <SelectValue placeholder="Choose a service" />
            </SelectTrigger>
            <SelectContent>
              {(services ?? []).filter((s) => s.active).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name} · {s.durationMin} min · {fmtMoney(s.priceCents)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="nb-date">Date</Label>
          <Input
            id="nb-date"
            type="date"
            value={date}
            onChange={(e) => { setDate(e.target.value); setSlot(null) }}
          />
        </div>

          <div className="grid gap-2">
            <Label className="flex items-center gap-1.5">
              <CalendarClock className="h-3.5 w-3.5" /> Available slots
            </Label>
            {!serviceId ? (
              <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                Select a service to see open slots.
              </p>
            ) : availabilityQuery.isLoading ? (
              <div className="grid grid-cols-4 gap-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 rounded-md" />
                ))}
              </div>
            ) : availabilityQuery.data?.closed ? (
              <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                Closed on this day.
              </p>
            ) : (availabilityQuery.data?.slots.length ?? 0) === 0 ? (
              <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                No open slots on this day — try another date.
              </p>
            ) : (
              <div className="grid max-h-40 grid-cols-4 gap-2 overflow-y-auto rounded-lg p-1">
                {availabilityQuery.data!.slots.map((s) => (
                  <Button
                    key={s.startsAt}
                    type="button"
                    size="sm"
                    variant={slot?.startsAt === s.startsAt ? 'default' : 'outline'}
                    className="h-9 tabular-nums"
                    onClick={() => setSlot(s)}
                  >
                    {s.time}
                  </Button>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="nb-name">Customer name</Label>
              <Input id="nb-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="nb-phone">Phone (optional)</Label>
              <Input id="nb-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 000 00" />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="nb-notes">Notes (optional)</Label>
            <Textarea id="nb-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Anything the team should know" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onDone}>Cancel</Button>
          <Button disabled={!canSubmit || createMutation.isPending} onClick={() => createMutation.mutate()}>
            {createMutation.isPending ? 'Booking…' : 'Create booking'}
          </Button>
        </DialogFooter>
    </>
  )
}
