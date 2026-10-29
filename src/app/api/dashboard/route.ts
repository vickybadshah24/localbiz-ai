import { toErrorResponse, ok } from '@/server/core/api'
import { getBusiness } from '@/server/services/messaging_service'
import { getDashboardStats } from '@/server/services/stats_service'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const business = await getBusiness()
    const stats = await getDashboardStats(business.id)
    return ok(stats)
  } catch (e) {
    return toErrorResponse(e)
  }
}
