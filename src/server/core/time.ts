// Time & working-hours helpers.
// The demo treats server-local time as business-local time; the production
// monorepo (backend/app/services/booking_service.py) should resolve the
// business timezone explicitly via `timezone`.

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

export interface DayHours {
  closed: boolean
  open: string // "HH:MM" 24h
  close: string // "HH:MM" 24h
}

export type WorkingHours = Record<DayKey, DayHours>

export const DAY_KEYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

export const DEFAULT_WORKING_HOURS: WorkingHours = {
  mon: { closed: false, open: '09:00', close: '18:00' },
  tue: { closed: false, open: '09:00', close: '18:00' },
  wed: { closed: false, open: '09:00', close: '18:00' },
  thu: { closed: false, open: '09:00', close: '18:00' },
  fri: { closed: false, open: '09:00', close: '18:00' },
  sat: { closed: false, open: '10:00', close: '16:00' },
  sun: { closed: true, open: '09:00', close: '17:00' },
}

export function parseWorkingHours(raw: string | null | undefined): WorkingHours {
  if (!raw) return { ...DEFAULT_WORKING_HOURS }
  try {
    const parsed = JSON.parse(raw) as Partial<WorkingHours>
    const result = { ...DEFAULT_WORKING_HOURS }
    for (const key of DAY_KEYS) {
      const day = parsed[key]
      if (day && typeof day.closed === 'boolean' && typeof day.open === 'string' && typeof day.close === 'string') {
        result[key] = { closed: day.closed, open: day.open, close: day.close }
      }
    }
    return result
  } catch {
    return { ...DEFAULT_WORKING_HOURS }
  }
}

const JS_DAY_TO_KEY: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

export function dayKeyFor(date: Date): DayKey {
  return JS_DAY_TO_KEY[date.getDay()]
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10))
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m)
}

export function fromMinutes(total: number): string {
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function isOverlapping(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && aEnd > bStart
}

// "YYYY-MM-DD" in server-local time
export function dateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)
}

export function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}
