import { ok, parseBody, toErrorResponse } from '@/server/core/api'
import { updateInquirySchema } from '@/server/schemas'
import { getBusiness } from '@/server/services/messaging_service'
import { db } from '@/lib/db'
import { ApiError } from '@/server/core/api'

export const dynamic = 'force-dynamic'

// GET /api/inquiries/[id] — inquiry with full message thread
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const business = await getBusiness()
    const inquiry = await db.inquiry.findFirst({
      where: { id, businessId: business.id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    })
    if (!inquiry) throw new ApiError('Inquiry not found', 404)
    return ok({ inquiry: { ...inquiry, messages: inquiry.messages } })
  } catch (e) {
    return toErrorResponse(e)
  }
}

// PATCH /api/inquiries/[id] — open / resolved
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const business = await getBusiness()
    const patch = await parseBody(req, updateInquirySchema)
    const existing = await db.inquiry.findFirst({ where: { id, businessId: business.id } })
    if (!existing) throw new ApiError('Inquiry not found', 404)
    const inquiry = await db.inquiry.update({ where: { id }, data: patch })
    return ok({ inquiry })
  } catch (e) {
    return toErrorResponse(e)
  }
}
