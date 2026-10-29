'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, MoreHorizontal, CalendarDays } from 'lucide-react'
import { api, type Booking, type BookingStatus } from '@/lib/api'
import { dateKeyOf, fmtDayLong, fmtMoney, fmtTimeRange, initials, todayKey } from '@/lib/format'
import MonthCalendar from './MonthCalendar'
import NewBookingDialog from './NewBookingDialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

function statusVariant(status: string): 'default' | 'secondary' | 'outline' | 'destructive' {
  switch (status) {
    case 'CONFIRMED':
      return 'default'
    case 'PENDING':
      return 'secondary'
    case 'CANCELLED':
      return 'destructive'
    default:
      return 'outline'
  }
}

function BookingRow({ booking, onStatus }: { booking: Booking; onStatus: (id: string, status: BookingStatus) => void }) {
  const cancellable = booking.status === 'PENDING' || booking.status === 'CONFIRMED'
  return (
    <li className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center">
      <span className="w-32 shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
        {fmtTimeRange(booking.startsAt, booking.endsAt)}
      </span>
      <Avatar className="hidden h-9 w-9 sm:flex">
        <AvatarFallback className="text-xs">{initials(booking.customerName)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium">{booking.customerName}</p>
          <Badge variant={statusVariant(booking.status)} className="text-[10px]">
            {booking.status.toLowerCase()}
          </Badge>
          {booking.source !== 'MANUAL' && (
            <Badge variant="outline" className="text-[9px] uppercase tracking-wide">
              via {booking.source}
            </Badge>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {booking.serviceName ?? 'Custom service'}
          {booking.durationMin ? ` · ${booking.durationMin} min` : ''}
          {booking.priceCents !== null ? ` · ${fmtMoney(booking.priceCents)}` : ''}
          {booking.customerPhone ? ` · ${booking.customerPhone}` : ''}
        </p>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Booking actions">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {booking.status === 'PENDING' && (
            <DropdownMenuItem onClick={() => onStatus(booking.id, 'CONFIRMED')}>Confirm</DropdownMenuItem>
          )}
          {booking.status === 'CONFIRMED' && (
            <DropdownMenuItem onClick={() => onStatus(booking.id, 'COMPLETED')}>Mark completed</DropdownMenuItem>
          )}
          {cancellable && (
            <DropdownMenuItem className="text-destructive" onClick={() => onStatus(booking.id, 'CANCELLED')}>
              Cancel booking
            </DropdownMenuItem>
          )}
          {!cancellable && booking.status !== 'COMPLETED' && (
            <DropdownMenuItem disabled>No actions available</DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  )
}

export default function BookingsView() {
  const [selectedDate, setSelectedDate] = useState<string>(todayKey())
  const [tab, setTab] = useState<'day' | 'upcoming'>('day')
  const [dialogOpen, setDialogOpen] = useState(false)
  const queryClient = useQueryClient()

  const bookingsQuery = useQuery({ queryKey: ['bookings'], queryFn: () => api.bookings() })
  const servicesQuery = useQuery({ queryKey: ['services'], queryFn: api.services })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: BookingStatus }) => api.updateBooking(id, { status }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success(`Booking ${updated.status.toLowerCase()}`)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const dayBookings = useMemo(() => {
    const all = bookingsQuery.data ?? []
    return all
      .filter((b) => dateKeyOf(b.startsAt) === selectedDate)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  }, [bookingsQuery.data, selectedDate])

  const upcoming = useMemo(() => {
    const all = bookingsQuery.data ?? []
    const now = Date.now() - 3_600_000
    return all
      .filter((b) => new Date(b.startsAt).getTime() >= now && b.status !== 'CANCELLED')
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  }, [bookingsQuery.data])

  const list = tab === 'day' ? dayBookings : upcoming

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
      {/* Calendar sidebar */}
      <div className="space-y-4">
        <Card>
          <CardContent className="p-4">
            <MonthCalendar selected={selectedDate} onSelect={(key) => { setSelectedDate(key); setTab('day') }} />
            <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary" /> confirmed</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-muted-foreground/50" /> pending</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-destructive" /> cancelled</span>
            </div>
          </CardContent>
        </Card>
        <Button className="w-full gap-2" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" /> New booking
        </Button>
      </div>

      {/* List */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base">
            {tab === 'day' ? fmtDayLong(`${selectedDate}T12:00:00Z`) : 'All upcoming'}
          </CardTitle>
          <Tabs value={tab} onValueChange={(v) => setTab(v as 'day' | 'upcoming')}>
            <TabsList className="h-8">
              <TabsTrigger value="day" className="text-xs">Day</TabsTrigger>
              <TabsTrigger value="upcoming" className="text-xs">Upcoming</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          {bookingsQuery.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : list.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <CalendarDays className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                {tab === 'day' ? 'No bookings on this day.' : 'No upcoming bookings.'}
              </p>
              <Button variant="outline" size="sm" className="gap-1" onClick={() => setDialogOpen(true)}>
                <Plus className="h-3 w-3" /> Create one
              </Button>
            </div>
          ) : (
            <ul className="max-h-[560px] space-y-2 overflow-y-auto pr-1 scroll-smooth">
              {list.map((b) => (
                <BookingRow key={b.id} booking={b} onStatus={(id, status) => statusMutation.mutate({ id, status })} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <NewBookingDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        services={servicesQuery.data ?? []}
        defaultDate={selectedDate}
      />
    </div>
  )
}
