// WhatsApp Cloud API webhook (mirrors backend/app/api/webhooks.py)
//
// GET  /api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
//      -> Meta subscription handshake, validated against the business verifyToken.
// POST /api/webhooks/whatsapp
//      -> Inbound customer messages: stored as an inquiry, AI auto-reply sent back.

import { ok, toErrorResponse, fail } from '@/server/core/api'
import { isValidMetaSignature, parseMetaPayload } from '@/server/integrations/whatsapp'
import { getBusiness, handleInbound } from '@/server/services/messaging_service'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')
    const business = await getBusiness()

    if (mode === 'subscribe' && token && token === business.verifyToken) {
      return new Response(challenge ?? '', { status: 200 })
    }
    return fail('Verification failed', 403)
  } catch (e) {
    return toErrorResponse(e)
  }
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text()
    if (!isValidMetaSignature(rawBody, req.headers.get('x-hub-signature-256'))) {
      return fail('Invalid signature', 401)
    }

    let payload: unknown
    try {
      payload = JSON.parse(rawBody)
    } catch {
      return fail('Payload must be valid JSON', 400)
    }

    const business = await getBusiness()
    const messages = parseMetaPayload(payload)
    const processed: Array<{ from: string; inquiryId: string; replied: boolean }> = []

    for (const msg of messages) {
      const result = await handleInbound({
        businessId: business.id,
        channel: 'WHATSAPP',
        customerName: msg.name ?? null,
        customerPhone: msg.from,
        text: msg.text,
      })
      processed.push({
        from: msg.from,
        inquiryId: result.inquiry.id,
        replied: Boolean(result.assistantMessage),
      })
    }

    // Always 200 so Meta does not retry indefinitely.
    return ok({ received: messages.length, processed })
  } catch (e) {
    console.error('[whatsapp webhook] error:', e)
    return ok({ received: 0, processed: [] })
  }
}
