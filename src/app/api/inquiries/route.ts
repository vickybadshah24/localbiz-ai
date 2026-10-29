import { ok, parseBody, toErrorResponse } from '@/server/core/api'
import { createInquirySchema } from '@/server/schemas'
import { getBusiness, handleInbound } from '@/server/services/messaging_service'
import { serializeInquiry } from '@/server/services/serialize'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET /api/inquiries?status=OPEN|RESOLVED
export async function GET(req: Request) {
  try {
    const business = await getBusiness()
    const url = new URL(req.url)
    const status = url.searchParams.get('status')

    const rows = await db.inquiry.findMany({
      where: { businessId: business.id, ...(status ? { status } : {}) },
      orderBy: { lastMessageAt: 'desc' },
      include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
      take: 100,
    })
    return ok({ inquiries: rows.map(serializeInquiry) })
  } catch (e) {
    return toErrorResponse(e)
  }
}

// POST /api/inquiries — customer opens a conversation from any channel
export async function POST(req: Request) {
  try {
    const input = await parseBody(req, createInquirySchema)
    const result = await handleInbound({
      channel: input.channel,
      customerName: input.customerName,
      customerPhone: input.customerPhone ?? null,
      text: input.message,
    })
    return ok(
      {
        inquiry: serializeInquiry(result.inquiry),
        customerMessage: result.customerMessage,
        assistantMessage: result.assistantMessage,
        ai: result.ai,
      },
      201
    )
  } catch (e) {
    return toErrorResponse(e)
  }
}
