import { ok, toErrorResponse, fail } from '@/server/core/api'
import { getBusiness } from '@/server/services/messaging_service'
import { getAvailability } from '@/server/services/booking_service'

export const dynamic = 'force-dynamic'

// GET /api/bookings/availability?date=YYYY-MM-DD&serviceId=...
export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const date = url.searchParams.get('date')
    const serviceId = url.searchParams.get('serviceId')
    if (!date) return fail('Query param "date" (YYYY-MM-DD) is required', 422)
    if (!serviceId) return fail('Query param "serviceId" is required', 422)

    const business = await getBusiness()
    const availability = await getAvailability(business.id, date, serviceId)
    return ok(availability)
  } catch (e) {
    return toErrorResponse(e)
  }
}
