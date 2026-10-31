import {
  columnText,
  totalColumnText,
  type ColumnKey,
  type TokenColumn,
  type TokenRow,
  type TokenTotals,
} from "./tokens"

export type CopyMeta = {
  range: string
  provider: string
  model: string
  project: string
  sort: string
  cost: boolean
  archive?: string
}

const CSV_HEADERS: Record<ColumnKey, string> = {
  provider: "provider",
  model: "model",
  input: "input",
  output: "output",
  reasoning: "reasoning",
  cacheRead: "cache_read",
  cacheWrite: "cache_write",
  total: "total",
  steps: "steps",
  cost: "cost_usd",
}

function markdownCell(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll(/\r?\n/g, " ")
}

function csvEscape(value: string): string {
  if (!/[",\r\n]/.test(value)) return value
  return `"${value.replaceAll('"', '""')}"`
}

function csvRowValue(column: TokenColumn, row: TokenRow): string {
  switch (column.key) {
    case "provider":
      return row.providerID
    case "model":
      return row.modelID
    case "input":
      return String(row.input)
    case "output":
      return String(row.output)
    case "reasoning":
      return String(row.reasoning)
    case "cacheRead":
      return String(row.cacheRead)
    case "cacheWrite":
      return String(row.cacheWrite)
    case "total":
      return String(row.total)
    case "steps":
      return String(row.steps)
    case "cost":
      return row.cost.toFixed(2)
  }
}

function csvTotalValue(column: TokenColumn, totals: TokenTotals, count: number): string {
  switch (column.key) {
    case "provider":
      return "Total"
    case "model":
      return `${count} model${count === 1 ? "" : "s"}`
    case "input":
      return String(totals.input)
    case "output":
      return String(totals.output)
    case "reasoning":
      return String(totals.reasoning)
    case "cacheRead":
      return String(totals.cacheRead)
    case "cacheWrite":
      return String(totals.cacheWrite)
    case "total":
      return String(totals.total)
    case "steps":
      return String(totals.steps)
    case "cost":
      return totals.cost.toFixed(2)
  }
}

export function formatMarkdown(
  columns: readonly TokenColumn[],
  rows: readonly TokenRow[],
  totals: TokenTotals,
  meta: CopyMeta,
): string {
  const lines = [
    "# Token usage",
    "",
    `Range: ${meta.range}`,
    `Provider: ${meta.provider} · Model: ${meta.model} · Project: ${meta.project} · Sort: ${meta.sort}`,
  ]
  if (meta.archive) lines.push(`Archive: ${meta.archive}`)
  lines.push("")
  lines.push(`| ${columns.map((column) => column.label).join(" | ")} |`)
  lines.push(`| ${columns.map(() => "---").join(" | ")} |`)
  for (const row of rows) {
    lines.push(`| ${columns.map((column) => markdownCell(columnText(column, row, true))).join(" | ")} |`)
  }
  const total = columns.map((column, index) => {
    const value = markdownCell(totalColumnText(column, totals, rows.length, true))
    return index < 2 ? `**${value}**` : value
  })
  lines.push(`| ${total.join(" | ")} |`)
  return lines.join("\n")
}

export function formatCsv(
  columns: readonly TokenColumn[],
  rows: readonly TokenRow[],
  totals: TokenTotals,
  _meta: CopyMeta,
): string {
  const lines = [columns.map((column) => CSV_HEADERS[column.key]).join(",")]
  for (const row of rows) {
    lines.push(columns.map((column) => csvEscape(csvRowValue(column, row))).join(","))
  }
  lines.push(columns.map((column) => csvEscape(csvTotalValue(column, totals, rows.length))).join(","))
  return lines.join("\n")
}
