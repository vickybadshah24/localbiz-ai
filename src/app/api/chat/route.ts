import { ok, parseBody, toErrorResponse } from '@/server/core/api'
import { chatSchema } from '@/server/schemas'
import { processWebChat } from '@/server/services/messaging_service'

export const dynamic = 'force-dynamic'

// POST /api/chat — public web-chat widget endpoint.
// Creates (or continues) an inquiry, stores the customer message and returns
// the AI assistant reply together with an optional booking draft.
export async function POST(req: Request) {
  try {
    const input = await parseBody(req, chatSchema)
    const result = await processWebChat({
      inquiryId: input.inquiryId ?? null,
      message: input.message,
      customerName: input.customerName ?? null,
    })
    return ok({
      inquiryId: result.inquiry.id,
      customerMessage: result.customerMessage,
      assistantMessage: result.assistantMessage,
      ai: result.ai,
    })
  } catch (e) {
    return toErrorResponse(e)
  }
}
