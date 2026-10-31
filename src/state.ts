import { createSignal, type Accessor } from "solid-js"
import type { Store } from "solid-js/store"
import type { QuotaStore } from "./forecast"
import type { HistoryStore } from "./history"
import type { RangeKey, SortDirection, SortKey } from "./tokens"
import type { UsageResult } from "./usage"

export type ProjectChoice = "all" | "current" | string

export type Filters = {
  range: RangeKey
  provider: string
  model: string
  project: ProjectChoice
  sort: SortKey
  direction: SortDirection
  cost: boolean
  exact: boolean
}

export const DEFAULT_FILTERS: Filters = {
  range: "month",
  provider: "opencode-go",
  model: "all",
  project: "all",
  sort: "total",
  direction: "desc",
  cost: false,
  exact: false,
}

const [filters, setFilters] = createSignal<Filters>({ ...DEFAULT_FILTERS })
export { filters }

export function updateFilters(patch: Partial<Filters>): void {
  setFilters({ ...filters(), ...patch })
}

export function resetFilters(): void {
  setFilters({ ...DEFAULT_FILTERS })
}

export type LiveData = {
  quota: Accessor<UsageResult | undefined>
  quotaError: Accessor<string | undefined>
  refreshQuota: () => void
  history: Store<HistoryStore>
  updateHistory: (mutation: (draft: HistoryStore) => void) => Promise<void>
  quotaSamples: Store<QuotaStore>
  updateQuotaSamples: (mutation: (draft: QuotaStore) => void) => void
}

let live: LiveData | undefined

export function setLiveData(value: LiveData): void {
  live = value
}

export function getLiveData(): LiveData {
  if (!live) throw new Error("token usage data is not ready")
  return live
}
