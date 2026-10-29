'use client'

import { useQuery } from '@tanstack/react-query'
import {
  CalendarCheck2,
  CalendarRange,
  MessagesSquare,
  Wallet,
  ArrowRight,
  Bot,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react'
import { api } from '@/lib/api'
import { fmtAgo, fmtMoney, fmtTimeRange, todayKey, initials } from '@/lib/format'
import StatCard from './StatCard'
import TrendChart from './TrendChart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

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

export default function DashboardView({ onSelectInquiry }: { onSelectInquiry: (id: string) => void }) {
  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: api.dashboard, refetchInterval: 60_000 })
  const { data: settingsData } = useQuery({ queryKey: ['settings'], queryFn: api.settings, staleTime: 30_000 })

  const today = todayKey()
  const business = settingsData?.business

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-80 rounded-xl lg:col-span-2" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Bookings today" value={data.todayBookings} sub="confirmed & pending" icon={CalendarCheck2} />
        <StatCard label="Next 7 days" value={data.weekBookings} sub="upcoming appointments" icon={CalendarRange} />
        <StatCard label="Open conversations" value={data.openInquiries} sub={`${data.newInquiries} new this week`} icon={MessagesSquare} />
        <StatCard label="Revenue next 7 days" value={fmtMoney(data.revenueWeekCents)} sub="confirmed + completed" icon={Wallet} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Trend */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Bookings — last 14 days</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendChart data={data.trend} />
          </CardContent>
        </Card>

        {/* Recent inquiries */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent inquiries</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.recentInquiries.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">No conversations yet.</p>
            )}
            {data.recentInquiries.map((inq) => (
              <button
                key={inq.id}
                onClick={() => onSelectInquiry(inq.id)}
                className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted min-h-[44px]"
              >
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="text-xs">{initials(inq.customerName)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{inq.customerName}</p>
                    <Badge variant="outline" className="h-4 px-1 text-[9px] uppercase tracking-wide">
                      {inq.channel === 'WHATSAPP' ? 'WhatsApp' : 'Web'}
                    </Badge>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{inq.lastMessage ?? ''}</p>
                </div>
                <span className="shrink-0 text-[10px] text-muted-foreground">{fmtAgo(inq.lastMessageAt)}</span>
              </button>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="w-full gap-1 text-xs"
              onClick={() => onSelectInquiry(data.recentInquiries[0]?.id ?? '')}
              disabled={data.recentInquiries.length === 0}
            >
              Open inbox <ArrowRight className="h-3 w-3" />
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Today's schedule */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Today&apos;s schedule</CardTitle>
          </CardHeader>
          <CardContent>
            {data.todaySchedule.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nothing booked for today yet.</p>
            ) : (
              <ul className="divide-y">
                {data.todaySchedule.map((b) => (
                  <li key={b.id} className="flex items-center gap-3 py-2.5">
                    <span className="w-28 shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                      {fmtTimeRange(b.startsAt, b.endsAt)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{b.customerName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {b.serviceName ?? 'Custom service'}
                        {b.priceCents !== null ? ` · ${fmtMoney(b.priceCents)}` : ''}
                      </p>
                    </div>
                    {b.source !== 'MANUAL' && (
                      <Badge variant="outline" className="hidden sm:inline-flex text-[9px] uppercase tracking-wide">
                        via {b.source}
                      </Badge>
                    )}
                    <Badge variant={statusVariant(b.status)} className="text-[10px]">
                      {b.status.toLowerCase()}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* AI status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="h-4 w-4 text-primary" /> AI assistant
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Auto-reply</span>
              <Badge variant={business?.autoReply ? 'default' : 'outline'}>
                {business?.autoReply ? 'On' : 'Off'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">WhatsApp channel</span>
              <Badge variant={business?.whatsappApiConfigured ? 'default' : 'secondary'}>
                {business?.whatsappApiConfigured ? 'Live API' : 'Sandbox'}
              </Badge>
            </div>
            <div className="flex items-start gap-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
              {business?.autoReply ? (
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              ) : (
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              )}
              <span>
                {business?.autoReply
                  ? `The AI answers new customer messages instantly using your services and knowledge base (${data.todaySchedule.length ?? 0} appointments on ${fmtDateLabel(today)}).`
                  : 'Auto-reply is off — customer messages wait for a manual reply in the inbox.'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function fmtDateLabel(key: string): string {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long' })
  return fmt.format(new Date(`${key}T12:00:00Z`))
}
