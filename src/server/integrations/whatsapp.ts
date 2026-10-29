// WhatsApp Cloud API integration (mirrors backend/app/integrations/whatsapp.py)
// - sendWhatsAppText: outbound messages via Graph API. Without credentials the
//   message is logged and marked `simulated` so the demo keeps working.
// - isValidMetaSignature: optional X-Hub-Signature-256 verification when
//   WHATSAPP_APP_SECRET is configured.

import crypto from 'crypto'
import { env, isWhatsAppConfigured } from '../core/config'

export interface WhatsAppSendResult {
  delivered: boolean
  simulated: boolean
  error?: string
}

export async function sendWhatsAppText(to: string, text: string): Promise<WhatsAppSendResult> {
  const body = text.slice(0, 4096)
  if (!isWhatsAppConfigured()) {
    console.log(`[whatsapp:simulated] -> ${to}: ${body.slice(0, 120)}`)
    return { delivered: false, simulated: true }
  }
  try {
    const url = `https://graph.facebook.com/${env.whatsappGraphVersion}/${env.whatsappPhoneNumberId}/messages`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.whatsappToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: body },
      }),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return { delivered: false, simulated: false, error: `Graph API ${res.status}: ${detail.slice(0, 200)}` }
    }
    return { delivered: true, simulated: false }
  } catch (e) {
    return { delivered: false, simulated: false, error: (e as Error).message }
  }
}

export function isValidMetaSignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!env.whatsappAppSecret) return true // verification disabled when no secret configured
  if (!signatureHeader) return false
  const expected =
    'sha256=' + crypto.createHmac('sha256', env.whatsappAppSecret).update(rawBody).digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(signatureHeader)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

export interface MetaInboundMessage {
  from: string
  name?: string
  text: string
  messageId: string
  timestamp: Date
}

/** Parse the Meta Cloud API webhook payload into flat inbound text messages. */
export function parseMetaPayload(payload: unknown): MetaInboundMessage[] {
  const out: MetaInboundMessage[] = []
  const p = payload as {
    entry?: Array<{
      changes?: Array<{
        value?: {
          contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>
          messages?: Array<{
            from?: string
            id?: string
            timestamp?: string
            type?: string
            text?: { body?: string }
          }>
        }
      }>
    }>
  }
  for (const entry of p?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const value = change?.value
      const contactName = value?.contacts?.[0]?.profile?.name
      for (const msg of value?.messages ?? []) {
        if (msg?.type !== 'text' || !msg.text?.body || !msg.from) continue
        out.push({
          from: msg.from,
          name: contactName,
          text: msg.text.body,
          messageId: msg.id ?? crypto.randomUUID(),
          timestamp: msg.timestamp ? new Date(parseInt(msg.timestamp, 10) * 1000) : new Date(),
        })
      }
    }
  }
  return out
}
