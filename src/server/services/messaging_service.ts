// Messaging service (mirrors backend/app/services/messaging_service.py)
// Orchestrates conversations: persistence, AI auto-reply, WhatsApp delivery.

import type { Inquiry, Message, Business } from '@prisma/client'
import { db } from '@/lib/db'
import { ApiError } from '../core/api'
import { sendWhatsAppText } from '../integrations/whatsapp'
import { generateAssistantReply } from './ai_service'

export async function getBusiness(businessId?: string | null): Promise<Business> {
  const business = businessId
    ? await db.business.findUnique({ where: { id: businessId } })
    : await db.business.findFirst()
  if (!business) {
    throw new ApiError('No business configured — run the seed script (bun prisma/seed.ts)', 500)
  }
  return business
}

export interface InboundInput {
  businessId?: string | null
  channel: 'WEB_CHAT' | 'WHATSAPP'
  customerName?: string | null
  customerPhone?: string | null
  text: string
}

export interface ProcessedInbound {
  inquiry: Inquiry
  customerMessage: Message
  assistantMessage: Message | null
  ai: { reply: string; intent: string; bookingDraft: Record<string, unknown> | null; degraded: boolean } | null
  delivery?: { delivered: boolean; simulated: boolean; error?: string }
}

async function loadHistory(inquiryId: string) {
  return db.message.findMany({ where: { inquiryId }, orderBy: { createdAt: 'asc' } })
}

/** Customer message arrives from any channel; store it and auto-reply if enabled. */
export async function handleInbound(input: InboundInput): Promise<ProcessedInbound> {
  const business = await getBusiness(input.businessId)

  let inquiry: Inquiry | null = null
  if (input.customerPhone) {
    inquiry = await db.inquiry.findFirst({
      where: { businessId: business.id, customerPhone: input.customerPhone, status: 'OPEN' },
      orderBy: { lastMessageAt: 'desc' },
    })
  }
  if (!inquiry) {
    inquiry = await db.inquiry.create({
      data: {
        businessId: business.id,
        customerName: input.customerName?.trim() || (input.channel === 'WHATSAPP' ? 'WhatsApp customer' : 'Web visitor'),
        customerPhone: input.customerPhone ?? null,
        channel: input.channel,
      },
    })
  }

  const customerMessage = await db.message.create({
    data: { inquiryId: inquiry.id, role: 'CUSTOMER', content: input.text },
  })

  let assistantMessage: Message | null = null
  let ai: ProcessedInbound['ai'] = null
  let delivery: ProcessedInbound['delivery']

  if (business.autoReply) {
    const history = await loadHistory(inquiry.id)
    const reply = await generateAssistantReply(business, inquiry, history.slice(0, -1), input.text)
    assistantMessage = await db.message.create({
      data: { inquiryId: inquiry.id, role: 'ASSISTANT', content: reply.reply },
    })
    ai = {
      reply: reply.reply,
      intent: reply.intent,
      bookingDraft: reply.bookingDraft as Record<string, unknown> | null,
      degraded: reply.degraded,
    }
    if (input.channel === 'WHATSAPP' && inquiry.customerPhone) {
      delivery = await sendWhatsAppText(inquiry.customerPhone, reply.reply)
    }
  }

  const lastMessageAt = new Date()
  await db.inquiry.update({ where: { id: inquiry.id }, data: { lastMessageAt } })

  return {
    inquiry: { ...inquiry, lastMessageAt },
    customerMessage,
    assistantMessage,
    ai,
    delivery,
  }
}

/** Owner sends a manual reply from the inquiries console. */
export async function ownerReply(inquiryId: string, content: string): Promise<Message> {
  const inquiry = await db.inquiry.findUnique({ where: { id: inquiryId } })
  if (!inquiry) throw new ApiError('Inquiry not found', 404)
  const message = await db.message.create({
    data: { inquiryId, role: 'OWNER', content },
  })
  await db.inquiry.update({ where: { id: inquiryId }, data: { lastMessageAt: new Date() } })
  return message
}

/** Public web-chat widget endpoint: per-visitor inquiry, AI reply, booking draft. */
export async function processWebChat(input: {
  businessId?: string | null
  inquiryId?: string | null
  message: string
  customerName?: string | null
}): Promise<ProcessedInbound> {
  const business = await getBusiness(input.businessId)

  let inquiry: Inquiry | null = null
  if (input.inquiryId) {
    inquiry = await db.inquiry.findFirst({ where: { id: input.inquiryId, businessId: business.id } })
    if (!inquiry) throw new ApiError('Inquiry not found', 404)
  } else {
    inquiry = await db.inquiry.create({
      data: {
        businessId: business.id,
        customerName: input.customerName?.trim() || 'Web visitor',
        channel: 'WEB_CHAT',
      },
    })
  }

  const customerMessage = await db.message.create({
    data: { inquiryId: inquiry.id, role: 'CUSTOMER', content: input.message },
  })

  let assistantMessage: Message | null = null
  let ai: ProcessedInbound['ai'] = null

  if (business.autoReply) {
    const history = await loadHistory(inquiry.id)
    const reply = await generateAssistantReply(business, inquiry, history.slice(0, -1), input.message)
    assistantMessage = await db.message.create({
      data: { inquiryId: inquiry.id, role: 'ASSISTANT', content: reply.reply },
    })
    ai = {
      reply: reply.reply,
      intent: reply.intent,
      bookingDraft: reply.bookingDraft as Record<string, unknown> | null,
      degraded: reply.degraded,
    }
  }

  const lastMessageAt = new Date()
  await db.inquiry.update({ where: { id: inquiry.id }, data: { lastMessageAt } })

  return {
    inquiry: { ...inquiry, lastMessageAt },
    customerMessage,
    assistantMessage,
    ai,
  }
}
