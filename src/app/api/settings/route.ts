import { ok, parseBody, toErrorResponse } from '@/server/core/api'
import { settingsUpdateSchema } from '@/server/schemas'
import { getBusiness } from '@/server/services/messaging_service'
import { db } from '@/lib/db'
import { isWhatsAppConfigured } from '@/server/core/config'

export const dynamic = 'force-dynamic'

function serializeBusiness(b: {
  id: string
  name: string
  industry: string
  phone: string | null
  email: string | null
  address: string | null
  timezone: string
  workingHours: string
  aiPersona: string
  autoReply: boolean
  whatsappConnected: boolean
  whatsappNumber: string | null
  verifyToken: string | null
}) {
  return {
    id: b.id,
    name: b.name,
    industry: b.industry,
    phone: b.phone,
    email: b.email,
    address: b.address,
    timezone: b.timezone,
    workingHours: JSON.parse(b.workingHours || '{}'),
    aiPersona: b.aiPersona,
    autoReply: b.autoReply,
    whatsappConnected: b.whatsappConnected,
    whatsappNumber: b.whatsappNumber,
    verifyToken: b.verifyToken,
    whatsappApiConfigured: isWhatsAppConfigured(),
  }
}

// GET /api/settings — business profile + AI + integration state
export async function GET() {
  try {
    const business = await getBusiness()
    const services = await db.service.findMany({
      where: { businessId: business.id },
      orderBy: { createdAt: 'asc' },
    })
    return ok({ business: serializeBusiness(business), services })
  } catch (e) {
    return toErrorResponse(e)
  }
}

// PUT /api/settings — update profile / AI / WhatsApp settings
export async function PUT(req: Request) {
  try {
    const business = await getBusiness()
    const input = await parseBody(req, settingsUpdateSchema)
    const data: Record<string, unknown> = {}
    if (input.name !== undefined) data.name = input.name
    if (input.industry !== undefined) data.industry = input.industry
    if (input.phone !== undefined) data.phone = input.phone
    if (input.email !== undefined) data.email = input.email
    if (input.address !== undefined) data.address = input.address
    if (input.timezone !== undefined) data.timezone = input.timezone
    if (input.workingHours !== undefined) data.workingHours = JSON.stringify(input.workingHours)
    if (input.aiPersona !== undefined) data.aiPersona = input.aiPersona
    if (input.autoReply !== undefined) data.autoReply = input.autoReply
    if (input.whatsappNumber !== undefined) data.whatsappNumber = input.whatsappNumber
    if (input.whatsappConnected !== undefined) {
      data.whatsappConnected = input.whatsappConnected
      if (input.whatsappConnected && !business.verifyToken) {
        data.verifyToken = crypto.randomUUID().replace(/-/g, '')
      }
    }
    const updated = await db.business.update({ where: { id: business.id }, data })
    return ok({ business: serializeBusiness(updated) })
  } catch (e) {
    return toErrorResponse(e)
  }
}
