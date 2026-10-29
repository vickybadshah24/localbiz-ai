'use client'

import { Sparkles, UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fmtTime } from '@/lib/format'
import type { Message } from '@/lib/api'

function Bubble({ message }: { message: Message }) {
  const isCustomer = message.role === 'CUSTOMER'
  const isOwner = message.role === 'OWNER'

  return (
    <div className={cn('flex w-full gap-2', isCustomer ? 'justify-start' : 'justify-end')}>
      {isCustomer && (
        <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
          <UserRound className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      )}
      <div className={cn('max-w-[80%] space-y-1', isCustomer ? 'items-start' : 'items-end')}>
        {!isCustomer && (
          <p className={cn('flex items-center gap-1 px-1 text-[10px] font-medium', isOwner ? 'text-primary-foreground/80' : 'text-primary/80')}>
            {isOwner ? (
              'You (owner)'
            ) : (
              <>
                <Sparkles className="h-3 w-3" /> AI assistant
              </>
            )}
          </p>
        )}
        <div
          className={cn(
            'rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm',
            isCustomer
              ? 'rounded-tl-md bg-muted text-foreground'
              : isOwner
                ? 'rounded-tr-md bg-primary text-primary-foreground'
                : 'rounded-tr-md border bg-card text-foreground'
          )}
        >
          {message.content}
        </div>
        <p className={cn('px-1 text-[10px] text-muted-foreground', isCustomer ? 'text-left' : 'text-right')}>
          {fmtTime(message.createdAt)}
        </p>
      </div>
      {!isCustomer && (
        <div className={cn('mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full', isOwner ? 'bg-primary/15' : 'bg-primary/10')}>
          <Sparkles className={cn('h-3.5 w-3.5', isOwner ? 'text-primary' : 'text-primary')} />
        </div>
      )}
    </div>
  )
}

export default function ChatThread({ messages }: { messages: Message[] }) {
  return (
    <div className="flex flex-col gap-4" role="log" aria-label="Conversation">
      {messages.map((m) => (
        <Bubble key={m.id} message={m} />
      ))}
    </div>
  )
}
