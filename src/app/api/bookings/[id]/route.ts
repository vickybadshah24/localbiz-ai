import { ok, parseBody, toErrorResponse } from '@/server/core/api'
import { updateBookingSchema } from '@/server/schemas'
import { getBusiness } from '@/server/services/messaging_service'
import { updateBooking } from '@/server/services/booking_service'
import { serializeBooking } from '@/server/services/serialize'

export const dynamic = 'force-dynamic'

// PATCH /api/bookings/[id] — confirm / cancel / complete / reschedule
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const business = await getBusiness()
    const patch = await parseBody(req, updateBookingSchema)
    const booking = await updateBooking(business.id, id, patch)
    return ok({ booking: serializeBooking(booking) })
  } catch (e) {
    return toErrorResponse(e)
  }
}
