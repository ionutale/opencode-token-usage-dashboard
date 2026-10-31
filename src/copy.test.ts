import { describe, expect, it } from "vitest"
import type { TokenColumn, TokenRow } from "./tokens"
import { sumRows } from "./tokens"
import { formatCsv, formatMarkdown } from "./copy"

const columns: TokenColumn[] = [
  { key: "provider", label: "Provider", width: 12, align: "left" },
  { key: "model", label: "Model", width: 24, align: "left" },
  { key: "input", label: "Input", width: 10, align: "right" },
  { key: "output", label: "Output", width: 9, align: "right" },
  { key: "cacheRead", label: "Cache R", width: 13, align: "right" },
  { key: "total", label: "Total", width: 13, align: "right" },
  { key: "steps", label: "Steps", width: 7, align: "right" },
  { key: "cost", label: "Cost*", width: 9, align: "right" },
]

const rows: TokenRow[] = [
  {
    providerID: "opencode-go",
    modelID: "deepseek-v4.1-flash",
    input: 61_900_000,
    output: 3_800_000,
    reasoning: 7_000_000,
    cacheRead: 2_200_000_000,
    cacheWrite: 0,
    total: 2_272_700_000,
    steps: 10_549,
    cost: 0.56,
    variants: [],
  },
  {
    providerID: "ollama",
    modelID: "qwen3.8:27b",
    input: 180_000,
    output: 66_200,
    reasoning: 154,
    cacheRead: 3_100_000,
    cacheWrite: 0,
    total: 3_346_354,
    steps: 31,
    cost: 0.01,
    variants: [],
  },
]

const totals = sumRows(rows)
const meta = {
  range: "Subscription month · Oct 1 → Oct 31",
  provider: "opencode-go",
  model: "all",
  project: "all",
  sort: "Total ↓",
  cost: true,
  archive: "127 days · since May 19",
}

describe("formatMarkdown", () => {
  it("includes the range, filters, visible rows, and total with exact values", () => {
    const output = formatMarkdown(columns, rows, totals, meta)
    expect(output).toContain("# Token usage")
    expect(output).toContain("Range: Subscription month · Oct 1 → Oct 31")
    expect(output).toContain("Provider: opencode-go")
    expect(output).toContain("Archive: 127 days · since May 19")
    expect(output).toContain("| Provider | Model | Input | Output | Cache R | Total | Steps | Cost* |")
    expect(output).toContain("| opencode-go | deepseek-v4.1-flash | 61,900,000 | 3,800,000 | 2,200,000,000 | 2,272,700,000 | 10,549 | $0.56 |")
    expect(output).toContain("| **Total** | **2 models** | 62,080,000 | 3,866,200 | 2,203,100,000 | 2,276,046,354 | 10,580 | $0.57 |")
    expect(output).not.toContain("61.9M")
  })

  it("escapes pipes in text cells", () => {
    const weird = [{ ...rows[0]!, modelID: "a|b" }]
    expect(formatMarkdown(columns, weird, sumRows(weird), meta)).toContain("a\\|b")
  })

  it("omits the cost column when it is not visible", () => {
    const noCost = columns.filter((column) => column.key !== "cost")
    const output = formatMarkdown(noCost, rows, totals, { ...meta, cost: false })
    expect(output).not.toContain("Cost*")
    expect(output).not.toContain("$0.56")
  })
})

describe("formatCsv", () => {
  it("writes machine-readable headers, raw numbers, and a total row", () => {
    const output = formatCsv(columns, rows, totals, meta)
    const lines = output.trim().split("\n")
    expect(lines[0]).toBe("provider,model,input,output,cache_read,total,steps,cost_usd")
    expect(lines[1]).toBe("opencode-go,deepseek-v4.1-flash,61900000,3800000,2200000000,2272700000,10549,0.56")
    expect(lines[3]).toBe("Total,2 models,62080000,3866200,2203100000,2276046354,10580,0.57")
  })

  it("quotes fields with commas or quotes", () => {
    const weird = [{ ...rows[0]!, modelID: 'a,b"c' }]
    const output = formatCsv(columns, weird, sumRows(weird), meta)
    expect(output).toContain('"a,b""c"')
  })
})
