// Dashboard aggregation service
import { db } from '@/lib/db'
import { addDays, dateKey, endOfDay, startOfDay } from '../core/time'
import { serializeBooking, serializeInquiry } from './serialize'

export async function getDashboardStats(businessId: string) {
  const now = new Date()
  const todayStart = startOfDay(now)
  const todayEnd = endOfDay(now)
  const weekEnd = endOfDay(addDays(now, 6))
  const trendStart = startOfDay(addDays(now, -13))
  const weekAgo = addDays(todayStart, -6)

  const [todayBookings, weekBookings, openInquiries, newInquiries, revenueBookings, trendBookings, upcomingRaw, recentRaw, todayScheduleRaw] =
    await Promise.all([
      db.booking.count({
        where: { businessId, startsAt: { gte: todayStart, lte: todayEnd }, status: { not: 'CANCELLED' } },
      }),
      db.booking.count({
        where: { businessId, startsAt: { gte: todayStart, lte: weekEnd }, status: { not: 'CANCELLED' } },
      }),
      db.inquiry.count({ where: { businessId, status: 'OPEN' } }),
      db.inquiry.count({ where: { businessId, createdAt: { gte: weekAgo } } }),
      db.booking.findMany({
        where: {
          businessId,
          startsAt: { gte: todayStart, lte: weekEnd },
          status: { in: ['CONFIRMED', 'COMPLETED'] },
        },
        include: { service: true },
      }),
      db.booking.findMany({
        where: { businessId, startsAt: { gte: trendStart, lte: todayEnd } },
        select: { startsAt: true, status: true },
      }),
      db.booking.findMany({
        where: { businessId, startsAt: { gte: now }, status: { not: 'CANCELLED' } },
        include: { service: true },
        orderBy: { startsAt: 'asc' },
        take: 5,
      }),
      db.inquiry.findMany({
        where: { businessId },
        orderBy: { lastMessageAt: 'desc' },
        take: 5,
        include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
      }),
      db.booking.findMany({
        where: { businessId, startsAt: { gte: todayStart, lte: todayEnd } },
        include: { service: true },
        orderBy: { startsAt: 'asc' },
      }),
    ])

  const revenueWeekCents = revenueBookings.reduce((sum, b) => sum + (b.service?.priceCents ?? 0), 0)

  const trend: Array<{ date: string; count: number }> = []
  for (let i = 13; i >= 0; i--) {
    const day = addDays(todayStart, -i)
    const key = dateKey(day)
    const count = trendBookings.filter(
      (b) => b.status !== 'CANCELLED' && dateKey(b.startsAt) === key
    ).length
    trend.push({ date: key, count })
  }

  return {
    todayBookings,
    weekBookings,
    openInquiries,
    newInquiries,
    revenueWeekCents,
    trend,
    upcoming: upcomingRaw.map(serializeBooking),
    recentInquiries: recentRaw.map(serializeInquiry),
    todaySchedule: todayScheduleRaw.map(serializeBooking),
  }
}
