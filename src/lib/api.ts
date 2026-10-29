// Typed API client (mirrors frontend/lib/api.ts in the target monorepo).
// All datetimes are business-time (UTC in this deployment) — format with the
// helpers in lib/format.ts so slot labels stay consistent end-to-end.

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED'
export type InquiryStatus = 'OPEN' | 'RESOLVED'
export type MessageRole = 'CUSTOMER' | 'ASSISTANT' | 'OWNER'
export type Channel = 'WEB_CHAT' | 'WHATSAPP'
export type BookingSource = 'MANUAL' | 'WEB_CHAT' | 'WHATSAPP' | 'AI'
export type KnowledgeCategory = 'pricing' | 'policy' | 'faq' | 'services' | 'general'

export interface DayHours {
  closed: boolean
  open: string
  close: string
}
export type WorkingHours = Record<string, DayHours>

export interface Booking {
  id: string
  serviceId: string | null
  serviceName: string | null
  durationMin: number | null
  priceCents: number | null
  customerName: string
  customerPhone: string | null
  startsAt: string
  endsAt: string
  status: BookingStatus
  notes: string | null
  source: BookingSource
  createdAt: string
}

export interface Inquiry {
  id: string
  customerName: string
  customerPhone: string | null
  channel: Channel
  status: InquiryStatus
  lastMessageAt: string
  createdAt: string
  lastMessage: string | null
}

export interface Message {
  id: string
  inquiryId: string
  role: MessageRole
  content: string
  createdAt: string
}

export interface InquiryDetail extends Omit<Inquiry, 'lastMessage'> {
  businessId: string
  messages: Message[]
}

export interface Service {
  id: string
  name: string
  description: string | null
  durationMin: number
  priceCents: number
  active: boolean
}

export interface KnowledgeEntry {
  id: string
  title: string
  content: string
  category: KnowledgeCategory
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface Business {
  id: string
  name: string
  industry: string
  phone: string | null
  email: string | null
  address: string | null
  timezone: string
  workingHours: WorkingHours
  aiPersona: string
  autoReply: boolean
  whatsappConnected: boolean
  whatsappNumber: string | null
  verifyToken: string | null
  whatsappApiConfigured: boolean
}

export interface DashboardStats {
  todayBookings: number
  weekBookings: number
  openInquiries: number
  newInquiries: number
  revenueWeekCents: number
  trend: Array<{ date: string; count: number }>
  upcoming: Booking[]
  recentInquiries: Inquiry[]
  todaySchedule: Booking[]
}

export interface BookingDraft {
  serviceName?: string
  date?: string
  time?: string
  customerName?: string
  customerPhone?: string
}

export interface AiInfo {
  reply: string
  intent: 'booking_request' | 'question' | 'general' | 'complaint' | 'greeting'
  bookingDraft: BookingDraft | null
  degraded: boolean
}

export interface Availability {
  date: string
  closed: boolean
  slots: Array<{ time: string; startsAt: string }>
}

export interface CreateBookingInput {
  serviceId: string
  customerName: string
  customerPhone?: string | null
  startsAt: string
  notes?: string | null
  source?: BookingSource
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((data as { error?: string })?.error || `Request failed (${res.status})`)
  }
  return data as T
}

const qs = (params: Record<string, string | undefined>) => {
  const search = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v) search.set(k, v)
  const s = search.toString()
  return s ? `?${s}` : ''
}

export const api = {
  // Dashboard
  dashboard: () => request<DashboardStats>('/api/dashboard'),

  // Bookings
  bookings: (params: { status?: string; upcoming?: string; from?: string; to?: string } = {}) =>
    request<{ bookings: Booking[] }>(`/api/bookings${qs(params)}`).then((r) => r.bookings),
  createBooking: (body: CreateBookingInput) =>
    request<{ booking: Booking }>('/api/bookings', { method: 'POST', body: JSON.stringify(body) }).then((r) => r.booking),
  updateBooking: (id: string, patch: { status?: BookingStatus; startsAt?: string; notes?: string | null }) =>
    request<{ booking: Booking }>(`/api/bookings/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }).then((r) => r.booking),
  availability: (date: string, serviceId: string) =>
    request<Availability>(`/api/bookings/availability${qs({ date, serviceId })}`),

  // Inquiries
  inquiries: (status?: string) =>
    request<{ inquiries: Inquiry[] }>(`/api/inquiries${qs({ status })}`).then((r) => r.inquiries),
  inquiry: (id: string) =>
    request<{ inquiry: InquiryDetail }>(`/api/inquiries/${id}`).then((r) => r.inquiry),
  updateInquiry: (id: string, patch: { status?: InquiryStatus }) =>
    request<{ inquiry: Inquiry }>(`/api/inquiries/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }).then((r) => r.inquiry),
  postOwnerMessage: (id: string, content: string) =>
    request<{ message: Message }>(`/api/inquiries/${id}/messages`, { method: 'POST', body: JSON.stringify({ content }) }).then((r) => r.message),
  suggestReply: (id: string) =>
    request<{ suggestion: string }>(`/api/inquiries/${id}/suggest`, { method: 'POST' }).then((r) => r.suggestion),

  // Public web chat
  chat: (body: { inquiryId?: string | null; message: string; customerName?: string }) =>
    request<{ inquiryId: string; customerMessage: Message; assistantMessage: Message | null; ai: AiInfo | null }>(
      '/api/chat',
      { method: 'POST', body: JSON.stringify(body) }
    ),

  // Settings / business
  settings: () => request<{ business: Business; services: Service[] }>('/api/settings'),
  updateSettings: (
    patch: Partial<{
      name: string
      industry: string
      phone: string | null
      email: string | null
      address: string | null
      timezone: string
      workingHours: WorkingHours
      aiPersona: string
      autoReply: boolean
      whatsappNumber: string | null
      whatsappConnected: boolean
    }>
  ) =>
    request<{ business: Business }>('/api/settings', { method: 'PUT', body: JSON.stringify(patch) }).then((r) => r.business),

  // Services
  services: () => request<{ services: Service[] }>('/api/services').then((r) => r.services),
  createService: (body: { name: string; description?: string | null; durationMin: number; priceCents: number }) =>
    request<{ service: Service }>('/api/services', { method: 'POST', body: JSON.stringify(body) }).then((r) => r.service),

  // Knowledge base
  knowledge: () => request<{ entries: KnowledgeEntry[] }>('/api/knowledge').then((r) => r.entries),
  createKnowledge: (body: { title: string; content: string; category: KnowledgeCategory }) =>
    request<{ entry: KnowledgeEntry }>('/api/knowledge', { method: 'POST', body: JSON.stringify(body) }).then((r) => r.entry),
  updateKnowledge: (id: string, patch: { title?: string; content?: string; category?: KnowledgeCategory; active?: boolean }) =>
    request<{ entry: KnowledgeEntry }>(`/api/knowledge/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }).then((r) => r.entry),
  deleteKnowledge: (id: string) => request<{ ok: boolean }>(`/api/knowledge/${id}`, { method: 'DELETE' }),

  // WhatsApp webhook (also used by the "simulate inbound" tester)
  sendWebhook: (payload: unknown) =>
    request<{ received: number }>('/api/webhooks/whatsapp', { method: 'POST', body: JSON.stringify(payload) }),
}
