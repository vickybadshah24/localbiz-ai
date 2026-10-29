'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, Inbox, Send, Sparkles } from 'lucide-react'
import { api, type InquiryStatus } from '@/lib/api'
import { fmtAgo, initials } from '@/lib/format'
import ChatThread from './ChatThread'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

type Filter = 'OPEN' | 'RESOLVED' | 'ALL'

export default function InquiriesView({ focusId }: { focusId?: string | null }) {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<Filter>('OPEN')
  const [mobileThread, setMobileThread] = useState(false)
  const [manualSelectedId, setManualSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const threadEndRef = useRef<HTMLDivElement>(null)

  const listQuery = useQuery({
    queryKey: ['inquiries'],
    queryFn: () => api.inquiries(),
    refetchInterval: 30_000,
  })

  const inquiries = useMemo(() => {
    const all = listQuery.data ?? []
    return filter === 'ALL' ? all : all.filter((i) => i.status === filter)
  }, [listQuery.data, filter])

  // Derived selection: explicit click > dashboard focus > first in list
  const selectedId = manualSelectedId ?? focusId ?? inquiries[0]?.id ?? null

  const detailQuery = useQuery({
    queryKey: ['inquiry', selectedId],
    queryFn: () => api.inquiry(selectedId!),
    enabled: Boolean(selectedId),
  })

  const messages = detailQuery.data?.messages ?? []

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length, selectedId])

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['inquiries'] })
    queryClient.invalidateQueries({ queryKey: ['inquiry', selectedId] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const sendMutation = useMutation({
    mutationFn: () => api.postOwnerMessage(selectedId!, draft.trim()),
    onSuccess: () => {
      setDraft('')
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const suggestMutation = useMutation({
    mutationFn: () => api.suggestReply(selectedId!),
    onSuccess: (suggestion) => {
      setDraft(suggestion ?? '')
      toast.success('AI draft inserted — review and send')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const statusMutation = useMutation({
    mutationFn: (status: InquiryStatus) => api.updateInquiry(selectedId!, { status }),
    onSuccess: () => {
      invalidate()
      toast.success('Conversation updated')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const selected = detailQuery.data

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
      {/* List */}
      <Card className={cn('flex flex-col overflow-hidden', mobileThread && 'hidden lg:flex')}>
        <div className="border-b p-3">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
            <TabsList className="h-8 w-full">
              <TabsTrigger value="OPEN" className="flex-1 text-xs">Open</TabsTrigger>
              <TabsTrigger value="RESOLVED" className="flex-1 text-xs">Resolved</TabsTrigger>
              <TabsTrigger value="ALL" className="flex-1 text-xs">All</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="max-h-[60vh] flex-1 space-y-1 overflow-y-auto p-2 lg:max-h-[calc(100vh-260px)]">
          {listQuery.isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)
          ) : inquiries.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <Inbox className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No conversations here yet.</p>
            </div>
          ) : (
            inquiries.map((inq) => (
              <button
                key={inq.id}
                onClick={() => { setManualSelectedId(inq.id); setMobileThread(true) }}
                className={cn(
                  'flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors min-h-[44px]',
                  selectedId === inq.id ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-muted'
                )}
              >
                <Avatar className="mt-0.5 h-9 w-9">
                  <AvatarFallback className="text-xs">{initials(inq.customerName)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{inq.customerName}</p>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{fmtAgo(inq.lastMessageAt)}</span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{inq.lastMessage ?? 'New conversation'}</p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <Badge variant="outline" className="h-4 px-1 text-[9px] uppercase tracking-wide">
                      {inq.channel === 'WHATSAPP' ? 'WhatsApp' : 'Web chat'}
                    </Badge>
                    {inq.status === 'OPEN' ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-label="Open" />
                    ) : (
                      <Badge variant="secondary" className="h-4 px-1 text-[9px]">resolved</Badge>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </Card>

      {/* Thread */}
      <Card className={cn('flex flex-col overflow-hidden', !mobileThread && 'hidden lg:flex')}>
        {!selectedId || !selected ? (
          <CardContent className="flex flex-1 items-center justify-center py-24 text-sm text-muted-foreground">
            Select a conversation to see the full thread.
          </CardContent>
        ) : (
          <>
            {/* Thread header */}
            <div className="flex items-center gap-3 border-b p-3">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 lg:hidden"
                aria-label="Back to list"
                onClick={() => setMobileThread(false)}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Avatar className="h-9 w-9">
                <AvatarFallback className="text-xs">{initials(selected.customerName)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{selected.customerName}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {selected.channel === 'WHATSAPP' ? `WhatsApp${selected.customerPhone ? ` · ${selected.customerPhone}` : ''}` : 'Web chat widget'}
                </p>
              </div>
              <Select value={selected.status} onValueChange={(v) => statusMutation.mutate(v as InquiryStatus)}>
                <SelectTrigger className="h-8 w-[130px] text-xs" aria-label="Conversation status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OPEN">Open</SelectItem>
                  <SelectItem value="RESOLVED">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Messages */}
            <div className="max-h-[46vh] min-h-[240px] flex-1 overflow-y-auto p-4 lg:max-h-[calc(100vh-360px)]">
              <ChatThread messages={messages} />
              <div ref={threadEndRef} />
            </div>

            {/* Composer */}
            <div className="border-t p-3">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Type a reply as the business owner…"
                rows={2}
                className="resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && draft.trim()) sendMutation.mutate()
                }}
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => suggestMutation.mutate()}
                  disabled={suggestMutation.isPending}
                >
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  {suggestMutation.isPending ? 'Drafting…' : 'AI draft'}
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() => sendMutation.mutate()}
                  disabled={!draft.trim() || sendMutation.isPending}
                >
                  <Send className="h-3.5 w-3.5" />
                  {sendMutation.isPending ? 'Sending…' : 'Send'}
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
