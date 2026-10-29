// Booking service (mirrors backend/app/services/booking_service.py)
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { ApiError } from '../core/api'
import { SLOT_STEP_MIN } from '../core/config'
import {
  dateKey,
  dayKeyFor,
  endOfDay,
  fromMinutes,
  isOverlapping,
  parseWorkingHours,
  startOfDay,
  toMinutes,
} from '../core/time'

export interface AvailabilitySlot {
  time: string // "HH:MM"
  startsAt: string // ISO datetime
}

export async function getAvailability(businessId: string, dateStr: string, serviceId: string) {
  const business = await db.business.findUnique({ where: { id: businessId } })
  if (!business) throw new ApiError('Business not found', 404)
  const service = await db.service.findFirst({ where: { id: serviceId, businessId } })
  if (!service || !service.active) throw new ApiError('Service not found', 404)

  const dayStart = parseLocalDate(dateStr)
  const hours = parseWorkingHours(business.workingHours)[dayKeyFor(dayStart)]
  if (hours.closed) {
    return { date: dateStr, closed: true, slots: [] as AvailabilitySlot[] }
  }

  const dayEnd = endOfDay(dayStart)
  const bookings = await db.booking.findMany({
    where: { businessId, status: { not: 'CANCELLED' }, startsAt: { gte: dayStart, lte: dayEnd } },
  })

  const openMin = toMinutes(hours.open)
  const closeMin = toMinutes(hours.close)
  const now = new Date()
  const slots: AvailabilitySlot[] = []

  for (let t = openMin; t + service.durationMin <= closeMin; t += SLOT_STEP_MIN) {
    const slotStart = new Date(dayStart)
    slotStart.setHours(Math.floor(t / 60), t % 60, 0, 0)
    if (slotStart.getTime() <= now.getTime()) continue // no backfilling today
    const slotEnd = new Date(slotStart.getTime() + service.durationMin * 60_000)
    const conflict = bookings.some((b) => isOverlapping(slotStart, slotEnd, b.startsAt, b.endsAt))
    if (!conflict) slots.push({ time: fromMinutes(t), startsAt: slotStart.toISOString() })
  }

  return { date: dateStr, closed: false, slots }
}

export async function createBooking(
  businessId: string,
  input: {
    serviceId: string
    customerName: string
    customerPhone?: string | null
    startsAt: string
    notes?: string | null
    source: string
  }
) {
  const business = await db.business.findUnique({ where: { id: businessId } })
  if (!business) throw new ApiError('Business not found', 404)
  const service = await db.service.findFirst({ where: { id: input.serviceId, businessId } })
  if (!service || !service.active) throw new ApiError('Service not found', 404)

  const startsAt = new Date(input.startsAt)
  if (isNaN(startsAt.getTime())) throw new ApiError('Invalid startsAt datetime', 422)
  const endsAt = new Date(startsAt.getTime() + service.durationMin * 60_000)

  const hours = parseWorkingHours(business.workingHours)[dayKeyFor(startsAt)]
  if (hours.closed) throw new ApiError('The business is closed on the selected day', 422)
  const startMin = startsAt.getHours() * 60 + startsAt.getMinutes()
  const endMin = startMin + service.durationMin
  if (startMin < toMinutes(hours.open) || endMin > toMinutes(hours.close)) {
    throw new ApiError(`Selected time is outside working hours (${hours.open}–${hours.close})`, 422)
  }

  const dayStart = startOfDay(startsAt)
  const dayEnd = endOfDay(startsAt)
  const existing = await db.booking.findMany({
    where: { businessId, status: { not: 'CANCELLED' }, startsAt: { gte: dayStart, lte: dayEnd } },
  })
  for (const b of existing) {
    if (isOverlapping(startsAt, endsAt, b.startsAt, b.endsAt)) {
      throw new ApiError('This time slot is no longer available', 409)
    }
  }

  const customerInitiated = input.source === 'AI' || input.source === 'WEB_CHAT' || input.source === 'WHATSAPP'
  return db.booking.create({
    data: {
      businessId,
      serviceId: service.id,
      customerName: input.customerName,
      customerPhone: input.customerPhone ?? null,
      startsAt,
      endsAt,
      notes: input.notes ?? null,
      source: input.source,
      status: customerInitiated ? 'PENDING' : 'CONFIRMED',
    },
    include: { service: true },
  })
}

export async function listBookings(
  businessId: string,
  opts: { from?: Date; to?: Date; status?: string; upcomingOnly?: boolean; limit?: number } = {}
) {
  const where: Prisma.BookingWhereInput = { businessId }
  const startsAt: Prisma.DateTimeFilter = {}
  if (opts.from) startsAt.gte = opts.from
  if (opts.to) startsAt.lte = opts.to
  if (opts.upcomingOnly) startsAt.gte = new Date()
  if (Object.keys(startsAt).length > 0) where.startsAt = startsAt
  if (opts.status) where.status = opts.status

  return db.booking.findMany({
    where,
    include: { service: true },
    orderBy: { startsAt: 'asc' },
    take: opts.limit ?? 300,
  })
}

export async function updateBooking(
  businessId: string,
  id: string,
  patch: { status?: string; startsAt?: string; notes?: string | null }
) {
  const booking = await db.booking.findFirst({
    where: { id, businessId },
    include: { service: true },
  })
  if (!booking) throw new ApiError('Booking not found', 404)

  const data: Prisma.BookingUpdateInput = {}
  if (patch.status) data.status = patch.status
  if (patch.notes !== undefined) data.notes = patch.notes
  if (patch.startsAt) {
    const startsAt = new Date(patch.startsAt)
    if (isNaN(startsAt.getTime())) throw new ApiError('Invalid startsAt datetime', 422)
    const duration = booking.service?.durationMin ?? 60
    const endsAt = new Date(startsAt.getTime() + duration * 60_000)
    const dayStart = startOfDay(startsAt)
    const dayEnd = endOfDay(startsAt)
    const others = await db.booking.findMany({
      where: {
        businessId,
        status: { not: 'CANCELLED' },
        id: { not: id },
        startsAt: { gte: dayStart, lte: dayEnd },
      },
    })
    for (const b of others) {
      if (isOverlapping(startsAt, endsAt, b.startsAt, b.endsAt)) {
        throw new ApiError('This time slot is no longer available', 409)
      }
    }
    data.startsAt = startsAt
    data.endsAt = endsAt
  }

  return db.booking.update({ where: { id }, data, include: { service: true } })
}

export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map((n) => parseInt(n, 10))
  if (!y || !m || !d) throw new ApiError('date must be formatted as YYYY-MM-DD', 422)
  return new Date(y, m - 1, d, 0, 0, 0, 0)
}

export { dateKey }
