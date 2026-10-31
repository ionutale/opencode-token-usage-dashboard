import { describe, expect, it } from "vitest"
import { sumRows, type TokenRow } from "./tokens"
import {
  archiveCoverage,
  archiveRows,
  dailyTotals,
  dailyUsage,
  emptyHistory,
  formatLocalDay,
  lastLocalDays,
  localDayRange,
  planBackfill,
  trendLevels,
} from "./history"

function row(
  providerID: string,
  modelID: string,
  input: number,
  output = 0,
  reasoning = 0,
  cacheRead = 0,
  cacheWrite = 0,
  steps = 1,
  cost = 0,
): TokenRow {
  const total = input + output + reasoning + cacheRead + cacheWrite
  return {
    providerID,
    modelID,
    input,
    output,
    reasoning,
    cacheRead,
    cacheWrite,
    total,
    steps,
    cost,
    variants: [],
  }
}

describe("local day helpers", () => {
  it("formats local dates as YYYY-MM-DD", () => {
    expect(formatLocalDay(new Date(2026, 9, 31, 12).getTime())).toBe("2026-10-31")
  })

  it("returns local midnight boundaries", () => {
    expect(localDayRange("2026-10-31")).toEqual({
      from: new Date(2026, 9, 31).getTime(),
      to: new Date(2026, 10, 1).getTime(),
    })
  })

  it("lists the last N local dates", () => {
    expect(lastLocalDays(3, new Date(2026, 9, 31, 12).getTime())).toEqual([
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
    ])
  })
})

describe("dailyUsage", () => {
  it("aggregates variants and stores steps, cost, and total", () => {
    const day = dailyUsage("2026-10-31", [
      row("opencode-go", "deepseek", 1, 2, 3, 4, 5, 6, 7),
      row("opencode-go", "deepseek", 10, 20, 30, 40, 50, 60, 70),
      row("ollama", "qwen", 1, 1, 1, 1, 1, 1, 1),
    ])
    expect(day.date).toBe("2026-10-31")
    expect(day.rows).toHaveLength(2)
    expect(day.rows[0]).toMatchObject({ providerID: "opencode-go", modelID: "deepseek", total: 165 })
    expect(day.steps).toBe(67)
    expect(day.cost).toBe(78)
    expect(day.total).toBe(170)
  })
})

describe("archive", () => {
  const days = {
    "2026-10-29": dailyUsage("2026-10-29", [row("p", "m", 1, 0, 0, 0, 0, 1, 0.1)]),
    "2026-10-30": dailyUsage("2026-10-30", [row("p", "m", 2, 0, 0, 0, 0, 2, 0.2)]),
    "2026-10-31": dailyUsage("2026-10-31", [row("p", "m", 4, 0, 0, 0, 0, 4, 0.4)]),
  }

  it("merges rows before a cutoff date", () => {
    const rows = archiveRows(days, "2026-10-31")
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ providerID: "p", modelID: "m", input: 3, total: 3, steps: 3 })
    expect(sumRows(rows).cost).toBeCloseTo(0.3)
  })

  it("reports coverage", () => {
    expect(archiveCoverage(days)).toEqual({ from: "2026-10-29", to: "2026-10-31", days: 3 })
    expect(archiveCoverage({})).toEqual({ from: undefined, to: undefined, days: 0 })
  })

  it("does not duplicate archived rows when combined with live rows", () => {
    const archived = archiveRows(days, "2026-10-31")
    const live = [row("p", "m", 8, 0, 0, 0, 0, 8, 0.8)]
    expect(sumRows([...archived, ...live]).input).toBe(11)
  })
})

describe("planBackfill", () => {
  it("selects active, unarchived days before today", () => {
    const days = {
      "2026-10-28": dailyUsage("2026-10-28", [row("p", "m", 1)]),
    }
    const activity = [
      { date: "2026-10-27", steps: 4 },
      { date: "2026-10-28", steps: 5 },
      { date: "2026-10-29", steps: 6 },
      { date: "2026-10-30", steps: 0 },
      { date: "2026-10-31", steps: 7 },
    ]
    expect(planBackfill(activity, days, "2026-10-31")).toEqual(["2026-10-27", "2026-10-29"])
  })
})

describe("trend", () => {
  const days = {
    "2026-10-29": dailyUsage("2026-10-29", [row("p", "m", 1)]),
    "2026-10-30": dailyUsage("2026-10-30", [row("p", "m", 2)]),
    "2026-10-31": dailyUsage("2026-10-31", [row("p", "m", 4)]),
  }

  it("fills missing dates with zero", () => {
    expect(dailyTotals(days, ["2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31"])).toEqual([0, 1, 2, 4])
  })

  it("maps values to block levels", () => {
    expect(trendLevels([0, 4, 8], 8)).toBe("·▅█")
    expect(trendLevels([0, 0, 0], 0)).toBe("···")
  })
})

describe("emptyHistory", () => {
  it("starts idle with no days", () => {
    expect(emptyHistory()).toEqual({
      version: 1,
      days: {},
      backfill: { status: "idle", total: 0, completed: 0, failed: 0 },
    })
  })
})
