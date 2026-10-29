// Service-layer tests (mirrors backend/app/tests/ in the target monorepo)
// Run with: bun test tests/

import { describe, expect, test, beforeEach, afterAll } from 'bun:test'
import { PrismaClient } from '@prisma/client'
import { getAvailability, createBooking } from '../src/server/services/booking_service'
import { retrieveKnowledge, tokenize } from '../src/server/services/knowledge_service'
import { parseMetaPayload } from '../src/server/integrations/whatsapp'
import { parseWorkingHours, toMinutes, fromMinutes } from '../src/server/core/time'

const db = new PrismaClient()

let businessId = ''
let keratinId = ''

beforeEach(async () => {
  const business = await db.business.findFirst()
  if (!business) throw new Error('Run `bun prisma/seed.ts` before tests')
  businessId = business.id
  const keratin = await db.service.findFirst({ where: { name: { contains: 'Keratin' } } })
  if (!keratin) throw new Error('Keratin service missing — re-run seed')
  keratinId = keratin.id
})

describe('time helpers', () => {
  test('minutes round-trip', () => {
    expect(fromMinutes(toMinutes('09:30'))).toBe('09:30')
    expect(toMinutes('18:00')).toBe(1080)
  })

  test('working hours parse with fallback', () => {
    const hours = parseWorkingHours('{"sun":{"closed":true,"open":"09:00","close":"17:00"}}')
    expect(hours.sun.closed).toBe(true)
    expect(hours.mon.closed).toBe(false)
    expect(parseWorkingHours('not-json').mon.open).toBe('09:00')
  })
})

describe('booking availability', () => {
  test('sunday is closed', async () => {
    // 2026-11-01 is a Sunday
    const result = await getAvailability(businessId, '2026-11-01', keratinId)
    expect(result.closed).toBe(true)
    expect(result.slots).toHaveLength(0)
  })

  test('open day returns slots inside working hours', async () => {
    // 2026-11-03 is a Tuesday, 09:00–18:00; 120-min service
    const result = await getAvailability(businessId, '2026-11-03', keratinId)
    expect(result.closed).toBe(false)
    expect(result.slots.length).toBeGreaterThan(0)
    expect(result.slots[0].time).toBe('09:00')
    const last = result.slots[result.slots.length - 1]
    expect(toMinutes(last.time) + 120).toBeLessThanOrEqual(toMinutes('18:00'))
  })
})

describe('booking creation', () => {
  test('rejects booking outside working hours', async () => {
    await expect(
      createBooking(businessId, {
        serviceId: keratinId,
        customerName: 'Test TooEarly',
        startsAt: '2026-11-03T06:00:00.000Z',
        source: 'MANUAL',
      })
    ).rejects.toThrow(/outside working hours/)
  })

  test('rejects double-booking the same slot', async () => {
    const input = {
      serviceId: keratinId,
      customerName: 'Test Clasher',
      startsAt: '2026-11-03T14:00:00.000Z',
      source: 'MANUAL' as const,
    }
    const first = await createBooking(businessId, input)
    expect(first.status).toBe('CONFIRMED')
    await expect(createBooking(businessId, input)).rejects.toThrow(/no longer available/)
    // cleanup
    await db.booking.delete({ where: { id: first.id } })
  })
})

describe('knowledge retrieval', () => {
  test('tokenize drops stop words', () => {
    const tokens = tokenize('What are the cancellation terms?')
    expect(tokens).toContain('cancellation')
    expect(tokens).not.toContain('the')
  })

  test('retrieves the most relevant entry', async () => {
    const hits = await retrieveKnowledge(businessId, 'can I cancel my appointment?', 2)
    expect(hits.length).toBeGreaterThan(0)
    expect(hits[0].title.toLowerCase()).toContain('cancellation')
  })
})

describe('whatsapp integration', () => {
  test('parses Meta webhook payloads', () => {
    const messages = parseMetaPayload({
      entry: [
        {
          changes: [
            {
              value: {
                contacts: [{ profile: { name: 'Ada' }, wa_id: '15550001111' }],
                messages: [
                  { from: '15550001111', id: 'wamid.1', timestamp: '1769712000', type: 'text', text: { body: 'Hello!' } },
                  { from: '15550001111', id: 'wamid.2', timestamp: '1769712001', type: 'image' },
                ],
              },
            },
          ],
        },
      ],
    })
    expect(messages).toHaveLength(1)
    expect(messages[0].text).toBe('Hello!')
    expect(messages[0].name).toBe('Ada')
  })
})

afterAll(async () => {
  await db.$disconnect()
})
