import { ok, parseBody, toErrorResponse } from '@/server/core/api'
import { updateKnowledgeSchema } from '@/server/schemas'
import { getBusiness } from '@/server/services/messaging_service'
import { deleteEntry, updateEntry } from '@/server/services/knowledge_service'

export const dynamic = 'force-dynamic'

// PATCH /api/knowledge/[id]
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const business = await getBusiness()
    const patch = await parseBody(req, updateKnowledgeSchema)
    const entry = await updateEntry(business.id, id, patch)
    return ok({ entry })
  } catch (e) {
    return toErrorResponse(e)
  }
}

// DELETE /api/knowledge/[id]
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const business = await getBusiness()
    await deleteEntry(business.id, id)
    return ok({ ok: true })
  } catch (e) {
    return toErrorResponse(e)
  }
}
