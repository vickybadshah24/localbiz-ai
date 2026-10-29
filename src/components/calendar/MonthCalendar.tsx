'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { todayKey } from '@/lib/format'

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

function keyOf(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function monthLabel(y: number, m: number): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(
    new Date(Date.UTC(y, m, 1))
  )
}

export interface Cell {
  key: string
  day: number
  inMonth: boolean
}

export default function MonthCalendar({
  selected,
  onSelect,
}: {
  selected?: string | null
  onSelect?: (key: string) => void
}) {
  const today = todayKey()
  // Displayed month: explicit navigation overrides the month of the selected date
  const [navOverride, setNavOverride] = useState<{ y: number; m: number } | null>(null)
  const anchor = selected ?? today
  const view = useMemo(() => {
    if (navOverride) return navOverride
    const [y, m] = anchor.split('-').map(Number)
    return { y, m: m - 1 }
  }, [navOverride, anchor])

  const cells = useMemo<Cell[]>(() => {
    const firstDay = new Date(Date.UTC(view.y, view.m, 1))
    const offset = (firstDay.getUTCDay() + 6) % 7 // Monday-based grid
    const daysInMonth = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate()
    const out: Cell[] = []
    // leading days from previous month
    const prevDays = new Date(Date.UTC(view.y, view.m, 0)).getUTCDate()
    for (let i = offset - 1; i >= 0; i--) {
      const d = prevDays - i
      out.push({ key: keyOf(view.y, view.m - 1, d), day: d, inMonth: false })
    }
    for (let d = 1; d <= daysInMonth; d++) {
      out.push({ key: keyOf(view.y, view.m, d), day: d, inMonth: true })
    }
    let nextDay = 1
    while (out.length % 7 !== 0 || out.length < 35) {
      out.push({ key: keyOf(view.y, view.m + 1, nextDay), day: nextDay, inMonth: false })
      nextDay++
      if (out.length >= 42) break
    }
    return out
  }, [view])

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold">{monthLabel(view.y, view.m)}</p>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label="Previous month"
            onClick={() =>
              setNavOverride((v) => {
                const base = v ?? view
                return base.m === 0 ? { y: base.y - 1, m: 11 } : { y: base.y, m: base.m - 1 }
              })
            }
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label="Next month"
            onClick={() =>
              setNavOverride((v) => {
                const base = v ?? view
                return base.m === 11 ? { y: base.y + 1, m: 0 } : { y: base.y, m: base.m + 1 }
              })
            }
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center" role="grid" aria-label="Calendar">
        {WEEKDAYS.map((w) => (
          <span key={w} className="py-1 text-[10px] font-medium text-muted-foreground">
            {w}
          </span>
        ))}
        {cells.map((cell) => {
          const isSelected = selected === cell.key
          const isToday = today === cell.key
          return (
            <button
              key={cell.key}
              type="button"
              role="gridcell"
              aria-selected={isSelected}
              onClick={() => onSelect?.(cell.key)}
              className={`flex h-8 w-full items-center justify-center rounded-md text-xs transition-colors min-h-[32px] ${
                isSelected
                  ? 'bg-primary font-semibold text-primary-foreground'
                  : isToday
                    ? 'ring-1 ring-primary font-semibold text-primary hover:bg-muted'
                    : cell.inMonth
                      ? 'hover:bg-muted'
                      : 'text-muted-foreground/40 hover:bg-muted/50'
              }`}
            >
              {cell.day}
            </button>
          )
        })}
      </div>
    </div>
  )
}
