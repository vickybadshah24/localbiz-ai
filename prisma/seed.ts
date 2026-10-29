// Seed script — run with: bun prisma/seed.ts
// Creates a demo business (Bella Vita Salon & Spa) with services, bookings,
// inquiries, messages and knowledge-base entries relative to "now".

import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const WORKING_HOURS = {
  mon: { closed: false, open: '09:00', close: '18:00' },
  tue: { closed: false, open: '09:00', close: '18:00' },
  wed: { closed: false, open: '09:00', close: '18:00' },
  thu: { closed: false, open: '09:00', close: '18:00' },
  fri: { closed: false, open: '09:00', close: '18:00' },
  sat: { closed: false, open: '10:00', close: '16:00' },
  sun: { closed: true, open: '09:00', close: '17:00' },
}

function at(dayOffset: number, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10))
  const d = new Date()
  d.setDate(d.getDate() + dayOffset)
  d.setHours(h, m, 0, 0)
  return d
}

function hoursAgo(h: number): Date {
  return new Date(Date.now() - h * 3_600_000)
}

async function main() {
  // Clean slate (idempotent seed)
  await db.message.deleteMany()
  await db.inquiry.deleteMany()
  await db.booking.deleteMany()
  await db.knowledgeEntry.deleteMany()
  await db.service.deleteMany()
  await db.business.deleteMany()

  const business = await db.business.create({
    data: {
      name: 'Bella Vita Salon & Spa',
      industry: 'Hair & Beauty Salon',
      phone: '+1 (555) 012-3456',
      email: 'hello@bellavita.example',
      address: '42 Market Street, Springfield',
      timezone: 'UTC',
      workingHours: JSON.stringify(WORKING_HOURS),
      aiPersona:
        'Warm, upbeat and reassuring — like a great salon receptionist. Keep replies short (1–3 sentences), use the customer\'s name when known, and always offer to book an appointment.',
      autoReply: true,
      whatsappConnected: false,
      whatsappNumber: '+1 (555) 012-3456',
      verifyToken: 'localbiz-demo-token',
    },
  })

  const [haircut, colour, beard, keratin, bridal] = await Promise.all([
    db.service.create({
      data: {
        businessId: business.id,
        name: 'Signature Haircut',
        description: 'Consultation, precision cut and styling finish',
        durationMin: 45,
        priceCents: 4500,
      },
    }),
    db.service.create({
      data: {
        businessId: business.id,
        name: 'Hair Colour & Gloss',
        description: 'Ammonia-free colour with a shine-boosting gloss',
        durationMin: 90,
        priceCents: 11000,
      },
    }),
    db.service.create({
      data: {
        businessId: business.id,
        name: 'Beard Sculpt & Shave',
        description: 'Hot-towel shave with beard shaping',
        durationMin: 30,
        priceCents: 2800,
      },
    }),
    db.service.create({
      data: {
        businessId: business.id,
        name: 'Keratin Smoothing Treatment',
        description: 'Frizz-free smoothing that lasts up to 12 weeks',
        durationMin: 120,
        priceCents: 15000,
      },
    }),
    db.service.create({
      data: {
        businessId: business.id,
        name: 'Bridal Hair & Makeup Trial',
        description: 'Full trial run for your big day, photos included',
        durationMin: 75,
        priceCents: 9500,
      },
    }),
  ])

  // ---- Bookings (relative to today) ----
  const bookings = [
    { day: -11, time: '11:00', service: haircut, name: 'Sofia Marino', phone: '+1 555 010 11', status: 'COMPLETED', source: 'WHATSAPP' },
    { day: -9, time: '15:30', service: beard, name: 'James Okafor', phone: '+1 555 010 22', status: 'COMPLETED', source: 'MANUAL' },
    { day: -8, time: '10:00', service: colour, name: 'Emma Lillich', phone: '+1 555 010 33', status: 'COMPLETED', source: 'WEB_CHAT' },
    { day: -6, time: '13:00', service: haircut, name: 'Ravi Patel', phone: '+1 555 010 44', status: 'COMPLETED', source: 'MANUAL' },
    { day: -5, time: '16:00', service: keratin, name: 'Grace Liu', phone: '+1 555 010 55', status: 'COMPLETED', source: 'AI' },
    { day: -3, time: '12:00', service: haircut, name: 'Tom Baker', phone: '+1 555 010 66', status: 'COMPLETED', source: 'MANUAL' },
    { day: -2, time: '16:00', service: colour, name: 'Nina Rossi', phone: '+1 555 010 77', status: 'CANCELLED', source: 'WEB_CHAT' },
    { day: -1, time: '11:00', service: haircut, name: 'Alex Kim', phone: '+1 555 010 88', status: 'COMPLETED', source: 'WHATSAPP' },
    { day: -1, time: '15:00', service: beard, name: 'Daniel Reyes', phone: '+1 555 010 99', status: 'COMPLETED', source: 'MANUAL' },
    { day: 0, time: '10:00', service: colour, name: 'Maya Chen', phone: '+1 555 011 22', status: 'CONFIRMED', source: 'WHATSAPP' },
    { day: 0, time: '13:00', service: haircut, name: 'James Okafor', phone: '+1 555 010 22', status: 'CONFIRMED', source: 'MANUAL' },
    { day: 0, time: '16:00', service: keratin, name: 'Grace Liu', phone: '+1 555 010 55', status: 'PENDING', source: 'AI' },
    { day: 1, time: '11:30', service: bridal, name: 'Olivia Bennett', phone: '+1 555 011 55', status: 'CONFIRMED', source: 'MANUAL' },
    { day: 1, time: '15:00', service: haircut, name: 'Ravi Patel', phone: '+1 555 010 44', status: 'PENDING', source: 'WEB_CHAT' },
    { day: 2, time: '10:30', service: beard, name: 'Tom Baker', phone: '+1 555 010 66', status: 'CONFIRMED', source: 'MANUAL' },
    { day: 3, time: '14:00', service: colour, name: 'Emma Lillich', phone: '+1 555 010 33', status: 'PENDING', source: 'WHATSAPP' },
    { day: 5, time: '12:00', service: haircut, name: 'Sofia Marino', phone: '+1 555 010 11', status: 'CONFIRMED', source: 'AI' },
  ]

  for (const b of bookings) {
    const start = at(b.day, b.time)
    const end = new Date(start.getTime() + (b.service?.durationMin ?? 45) * 60_000)
    await db.booking.create({
      data: {
        businessId: business.id,
        serviceId: b.service.id,
        customerName: b.name,
        customerPhone: b.phone,
        startsAt: start,
        endsAt: end,
        status: b.status,
        source: b.source,
      },
    })
  }

  // ---- Inquiries & messages ----
  const maya = await db.inquiry.create({
    data: {
      businessId: business.id,
      customerName: 'Maya Chen',
      customerPhone: '+1 555 011 22',
      channel: 'WHATSAPP',
      status: 'OPEN',
      lastMessageAt: hoursAgo(2),
      createdAt: hoursAgo(30),
    },
  })
  await db.message.createMany({
    data: [
      { inquiryId: maya.id, role: 'CUSTOMER', content: 'Hi! How much is the keratin treatment?', createdAt: hoursAgo(30) },
      { inquiryId: maya.id, role: 'ASSISTANT', content: 'Hi Maya! The Keratin Smoothing Treatment is $150 and takes about 2 hours — it keeps hair frizz-free for up to 12 weeks. Would you like me to book you in? 😊', createdAt: hoursAgo(30) },
      { inquiryId: maya.id, role: 'CUSTOMER', content: 'Oh nice. Can I come in this Saturday around 11am?', createdAt: hoursAgo(2) },
    ],
  })

  const james = await db.inquiry.create({
    data: {
      businessId: business.id,
      customerName: 'James Okafor',
      channel: 'WEB_CHAT',
      status: 'OPEN',
      lastMessageAt: hoursAgo(5),
      createdAt: hoursAgo(6),
    },
  })
  await db.message.createMany({
    data: [
      { inquiryId: james.id, role: 'CUSTOMER', content: 'Do you use ammonia-free colour? My scalp is sensitive.', createdAt: hoursAgo(6) },
      { inquiryId: james.id, role: 'ASSISTANT', content: 'Great question, James — yes! We use a gentle ammonia-free line, and we always recommend a patch test 48 hours before your first colour. Shall I book a free consultation?', createdAt: hoursAgo(5) },
    ],
  })

  const priya = await db.inquiry.create({
    data: {
      businessId: business.id,
      customerName: 'Priya Sharma',
      customerPhone: '+1 555 011 99',
      channel: 'WHATSAPP',
      status: 'OPEN',
      lastMessageAt: hoursAgo(26),
      createdAt: hoursAgo(26),
    },
  })
  await db.message.createMany({
    data: [
      { inquiryId: priya.id, role: 'CUSTOMER', content: 'Hello! Do you sell gift vouchers?', createdAt: hoursAgo(26) },
      { inquiryId: priya.id, role: 'ASSISTANT', content: 'Hi Priya! Yes — digital gift vouchers are available for any amount and are valid for 12 months. I can email one over right away if you like! 🎁', createdAt: hoursAgo(26) },
    ],
  })

  const daniel = await db.inquiry.create({
    data: {
      businessId: business.id,
      customerName: 'Daniel Reyes',
      channel: 'WEB_CHAT',
      status: 'RESOLVED',
      lastMessageAt: hoursAgo(50),
      createdAt: hoursAgo(52),
    },
  })
  await db.message.createMany({
    data: [
      { inquiryId: daniel.id, role: 'CUSTOMER', content: 'Is there parking nearby?', createdAt: hoursAgo(52) },
      { inquiryId: daniel.id, role: 'ASSISTANT', content: 'Yes — free 2-hour parking in the Market Street garage right next door. See you soon!', createdAt: hoursAgo(51) },
      { inquiryId: daniel.id, role: 'CUSTOMER', content: 'Perfect, thanks!', createdAt: hoursAgo(50) },
    ],
  })

  // ---- Knowledge base ----
  await db.knowledgeEntry.createMany({
    data: [
      {
        businessId: business.id,
        title: 'Cancellation policy',
        content:
          'Free cancellation up to 24 hours before the appointment. Cancellations within 24 hours are charged 30% of the service price; no-shows are charged 50%.',
        category: 'policy',
      },
      {
        businessId: business.id,
        title: 'Payment methods',
        content:
          'All prices include a welcome consultation. We accept cash, all major cards and UPI. Members receive 10% off every visit.',
        category: 'pricing',
      },
      {
        businessId: business.id,
        title: 'Parking & accessibility',
        content:
          'Free 2-hour parking is available in the Market Street garage next door. The salon is step-free and fully wheelchair accessible.',
        category: 'faq',
      },
      {
        businessId: business.id,
        title: 'Products we use',
        content:
          'We use ammonia-free colour and vegan, cruelty-free product lines (O&M and Davines). A patch test is required 48 hours before a first colour service.',
        category: 'faq',
      },
      {
        businessId: business.id,
        title: 'Glow Membership',
        content:
          'The Glow Membership is $29/month: 10% off all services, one free express blow-dry per month and priority weekend booking.',
        category: 'pricing',
      },
    ],
  })

  const counts = {
    business: business.name,
    services: 5,
    bookings: bookings.length,
    inquiries: 4,
    knowledge: 5,
  }
  console.log('Seed complete:', JSON.stringify(counts))
}

main()
  .catch((e) => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
