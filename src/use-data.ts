import { usePlugin } from "@opencode/plugin/tui"
import { createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js"
import type { QuotaSample } from "./forecast"
import {
  archiveCoverage,
  archiveRows,
  dailyTotals,
  formatLocalDay,
  lastLocalDays,
  localDayRange,
  type ArchiveCoverage,
  type BackfillState,
} from "./history"
import {
  aggregateModels,
  describeRange,
  filterRows,
  mergeTokenRows,
  modelOptions,
  parseStatsResponse,
  providerOptions,
  rangeWindow,
  sortRows,
  sumRows,
  type StatsResponse,
  type TokenRow,
  type TokenTotals,
} from "./tokens"
import { filters, getLiveData, updateFilters, type ProjectChoice } from "./state"
import type { UsageResult } from "./usage"

const TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
const TREND_DAYS = 90

export type ProjectOption = {
  value: ProjectChoice
  label: string
}

export type UsageData = {
  rows: () => TokenRow[]
  totals: () => TokenTotals
  providers: () => string[]
  models: () => string[]
  loading: () => boolean
  error: () => string | undefined
  rangeLabel: () => string
  approximate: () => boolean
  updatedAt: () => number | undefined
  now: () => number
  projectOptions: () => ProjectOption[]
  projectLabel: () => string
  cycleProject: () => void
  archiveNote: () => string
  coverage: () => ArchiveCoverage
  backfill: () => BackfillState
  todayTotal: () => number
  todayLoading: () => boolean
  todayError: () => string | undefined
  trendDates: () => string[]
  trendValues: () => number[]
  quota: () => UsageResult | undefined
  quotaError: () => string | undefined
  quotaSamples: () => QuotaSample[]
  refresh: () => void
}

function basename(path: string): string {
  const parts = path.split("/").filter(Boolean)
  return parts[parts.length - 1] ?? path
}

function errorText(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "TimeoutError") return "Timed out loading local usage."
    if (error.name === "AbortError") return "Loading was cancelled."
    if (error.message.length > 0) return error.message
  }
  const record = typeof error === "object" && error !== null ? (error as Record<string, unknown>) : undefined
  if (typeof record?.message === "string" && record.message.length > 0) return record.message
  return "Could not load local usage."
}

