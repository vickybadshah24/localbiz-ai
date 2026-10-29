# LocalBiz AI

AI front desk for local businesses: an assistant that answers customers on **WhatsApp and web chat**, proposes and manages **bookings**, and gives the owner a unified **dashboard** with an inquiry inbox.

Built for the target monorepo layout below — implemented in this workspace as a Next.js fullstack app (see [Architecture mapping](#architecture-mapping)).

```
localbiz-ai/
├── frontend/                 # Next.js 16 (App Router) — owner console
│   ├── app/                  # dashboard / bookings / inquiries / settings
│   ├── components/           # chat/, calendar/, dashboard/, settings/
│   └── lib/api.ts            # typed API client
├── backend/                  # FastAPI — chat, bookings, inquiries, webhooks
│   ├── app/api/              # chat.py, bookings.py, inquiries.py, webhooks.py
│   ├── app/services/         # ai, booking, knowledge, messaging services
│   ├── app/integrations/     # whatsapp.py (Cloud API), llm.py
│   └── alembic/              # migrations
├── docker-compose.yml        # postgres + backend + frontend
├── .env.example
└── README.md
```

## What it does

- **AI receptionist** — grounds every reply in the business profile, service list (name/duration/price), working hours and the owner-curated knowledge base; returns strict-JSON replies with intent + booking draft.
- **Conversational booking** — the AI resolves relative dates ("this Saturday at 11am") into a concrete draft; the customer confirms it and the slot is validated against real availability (working hours, 30-min grid, no overlaps).
- **Inbox with human-in-the-loop** — WhatsApp + web chat conversations in one console; the owner can reply manually or let the AI draft a reply (`AI draft` button).
- **WhatsApp Cloud API** — Meta webhook handshake (`hub.verify_token`), optional `X-Hub-Signature-256` validation, inbound parsing and outbound replies. Without credentials it runs in **sandbox mode** (full pipeline, simulated delivery).
- **Dashboard** — bookings today / next 7 days, revenue forecast, 14-day trend, open conversations, today's schedule, AI status.
- **Settings** — business profile, per-day working hours editor, AI persona + auto-reply toggle, knowledge base CRUD, WhatsApp webhook URL + verify token, and a built-in **inbound message simulator**.

## Architecture mapping (this workspace → target monorepo)

This workspace runs a single **Next.js fullstack** deployment (sandbox constraint: one visible route, one port). Every backend module from the FastAPI structure has a direct counterpart:

| Target monorepo                     | This implementation                          |
| ----------------------------------- | -------------------------------------------- |
| `backend/app/api/chat.py`           | `src/app/api/chat/route.ts`                  |
| `backend/app/api/bookings.py`       | `src/app/api/bookings/**/route.ts`           |
| `backend/app/api/inquiries.py`      | `src/app/api/inquiries/**/route.ts`          |
| `backend/app/api/webhooks.py`       | `src/app/api/webhooks/whatsapp/route.ts`     |
| `backend/app/core/config.py`        | `src/server/core/config.ts`                  |
| `backend/app/core/security.py`      | `src/server/integrations/whatsapp.ts` (signature validation), `src/server/schemas` (zod validation) |
| `backend/app/models/`               | `prisma/schema.prisma`                       |
| `backend/app/schemas/`              | `src/server/schemas/index.ts`                |
| `backend/app/services/ai_service.py`| `src/server/services/ai_service.ts`          |
| `backend/app/services/booking_service.py` | `src/server/services/booking_service.ts` |
| `backend/app/services/knowledge_service.py` | `src/server/services/knowledge_service.ts` |
| `backend/app/services/messaging_service.py` | `src/server/services/messaging_service.ts` |
| `backend/app/integrations/llm.py`   | `src/server/integrations/llm.ts`             |
| `backend/app/integrations/whatsapp.py` | `src/server/integrations/whatsapp.ts`     |
| `frontend/lib/api.ts`               | `src/lib/api.ts`                             |
| `frontend/app/{dashboard,bookings,inquiries,settings}` | single-page views in `src/components/{dashboard,calendar,chat,settings}` |
| `alembic/` + Postgres               | `prisma/` + SQLite (`docker-compose.yml` shows the production split) |

## Running

### This workspace (already running)

```bash
bun prisma/seed.ts   # demo data: Bella Vita Salon & Spa
bun run lint         # type/lint checks
# dev server: http://localhost:3000
```

### Production monorepo

```bash
cp .env.example .env        # add WhatsApp credentials (optional)
docker compose up --build   # db + backend(:8000) + frontend(:3000)
```

## API surface

| Method | Path | Purpose |
| ------ | ---- | ------- |
| GET  | `/api/dashboard` | KPIs, 14-day trend, today's schedule, recent inquiries |
| GET/POST | `/api/bookings` | list (filters: `status`, `from`, `to`, `upcoming`) / create |
| PATCH | `/api/bookings/[id]` | confirm, cancel, complete, reschedule |
| GET  | `/api/bookings/availability` | open slots for `date` + `serviceId` |
| GET/POST | `/api/inquiries` | list / start a conversation (triggers AI auto-reply) |
| GET/PATCH | `/api/inquiries/[id]` | full thread / open-resolved |
| POST | `/api/inquiries/[id]/messages` | owner reply |
| POST | `/api/inquiries/[id]/suggest` | AI-drafted owner reply |
| POST | `/api/chat` | public web-chat widget (AI reply + booking draft) |
| GET/PUT | `/api/settings` | business profile, working hours, AI, WhatsApp |
| GET/POST | `/api/services`, `/api/knowledge`, `/api/knowledge/[id]` | services & knowledge CRUD |
| GET/POST | `/api/webhooks/whatsapp` | Meta verification / inbound messages |

## Environment

See `.env.example`. The AI reply pipeline uses the Z.ai SDK server-side. WhatsApp variables are optional — without them the channel runs in sandbox mode and every feature stays usable.

## Time handling

All business datetimes are stored and rendered in **UTC** end-to-end (availability slots, bookings, dashboard), so labels never drift between server and browser. Production deployments should resolve `Business.timezone` in the booking service.
