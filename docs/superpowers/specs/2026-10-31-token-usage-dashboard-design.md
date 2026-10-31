# OpenCode Token Usage Dashboard — Design

- **Date:** 2026-10-31
- **Status:** Implemented in 0.1.0
- **Repo:** `github.com/ionutale/opencode-token-usage-dashboard`
- **Target:** OpenCode V2 (verified against 2.2.5)

## Summary

A generic OpenCode token-usage plugin with two surfaces:

- `/tokens` — full-screen dashboard with summary cards, a 90-day archive trend,
  filters, and the full table.
- `/tokens-quick` — xlarge modal with quota bars, filters, the table, and a
  pinned total.

The plugin archives local daily provider/model aggregates, shows 90 days of
history, and projects the official Go quota from sampled percentages. It works
without the Go plugin for local usage; when `opencode-go-usage-plugin` 0.3.0+ is
installed, it uses that plugin’s read-only `go-usage` RPC for official quota bars
and the forecast.

## Goals

1. Local token history per provider + model across the current subscription
   windows and all archived time.
2. Preserve history beyond the live OpenCode stats window.
3. Show cache efficiency and a useful quota forecast.
4. Keep the key and quota fetch server-side in the Go plugin.
5. Be useful with or without the Go plugin.

## Non-goals

- Cross-machine or per-API-key attribution.
- Server-authoritative Go usage history (not exposed by the official API).
- Per-project archived history (backfill cost).
- A web dashboard, charts beyond a text sparkline, or notifications.

## Verified constraints

- OpenCode local `client.session.stats` returns per-model tokens, steps, cost,
  and an `activity` list. Numeric `from`/`to` filtering works.
- `activity` dates are in the supplied timezone; daily queries use local
  midnight boundaries.
- The official Go endpoint has no per-model history (issue #43983 still open).
- `opencode-go-usage-plugin` provides the `go-usage` RPC and resolves the key
  server-side. The dashboard duplicates only the client-side RPC contract.
- OpenCode 2.2.5 TUI data-hook reactivity is reliable when the hook lives in the
  same component that renders the header, summary, and table. Passing a data
  object from a wrapper into a child view caused stale header/summary labels on
  filter changes.
- The dashboard route may consume number keys before the plugin layer; `[`/`]`
  are the reliable range-cycle bindings. The dialog/modal keeps `1-4`.

## Architecture

```text
TUI (dashboard/modal)
├─ useUsageData hook (inside UsageView)
│  ├─ live stats: client.session.stats({from,to,project})
│  ├─ today live: client.session.stats({from,to})
│  ├─ archive rows: durable history store
│  └─ filters: shared module signal
├─ quota state: go-usage RPC (optional) + durable samples
└─ background setup (tui.tsx)
   ├─ quota poll every 30s → samples
   └─ archive backfill: all active days, resumable
```

### Store

`HistoryStore`:

```ts
{
  version: 1
  days: Record<string, { date, rows, steps, cost, total }>
  backfill: { status, total, completed, failed, startedAt?, finishedAt? }
}
```

`QuotaStore`: `{ samples: QuotaSample[] }`, 6h retention.

### Backfill

- First run (or after failures): stats all-time `activity`, active days before
  today, query each missing day, store its daily aggregate.
- Subsequent runs: query only the range since the last archived day; this avoids
  re-scanning all history on every TUI start.
- Runs 10s after TUI startup so the live view loads first.
- Sequential, resumable, background; progress is shown in the filter bar.

### Ranges

| Range | From |
| --- | --- |
| rolling | `now − 5h` |
| week | `weekly.resetsAt − 7d` |
| month | `subtractCalendarMonth(monthly.resetsAt)` |
| all | archived days + live today |

Expired resets fall back to ISO week/calendar month UTC and are marked
approximate. Month subtraction clamps month-end/leap-year dates.

## Summary and trend

- Total tokens + steps for the current filtered rows.
- Cached input share = `cacheRead / (input + cacheRead)`.
- Top model by total tokens, with estimated list cost.
- Forecast cards for rolling/weekly/monthly.
- 90-day sparkline of all-project daily totals; today comes from live data.
- Daily rows are completed days; today is always live.

## Forecast

- Sample `go-usage` every 30s; keep 6h per window.
- Use the latest reset cycle and the last 3h of samples.
- Requires 8 samples / 15 min span.
- Least-squares slope; project `(100 − current) / slope`.
- If the projection is after the reset, report “No risk before reset”.
- If slope ≤ 0, “Not burning”; if current ≥ 100, “Reached”.
- Without the Go plugin, “Quota unavailable”.

## Table and copy

- `tokenColumns` sizes numeric columns to the widest exact/compact value; never
  truncates numbers.
- Optional columns drop in order: Reasoning → Steps → Cache W → Cost.
- One row per provider + model; variants aggregated.
- The pinned total sums visible serialized rows.
- Copy:
  - `y`: Markdown with range/filter header, visible rows, total.
  - `Y`: CSV with machine headers, raw numbers, total.
  - Uses `renderer.copyToClipboardOSC52`; toast success/failure.
  - Copy always uses exact numbers.

## Reactivity ruling

The data hook must live inside `UsageView`, not in the wrapper component. A
wrapper hook plus child view produced stale range labels/summary cards on
OpenCode 2.2.5. This is a platform-specific ruling; keep the hook and the view
together.

The dashboard route uses `[`/`]` for range cycling because number keys can be
intercepted by the route’s global keymap. The quick modal keeps `1-4`.

## Project filter

- `all` / `current` / each project.
- Applies to live ranges and today only.
- Disabled in `All` and the 90-day trend; the filter bar shows `all (archive)`.
- Archived rows are provider/model aggregates, not per-project.

## Release split

- New plugin: `opencode-token-usage-dashboard` 0.1.0.
- Existing plugin: `opencode-go-usage-plugin` 0.3.0, removes `/tokens`, keeps
  sidebar + `go-usage` RPC, README points here.
- Install both for quota/forecast; the dashboard works standalone for local
  table/history.
- npm name is available; publishing is pending `npm login`.

## Testing

- Unit: ranges, month-end, expired resets, aggregation, filters, sort, totals,
  columns, exact numbering, history/day boundaries, backfill planning, archive
  merge/coverage/trend, forecast sampling/slope/projection, copy Markdown/CSV,
  malformed stats payloads.
- `pnpm test`, `pnpm typecheck`, `pnpm build:tui`.
- Live pty at 120×40: dashboard, All archive, summary, forecast, project toast,
  copy, quick modal.
- Post-publish install from GitHub with the Go plugin and without it.

## Known limitations

- Local TUI archive only.
- Project filter live-only.
- Forecast based on rounded official percentages; needs samples.
- `4` may be consumed on the dashboard route; use `]`.
- Clipboard requires OSC 52.
- The archive is stored in the TUI plugin storage, not server-side.