export function useUsageData(): UsageData {
  const context = usePlugin()
  const live = getLiveData()

  const [liveStats, setLiveStats] = createSignal<StatsResponse | undefined>()
  const [todayRows, setTodayRows] = createSignal<TokenRow[]>([])
  const [liveLoading, setLiveLoading] = createSignal(true)
  const [todayLoading, setTodayLoading] = createSignal(true)
  const [liveError, setLiveError] = createSignal<string | undefined>()
  const [todayError, setTodayError] = createSignal<string | undefined>()
  const [updatedAt, setUpdatedAt] = createSignal<number | undefined>()
  const [refreshCounter, setRefreshCounter] = createSignal(0)
  const [now, setNow] = createSignal(Date.now())

  let disposed = false
  let liveRequest = 0
  let todayRequest = 0

  const projects = createMemo(() => context.data.project.list())
  const location = () => context.location ?? context.data.location.default()
  const currentProject = createMemo(() => {
    const directory = location().directory
    return projects()
      .filter((project) => directory === project.canonical || directory.startsWith(`${project.canonical.replace(/\/$/, "")}/`))
      .sort((left, right) => right.canonical.length - left.canonical.length)[0]
  })

  const projectOptions = createMemo<ProjectOption[]>(() => {
    const current = currentProject()
    const options: ProjectOption[] = [
      { value: "all", label: "All projects" },
      { value: "current", label: current ? `Current: ${current.name ?? basename(current.canonical)}` : "Current project" },
      ...projects().map((project) => ({
        value: project.id,
        label: project.name ?? basename(project.canonical),
      })),
    ]
    const selected = filters().project
    if (selected !== "all" && selected !== "current" && !options.some((option) => option.value === selected)) {
      options.push({ value: selected, label: selected })
    }
    return options
  })

  const projectLabel = createMemo(() => {
    if (filters().range === "all") return "all (archive)"
    return projectOptions().find((option) => option.value === filters().project)?.label ?? filters().project
  })

  function selectedProject(): string | undefined {
    if (filters().project === "all") return undefined
    if (filters().project === "current") return currentProject()?.id
    return filters().project
  }

  function cycleProject(): void {
    if (filters().range === "all") return
    const options = projectOptions()
    const index = options.findIndex((option) => option.value === filters().project)
    const next = options[(index + 1) % options.length]
    if (!next) return
    updateFilters({ project: next.value, model: "all" })
  }

  async function loadToday(at: number): Promise<void> {
    const id = ++todayRequest
    setTodayLoading(true)
    setTodayError(undefined)
    const date = formatLocalDay(at)
    const { from } = localDayRange(date)
    try {
      const result = await context.client.session.stats(
        { from, to: at + 1, timezone: TIMEZONE, tools: "none" },
        { signal: AbortSignal.timeout(30_000) },
      )
      if (disposed || id !== todayRequest) return
      const parsed = parseStatsResponse(result)
      setTodayRows(aggregateModels(parsed.models))
      setUpdatedAt(Date.now())
    } catch (error) {
      if (disposed || id !== todayRequest) return
      setTodayError(errorText(error))
    } finally {
      if (!disposed && id === todayRequest) setTodayLoading(false)
    }
  }

  async function loadLive(at: number): Promise<void> {
    if (filters().range === "all") return
    const id = ++liveRequest
    setLiveLoading(true)
    setLiveError(undefined)
    setLiveStats(undefined)
    const active = rangeWindow(filters().range, live.quota(), at)
    const project = selectedProject()
    try {
      const result = await context.client.session.stats(
        {
          from: active.from,
          to: active.to,
          timezone: TIMEZONE,
          tools: "none",
          ...(project === undefined ? {} : { project }),
        },
        { signal: AbortSignal.timeout(30_000) },
      )
      if (disposed || id !== liveRequest) return
      const parsed = parseStatsResponse(result)
      setLiveStats(parsed)
      setUpdatedAt(Date.now())
    } catch (error) {
      if (disposed || id !== liveRequest) return
      setLiveError(errorText(error))
    } finally {
      if (!disposed && id === liveRequest) setLiveLoading(false)
    }
  }

  createEffect(() => {
    const refresh = refreshCounter()
    const at = Date.now()
    setNow(at)
    void loadToday(at)
  })

  createEffect(() => {
    const range = filters().range
    const project = filters().project
    const current = currentProject()?.id
    const reset = `${live.quota()?.usage.weekly.resetsAt ?? ""}|${live.quota()?.usage.monthly.resetsAt ?? ""}|${live.quota()?.stale === true}`
    const refresh = refreshCounter()
    if (range === "all") return
    const at = Date.now()
    setNow(at)
    void loadLive(at)
  })

  onMount(() => {
    void context.data.project.sync().catch(() => undefined)
  })

  onCleanup(() => {
    disposed = true
    liveRequest += 1
    todayRequest += 1
  })

  const archivedRows = createMemo(() => archiveRows(live.history.days, formatLocalDay(now())))
  const todayTotal = createMemo(() => sumRows(todayRows()).total)
  const allRows = createMemo(() => {
    if (filters().range === "all") return mergeTokenRows([...archivedRows(), ...todayRows()])
    return aggregateModels(liveStats()?.models ?? [])
  })
  const rows = createMemo(() =>
    sortRows(filterRows(allRows(), filters().provider, filters().model), filters().sort, filters().direction),
  )
  const totals = createMemo(() => sumRows(rows()))
  const providers = createMemo(() => {
    const base = ["all", ...providerOptions(allRows())]
    return filters().provider !== "all" && !base.includes(filters().provider)
      ? [filters().provider, ...base]
      : base
  })
  const models = createMemo(() => {
    const base = ["all", ...modelOptions(allRows(), filters().provider)]
    return filters().model !== "all" && !base.includes(filters().model) ? [filters().model, ...base] : base
  })

  createEffect(() => {
    if (loading()) return
    const options = modelOptions(allRows(), filters().provider)
    if (filters().model !== "all" && !options.includes(filters().model)) {
      updateFilters({ model: "all" })
    }
  })

  const loading = createMemo(() =>
    filters().range === "all" ? archivedRows().length === 0 && todayLoading() : liveLoading(),
  )
  const error = createMemo(() =>
    filters().range === "all" ? (archivedRows().length === 0 ? todayError() : undefined) : liveError(),
  )

  const coverage = createMemo(() => archiveCoverage(live.history.days))
  const backfill = createMemo(() => live.history.backfill)
  const rangeLabel = createMemo(() => {
    if (filters().range === "all") {
      return coverage().from
        ? `All local history · archived since ${coverage().from}`
        : "All local history · archive starts now"
    }
    return describeRange(rangeWindow(filters().range, live.quota(), now()), TIMEZONE)
  })

  const archiveNote = createMemo(() => {
    const archived = coverage()
    const state = backfill()
    const parts = [archived.from ? `Archive ${archived.days} days · since ${archived.from}` : "Archive empty"]
    if (state.status === "running") parts.push(`backfilling ${state.completed}/${state.total}`)
    else if (state.status === "done" && state.failed > 0) parts.push(`${state.failed} failed`)
    if (filters().range === "all") {
      if (todayLoading()) parts.push("today loading")
      if (todayError()) parts.push("today unavailable")
    }
    return parts.join(" · ")
  })
  const approximate = createMemo(
    () => filters().range !== "all" && rangeWindow(filters().range, live.quota(), now()).approximate,
  )

  const trendDates = createMemo(() => lastLocalDays(TREND_DAYS, now()))
  const trendValues = createMemo(() => {
    const dates = trendDates()
    const values = dailyTotals(live.history.days, dates)
    if (values.length > 0) values[values.length - 1] = todayTotal()
    return values
  })

  const refresh = () => {
    setRefreshCounter((value) => value + 1)
    live.refreshQuota()
  }

  return {
    rows,
    totals,
    providers,
    models,
    loading,
    error,
    rangeLabel,
    approximate,
    updatedAt,
    now,
    projectOptions,
    projectLabel,
    cycleProject,
    archiveNote,
    coverage,
    backfill,
    todayTotal,
    todayLoading,
    todayError,
    trendDates,
    trendValues,
    quota: live.quota,
    quotaError: live.quotaError,
    quotaSamples: () => live.quotaSamples.samples,
    refresh,
  }
}
