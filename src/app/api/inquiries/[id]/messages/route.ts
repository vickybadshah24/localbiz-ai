import { ok, parseBody, toErrorResponse } from '@/server/core/api'
import { postMessageSchema } from '@/server/schemas'
import { ownerReply } from '@/server/services/messaging_service'

export const dynamic = 'force-dynamic'

// POST /api/inquiries/[id]/messages — owner manual reply
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const input = await parseBody(req, postMessageSchema)
    const message = await ownerReply(id, input.content)
    return ok({ message }, 201)
  } catch (e) {
    return toErrorResponse(e)
  }
}
