import { ok, toErrorResponse } from '@/server/core/api'
import { getBusiness, } from '@/server/services/messaging_service'
import { suggestOwnerReply } from '@/server/services/ai_service'
import { db } from '@/lib/db'
import { ApiError } from '@/server/core/api'
import type { Message } from '@prisma/client'

export const dynamic = 'force-dynamic'

// POST /api/inquiries/[id]/suggest — AI drafts an owner reply (not sent)
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const business = await getBusiness()
    const inquiry = await db.inquiry.findFirst({
      where: { id, businessId: business.id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    })
    if (!inquiry) throw new ApiError('Inquiry not found', 404)

    const history: Array<Pick<Message, 'role' | 'content'>> = inquiry.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }))
    const suggestion = await suggestOwnerReply(business, inquiry, history)
    return ok({ suggestion })
  } catch (e) {
    return toErrorResponse(e)
  }
}
