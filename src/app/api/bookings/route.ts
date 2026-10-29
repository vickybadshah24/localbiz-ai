import { ok, parseBody, toErrorResponse } from '@/server/core/api'
import { createBookingSchema } from '@/server/schemas'
import { getBusiness } from '@/server/services/messaging_service'
import { createBooking, listBookings } from '@/server/services/booking_service'
import { serializeBooking } from '@/server/services/serialize'

export const dynamic = 'force-dynamic'

// GET /api/bookings?status=&from=&to=&upcoming=1
export async function GET(req: Request) {
  try {
    const business = await getBusiness()
    const url = new URL(req.url)
    const status = url.searchParams.get('status') ?? undefined
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')
    const upcoming = url.searchParams.get('upcoming')

    const bookings = await listBookings(business.id, {
      status: status ?? undefined,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      upcomingOnly: upcoming === '1',
    })
    return ok({ bookings: bookings.map(serializeBooking) })
  } catch (e) {
    return toErrorResponse(e)
  }
}

// POST /api/bookings — create a booking (owner console or confirmed AI draft)
export async function POST(req: Request) {
  try {
    const business = await getBusiness()
    const input = await parseBody(req, createBookingSchema)
    const booking = await createBooking(business.id, input)
    return ok({ booking: serializeBooking(booking) }, 201)
  } catch (e) {
    return toErrorResponse(e)
  }
}
