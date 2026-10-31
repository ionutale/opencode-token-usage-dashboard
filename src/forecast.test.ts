import { describe, expect, it } from "vitest"
import type { UsageResult } from "./usage"
import { appendQuotaSamples, forecastLabel, forecastQuota, type QuotaSample } from "./forecast"

const ROLLING_RESET = "2026-11-01T12:00:00.000Z"
const WEEKLY_RESET = "2026-11-05T00:00:00.000Z"
const MONTHLY_RESET = "2026-11-20T00:00:00.000Z"
const BASE = Date.parse("2026-11-01T00:00:00.000Z")

function usage(percents: [number, number, number], resets: [string, string, string]): UsageResult {
  return {
    usage: {
      rolling: { status: "ok", percent: percents[0], resetsAt: resets[0] },
      weekly: { status: "ok", percent: percents[1], resetsAt: resets[1] },
      monthly: { status: "ok", percent: percents[2], resetsAt: resets[2] },
    },
    fetchedAt: "2026-10-31T00:00:00.000Z",
  }
}

function samples(count: number, step: number, reset = ROLLING_RESET, start = BASE, interval = 15 * 60_000): QuotaSample[] {
  return Array.from({ length: count }, (_, index) => ({
    window: "rolling" as const,
    at: start + index * interval,
    percent: 10 + index * step,
    resetsAt: reset,
  }))
}

describe("appendQuotaSamples", () => {
  it("records one sample per window", () => {
    const result = appendQuotaSamples([], usage([10, 20, 30], [ROLLING_RESET, WEEKLY_RESET, MONTHLY_RESET]), 1_000)
    expect(result).toHaveLength(3)
    expect(result.map((sample) => sample.window).sort()).toEqual(["monthly", "rolling", "weekly"])
  })

  it("prunes samples older than six hours", () => {
    const first = appendQuotaSamples([], usage([10, 20, 30], [ROLLING_RESET, WEEKLY_RESET, MONTHLY_RESET]), 1_000)
    const result = appendQuotaSamples(
      first,
      usage([11, 21, 31], [ROLLING_RESET, WEEKLY_RESET, MONTHLY_RESET]),
      6 * 60 * 60_000 + 1_500,
    )
    expect(result).toHaveLength(3)
    expect(result.every((sample) => sample.at > 1_000)).toBe(true)
  })

  it("drops stale samples when a window reset changes", () => {
    const first = appendQuotaSamples([], usage([10, 20, 30], [ROLLING_RESET, WEEKLY_RESET, MONTHLY_RESET]), 1_000)
    const result = appendQuotaSamples(
      first,
      usage([12, 21, 31], ["2026-11-01T13:00:00.000Z", WEEKLY_RESET, MONTHLY_RESET]),
      2_000,
    )
    expect(result.filter((sample) => sample.window === "rolling")).toHaveLength(1)
    expect(result.filter((sample) => sample.window === "rolling")[0]?.resetsAt).toBe("2026-11-01T13:00:00.000Z")
    expect(result).toHaveLength(5)
  })
})

describe("forecastQuota", () => {
  const now = BASE + 11 * 15 * 60_000

  it("projects 100% from the recent slope", () => {
    const forecast = forecastQuota(samples(12, 2), "rolling", now)
    expect(forecast.kind).toBe("projected")
    expect(forecast.at).toBeCloseTo(now + 8.5 * 60 * 60_000, -3)
  })

  it("says no risk when the window resets first", () => {
    const forecast = forecastQuota(
      samples(12, 2, new Date(BASE + 4 * 60 * 60_000).toISOString()),
      "rolling",
      now,
    )
    expect(forecast.kind).toBe("no-risk")
  })

  it("reports a flat window as not burning", () => {
    const forecast = forecastQuota(samples(12, 0), "rolling", now)
    expect(forecast.kind).toBe("not-burning")
  })

  it("waits for enough recent samples", () => {
    expect(forecastQuota(samples(3, 2), "rolling", now).kind).toBe("collecting")
    expect(forecastQuota(samples(8, 2, ROLLING_RESET, BASE, 60_000), "rolling", now).kind).toBe("collecting")
  })

  it("reports a reached window", () => {
    const reached = samples(12, 2)
    reached[reached.length - 1]!.percent = 100
    expect(forecastQuota(reached, "rolling", now).kind).toBe("reached")
  })

  it("ignores samples from an older reset", () => {
    const mixed = [
      ...samples(7, 2, "2026-11-01T03:00:00.000Z", BASE),
      ...samples(3, 2, ROLLING_RESET, BASE + 10_000),
    ]
    expect(forecastQuota(mixed, "rolling", now).kind).toBe("collecting")
  })
})

describe("forecastLabel", () => {
  const now = 0

  it("labels each forecast state", () => {
    expect(forecastLabel({ kind: "collecting", samples: 2 }, now)).toBe("Collecting samples")
    expect(forecastLabel({ kind: "not-burning", samples: 12, current: 20 }, now)).toBe("Not burning")
    expect(forecastLabel({ kind: "no-risk", samples: 12, current: 20 }, now)).toBe("No risk before reset")
    expect(forecastLabel({ kind: "projected", samples: 12, at: 2 * 60 * 60_000 }, now)).toBe("100% in 2h 0m")
    expect(forecastLabel({ kind: "reached", samples: 12, current: 100 }, now)).toBe("Reached")
    expect(forecastLabel({ kind: "unavailable", samples: 0 }, now)).toBe("Quota unavailable")
  })
})
