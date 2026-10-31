/** @jsxImportSource @opentui/solid */
import { usePlugin } from "@opencode/plugin/tui"
import { TextAttributes } from "@opentui/core"
import { For, Show, createMemo, type JSX } from "solid-js"
import { formatCsv, formatMarkdown } from "./copy"
import { forecastLabel, forecastQuota, type QuotaWindowKey } from "./forecast"
import { trendLevels } from "./history"
import { filters, updateFilters, getLiveData } from "./state"
import {
  columnText,
  fitNumber,
  fitText,
  formatTokens,
  formatCost,
  sumRows,
  tokenColumns,
  totalColumnText,
  type TokenColumn,
  type TokenRow,
  type TokenTotals,
} from "./tokens"
import { useUsageData, type UsageData } from "./use-data"
import {
  RED,
  YELLOW,
  barSegments,
  formatResetsIn,
  usageColor,
  type UsageWindow,
} from "./usage"

const RANGE_OPTIONS = [
  { key: "rolling", label: "1 Rolling" },
  { key: "week", label: "2 Week" },
  { key: "month", label: "3 Month" },
  { key: "all", label: "4 All" },
] as const

const SORT_KEYS = ["total", "input", "output", "cacheRead", "cacheWrite", "steps", "cost", "reasoning"] as const

const SORT_LABELS: Record<(typeof SORT_KEYS)[number], string> = {
  total: "Total",
  input: "Input",
  output: "Output",
  reasoning: "Reasoning",
  cacheRead: "Cache read",
  cacheWrite: "Cache write",
  steps: "Steps",
  cost: "Cost",
}

