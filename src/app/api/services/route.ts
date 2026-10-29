import { ok, parseBody, toErrorResponse } from '@/server/core/api'
import { createServiceSchema } from '@/server/schemas'
import { getBusiness } from '@/server/services/messaging_service'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET /api/services — bookable service list
export async function GET() {
  try {
    const business = await getBusiness()
    const services = await db.service.findMany({
      where: { businessId: business.id },
      orderBy: { createdAt: 'asc' },
    })
    return ok({ services })
  } catch (e) {
    return toErrorResponse(e)
  }
}

// POST /api/services — add a bookable service
export async function POST(req: Request) {
  try {
    const business = await getBusiness()
    const input = await parseBody(req, createServiceSchema)
    const service = await db.service.create({
      data: { businessId: business.id, ...input },
    })
    return ok({ service }, 201)
  } catch (e) {
    return toErrorResponse(e)
  }
}
