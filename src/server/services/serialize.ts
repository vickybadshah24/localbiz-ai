import type { Booking, Inquiry, Message, Service } from '@prisma/client'

export interface SerializedBooking {
  id: string
  serviceId: string | null
  serviceName: string | null
  durationMin: number | null
  priceCents: number | null
  customerName: string
  customerPhone: string | null
  startsAt: string
  endsAt: string
  status: string
  notes: string | null
  source: string
  createdAt: string
}

export function serializeBooking(b: Booking & { service?: Service | null }): SerializedBooking {
  return {
    id: b.id,
    serviceId: b.serviceId,
    serviceName: b.service?.name ?? null,
    durationMin: b.service?.durationMin ?? null,
    priceCents: b.service?.priceCents ?? null,
    customerName: b.customerName,
    customerPhone: b.customerPhone,
    startsAt: b.startsAt.toISOString(),
    endsAt: b.endsAt.toISOString(),
    status: b.status,
    notes: b.notes,
    source: b.source,
    createdAt: b.createdAt.toISOString(),
  }
}

export interface SerializedInquiry {
  id: string
  customerName: string
  customerPhone: string | null
  channel: string
  status: string
  lastMessageAt: string
  createdAt: string
  lastMessage: string | null
}

export function serializeInquiry(
  i: Inquiry & { messages?: Message[] }
): SerializedInquiry {
  return {
    id: i.id,
    customerName: i.customerName,
    customerPhone: i.customerPhone,
    channel: i.channel,
    status: i.status,
    lastMessageAt: i.lastMessageAt.toISOString(),
    createdAt: i.createdAt.toISOString(),
    lastMessage: i.messages?.[0]?.content ?? null,
  }
}
