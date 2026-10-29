// Formatting helpers.
// The deployment treats business time as UTC, so every datetime is formatted
// with timeZone: 'UTC' to keep slot labels consistent between availability,
// bookings and the dashboard.

const timeFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const dayFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  weekday: 'short',
  month: 'short',
  day: 'numeric',
})

const longDayFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  weekday: 'long',
  month: 'long',
  day: 'numeric',
})

export function fmtTime(iso: string): string {
  return timeFmt.format(new Date(iso))
}

export function fmtTimeRange(startsAt: string, endsAt: string): string {
  return `${fmtTime(startsAt)} – ${fmtTime(endsAt)}`
}

export function fmtDay(iso: string): string {
  return dayFmt.format(new Date(iso))
}

export function fmtDayLong(iso: string): string {
  return longDayFmt.format(new Date(iso))
}

export function fmtDateKey(key: string): string {
  // key = "YYYY-MM-DD"
  return dayFmt.format(new Date(`${key}T12:00:00Z`))
}

export function fmtMonthDay(key: string): string {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })
  return fmt.format(new Date(`${key}T12:00:00Z`))
}

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

export function dateKeyOf(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10)
}

export function fmtMoney(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '—'
  const dollars = cents / 100
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`
}

export function fmtAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return fmtDateKey(iso.slice(0, 10))
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}