const FORECAST_WINDOWS: ReadonlyArray<{ key: QuotaWindowKey; label: string }> = [
  { key: "rolling", label: "Rolling" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
]

export function UsageView(props: {
  width: number
  maxTableHeight: number
  dashboard?: boolean
  onClose: () => void
}) {
  const context = usePlugin()
  const muted = context.theme.text.muted
  const data = useUsageData()

  const columns = createMemo<TokenColumn[]>(() =>
    tokenColumns(data.rows(), data.totals(), {
      width: props.width,
      exact: filters().exact,
      cost: filters().cost,
    }),
  )

  const tableHeight = createMemo(() => Math.min(props.maxTableHeight, Math.max(5, data.rows().length)))

  const copy = (kind: "markdown" | "csv") => {
    const meta = {
      range: data.rangeLabel(),
      provider: filters().provider,
      model: filters().model,
      project: data.projectLabel(),
      sort: `${SORT_LABELS[filters().sort]} ${filters().direction === "desc" ? "↓" : "↑"}`,
      cost: filters().cost,
      ...(filters().range === "all" ? { archive: data.archiveNote() } : {}),
    }
    const text =
      kind === "markdown"
        ? formatMarkdown(columns(), data.rows(), data.totals(), meta)
        : formatCsv(columns(), data.rows(), data.totals(), meta)
    const ok = context.renderer.copyToClipboardOSC52(text)
    context.ui.toast.show({
      message: ok ? `Copied ${kind === "markdown" ? "Markdown" : "CSV"}` : "Clipboard unavailable",
      variant: ok ? "success" : "warning",
    })
  }

  const selectRange = (range: (typeof RANGE_OPTIONS)[number]["key"]) => {
    if (filters().range === range) return
    updateFilters({ range })
  }

  const cycleRange = (direction: number) => {
    const index = RANGE_OPTIONS.findIndex((option) => option.key === filters().range)
    const next = RANGE_OPTIONS[(index + direction + RANGE_OPTIONS.length) % RANGE_OPTIONS.length]
    if (next) selectRange(next.key)
  }

  const cycleProvider = () => {
    const choices = data.providers()
    const index = choices.indexOf(filters().provider)
    updateFilters({ provider: choices[(index + 1) % choices.length] ?? "all", model: "all" })
  }

  const cycleModel = () => {
    const choices = data.models()
    const index = choices.indexOf(filters().model)
    updateFilters({ model: choices[(index + 1) % choices.length] ?? "all" })
  }

  const cycleSort = () => {
    const index = SORT_KEYS.indexOf(filters().sort)
    updateFilters({ sort: SORT_KEYS[(index + 1) % SORT_KEYS.length] ?? "total" })
  }

  const toggleDirection = () => updateFilters({ direction: filters().direction === "desc" ? "asc" : "desc" })
  const toggleCost = () => {
    updateFilters({ cost: !filters().cost })
  }
  const toggleExact = () => {
    updateFilters({ exact: !filters().exact })
  }

  const cycleProject = () => {
    if (filters().range === "all") {
      context.ui.toast.show({
        message: "Project filter applies to live ranges. Choose Rolling, Week, or Month.",
        variant: "warning",
      })
      return
    }
    data.cycleProject()
  }

  context.keymap.layer(() => ({
    mode: "global",
    priority: 10,
    commands: [
      { bind: "escape", run: props.onClose },
      { bind: "1", run: () => selectRange("rolling") },
      { bind: "2", run: () => selectRange("week") },
      { bind: "3", run: () => selectRange("month") },
      { bind: "4", run: () => selectRange("all") },
      { bind: "[", run: () => cycleRange(-1) },
      { bind: "]", run: () => cycleRange(1) },
      { bind: "p", run: cycleProvider },
      { bind: "shift+p", run: cycleProject },
      { bind: "m", run: cycleModel },
      { bind: "s", run: cycleSort },
      { bind: "shift+s", run: toggleDirection },
      { bind: "c", run: toggleCost },
      { bind: "t", run: toggleExact },
      { bind: "y", run: () => copy("markdown") },
      { bind: "shift+y", run: () => copy("csv") },
      { bind: "r", run: data.refresh },
    ],
  }))

  const footerHint = () =>
    props.width >= 100
      ? "[ ] range · 1-4 range · p provider · P project · m model · s sort · c cost · t exact · y/Y copy · r refresh · Esc"
      : "[ ] range · 1-4 range · p provider · P project · m model · s sort · c cost · t exact · y/Y copy · r"

  return (
    <box flexDirection="column" width={props.width} gap={0}>
      <UsageHeader data={data} />
      {props.dashboard ? (
        <>
          <Summary data={data} width={props.width} />
          <Trend data={data} width={props.width} />
        </>
      ) : null}
      <FilterBar data={data} />
      <TableHeader columns={columns()} />
      <box height={tableHeight()} width="100%">
        <Show when={!data.error()} fallback={<ErrorState text={data.error() ?? "Could not load local usage."} />}>
          <Show when={!data.loading()} fallback={<LoadingState />}>
            <Show when={data.rows().length > 0} fallback={<EmptyState data={data} />}>
              <scrollbox
                width="100%"
                height="100%"
                focused={true}
                scrollX={false}
                contentOptions={{ flexDirection: "column" }}
                verticalScrollbarOptions={{ visible: false }}
                horizontalScrollbarOptions={{ visible: false }}
              >
                <For each={data.rows()}>
                  {(row) => <TableRow cells={rowCells(columns(), row, filters().exact)} />}
                </For>
              </scrollbox>
            </Show>
          </Show>
        </Show>
      </box>
      <TotalArea
        columns={columns()}
        totals={data.totals()}
        count={data.rows().length}
        exact={filters().exact}
        visible={!data.loading() && !data.error()}
      />
      <Show when={filters().cost}>
        <text fg={muted}>* Cost is an estimated list price, not your Go subscription charge.</text>
      </Show>
      <text fg={muted} wrapMode="none">
        {footerHint()}
      </text>
    </box>
  )
}

function UsageHeader(props: { data: UsageData }) {
  const context = usePlugin()
  const muted = context.theme.text.muted
  const base = context.theme.text.base

  return (
    <box flexDirection="column">
      <box flexDirection="row" justifyContent="space-between">
        <text fg={base} attributes={TextAttributes.BOLD}>
          Token usage
        </text>
        <text fg={muted}>
          {props.data.updatedAt() === undefined ? "Gathering…" : `Updated ${formatClock(props.data.updatedAt()!)}`}
        </text>
      </box>
      <text fg={muted}>Official Go quota (% of allowance)</text>
      <Show
        when={props.data.quota()}
        fallback={
          <text fg={props.data.quotaError() === undefined ? muted : RED}>
            Go quota: {props.data.quotaError() ?? "loading…"}
          </text>
        }
      >
        {(usage) => (
          <>
            <QuotaRow label="Rolling" window={() => usage().usage.rolling} now={props.data.now} dim={() => usage().stale === true} />
            <QuotaRow label="Weekly" window={() => usage().usage.weekly} now={props.data.now} dim={() => usage().stale === true} />
            <QuotaRow label="Monthly" window={() => usage().usage.monthly} now={props.data.now} dim={() => usage().stale === true} />
          </>
        )}
      </Show>
      <text fg={muted}>Local stats · this OpenCode server only · includes subagents</text>
    </box>
  )
}

function QuotaRow(props: { label: string; window: () => UsageWindow; now: () => number; dim: () => boolean }) {
  const context = usePlugin()
  const accent = () => (props.dim() ? context.theme.text.muted : usageColor(props.window().percent))
  const percent = () => String(Math.round(props.window().percent)).padStart(3)
  return (
    <box flexDirection="row">
      <text fg={context.theme.text.muted}>{props.label.padEnd(9)}</text>
      <text fg={accent()}>{barSegments(props.window().percent)}</text>
      <text fg={accent()}>{`  ${percent()}%`}</text>
      <text fg={context.theme.text.muted}>{`  ${formatResetsIn(props.window().resetsAt, props.now())}`}</text>
    </box>
  )
}

function FilterBar(props: { data: UsageData }) {
  const context = usePlugin()
  const muted = context.theme.text.muted
  const base = context.theme.text.base

  return (
    <box flexDirection="column">
      <box flexDirection="row" gap={1}>
        <text fg={muted}>Range</text>
        <For each={RANGE_OPTIONS}>
          {(option) => (
            <text
              fg={filters().range === option.key ? base : muted}
              attributes={filters().range === option.key ? TextAttributes.BOLD : undefined}
            >
              {option.label}
            </text>
          )}
        </For>
        <text fg={muted}>· Provider [p]</text>
        <text fg={base}>{filters().provider}</text>
        <text fg={muted}>· Model [m]</text>
        <text fg={base}>{shorten(filters().model, 20)}</text>
      </box>
      <box flexDirection="row" gap={1}>
        <text fg={muted}>Project [P]</text>
        <text fg={base}>{shorten(props.data.projectLabel(), 16)}</text>
        <text fg={muted}>· Sort [s]</text>
        <text fg={base}>
          {SORT_LABELS[filters().sort]} {filters().direction === "desc" ? "↓" : "↑"}
        </text>
        <text fg={muted}>· Cost [c]</text>
        <text fg={base}>{filters().cost ? "on" : "off"}</text>
        <text fg={muted}>· Exact [t]</text>
        <text fg={base}>{filters().exact ? "on" : "off"}</text>
        <text fg={muted}>· Copy [y/Y]</text>
      </box>
      <text fg={props.data.approximate() ? YELLOW : muted} wrapMode="none">
        {props.data.rangeLabel()}
      </text>
      <text fg={muted} wrapMode="none">
        {props.data.archiveNote()}
      </text>
    </box>
  )
}

type Cell = {
  text: string
  width: number
  align: "left" | "right"
  color?: string
  bold?: boolean
}

function TableHeader(props: { columns: readonly TokenColumn[] }) {
  return <TableRow cells={props.columns.map((column) => cell(column.label, column))} muted={true} />
}

function TableRow(props: { cells: readonly Cell[]; muted?: boolean; bold?: boolean }) {
  const context = usePlugin()
  const defaultColor = () => (props.muted ? context.theme.text.muted : context.theme.text.base)
  const bold = () => props.bold === true
  return (
    <box flexDirection="row" gap={1} height={1}>
      <For each={props.cells}>
        {(item) => (
          <box width={item.width} flexShrink={0}>
            <text
              fg={item.color ?? defaultColor()}
              attributes={bold() || item.bold === true ? TextAttributes.BOLD : undefined}
              wrapMode="none"
            >
              {item.align === "left" ? fitText(item.text, item.width) : fitNumber(item.text, item.width)}
            </text>
          </box>
        )}
      </For>
    </box>
  )
}

function TotalArea(props: {
  columns: readonly TokenColumn[]
  totals: TokenTotals
  count: number
  exact: boolean
  visible: boolean
}) {
  const context = usePlugin()
  const muted = context.theme.text.muted
  const width = () => props.columns.reduce((sum, column) => sum + column.width, 0) + Math.max(0, props.columns.length - 1)
  return (
    <box height={2} flexDirection="column">
      <Show when={props.visible} fallback={<text fg={muted}> </text>}>
        <text fg={muted}>{"─".repeat(width())}</text>
        <TableRow cells={totalCells(props.columns, props.totals, props.count, props.exact)} bold={true} />
      </Show>
    </box>
  )
}

function LoadingState() {
  const context = usePlugin()
  return (
    <box height="100%" width="100%" alignItems="center" justifyContent="center">
      <text fg={context.theme.text.muted}>Gathering local usage…</text>
    </box>
  )
}

function EmptyState(props: { data: UsageData }) {
  const context = usePlugin()
  const muted = context.theme.text.muted
  return (
    <box height="100%" width="100%" flexDirection="column" alignItems="center" justifyContent="center" gap={1}>
      <text fg={muted}>No usage for this range and filter.</text>
      <text fg={muted}>Press p for provider, P for project, or 1-4 for range.</text>
    </box>
  )
}

function ErrorState(props: { text: string }) {
  const context = usePlugin()
  return (
    <box height="100%" width="100%" flexDirection="column" alignItems="center" justifyContent="center" gap={1}>
      <text fg={RED} wrapMode="word">
        {props.text}
      </text>
      <text fg={context.theme.text.muted}>Press r to retry.</text>
    </box>
  )
}

function cell(text: string, column: TokenColumn, color?: string): Cell {
  return { text, width: column.width, align: column.align, ...(color === undefined ? {} : { color }) }
}

function rowCells(columns: readonly TokenColumn[], row: TokenRow, exact: boolean): Cell[] {
  return columns.map((column) => cell(columnText(column, row, exact), column))
}

function totalCells(columns: readonly TokenColumn[], totals: TokenTotals, count: number, exact: boolean): Cell[] {
  return columns.map((column) => cell(totalColumnText(column, totals, count, exact), column))
}

export function Summary(props: { data: UsageData; width: number }) {
  const context = usePlugin()
  const muted = context.theme.text.muted
  const base = context.theme.text.base
  const cardWidth = () => Math.max(16, Math.floor((props.width - 6) / 4))
  const totals = createMemo(() => sumRows(props.data.rows()))
  const cachePercent = createMemo(() => {
    const value = totals()
    const input = value.input + value.cacheRead
    return input > 0 ? (value.cacheRead / input) * 100 : 0
  })
  const top = createMemo(() => {
    const rows = props.data.rows()
    return rows.reduce<TokenRow | undefined>((best, row) => (best === undefined || row.total > best.total ? row : best), undefined)
  })
  const forecasts = createMemo(() =>
    FORECAST_WINDOWS.map((window) => ({
      label: window.label,
      text: forecastLabel(forecastQuota(props.data.quotaSamples(), window.key, props.data.now()), props.data.now()),
    })),
  )

  return (
    <box flexDirection="row" gap={2} height={4}>
      <Card
        width={cardWidth()}
        label="Total tokens"
        value={formatTokens(totals().total, filters().exact)}
        detail={`${formatTokens(totals().steps, true)} steps`}
      />
      <Card
        width={cardWidth()}
        label="Cached input"
        value={`${cachePercent().toFixed(1)}%`}
        detail="cache read share"
      />
      <Card
        width={cardWidth()}
        label="Top model"
        value={top()?.modelID ?? "—"}
        detail={top() ? `${formatTokens(top()!.total, filters().exact)} tokens · ${formatCost(top()!.cost)} est.` : "no usage"}
      />
      <box width={cardWidth()} flexDirection="column">
        <text fg={muted}>Forecast</text>
        <For each={forecasts()}>
          {(forecast) => (
            <text fg={base} wrapMode="none">
              {shorten(`${forecast.label} ${forecast.text}`, cardWidth())}
            </text>
          )}
        </For>
      </box>
    </box>
  )
}

function Card(props: { width: number; label: string; value: string; detail: string }) {
  const context = usePlugin()
  const muted = context.theme.text.muted
  const base = context.theme.text.base
  return (
    <box width={props.width} flexDirection="column">
      <text fg={muted}>{props.label}</text>
      <text fg={base} attributes={TextAttributes.BOLD} wrapMode="none">
        {shorten(props.value, props.width)}
      </text>
      <text fg={muted} wrapMode="none">
        {shorten(props.detail, props.width)}
      </text>
    </box>
  )
}

export function Trend(props: { data: UsageData; width: number }) {
  const context = usePlugin()
  const muted = context.theme.text.muted
  const base = context.theme.text.base
  const dates = createMemo(() => props.data.trendDates())
  const levels = createMemo(() => trendLevels(props.data.trendValues()))
  return (
    <box flexDirection="column" height={4}>
      <text fg={muted}>90-day trend · all projects</text>
      <text fg={base} wrapMode="none">
        {levels()}
      </text>
      <box flexDirection="row" justifyContent="space-between">
        <text fg={muted}>{dates()[0] ?? ""}</text>
        <text fg={muted}>{dates()[dates().length - 1] ?? ""}</text>
      </box>
    </box>
  )
}

function shorten(value: string, width: number): string {
  if (width <= 0) return ""
  if (value.length <= width) return value
  if (width === 1) return "…"
  return `${value.slice(0, width - 1)}…`
}

function formatClock(ms: number): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(ms))
}
