// AI service (mirrors backend/app/services/ai_service.py)
// Builds a grounded system prompt from the business profile + knowledge base,
// asks the LLM for a strict-JSON reply, and degrades gracefully to a
// heuristic reply when the LLM is unavailable.

import type { Business, Inquiry } from '@prisma/client'
import { db } from '@/lib/db'
import { AI_HISTORY_LIMIT, AI_KNOWLEDGE_LIMIT } from '../core/config'
import { extractJson, llmComplete, type LlmMessage } from '../integrations/llm'
import { aiReplySchema } from '../schemas'
import { parseWorkingHours, DAY_KEYS } from '../core/time'
import { retrieveKnowledge } from './knowledge_service'

export interface BookingDraft {
  serviceName?: string
  date?: string
  time?: string
  customerName?: string
  customerPhone?: string
}

export interface AiReply {
  reply: string
  intent: 'booking_request' | 'question' | 'general' | 'complaint' | 'greeting'
  bookingDraft: BookingDraft | null
  degraded: boolean
}

interface HistoryItem {
  role: string
  content: string
}

interface ServiceInfo {
  name: string
  durationMin: number
  priceCents: number
  description?: string | null
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

function formatHours(raw: string | null | undefined): string {
  const hours = parseWorkingHours(raw)
  return DAY_KEYS.map((key) => {
    const day = hours[key]
    const label = key.charAt(0).toUpperCase() + key.slice(1)
    return `- ${label}: ${day.closed ? 'closed' : `${day.open}–${day.close}`}`
  }).join('\n')
}

function buildSystemPrompt(
  business: Business,
  services: ServiceInfo[],
  knowledge: Array<{ title: string; content: string; category: string }>
): string {
  const now = new Date()
  const nowLabel = now.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  const serviceLines = services.length
    ? services.map((s) => `- ${s.name} — ${s.durationMin} min — ${formatMoney(s.priceCents)}`).join('\n')
    : '- (service list not configured yet; ask the customer what they need and say the team will confirm)'

  const knowledgeText = knowledge.length
    ? knowledge.map((k) => `[${k.category}] ${k.title}: ${k.content}`).join('\n')
    : '(no extra knowledge entries matched)'

  return `You are the AI front-desk assistant for "${business.name}" (${business.industry}).

Current date & time: ${nowLabel}. Business timezone: ${business.timezone}.

## Business profile
- Phone: ${business.phone ?? 'n/a'}
- Email: ${business.email ?? 'n/a'}
- Address: ${business.address ?? 'n/a'}

## Opening hours
${formatHours(business.workingHours)}

## Services & prices
${serviceLines}

## Knowledge base (use this to answer questions)
${knowledgeText}

## Tone & persona
${business.aiPersona}

## Rules
1. Answer customer questions using ONLY the information above. If something is not covered, say politely that you will check with the team — never invent facts, prices or services.
2. If the customer wants to book or asks for a time slot, identify the service, date and time. Resolve relative dates ("tomorrow", "next Friday") against the current date. Put the result in "booking".
3. Keep the reply short and WhatsApp-friendly: 1–4 sentences, plain text, no markdown lists.
4. If key details are missing (which service, which day/time), ask ONE short follow-up question instead of guessing.
5. For complaints, apologize briefly, promise a follow-up from the team, and do not offer compensation.

## Output format
Respond with STRICT JSON only — no text outside the JSON:
{"reply": "<your message to the customer>", "intent": "booking_request|question|general|complaint|greeting", "booking": null}
Include a "booking" object ONLY when the customer clearly wants an appointment:
{"reply": "...", "intent": "booking_request", "booking": {"serviceName": "...", "date": "YYYY-MM-DD", "time": "HH:MM", "customerName": "...", "customerPhone": "..."}}
Use the customer's name from the conversation when known; otherwise omit customerName.`
}

function historyToMessages(history: HistoryItem[]): LlmMessage[] {
  return history.slice(-AI_HISTORY_LIMIT).map((h): LlmMessage => {
    if (h.role === 'CUSTOMER') return { role: 'user', content: h.content }
    if (h.role === 'OWNER') return { role: 'assistant', content: `(the owner replied) ${h.content}` }
    return { role: 'assistant', content: h.content }
  })
}

const BOOKING_WORDS = ['book', 'appointment', 'slot', 'schedule', 'reserve', 'availability', 'available', 'visit', 'come in']
const COMPLAINT_WORDS = ['complain', 'complaint', 'angry', 'refund', 'terrible', 'awful', 'unacceptable', 'late', 'broken', 'rude']
const GREETING_RE = /^\s*(hello|hi|hey|good\s?(morning|afternoon|evening))\b/

function detectIntent(text: string): AiReply['intent'] {
  const lower = text.toLowerCase()
  if (COMPLAINT_WORDS.some((w) => lower.includes(w))) return 'complaint'
  if (BOOKING_WORDS.some((w) => lower.includes(w))) return 'booking_request'
  if (GREETING_RE.test(lower)) return 'greeting'
  return 'question'
}

function heuristicReply(
  business: Business,
  services: ServiceInfo[],
  knowledge: Array<{ title: string; content: string; category: string }>,
  userMessage: string
): AiReply {
  const intent = detectIntent(userMessage)
  const lower = userMessage.toLowerCase()
  let reply: string

  if (intent === 'booking_request') {
    const list = services
      .slice(0, 4)
      .map((s) => `${s.name} (${s.durationMin} min, ${formatMoney(s.priceCents)})`)
      .join(', ')
    reply = services.length
      ? `I'd be happy to book that for you! We offer: ${list}. Which service would you like, and on what day and time?`
      : `I'd be happy to help you book a visit! What did you have in mind, and what day and time suits you?`
  } else if (intent === 'complaint') {
    reply = `I'm really sorry about your experience at ${business.name}. I've flagged this to the team right away and someone will follow up with you shortly to make it right.`
  } else if (intent === 'greeting') {
    reply = `Hi! Thanks for reaching out to ${business.name}. 😊 How can I help — booking an appointment, prices, or a general question?`
  } else if (knowledge.length > 0 && knowledge[0]) {
    const k = knowledge[0]
    const snippet = k.content.length > 280 ? `${k.content.slice(0, 280)}…` : k.content
    reply = `${k.title}: ${snippet}`
  } else {
    reply = `Great question! Let me check with the team at ${business.name} and get right back to you. In the meantime, is there anything else I can help with?`
  }

  // Simple demo nicety: recognise a price question when no knowledge matched.
  if (intent === 'question' && knowledge.length === 0 && /(price|cost|how much)/.test(lower) && services.length) {
    reply = `Our services: ${services.map((s) => `${s.name} ${formatMoney(s.priceCents)}`).join(', ')}. Would you like me to book one for you?`
  }

  return { reply, intent, bookingDraft: null, degraded: true }
}

export async function generateAssistantReply(
  business: Business,
  _inquiry: Inquiry,
  history: HistoryItem[],
  userMessage: string
): Promise<AiReply> {
  const services = await db.service.findMany({
    where: { businessId: business.id, active: true },
    orderBy: { createdAt: 'asc' },
  })
  const knowledge = await retrieveKnowledge(business.id, userMessage, AI_KNOWLEDGE_LIMIT)
  const system = buildSystemPrompt(business, services, knowledge)

  const messages: LlmMessage[] = [
    { role: 'system', content: system },
    ...historyToMessages(history),
    { role: 'user', content: userMessage },
  ]

  try {
    const raw = await llmComplete(messages, { temperature: 0.5, maxTokens: 600 })
    const parsed = extractJson<unknown>(raw)
    if (!parsed) throw new Error('No JSON object in LLM output')
    const validated = aiReplySchema.parse(parsed)
    return {
      reply: validated.reply.trim(),
      intent: validated.intent,
      bookingDraft: validated.booking ?? null,
      degraded: false,
    }
  } catch (e) {
    console.error('[ai_service] falling back to heuristic reply:', (e as Error).message)
    return heuristicReply(business, services, knowledge, userMessage)
  }
}

/** Draft a reply for the business owner (human tone, plain text). */
export async function suggestOwnerReply(
  business: Business,
  inquiry: Inquiry,
  history: HistoryItem[]
): Promise<string> {
  const services = await db.service.findMany({ where: { businessId: business.id, active: true } })
  const lastCustomer = [...history].reverse().find((h) => h.role === 'CUSTOMER')
  const knowledge = await retrieveKnowledge(business.id, lastCustomer?.content ?? '', AI_KNOWLEDGE_LIMIT)

  const system = `You draft replies for the OWNER of "${business.name}" (${business.industry}).
Write ONE short ready-to-send reply (1–4 sentences) to the customer's latest message.
Tone: ${business.aiPersona} Write as a human owner — first person, warm, no sign-offs, no quotes, no JSON, plain text only.

## Business facts you may use
Opening hours:
${formatHours(business.workingHours)}
Services: ${services.map((s) => `${s.name} (${s.durationMin} min, ${formatMoney(s.priceCents)})`).join('; ') || 'n/a'}
${knowledge.map((k) => `[${k.category}] ${k.title}: ${k.content}`).join('\n') || ''}

Return ONLY the reply text.`

  try {
    const raw = await llmComplete(
      [
        { role: 'system', content: system },
        ...historyToMessages(history),
      ],
      { temperature: 0.6, maxTokens: 300 }
    )
    return raw.trim().replace(/^["']|["']$/g, '')
  } catch (e) {
    console.error('[ai_service] owner-suggest fallback:', (e as Error).message)
    const topic = lastCustomer ? `"${lastCustomer.content.slice(0, 80)}"` : 'your message'
    const k = knowledge[0]
    return `Hi ${inquiry.customerName}, thanks for your message about ${topic}. ${k ? `${k.content.slice(0, 160)} ` : ''}Happy to help — just let me know what works for you!`
  }
}
