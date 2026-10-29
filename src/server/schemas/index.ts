import { z } from 'zod'
import { DAY_KEYS } from '../core/time'

export const bookingStatusSchema = z.enum(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'])
export const inquiryStatusSchema = z.enum(['OPEN', 'RESOLVED'])
export const messageRoleSchema = z.enum(['CUSTOMER', 'ASSISTANT', 'OWNER'])
export const channelSchema = z.enum(['WEB_CHAT', 'WHATSAPP'])
export const bookingSourceSchema = z.enum(['MANUAL', 'WEB_CHAT', 'WHATSAPP', 'AI'])
export const knowledgeCategorySchema = z.enum(['pricing', 'policy', 'faq', 'services', 'general'])

const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/

export const dayHoursSchema = z.object({
  closed: z.boolean(),
  open: z.string().regex(timeRe, 'Use HH:MM (24h)'),
  close: z.string().regex(timeRe, 'Use HH:MM (24h)'),
})

export const workingHoursSchema = z.object(
  Object.fromEntries(DAY_KEYS.map((k) => [k, dayHoursSchema])) as Record<
    (typeof DAY_KEYS)[number],
    typeof dayHoursSchema
  >
)

export const createBookingSchema = z.object({
  serviceId: z.string().min(1, 'serviceId is required'),
  customerName: z.string().min(1, 'Customer name is required').max(120),
  customerPhone: z.string().max(40).optional().nullable(),
  // ISO datetime of the slot start
  startsAt: z.string().min(8, 'startsAt (ISO datetime) is required'),
  notes: z.string().max(500).optional().nullable(),
  source: bookingSourceSchema.default('MANUAL'),
})

export const updateBookingSchema = z.object({
  status: bookingStatusSchema.optional(),
  startsAt: z.string().min(8).optional(),
  notes: z.string().max(500).optional().nullable(),
})

export const createInquirySchema = z.object({
  customerName: z.string().min(1).max(120),
  customerPhone: z.string().max(40).optional().nullable(),
  channel: channelSchema.default('WEB_CHAT'),
  message: z.string().min(1).max(4000),
})

export const updateInquirySchema = z.object({
  status: inquiryStatusSchema.optional(),
})

export const postMessageSchema = z.object({
  content: z.string().min(1).max(4000),
})

export const chatSchema = z.object({
  inquiryId: z.string().optional().nullable(),
  message: z.string().min(1).max(4000),
  customerName: z.string().max(120).optional(),
})

export const settingsUpdateSchema = z.object({
  name: z.string().min(1).max(160).optional(),
  industry: z.string().max(120).optional(),
  phone: z.string().max(40).optional().nullable(),
  email: z.string().max(160).optional().nullable(),
  address: z.string().max(300).optional().nullable(),
  timezone: z.string().max(60).optional(),
  workingHours: workingHoursSchema.optional(),
  aiPersona: z.string().max(2000).optional(),
  autoReply: z.boolean().optional(),
  whatsappNumber: z.string().max(40).optional().nullable(),
  whatsappConnected: z.boolean().optional(),
})

export const createServiceSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().nullable(),
  durationMin: z.number().int().min(5).max(600),
  priceCents: z.number().int().min(0),
  active: z.boolean().default(true),
})

export const createKnowledgeSchema = z.object({
  title: z.string().min(1).max(160),
  content: z.string().min(1).max(4000),
  category: knowledgeCategorySchema.default('general'),
})

export const updateKnowledgeSchema = z.object({
  title: z.string().min(1).max(160).optional(),
  content: z.string().min(1).max(4000).optional(),
  category: knowledgeCategorySchema.optional(),
  active: z.boolean().optional(),
})

// --- AI structured output ---
export const aiBookingDraftSchema = z.object({
  serviceName: z.string().nullish(), // LLM may send explicit nulls
  date: z.string().nullish(), // YYYY-MM-DD
  time: z.string().nullish(), // HH:MM
  customerName: z.string().nullish(),
  customerPhone: z.string().nullish(),
})

export const aiReplySchema = z.object({
  reply: z.string().min(1),
  // LLMs occasionally emit a label outside the contract — fall back gracefully
  intent: z
    .enum(['booking_request', 'question', 'general', 'complaint', 'greeting'])
    .catch('general'),
  booking: aiBookingDraftSchema.nullish(),
})
