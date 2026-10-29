import { ok, parseBody, toErrorResponse } from '@/server/core/api'
import { createKnowledgeSchema } from '@/server/schemas'
import { getBusiness } from '@/server/services/messaging_service'
import { createEntry, listEntries } from '@/server/services/knowledge_service'

export const dynamic = 'force-dynamic'

// GET /api/knowledge — knowledge base entries
export async function GET() {
  try {
    const business = await getBusiness()
    const entries = await listEntries(business.id)
    return ok({ entries })
  } catch (e) {
    return toErrorResponse(e)
  }
}

// POST /api/knowledge — add an entry the AI can use
export async function POST(req: Request) {
  try {
    const business = await getBusiness()
    const input = await parseBody(req, createKnowledgeSchema)
    const entry = await createEntry(business.id, input)
    return ok({ entry }, 201)
  } catch (e) {
    return toErrorResponse(e)
  }
}
