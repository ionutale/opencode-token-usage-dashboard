# opencode-token-usage-dashboard

[OpenCode](https://opencode.ai) token usage — a full-screen dashboard and a
quick modal with local per-model history, cache efficiency, Go quota forecast,
filters, and copy.

```text
Token usage                                                       Updated 07:40
Official Go quota (% of allowance)
Rolling  █░░░░░░░░░   14%  3h 14m
Weekly   █░░░░░░░░░   13%  1d 17h
Monthly  ████░░░░░░   38%  17d 13h
Local stats · this OpenCode server only · includes subagents
Total tokens      Cached input     Top model               Forecast
20.9B             96.7%            deepseek-v4.1-flash     Rolling No risk before reset
115,935 steps     cache read share 12.2B tokens · $155.97  Weekly  100% in 22h 52m
                                                           Monthly 100% in 1d 15h
90-day trend · all projects
▁▁▁▁▂··▁▃▂▃▁▂▂▁▁▁▁▁▂▁▂▁▁▁▁▁▁▃▁▁▁▁▁▁▁▂▃▂·▁······▁▂▁····▂▄█▂▂▂▂▃▄▅▄▁▂▂▂▂▂▁▁▁▂▃▂▁▃▁▁▁▂▃▁▁▁▁▁▂
Range 1 Rolling 2 Week 3 Month 4 All · Provider [p] opencode-go · Model [m] all
Project [P] all (archive) · Sort [s] Total ↓ · Cost [c] off · Exact [t] off · Copy [y/Y]
All local history · archived since 2026-05-19
Archive 131 days · since 2026-05-19
Provider     Model                              Input   Output Reasoning    Cache R    Cache W      Total   Steps
opencode-go  deepseek-v4.1-flash             490.4M    28.3M      56.1M      11.6B          0      12.2B  60,720
...
Total        21 models                         693M      50M        69M      19.9B       642K      20.9B 115,935
```

## Features

- **Dashboard**: `/tokens` opens a full-screen view.
- **Quick view**: `/tokens-quick` opens an xlarge modal.
- **Local history archive**: backfills every active day available from this
  OpenCode server, stores daily provider/model aggregates, and keeps appending.
  The `All` range is archived past days plus live today.
- **Go quota forecast**: samples the official rolling/weekly/monthly percentages
  every 30 seconds, fits the last 3 hours, and projects time to 100% (or “no
  risk before reset”).
- **Efficiency**: total tokens, cached input share, top model by tokens, cache
  read/write, reasoning, steps, and an optional list-price cost column.
- **Trend**: 90-day daily token sparkline from the archive.
- **Project filter**: live ranges only; the archived `All` view is all-project.
- **Copy**: `y` copies the visible Markdown table; `Y` copies CSV. Both include
  the range/filter header, visible rows, and total.
- **Safe with or without the Go plugin**: local token/history features work
  standalone. Official quota bars and the forecast appear when
  `opencode-go-usage-plugin` is installed.

## Requirements

- OpenCode V2 (verified against 2.2.5)
- About 116 terminal columns for the full dashboard; optional columns hide on
  narrower terminals
- Optional for quota/forecast: [`opencode-go-usage-plugin`](https://github.com/ionutale/opencode-go-usage-plugin)
  0.3.0+ with an OpenCode Go connection

## Install

```sh
opencode plugin add github:ionutale/opencode-token-usage-dashboard
```

Optional Go quota/forecast support:

```sh
opencode plugin add github:ionutale/opencode-go-usage-plugin
```

Manual `opencode.json(c)`:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    "github:ionutale/opencode-token-usage-dashboard",
    "github:ionutale/opencode-go-usage-plugin",
  ],
}
```

## Usage

| Command | Surface |
| --- | --- |
| `/tokens` | Full-screen dashboard |
| `/tokens-quick` | Xlarge quick modal |
| Ctrl+P | “Token usage dashboard” / “Token usage: quick view” |

### Keys

| Key | Action |
| --- | --- |
| `1`–`4` | Rolling / Week / Month / All (dialog/modal) |
| `[` / `]` | Cycle ranges (reliable on the dashboard route) |
| `p` | Cycle provider |
| `P` | Cycle project (live ranges only) |
| `m` | Cycle model |
| `s` | Cycle sort metric |
| `S` | Reverse sort direction |
| `c` | Toggle cost column |
| `t` | Toggle compact/exact numbers |
| `y` / `Y` | Copy Markdown / CSV |
| `r` | Refresh quota and current range |
| `Esc` | Close modal / return from dashboard |
| arrows / PgUp / PgDn | Scroll table |

### Ranges

| Range | Meaning |
| --- | --- |
| Rolling | Last 5 hours |
| Week | Current Go week (`weekly.resetsAt − 7d`) |
| Month | Current subscription cycle (`monthly.resetsAt` minus one month) |
| All | Archived days before today + live today, all projects |

Week/Month use the official Go reset timestamps when available; otherwise they
fall back to ISO week/calendar month UTC and show a warning.

## History archive

- On first run, the plugin reads the stats API’s active-day list and backfills
  every available day (131 days in the author’s account). The backfill runs in
  the background after the live view opens, is resumable, and shows progress.
- Daily rows are provider/model aggregates. The archive is stored in the plugin’s
  durable TUI storage, not in OpenCode’s database.
- The archive excludes today; today is always live.
- The `All` table and 90-day trend are all-project. The project filter applies
  to Rolling/Week/Month only.
- Storage is local to the TUI installation; switching servers or machines does
  not merge archives.

## Forecast

- Samples the official quota from the `go-usage` RPC every 30s.
- Keeps 6h of samples; uses the last 3h linear slope.
- Requires at least 8 samples spanning 15 minutes; otherwise shows
  “Collecting samples”.
- Projects each window’s 100% time, or reports “No risk before reset” /
  “Not burning” / “Reached”.
- The forecast is an estimate at the current pace, based on rounded official
  percentages.
- Without `opencode-go-usage-plugin`, quota bars and forecast show
  “Quota unavailable”; the local table/history still works.

## Table

- One row per provider + model; variants aggregated.
- Columns: Provider, Model, Input, Output, Reasoning, Cache R, Cache W, Total,
  Steps; optional Cost*.
- Numeric columns size to the widest formatted value, so exact mode never
  truncates a number.
- Optional columns drop in order: Reasoning → Steps → Cache W → Cost.
- `Total` = input + output + reasoning + cache read + cache write.
- Cost is an estimated list price, not the Go subscription charge.

## Limitations

- **Local server only**: this OpenCode server’s sessions; not other machines or
  clients (Pi, Claude Code, Windows).
- **Provider-level, not per-key**: one Go key/workspace is assumed.
- **Go quota is percentage-only**: the official API has no per-model history.
- **Subagents included**; variants aggregated.
- **Archive is TUI-local**; project filter is live-only.
- Copy requires terminal OSC 52 clipboard support.

## Development

```sh
pnpm install
pnpm test
pnpm typecheck
pnpm build:tui
```

The published `./tui` entry is the prebuilt `dist/tui.js`, bundled with esbuild
and the OpenTUI Solid transform. All runtime packages are external; the plugin
is loaded by the OpenCode TUI.

To test a local checkout, add the absolute paths of this repo and the Go plugin
to the global `opencode.json(c)` `plugins` array, then open `/tokens` or
`/tokens-quick` in a session.

Design notes: `docs/superpowers/specs/2026-10-31-token-usage-dashboard-design.md`.

## License

MIT © 2026 Ion Utale
