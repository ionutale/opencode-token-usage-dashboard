/** @jsxImportSource @opentui/solid */
import { Plugin } from "@opencode/plugin/tui"
import { createSignal } from "solid-js"
import { Dashboard } from "./dashboard"
import { TokensModal } from "./modal"
import { GoUsage, QUOTA_TIMEOUT_MS, quotaErrorText } from "./quota"
import { appendQuotaSamples, type QuotaStore } from "./forecast"
import { dailyUsage, emptyHistory, formatLocalDay, localDayRange, planBackfill, type HistoryStore } from "./history"
import { setLiveData } from "./state"
import { aggregateModels, parseStatsResponse } from "./tokens"
import type { UsageResult } from "./usage"

const TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"

export default Plugin.define({
  id: "opencode-token-usage-dashboard.tui",
  setup(context) {
    const rpc = context.client.rpc(GoUsage)
    const [quota, setQuota] = createSignal<UsageResult | undefined>()
    const [quotaError, setQuotaError] = createSignal<string | undefined>()
    const [history, updateHistory] = context.storage.store<HistoryStore>("token-usage.history", {
      initial: emptyHistory(),
    })
    const [quotaSamples, updateQuotaSamples] = context.storage.store<QuotaStore>("token-usage.quota", {
      initial: { samples: [] },
    })

    let disposed = false
    let quotaRequest = 0
    let quotaTimer: ReturnType<typeof setInterval> | undefined
    const abort = new AbortController()

    const refreshQuota = async () => {
      const id = ++quotaRequest
      try {
        const location = context.location ?? context.data.location.default()
        const result = await rpc.get({}, { location, signal: AbortSignal.timeout(QUOTA_TIMEOUT_MS) })
        if (disposed || id !== quotaRequest) return
        const usage = result as UsageResult
        setQuota(usage)
        setQuotaError(undefined)
        updateQuotaSamples((draft) => {
          draft.samples = appendQuotaSamples(draft.samples, usage, Date.now())
        })
      } catch (error) {
        if (disposed || id !== quotaRequest) return
        setQuota(undefined)
        setQuotaError(quotaErrorText(error))
      }
    }

    setLiveData({
      quota,
      quotaError,
      refreshQuota: () => void refreshQuota(),
      history,
      updateHistory,
      quotaSamples,
      updateQuotaSamples,
    })

    const runBackfill = async () => {
      try {
        const today = formatLocalDay(Date.now())
        const archived = Object.keys(history.days).sort()
        let activity: Array<{ date: string; steps: number }> = []

        if (archived.length === 0 || history.backfill.failed > 0) {
          const all = await context.client.session.stats(
            { timezone: TIMEZONE, tools: "none" },
            { signal: abort.signal },
          )
          if (disposed) return
          activity = Array.isArray(all.activity)
            ? all.activity.map((item) => ({ date: item.date, steps: item.steps }))
            : []
        } else {
          const last = archived[archived.length - 1]!
          const from = localDayRange(last).to
          const now = Date.now()
          if (from < now) {
            const recent = await context.client.session.stats(
              { from, to: now + 1, timezone: TIMEZONE, tools: "none" },
              { signal: abort.signal },
            )
            if (disposed) return
            activity = Array.isArray(recent.activity)
              ? recent.activity.map((item) => ({ date: item.date, steps: item.steps }))
              : []
          }
        }

        const plan = planBackfill(activity, history.days, today)
        if (plan.length === 0) {
          if (history.backfill.status !== "done") {
            await updateHistory((draft) => {
              draft.backfill = { status: "done", total: 0, completed: 0, failed: 0, finishedAt: Date.now() }
            })
          }
          return
        }

        await updateHistory((draft) => {
          draft.backfill = { status: "running", total: plan.length, completed: 0, failed: 0, startedAt: Date.now() }
        })

        for (const date of plan) {
          if (disposed) return
          try {
            const { from, to } = localDayRange(date)
            const stats = await context.client.session.stats(
              { from, to, timezone: TIMEZONE, tools: "none" },
              { signal: abort.signal },
            )
            if (disposed) return
            const parsed = parseStatsResponse(stats)
            const day = dailyUsage(date, aggregateModels(parsed.models))
            await updateHistory((draft) => {
              draft.days[date] = day
              draft.backfill.completed += 1
            })
          } catch {
            if (disposed) return
            await updateHistory((draft) => {
              draft.backfill.failed += 1
            })
          }
        }

        await updateHistory((draft) => {
          draft.backfill.status = "done"
          draft.backfill.finishedAt = Date.now()
        })
      } catch {
        // A failed query leaves the archive as-is; the next TUI start retries.
      }
    }

    void refreshQuota()
    const backfillTimer = setTimeout(() => void runBackfill(), 10_000)
    quotaTimer = setInterval(() => void refreshQuota(), 30_000)

    const [previous, setPrevious] = createSignal(context.ui.router.current())
    const unregister = context.ui.router.register({
      name: "token-usage",
      render: () => <Dashboard onClose={() => context.ui.router.navigate(previous())} />,
    })

    const openDashboard = () => {
      const current = context.ui.router.current()
      if (current.type === "plugin" && current.name === "token-usage") return
      setPrevious({ ...current })
      context.ui.dialog.clear()
      context.ui.router.navigate({ type: "plugin", name: "token-usage" })
    }

    const openQuick = () => {
      context.ui.dialog.clear()
      context.ui.dialog.show(() => <TokensModal />)
      // `show` replaces the dialog and resets presentation to medium.
      context.ui.dialog.set({ size: "xlarge", centered: true })
    }

    context.keymap.layer(() => ({
      mode: "global",
      priority: 10,
      commands: [
        {
          id: "opencode-token-usage.dashboard",
          title: "Token usage dashboard",
          group: "Token usage",
          palette: true,
          slash: { name: "tokens" },
          run: openDashboard,
        },
        {
          id: "opencode-token-usage.quick",
          title: "Token usage: quick view",
          group: "Token usage",
          palette: true,
          slash: { name: "tokens-quick" },
          run: openQuick,
        },
      ],
    }))

    return () => {
      disposed = true
      quotaRequest += 1
      abort.abort()
      if (quotaTimer) clearInterval(quotaTimer)
      clearTimeout(backfillTimer)
      unregister()
    }
  },
})
