import { mergeTokenRows, type TokenRow } from "./tokens"

export type DailyUsage = {
  date: string
  rows: TokenRow[]
  steps: number
  cost: number
  total: number
}

export type BackfillState = {
  status: "idle" | "running" | "done"
  total: number
  completed: number
  failed: number
  startedAt?: number
  finishedAt?: number
}

export type HistoryStore = {
  version: 1
  days: Record<string, DailyUsage>
  backfill: BackfillState
}

export type ActivityDay = {
  date: string
  steps: number
}

export type ArchiveCoverage = {
  from: string | undefined
  to: string | undefined
  days: number
}

const TWO_DIGITS = new Intl.NumberFormat("en-US", { minimumIntegerDigits: 2, useGrouping: false })

function pad(value: number): string {
  return TWO_DIGITS.format(value)
}

export function emptyHistory(): HistoryStore {
  return {
    version: 1,
    days: {},
    backfill: { status: "idle", total: 0, completed: 0, failed: 0 },
  }
}

/** Local calendar day key (`YYYY-MM-DD`) for a timestamp. */
export function formatLocalDay(ms: number): string {
  const date = new Date(ms)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Local midnight boundaries for a `YYYY-MM-DD` date. */
export function localDayRange(date: string): { from: number; to: number } {
  const [year, month, day] = date.split("-").map(Number)
  return {
    from: new Date(year!, month! - 1, day!).getTime(),
    to: new Date(year!, month! - 1, day! + 1).getTime(),
  }
}

/** The last `count` local dates, oldest first, ending today. */
export function lastLocalDays(count: number, now: number): string[] {
  const today = new Date(now)
  const dates: string[] = []
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    dates.push(formatLocalDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset).getTime()))
  }
  return dates
}

export function dailyUsage(date: string, rows: readonly TokenRow[]): DailyUsage {
  const merged = mergeTokenRows(rows)
  return {
    date,
    rows: merged,
    steps: merged.reduce((sum, row) => sum + row.steps, 0),
    cost: merged.reduce((sum, row) => sum + row.cost, 0),
    total: merged.reduce((sum, row) => sum + row.total, 0),
  }
}

export function archiveRows(
  days: Readonly<Record<string, DailyUsage>>,
  beforeDate?: string,
): TokenRow[] {
  const rows: TokenRow[] = []
  for (const [date, day] of Object.entries(days)) {
    if (beforeDate !== undefined && date >= beforeDate) continue
    rows.push(...day.rows)
  }
  return mergeTokenRows(rows)
}

export function archiveCoverage(days: Readonly<Record<string, DailyUsage>>): ArchiveCoverage {
  const dates = Object.keys(days).sort()
  if (dates.length === 0) return { from: undefined, to: undefined, days: 0 }
  return { from: dates[0], to: dates[dates.length - 1], days: dates.length }
}

/** Active days that still need a daily stats query. */
export function planBackfill(
  activity: readonly ActivityDay[],
  days: Readonly<Record<string, DailyUsage>>,
  today: string,
): string[] {
  const dates = new Set<string>()
  for (const item of activity) {
    if (item.steps <= 0) continue
    if (item.date >= today) continue
    if (days[item.date] !== undefined) continue
    dates.add(item.date)
  }
  return [...dates].sort()
}

export function dailyTotals(days: Readonly<Record<string, DailyUsage>>, dates: readonly string[]): number[] {
  return dates.map((date) => days[date]?.total ?? 0)
}

const LEVELS = "▁▂▃▄▅▆▇█"

/** A one-line sparkline. Missing/zero days render as a dot. */
export function trendLevels(values: readonly number[], maxValue?: number): string {
  const max = maxValue ?? values.reduce((highest, value) => Math.max(highest, value), 0)
  return values
    .map((value) => {
      if (value <= 0 || max <= 0) return "·"
      const index = Math.min(LEVELS.length - 1, Math.max(0, Math.round((value / max) * (LEVELS.length - 1))))
      return LEVELS[index]!
    })
    .join("")
}
