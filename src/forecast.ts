import { formatDuration, type UsageResult } from "./usage"

export type QuotaWindowKey = "rolling" | "weekly" | "monthly"

export type QuotaSample = {
  window: QuotaWindowKey
  at: number
  percent: number
  resetsAt: string
}

export type QuotaStore = {
  samples: QuotaSample[]
}

export type ForecastKind =
  | "collecting"
  | "not-burning"
  | "no-risk"
  | "projected"
  | "reached"
  | "unavailable"

export type Forecast = {
  kind: ForecastKind
  samples: number
  current?: number
  resetAt?: number
  slope?: number
  at?: number
}

const WINDOWS: readonly QuotaWindowKey[] = ["rolling", "weekly", "monthly"]
const MAX_AGE_MS = 6 * 60 * 60_000
const SLOPE_WINDOW_MS = 3 * 60 * 60_000
const MIN_SAMPLES = 8
const MIN_SPAN_MS = 15 * 60_000

/** Appends the latest window samples, dropping old time and old reset cycles. */
export function appendQuotaSamples(
  existing: readonly QuotaSample[],
  usage: UsageResult,
  at: number,
): QuotaSample[] {
  const samples: QuotaSample[] = []
  for (const sample of existing) {
    const current = usage.usage[sample.window]
    if (sample.at <= at - MAX_AGE_MS) continue
    if (sample.at > at) continue
    if (sample.resetsAt !== current.resetsAt) continue
    samples.push(sample)
  }
  for (const window of WINDOWS) {
    const current = usage.usage[window]
    samples.push({ window, at, percent: current.percent, resetsAt: current.resetsAt })
  }
  return samples
}

function slopePerMs(points: readonly { at: number; percent: number }[]): number | undefined {
  if (points.length < 2) return undefined
  const meanAt = points.reduce((sum, point) => sum + point.at, 0) / points.length
  const meanPercent = points.reduce((sum, point) => sum + point.percent, 0) / points.length
  let numerator = 0
  let denominator = 0
  for (const point of points) {
    const dx = point.at - meanAt
    numerator += dx * (point.percent - meanPercent)
    denominator += dx * dx
  }
  if (denominator === 0) return undefined
  return numerator / denominator
}

/** Projects a window to 100% from the most recent 3h of its own reset cycle. */
export function forecastQuota(
  samples: readonly QuotaSample[],
  window: QuotaWindowKey,
  now: number,
): Forecast {
  const all = samples.filter((sample) => sample.window === window)
  if (all.length === 0) return { kind: "unavailable", samples: 0 }

  const latest = all.reduce((current, sample) => (sample.at > current.at ? sample : current))
  const reset = latest.resetsAt
  const points = all
    .filter((sample) => sample.resetsAt === reset && sample.at >= now - SLOPE_WINDOW_MS && sample.at <= now)
    .sort((left, right) => left.at - right.at)

  if (points.length < MIN_SAMPLES) return { kind: "collecting", samples: points.length }
  const span = points[points.length - 1]!.at - points[0]!.at
  if (span < MIN_SPAN_MS) return { kind: "collecting", samples: points.length }

  const current = points[points.length - 1]!.percent
  if (current >= 100) return { kind: "reached", samples: points.length, current }

  const resetAt = Date.parse(reset)
  if (Number.isNaN(resetAt)) return { kind: "unavailable", samples: points.length, current }
  if (resetAt <= now) return { kind: "no-risk", samples: points.length, current, resetAt }

  const slope = slopePerMs(points)
  if (slope === undefined || slope <= 0) return { kind: "not-burning", samples: points.length, current, resetAt }

  const hours = (100 - current) / (slope * 60 * 60_000)
  const at = now + hours * 60 * 60_000
  if (at >= resetAt) return { kind: "no-risk", samples: points.length, current, resetAt, slope }
  return { kind: "projected", samples: points.length, current, resetAt, slope, at }
}

export function forecastLabel(forecast: Forecast, now: number): string {
  switch (forecast.kind) {
    case "collecting":
      return "Collecting samples"
    case "not-burning":
      return "Not burning"
    case "no-risk":
      return "No risk before reset"
    case "projected":
      return `100% in ${formatDuration((forecast.at ?? now) - now)}`
    case "reached":
      return "Reached"
    case "unavailable":
      return "Quota unavailable"
  }
}
