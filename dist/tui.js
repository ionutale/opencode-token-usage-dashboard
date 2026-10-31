// src/tui.tsx
import { createComponent as _$createComponent4 } from "@opentui/solid";
import { Plugin } from "@opencode/plugin/tui";
import { createSignal as createSignal3 } from "solid-js";

// src/dashboard.tsx
import { effect as _$effect2 } from "@opentui/solid";
import { insert as _$insert2 } from "@opentui/solid";
import { createComponent as _$createComponent2 } from "@opentui/solid";
import { setProp as _$setProp2 } from "@opentui/solid";
import { createElement as _$createElement2 } from "@opentui/solid";
import { usePlugin as usePlugin3 } from "@opencode/plugin/tui";
import { useTerminalDimensions } from "@opentui/solid";

// src/components.tsx
import { effect as _$effect } from "@opentui/solid";
import { createTextNode as _$createTextNode } from "@opentui/solid";
import { insertNode as _$insertNode } from "@opentui/solid";
import { insert as _$insert } from "@opentui/solid";
import { memo as _$memo } from "@opentui/solid";
import { createComponent as _$createComponent } from "@opentui/solid";
import { setProp as _$setProp } from "@opentui/solid";
import { createElement as _$createElement } from "@opentui/solid";
import { usePlugin as usePlugin2 } from "@opencode/plugin/tui";
import { TextAttributes } from "@opentui/core";
import { For, Show, createMemo as createMemo2 } from "solid-js";

// src/tokens.ts
var FIVE_HOURS_MS = 5 * 60 * 60 * 1e3;
var SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1e3;
function finite(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
function resetTime(value) {
  if (value === void 0) return void 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? void 0 : parsed;
}
function subtractUtcMonth(ms) {
  const date = new Date(ms);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const target = new Date(Date.UTC(year, month - 1, 1, date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds(), date.getUTCMilliseconds()));
  const daysInTarget = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, daysInTarget));
  return target.getTime();
}
function startOfIsoWeekUtc(ms) {
  const date = new Date(ms);
  const day = date.getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - daysSinceMonday);
}
function startOfUtcMonth(ms) {
  const date = new Date(ms);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
}
function rangeWindow(key, usage, now) {
  const to = now + 1;
  if (key === "all") return { key, from: void 0, to, approximate: false };
  if (key === "rolling") return { key, from: now - FIVE_HOURS_MS, to, approximate: false };
  if (key === "week") {
    if (usage?.stale !== true) {
      const reset = resetTime(usage?.usage.weekly.resetsAt);
      if (reset !== void 0 && reset > now) {
        const from = reset - SEVEN_DAYS_MS;
        if (from < to) return { key, from, to, approximate: false };
      }
    }
    return { key, from: startOfIsoWeekUtc(now), to, approximate: true };
  }
  if (usage?.stale !== true) {
    const reset = resetTime(usage?.usage.monthly.resetsAt);
    if (reset !== void 0 && reset > now) {
      const from = subtractUtcMonth(reset);
      if (from < to) return { key, from, to, approximate: false };
    }
  }
  return { key, from: startOfUtcMonth(now), to, approximate: true };
}
function aggregateModels(models) {
  const rows = /* @__PURE__ */ new Map();
  for (const item of models) {
    const providerID = item.model.providerID;
    const modelID = item.model.id;
    const input = finite(item.tokens.input);
    const output = finite(item.tokens.output);
    const reasoning = finite(item.tokens.reasoning);
    const cacheRead = finite(item.tokens.cache.read);
    const cacheWrite = finite(item.tokens.cache.write);
    const total = input + output + reasoning + cacheRead + cacheWrite;
    const steps = finite(item.steps);
    const cost = finite(item.cost);
    const variant = item.model.variant;
    const key = `${providerID}\0${modelID}`;
    const existing = rows.get(key);
    if (existing) {
      existing.input += input;
      existing.output += output;
      existing.reasoning += reasoning;
      existing.cacheRead += cacheRead;
      existing.cacheWrite += cacheWrite;
      existing.total += total;
      existing.steps += steps;
      existing.cost += cost;
      if (variant && !existing.variants.includes(variant)) existing.variants.push(variant);
      continue;
    }
    rows.set(key, {
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
      variants: variant ? [variant] : []
    });
  }
  for (const row of rows.values()) row.variants.sort();
  return [...rows.values()];
}
function filterRows(rows, providerID, modelID) {
  return rows.filter(
    (row) => (providerID === "all" || row.providerID === providerID) && (modelID === "all" || row.modelID === modelID)
  );
}
var SORT_VALUE = {
  total: (row) => row.total,
  input: (row) => row.input,
  output: (row) => row.output,
  reasoning: (row) => row.reasoning,
  cacheRead: (row) => row.cacheRead,
  cacheWrite: (row) => row.cacheWrite,
  steps: (row) => row.steps,
  cost: (row) => row.cost
};
function sortRows(rows, key, direction) {
  const factor = direction === "asc" ? 1 : -1;
  return [...rows].sort((left, right) => {
    const difference = (SORT_VALUE[key](left) - SORT_VALUE[key](right)) * factor;
    if (difference !== 0) return difference;
    return left.providerID.localeCompare(right.providerID) || left.modelID.localeCompare(right.modelID);
  });
}
function sumRows(rows) {
  const totals = {
    input: 0,
    output: 0,
    reasoning: 0,
    cacheRead: 0,
    cacheWrite: 0,
    total: 0,
    steps: 0,
    cost: 0
  };
  for (const row of rows) {
    totals.input += row.input;
    totals.output += row.output;
    totals.reasoning += row.reasoning;
    totals.cacheRead += row.cacheRead;
    totals.cacheWrite += row.cacheWrite;
    totals.total += row.total;
    totals.steps += row.steps;
    totals.cost += row.cost;
  }
  return totals;
}
function providerOptions(rows) {
  return [...new Set(rows.map((row) => row.providerID))].sort();
}
function modelOptions(rows, providerID) {
  return [
    ...new Set(
      rows.filter((row) => providerID === "all" || row.providerID === providerID).map((row) => row.modelID)
    )
  ].sort();
}
var exactFormatter = new Intl.NumberFormat("en-US");
var compactFormatter = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
var costFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});
function formatTokens(value, exact) {
  return (exact ? exactFormatter : compactFormatter).format(finite(value));
}
function formatCost(value) {
  return costFormatter.format(finite(value));
}
function formatTimestamp(ms, timezone) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone
  }).format(new Date(ms));
}
function describeRange(window, timezone) {
  if (window.key === "all") return "All local history";
  const end = formatTimestamp(window.to - 1, timezone);
  const label = window.key === "rolling" ? `Rolling 5h \xB7 since ${formatTimestamp(window.from ?? window.to, timezone)} (${timezone})` : window.key === "week" ? `Go week \xB7 ${formatTimestamp(window.from ?? window.to, timezone)} \u2192 ${end} (${timezone})` : `Subscription month \xB7 ${formatTimestamp(window.from ?? window.to, timezone)} \u2192 ${end} (${timezone})`;
  return window.approximate ? `${label} \xB7 quota unavailable (fallback)` : label;
}
function fitText(value, width) {
  if (width <= 0) return "";
  if (value.length <= width) return value.padEnd(width);
  if (width === 1) return "\u2026";
  return `${value.slice(0, width - 1)}\u2026`;
}
function fitNumber(value, width) {
  if (width <= 0) return value;
  return value.length < width ? value.padStart(width) : value;
}
var StatsParseError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "StatsParseError";
  }
};
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function parseStatsResponse(input) {
  if (!isRecord(input)) throw new StatsParseError("local usage response is not an object");
  const rawModels = input.models;
  if (!Array.isArray(rawModels)) throw new StatsParseError("local usage response is missing models");
  const models = [];
  for (const item of rawModels) {
    if (!isRecord(item)) continue;
    const model = item.model;
    if (!isRecord(model)) continue;
    if (typeof model.providerID !== "string" || model.providerID.length === 0) continue;
    if (typeof model.id !== "string" || model.id.length === 0) continue;
    const tokens = item.tokens;
    if (!isRecord(tokens) || !isRecord(tokens.cache)) continue;
    models.push({
      model: {
        id: model.id,
        providerID: model.providerID,
        ...typeof model.variant === "string" && model.variant.length > 0 ? { variant: model.variant } : {}
      },
      steps: finite(item.steps),
      tokens: {
        input: finite(tokens.input),
        output: finite(tokens.output),
        reasoning: finite(tokens.reasoning),
        cache: { read: finite(tokens.cache.read), write: finite(tokens.cache.write) }
      },
      cost: finite(item.cost)
    });
  }
  return { models };
}
function tokenColumns(rows, totals, options) {
  const exact = options.exact;
  const providerWidth = Math.min(
    18,
    Math.max(12, 5, ...rows.map((row) => row.providerID.length))
  );
  const inputWidth = Math.max(
    9,
    5,
    formatTokens(totals.input, exact).length,
    ...rows.map((row) => formatTokens(row.input, exact).length)
  );
  const outputWidth = Math.max(
    8,
    6,
    formatTokens(totals.output, exact).length,
    ...rows.map((row) => formatTokens(row.output, exact).length)
  );
  const reasoningWidth = Math.max(
    9,
    9,
    formatTokens(totals.reasoning, exact).length,
    ...rows.map((row) => formatTokens(row.reasoning, exact).length)
  );
  const cacheReadWidth = Math.max(
    10,
    7,
    formatTokens(totals.cacheRead, exact).length,
    ...rows.map((row) => formatTokens(row.cacheRead, exact).length)
  );
  const cacheWriteWidth = Math.max(
    10,
    7,
    formatTokens(totals.cacheWrite, exact).length,
    ...rows.map((row) => formatTokens(row.cacheWrite, exact).length)
  );
  const totalWidth = Math.max(
    10,
    5,
    formatTokens(totals.total, exact).length,
    ...rows.map((row) => formatTokens(row.total, exact).length)
  );
  const stepsWidth = Math.max(
    6,
    5,
    formatTokens(totals.steps, true).length,
    ...rows.map((row) => formatTokens(row.steps, true).length)
  );
  const costWidth = Math.max(
    9,
    5,
    formatCost(totals.cost).length,
    ...rows.map((row) => formatCost(row.cost).length)
  );
  const specs = /* @__PURE__ */ new Map([
    ["provider", { key: "provider", label: "Provider", width: providerWidth, align: "left" }],
    ["model", { key: "model", label: "Model", width: 14, align: "left" }],
    ["input", { key: "input", label: "Input", width: inputWidth, align: "right" }],
    ["output", { key: "output", label: "Output", width: outputWidth, align: "right" }],
    ["reasoning", { key: "reasoning", label: "Reasoning", width: reasoningWidth, align: "right", optional: true }],
    ["cacheRead", { key: "cacheRead", label: "Cache R", width: cacheReadWidth, align: "right" }],
    ["cacheWrite", { key: "cacheWrite", label: "Cache W", width: cacheWriteWidth, align: "right", optional: true }],
    ["total", { key: "total", label: "Total", width: totalWidth, align: "right" }],
    ["steps", { key: "steps", label: "Steps", width: stepsWidth, align: "right", optional: true }],
    ["cost", { key: "cost", label: "Cost*", width: costWidth, align: "right", optional: true }]
  ]);
  const required = ["provider", "model", "input", "output", "cacheRead", "total"];
  const optional = [
    "reasoning",
    "steps",
    "cacheWrite",
    ...options.cost ? ["cost"] : []
  ];
  const enabled = /* @__PURE__ */ new Set([...required, ...optional]);
  const order = [
    "provider",
    "model",
    "input",
    "output",
    "reasoning",
    "cacheRead",
    "cacheWrite",
    "total",
    "steps",
    "cost"
  ];
  const build = () => {
    const selected = order.flatMap((key) => {
      const spec = specs.get(key);
      return enabled.has(key) && spec ? [spec] : [];
    });
    const fixed = selected.reduce((sum, column) => sum + (column.key === "model" ? 0 : column.width), 0);
    const gaps = Math.max(0, selected.length - 1);
    const modelWidth = Math.max(14, options.width - fixed - gaps);
    const columns = selected.map((column) => ({
      key: column.key,
      label: column.label,
      align: column.align,
      width: column.key === "model" ? modelWidth : column.width
    }));
    return {
      columns,
      total: columns.reduce((sum, column) => sum + column.width, 0) + gaps
    };
  };
  let result = build();
  for (const key of optional) {
    if (result.total <= options.width) break;
    enabled.delete(key);
    result = build();
  }
  return result.columns;
}
function mergeTokenRows(rows) {
  const merged = /* @__PURE__ */ new Map();
  for (const row of rows) {
    const key = `${row.providerID}\0${row.modelID}`;
    const target = merged.get(key);
    if (!target) {
      merged.set(key, { ...row, variants: [...row.variants] });
      continue;
    }
    target.input += row.input;
    target.output += row.output;
    target.reasoning += row.reasoning;
    target.cacheRead += row.cacheRead;
    target.cacheWrite += row.cacheWrite;
    target.total += row.total;
    target.steps += row.steps;
    target.cost += row.cost;
    for (const variant of row.variants) {
      if (!target.variants.includes(variant)) target.variants.push(variant);
    }
  }
  for (const row of merged.values()) row.variants.sort();
  return [...merged.values()];
}
function columnText(column, row, exact) {
  switch (column.key) {
    case "provider":
      return row.providerID;
    case "model":
      return row.modelID;
    case "input":
      return formatTokens(row.input, exact);
    case "output":
      return formatTokens(row.output, exact);
    case "reasoning":
      return formatTokens(row.reasoning, exact);
    case "cacheRead":
      return formatTokens(row.cacheRead, exact);
    case "cacheWrite":
      return formatTokens(row.cacheWrite, exact);
    case "total":
      return formatTokens(row.total, exact);
    case "steps":
      return formatTokens(row.steps, true);
    case "cost":
      return formatCost(row.cost);
  }
}
function totalColumnText(column, totals, count, exact) {
  switch (column.key) {
    case "provider":
      return "Total";
    case "model":
      return `${count} model${count === 1 ? "" : "s"}`;
    case "input":
      return formatTokens(totals.input, exact);
    case "output":
      return formatTokens(totals.output, exact);
    case "reasoning":
      return formatTokens(totals.reasoning, exact);
    case "cacheRead":
      return formatTokens(totals.cacheRead, exact);
    case "cacheWrite":
      return formatTokens(totals.cacheWrite, exact);
    case "total":
      return formatTokens(totals.total, exact);
    case "steps":
      return formatTokens(totals.steps, true);
    case "cost":
      return formatCost(totals.cost);
  }
}

// src/copy.ts
var CSV_HEADERS = {
  provider: "provider",
  model: "model",
  input: "input",
  output: "output",
  reasoning: "reasoning",
  cacheRead: "cache_read",
  cacheWrite: "cache_write",
  total: "total",
  steps: "steps",
  cost: "cost_usd"
};
function markdownCell(value) {
  return value.replaceAll("|", "\\|").replaceAll(/\r?\n/g, " ");
}
function csvEscape(value) {
  if (!/[",\r\n]/.test(value)) return value;
  return `"${value.replaceAll('"', '""')}"`;
}
function csvRowValue(column, row) {
  switch (column.key) {
    case "provider":
      return row.providerID;
    case "model":
      return row.modelID;
    case "input":
      return String(row.input);
    case "output":
      return String(row.output);
    case "reasoning":
      return String(row.reasoning);
    case "cacheRead":
      return String(row.cacheRead);
    case "cacheWrite":
      return String(row.cacheWrite);
    case "total":
      return String(row.total);
    case "steps":
      return String(row.steps);
    case "cost":
      return row.cost.toFixed(2);
  }
}
function csvTotalValue(column, totals, count) {
  switch (column.key) {
    case "provider":
      return "Total";
    case "model":
      return `${count} model${count === 1 ? "" : "s"}`;
    case "input":
      return String(totals.input);
    case "output":
      return String(totals.output);
    case "reasoning":
      return String(totals.reasoning);
    case "cacheRead":
      return String(totals.cacheRead);
    case "cacheWrite":
      return String(totals.cacheWrite);
    case "total":
      return String(totals.total);
    case "steps":
      return String(totals.steps);
    case "cost":
      return totals.cost.toFixed(2);
  }
}
function formatMarkdown(columns, rows, totals, meta) {
  const lines = [
    "# Token usage",
    "",
    `Range: ${meta.range}`,
    `Provider: ${meta.provider} \xB7 Model: ${meta.model} \xB7 Project: ${meta.project} \xB7 Sort: ${meta.sort}`
  ];
  if (meta.archive) lines.push(`Archive: ${meta.archive}`);
  lines.push("");
  lines.push(`| ${columns.map((column) => column.label).join(" | ")} |`);
  lines.push(`| ${columns.map(() => "---").join(" | ")} |`);
  for (const row of rows) {
    lines.push(`| ${columns.map((column) => markdownCell(columnText(column, row, true))).join(" | ")} |`);
  }
  const total = columns.map((column, index) => {
    const value = markdownCell(totalColumnText(column, totals, rows.length, true));
    return index < 2 ? `**${value}**` : value;
  });
  lines.push(`| ${total.join(" | ")} |`);
  return lines.join("\n");
}
function formatCsv(columns, rows, totals, _meta) {
  const lines = [columns.map((column) => CSV_HEADERS[column.key]).join(",")];
  for (const row of rows) {
    lines.push(columns.map((column) => csvEscape(csvRowValue(column, row))).join(","));
  }
  lines.push(columns.map((column) => csvEscape(csvTotalValue(column, totals, rows.length))).join(","));
  return lines.join("\n");
}

// src/usage.ts
var GREEN = "#22c55e";
var YELLOW = "#eab308";
var RED = "#ef4444";
var ERROR_TEXT = {
  no_credential: "not connected",
  unauthorized: "check API key",
  forbidden: "Go plan required",
  upstream: "unreachable"
};
function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return "0m";
  const totalMinutes = Math.floor(ms / 6e4);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor(totalMinutes % 1440 / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
function formatResetsIn(resetsAt, nowMs) {
  const target = Date.parse(resetsAt);
  if (Number.isNaN(target)) return "0m";
  return formatDuration(target - nowMs);
}
function barSegments(percent, width = 10) {
  const bounded = Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0;
  const filled = Math.min(width, Math.max(0, Math.round(bounded / 100 * width)));
  return "\u2588".repeat(filled) + "\u2591".repeat(width - filled);
}
function usageColor(percent) {
  if (percent >= 75) return RED;
  if (percent >= 50) return YELLOW;
  return GREEN;
}
function describeRpcError(error) {
  const record = typeof error === "object" && error !== null ? error : void 0;
  const data = typeof record?.data === "object" && record.data !== null ? record.data : void 0;
  const rawType = typeof record?.type === "string" ? record.type : typeof data?.type === "string" ? data.type : void 0;
  if (rawType) {
    const normalized = rawType.replace(/^rpc\.[^.]+\./, "");
    const known = ERROR_TEXT[normalized];
    if (known) return known;
  }
  if (error instanceof Error && error.message.length > 0) return error.message;
  if (typeof record?.message === "string" && record.message.length > 0) return record.message;
  if (typeof data?.message === "string" && data.message.length > 0) return data.message;
  return ERROR_TEXT.upstream;
}

// src/forecast.ts
var WINDOWS = ["rolling", "weekly", "monthly"];
var MAX_AGE_MS = 6 * 60 * 6e4;
var SLOPE_WINDOW_MS = 3 * 60 * 6e4;
var MIN_SAMPLES = 8;
var MIN_SPAN_MS = 15 * 6e4;
function appendQuotaSamples(existing, usage, at) {
  const samples = [];
  for (const sample of existing) {
    const current = usage.usage[sample.window];
    if (sample.at <= at - MAX_AGE_MS) continue;
    if (sample.at > at) continue;
    if (sample.resetsAt !== current.resetsAt) continue;
    samples.push(sample);
  }
  for (const window of WINDOWS) {
    const current = usage.usage[window];
    samples.push({ window, at, percent: current.percent, resetsAt: current.resetsAt });
  }
  return samples;
}
function slopePerMs(points) {
  if (points.length < 2) return void 0;
  const meanAt = points.reduce((sum, point) => sum + point.at, 0) / points.length;
  const meanPercent = points.reduce((sum, point) => sum + point.percent, 0) / points.length;
  let numerator = 0;
  let denominator = 0;
  for (const point of points) {
    const dx = point.at - meanAt;
    numerator += dx * (point.percent - meanPercent);
    denominator += dx * dx;
  }
  if (denominator === 0) return void 0;
  return numerator / denominator;
}
function forecastQuota(samples, window, now) {
  const all = samples.filter((sample) => sample.window === window);
  if (all.length === 0) return { kind: "unavailable", samples: 0 };
  const latest = all.reduce((current2, sample) => sample.at > current2.at ? sample : current2);
  const reset = latest.resetsAt;
  const points = all.filter((sample) => sample.resetsAt === reset && sample.at >= now - SLOPE_WINDOW_MS && sample.at <= now).sort((left, right) => left.at - right.at);
  if (points.length < MIN_SAMPLES) return { kind: "collecting", samples: points.length };
  const span = points[points.length - 1].at - points[0].at;
  if (span < MIN_SPAN_MS) return { kind: "collecting", samples: points.length };
  const current = points[points.length - 1].percent;
  if (current >= 100) return { kind: "reached", samples: points.length, current };
  const resetAt = Date.parse(reset);
  if (Number.isNaN(resetAt)) return { kind: "unavailable", samples: points.length, current };
  if (resetAt <= now) return { kind: "no-risk", samples: points.length, current, resetAt };
  const slope = slopePerMs(points);
  if (slope === void 0 || slope <= 0) return { kind: "not-burning", samples: points.length, current, resetAt };
  const hours = (100 - current) / (slope * 60 * 6e4);
  const at = now + hours * 60 * 6e4;
  if (at >= resetAt) return { kind: "no-risk", samples: points.length, current, resetAt, slope };
  return { kind: "projected", samples: points.length, current, resetAt, slope, at };
}
function forecastLabel(forecast, now) {
  switch (forecast.kind) {
    case "collecting":
      return "Collecting samples";
    case "not-burning":
      return "Not burning";
    case "no-risk":
      return "No risk before reset";
    case "projected":
      return `100% in ${formatDuration((forecast.at ?? now) - now)}`;
    case "reached":
      return "Reached";
    case "unavailable":
      return "Quota unavailable";
  }
}

// src/history.ts
var TWO_DIGITS = new Intl.NumberFormat("en-US", { minimumIntegerDigits: 2, useGrouping: false });
function pad(value) {
  return TWO_DIGITS.format(value);
}
function emptyHistory() {
  return {
    version: 1,
    days: {},
    backfill: { status: "idle", total: 0, completed: 0, failed: 0 }
  };
}
function formatLocalDay(ms) {
  const date = new Date(ms);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
function localDayRange(date) {
  const [year, month, day] = date.split("-").map(Number);
  return {
    from: new Date(year, month - 1, day).getTime(),
    to: new Date(year, month - 1, day + 1).getTime()
  };
}
function lastLocalDays(count, now) {
  const today = new Date(now);
  const dates = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    dates.push(formatLocalDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset).getTime()));
  }
  return dates;
}
function dailyUsage(date, rows) {
  const merged = mergeTokenRows(rows);
  return {
    date,
    rows: merged,
    steps: merged.reduce((sum, row) => sum + row.steps, 0),
    cost: merged.reduce((sum, row) => sum + row.cost, 0),
    total: merged.reduce((sum, row) => sum + row.total, 0)
  };
}
function archiveRows(days, beforeDate) {
  const rows = [];
  for (const [date, day] of Object.entries(days)) {
    if (beforeDate !== void 0 && date >= beforeDate) continue;
    rows.push(...day.rows);
  }
  return mergeTokenRows(rows);
}
function archiveCoverage(days) {
  const dates = Object.keys(days).sort();
  if (dates.length === 0) return { from: void 0, to: void 0, days: 0 };
  return { from: dates[0], to: dates[dates.length - 1], days: dates.length };
}
function planBackfill(activity, days, today) {
  const dates = /* @__PURE__ */ new Set();
  for (const item of activity) {
    if (item.steps <= 0) continue;
    if (item.date >= today) continue;
    if (days[item.date] !== void 0) continue;
    dates.add(item.date);
  }
  return [...dates].sort();
}
function dailyTotals(days, dates) {
  return dates.map((date) => days[date]?.total ?? 0);
}
var LEVELS = "\u2581\u2582\u2583\u2584\u2585\u2586\u2587\u2588";
function trendLevels(values, maxValue) {
  const max = maxValue ?? values.reduce((highest, value) => Math.max(highest, value), 0);
  return values.map((value) => {
    if (value <= 0 || max <= 0) return "\xB7";
    const index = Math.min(LEVELS.length - 1, Math.max(0, Math.round(value / max * (LEVELS.length - 1))));
    return LEVELS[index];
  }).join("");
}

// src/state.ts
import { createSignal } from "solid-js";
var DEFAULT_FILTERS = {
  range: "month",
  provider: "opencode-go",
  model: "all",
  project: "all",
  sort: "total",
  direction: "desc",
  cost: false,
  exact: false
};
var [filters, setFilters] = createSignal({ ...DEFAULT_FILTERS });
function updateFilters(patch) {
  setFilters({ ...filters(), ...patch });
}
var live;
function setLiveData(value) {
  live = value;
}
function getLiveData() {
  if (!live) throw new Error("token usage data is not ready");
  return live;
}

// src/use-data.ts
import { usePlugin } from "@opencode/plugin/tui";
import { createEffect, createMemo, createSignal as createSignal2, onCleanup, onMount } from "solid-js";
var TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
var TREND_DAYS = 90;
function basename(path) {
  const parts = path.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? path;
}
function errorText(error) {
  if (error instanceof Error) {
    if (error.name === "TimeoutError") return "Timed out loading local usage.";
    if (error.name === "AbortError") return "Loading was cancelled.";
    if (error.message.length > 0) return error.message;
  }
  const record = typeof error === "object" && error !== null ? error : void 0;
  if (typeof record?.message === "string" && record.message.length > 0) return record.message;
  return "Could not load local usage.";
}
function useUsageData() {
  const context = usePlugin();
  const live2 = getLiveData();
  const [liveStats, setLiveStats] = createSignal2();
  const [todayRows, setTodayRows] = createSignal2([]);
  const [liveLoading, setLiveLoading] = createSignal2(true);
  const [todayLoading, setTodayLoading] = createSignal2(true);
  const [liveError, setLiveError] = createSignal2();
  const [todayError, setTodayError] = createSignal2();
  const [updatedAt, setUpdatedAt] = createSignal2();
  const [refreshCounter, setRefreshCounter] = createSignal2(0);
  const [now, setNow] = createSignal2(Date.now());
  let disposed = false;
  let liveRequest = 0;
  let todayRequest = 0;
  const projects = createMemo(() => context.data.project.list());
  const location = () => context.location ?? context.data.location.default();
  const currentProject = createMemo(() => {
    const directory = location().directory;
    return projects().filter((project) => directory === project.canonical || directory.startsWith(`${project.canonical.replace(/\/$/, "")}/`)).sort((left, right) => right.canonical.length - left.canonical.length)[0];
  });
  const projectOptions = createMemo(() => {
    const current = currentProject();
    const options = [
      { value: "all", label: "All projects" },
      { value: "current", label: current ? `Current: ${current.name ?? basename(current.canonical)}` : "Current project" },
      ...projects().map((project) => ({
        value: project.id,
        label: project.name ?? basename(project.canonical)
      }))
    ];
    const selected = filters().project;
    if (selected !== "all" && selected !== "current" && !options.some((option) => option.value === selected)) {
      options.push({ value: selected, label: selected });
    }
    return options;
  });
  const projectLabel = createMemo(() => {
    if (filters().range === "all") return "all (archive)";
    return projectOptions().find((option) => option.value === filters().project)?.label ?? filters().project;
  });
  function selectedProject() {
    if (filters().project === "all") return void 0;
    if (filters().project === "current") return currentProject()?.id;
    return filters().project;
  }
  function cycleProject() {
    if (filters().range === "all") return;
    const options = projectOptions();
    const index = options.findIndex((option) => option.value === filters().project);
    const next = options[(index + 1) % options.length];
    if (!next) return;
    updateFilters({ project: next.value, model: "all" });
  }
  async function loadToday(at) {
    const id = ++todayRequest;
    setTodayLoading(true);
    setTodayError(void 0);
    const date = formatLocalDay(at);
    const { from } = localDayRange(date);
    try {
      const result = await context.client.session.stats(
        { from, to: at + 1, timezone: TIMEZONE, tools: "none" },
        { signal: AbortSignal.timeout(3e4) }
      );
      if (disposed || id !== todayRequest) return;
      const parsed = parseStatsResponse(result);
      setTodayRows(aggregateModels(parsed.models));
      setUpdatedAt(Date.now());
    } catch (error2) {
      if (disposed || id !== todayRequest) return;
      setTodayError(errorText(error2));
    } finally {
      if (!disposed && id === todayRequest) setTodayLoading(false);
    }
  }
  async function loadLive(at) {
    if (filters().range === "all") return;
    const id = ++liveRequest;
    setLiveLoading(true);
    setLiveError(void 0);
    setLiveStats(void 0);
    const active = rangeWindow(filters().range, live2.quota(), at);
    const project = selectedProject();
    try {
      const result = await context.client.session.stats(
        {
          from: active.from,
          to: active.to,
          timezone: TIMEZONE,
          tools: "none",
          ...project === void 0 ? {} : { project }
        },
        { signal: AbortSignal.timeout(3e4) }
      );
      if (disposed || id !== liveRequest) return;
      const parsed = parseStatsResponse(result);
      setLiveStats(parsed);
      setUpdatedAt(Date.now());
    } catch (error2) {
      if (disposed || id !== liveRequest) return;
      setLiveError(errorText(error2));
    } finally {
      if (!disposed && id === liveRequest) setLiveLoading(false);
    }
  }
  createEffect(() => {
    const refresh2 = refreshCounter();
    const at = Date.now();
    setNow(at);
    void loadToday(at);
  });
  createEffect(() => {
    const range = filters().range;
    const project = filters().project;
    const current = currentProject()?.id;
    const reset = `${live2.quota()?.usage.weekly.resetsAt ?? ""}|${live2.quota()?.usage.monthly.resetsAt ?? ""}|${live2.quota()?.stale === true}`;
    const refresh2 = refreshCounter();
    if (range === "all") return;
    const at = Date.now();
    setNow(at);
    void loadLive(at);
  });
  onMount(() => {
    void context.data.project.sync().catch(() => void 0);
  });
  onCleanup(() => {
    disposed = true;
    liveRequest += 1;
    todayRequest += 1;
  });
  const archivedRows = createMemo(() => archiveRows(live2.history.days, formatLocalDay(now())));
  const todayTotal = createMemo(() => sumRows(todayRows()).total);
  const allRows = createMemo(() => {
    if (filters().range === "all") return mergeTokenRows([...archivedRows(), ...todayRows()]);
    return aggregateModels(liveStats()?.models ?? []);
  });
  const rows = createMemo(
    () => sortRows(filterRows(allRows(), filters().provider, filters().model), filters().sort, filters().direction)
  );
  const totals = createMemo(() => sumRows(rows()));
  const providers = createMemo(() => {
    const base = ["all", ...providerOptions(allRows())];
    return filters().provider !== "all" && !base.includes(filters().provider) ? [filters().provider, ...base] : base;
  });
  const models = createMemo(() => {
    const base = ["all", ...modelOptions(allRows(), filters().provider)];
    return filters().model !== "all" && !base.includes(filters().model) ? [filters().model, ...base] : base;
  });
  createEffect(() => {
    if (loading()) return;
    const options = modelOptions(allRows(), filters().provider);
    if (filters().model !== "all" && !options.includes(filters().model)) {
      updateFilters({ model: "all" });
    }
  });
  const loading = createMemo(
    () => filters().range === "all" ? archivedRows().length === 0 && todayLoading() : liveLoading()
  );
  const error = createMemo(
    () => filters().range === "all" ? archivedRows().length === 0 ? todayError() : void 0 : liveError()
  );
  const coverage = createMemo(() => archiveCoverage(live2.history.days));
  const backfill = createMemo(() => live2.history.backfill);
  const rangeLabel = createMemo(() => {
    if (filters().range === "all") {
      return coverage().from ? `All local history \xB7 archived since ${coverage().from}` : "All local history \xB7 archive starts now";
    }
    return describeRange(rangeWindow(filters().range, live2.quota(), now()), TIMEZONE);
  });
  const archiveNote = createMemo(() => {
    const archived = coverage();
    const state = backfill();
    const parts = [archived.from ? `Archive ${archived.days} days \xB7 since ${archived.from}` : "Archive empty"];
    if (state.status === "running") parts.push(`backfilling ${state.completed}/${state.total}`);
    else if (state.status === "done" && state.failed > 0) parts.push(`${state.failed} failed`);
    if (filters().range === "all") {
      if (todayLoading()) parts.push("today loading");
      if (todayError()) parts.push("today unavailable");
    }
    return parts.join(" \xB7 ");
  });
  const approximate = createMemo(
    () => filters().range !== "all" && rangeWindow(filters().range, live2.quota(), now()).approximate
  );
  const trendDates = createMemo(() => lastLocalDays(TREND_DAYS, now()));
  const trendValues = createMemo(() => {
    const dates = trendDates();
    const values = dailyTotals(live2.history.days, dates);
    if (values.length > 0) values[values.length - 1] = todayTotal();
    return values;
  });
  const refresh = () => {
    setRefreshCounter((value) => value + 1);
    live2.refreshQuota();
  };
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
    quota: live2.quota,
    quotaError: live2.quotaError,
    quotaSamples: () => live2.quotaSamples.samples,
    refresh
  };
}

// src/components.tsx
var RANGE_OPTIONS = [{
  key: "rolling",
  label: "1 Rolling"
}, {
  key: "week",
  label: "2 Week"
}, {
  key: "month",
  label: "3 Month"
}, {
  key: "all",
  label: "4 All"
}];
var SORT_KEYS = ["total", "input", "output", "cacheRead", "cacheWrite", "steps", "cost", "reasoning"];
var SORT_LABELS = {
  total: "Total",
  input: "Input",
  output: "Output",
  reasoning: "Reasoning",
  cacheRead: "Cache read",
  cacheWrite: "Cache write",
  steps: "Steps",
  cost: "Cost"
};
var FORECAST_WINDOWS = [{
  key: "rolling",
  label: "Rolling"
}, {
  key: "weekly",
  label: "Weekly"
}, {
  key: "monthly",
  label: "Monthly"
}];
function UsageView(props) {
  const context = usePlugin2();
  const muted = context.theme.text.muted;
  const data = useUsageData();
  const columns = createMemo2(() => tokenColumns(data.rows(), data.totals(), {
    width: props.width,
    exact: filters().exact,
    cost: filters().cost
  }));
  const tableHeight = createMemo2(() => Math.min(props.maxTableHeight, Math.max(5, data.rows().length)));
  const copy = (kind) => {
    const meta = {
      range: data.rangeLabel(),
      provider: filters().provider,
      model: filters().model,
      project: data.projectLabel(),
      sort: `${SORT_LABELS[filters().sort]} ${filters().direction === "desc" ? "\u2193" : "\u2191"}`,
      cost: filters().cost,
      ...filters().range === "all" ? {
        archive: data.archiveNote()
      } : {}
    };
    const text = kind === "markdown" ? formatMarkdown(columns(), data.rows(), data.totals(), meta) : formatCsv(columns(), data.rows(), data.totals(), meta);
    const ok = context.renderer.copyToClipboardOSC52(text);
    context.ui.toast.show({
      message: ok ? `Copied ${kind === "markdown" ? "Markdown" : "CSV"}` : "Clipboard unavailable",
      variant: ok ? "success" : "warning"
    });
  };
  const selectRange = (range) => {
    if (filters().range === range) return;
    updateFilters({
      range
    });
  };
  const cycleRange = (direction) => {
    const index = RANGE_OPTIONS.findIndex((option) => option.key === filters().range);
    const next = RANGE_OPTIONS[(index + direction + RANGE_OPTIONS.length) % RANGE_OPTIONS.length];
    if (next) selectRange(next.key);
  };
  const cycleProvider = () => {
    const choices = data.providers();
    const index = choices.indexOf(filters().provider);
    updateFilters({
      provider: choices[(index + 1) % choices.length] ?? "all",
      model: "all"
    });
  };
  const cycleModel = () => {
    const choices = data.models();
    const index = choices.indexOf(filters().model);
    updateFilters({
      model: choices[(index + 1) % choices.length] ?? "all"
    });
  };
  const cycleSort = () => {
    const index = SORT_KEYS.indexOf(filters().sort);
    updateFilters({
      sort: SORT_KEYS[(index + 1) % SORT_KEYS.length] ?? "total"
    });
  };
  const toggleDirection = () => updateFilters({
    direction: filters().direction === "desc" ? "asc" : "desc"
  });
  const toggleCost = () => {
    updateFilters({
      cost: !filters().cost
    });
  };
  const toggleExact = () => {
    updateFilters({
      exact: !filters().exact
    });
  };
  const cycleProject = () => {
    if (filters().range === "all") {
      context.ui.toast.show({
        message: "Project filter applies to live ranges. Choose Rolling, Week, or Month.",
        variant: "warning"
      });
      return;
    }
    data.cycleProject();
  };
  context.keymap.layer(() => ({
    mode: "global",
    priority: 10,
    commands: [{
      bind: "escape",
      run: props.onClose
    }, {
      bind: "1",
      run: () => selectRange("rolling")
    }, {
      bind: "2",
      run: () => selectRange("week")
    }, {
      bind: "3",
      run: () => selectRange("month")
    }, {
      bind: "4",
      run: () => selectRange("all")
    }, {
      bind: "[",
      run: () => cycleRange(-1)
    }, {
      bind: "]",
      run: () => cycleRange(1)
    }, {
      bind: "p",
      run: cycleProvider
    }, {
      bind: "shift+p",
      run: cycleProject
    }, {
      bind: "m",
      run: cycleModel
    }, {
      bind: "s",
      run: cycleSort
    }, {
      bind: "shift+s",
      run: toggleDirection
    }, {
      bind: "c",
      run: toggleCost
    }, {
      bind: "t",
      run: toggleExact
    }, {
      bind: "y",
      run: () => copy("markdown")
    }, {
      bind: "shift+y",
      run: () => copy("csv")
    }, {
      bind: "r",
      run: data.refresh
    }]
  }));
  const footerHint = () => props.width >= 100 ? "[ ] range \xB7 1-4 range \xB7 p provider \xB7 P project \xB7 m model \xB7 s sort \xB7 c cost \xB7 t exact \xB7 y/Y copy \xB7 r refresh \xB7 Esc" : "[ ] range \xB7 1-4 range \xB7 p provider \xB7 P project \xB7 m model \xB7 s sort \xB7 c cost \xB7 t exact \xB7 y/Y copy \xB7 r";
  return (() => {
    var _el$ = _$createElement("box"), _el$2 = _$createElement("box"), _el$6 = _$createElement("text");
    _$insertNode(_el$, _el$2);
    _$insertNode(_el$, _el$6);
    _$setProp(_el$, "flexDirection", "column");
    _$setProp(_el$, "gap", 0);
    _$insert(_el$, _$createComponent(UsageHeader, {
      data
    }), _el$2);
    _$insert(_el$, (() => {
      var _c$ = _$memo(() => !!props.dashboard);
      return () => _c$() ? [_$createComponent(Summary, {
        data,
        get width() {
          return props.width;
        }
      }), _$createComponent(Trend, {
        data,
        get width() {
          return props.width;
        }
      })] : null;
    })(), _el$2);
    _$insert(_el$, _$createComponent(FilterBar, {
      data
    }), _el$2);
    _$insert(_el$, _$createComponent(TableHeader, {
      get columns() {
        return columns();
      }
    }), _el$2);
    _$setProp(_el$2, "width", "100%");
    _$insert(_el$2, _$createComponent(Show, {
      get when() {
        return !data.error();
      },
      get fallback() {
        return _$createComponent(ErrorState, {
          get text() {
            return data.error() ?? "Could not load local usage.";
          }
        });
      },
      get children() {
        return _$createComponent(Show, {
          get when() {
            return !data.loading();
          },
          get fallback() {
            return _$createComponent(LoadingState, {});
          },
          get children() {
            return _$createComponent(Show, {
              get when() {
                return data.rows().length > 0;
              },
              get fallback() {
                return _$createComponent(EmptyState, {
                  data
                });
              },
              get children() {
                var _el$3 = _$createElement("scrollbox");
                _$setProp(_el$3, "width", "100%");
                _$setProp(_el$3, "height", "100%");
                _$setProp(_el$3, "focused", true);
                _$setProp(_el$3, "scrollX", false);
                _$setProp(_el$3, "contentOptions", {
                  flexDirection: "column"
                });
                _$setProp(_el$3, "verticalScrollbarOptions", {
                  visible: false
                });
                _$setProp(_el$3, "horizontalScrollbarOptions", {
                  visible: false
                });
                _$insert(_el$3, _$createComponent(For, {
                  get each() {
                    return data.rows();
                  },
                  children: (row) => _$createComponent(TableRow, {
                    get cells() {
                      return rowCells(columns(), row, filters().exact);
                    }
                  })
                }));
                return _el$3;
              }
            });
          }
        });
      }
    }));
    _$insert(_el$, _$createComponent(TotalArea, {
      get columns() {
        return columns();
      },
      get totals() {
        return data.totals();
      },
      get count() {
        return data.rows().length;
      },
      get exact() {
        return filters().exact;
      },
      get visible() {
        return _$memo(() => !!!data.loading())() && !data.error();
      }
    }), _el$6);
    _$insert(_el$, _$createComponent(Show, {
      get when() {
        return filters().cost;
      },
      get children() {
        var _el$4 = _$createElement("text");
        _$insertNode(_el$4, _$createTextNode(`* Cost is an estimated list price, not your Go subscription charge.`));
        _$setProp(_el$4, "fg", muted);
        return _el$4;
      }
    }), _el$6);
    _$setProp(_el$6, "fg", muted);
    _$setProp(_el$6, "wrapMode", "none");
    _$insert(_el$6, footerHint);
    _$effect((_p$) => {
      var _v$ = props.width, _v$2 = tableHeight();
      _v$ !== _p$.e && (_p$.e = _$setProp(_el$, "width", _v$, _p$.e));
      _v$2 !== _p$.t && (_p$.t = _$setProp(_el$2, "height", _v$2, _p$.t));
      return _p$;
    }, {
      e: void 0,
      t: void 0
    });
    return _el$;
  })();
}
function UsageHeader(props) {
  const context = usePlugin2();
  const muted = context.theme.text.muted;
  const base = context.theme.text.base;
  return (() => {
    var _el$7 = _$createElement("box"), _el$8 = _$createElement("box"), _el$9 = _$createElement("text"), _el$1 = _$createElement("text"), _el$10 = _$createElement("text"), _el$12 = _$createElement("text");
    _$insertNode(_el$7, _el$8);
    _$insertNode(_el$7, _el$10);
    _$insertNode(_el$7, _el$12);
    _$setProp(_el$7, "flexDirection", "column");
    _$insertNode(_el$8, _el$9);
    _$insertNode(_el$8, _el$1);
    _$setProp(_el$8, "flexDirection", "row");
    _$setProp(_el$8, "justifyContent", "space-between");
    _$insertNode(_el$9, _$createTextNode(`Token usage`));
    _$setProp(_el$9, "fg", base);
    _$setProp(_el$1, "fg", muted);
    _$insert(_el$1, (() => {
      var _c$2 = _$memo(() => props.data.updatedAt() === void 0);
      return () => _c$2() ? "Gathering\u2026" : `Updated ${formatClock(props.data.updatedAt())}`;
    })());
    _$insertNode(_el$10, _$createTextNode(`Official Go quota (% of allowance)`));
    _$setProp(_el$10, "fg", muted);
    _$insert(_el$7, _$createComponent(Show, {
      get when() {
        return props.data.quota();
      },
      get fallback() {
        return (() => {
          var _el$14 = _$createElement("text"), _el$15 = _$createTextNode(`Go quota: `);
          _$insertNode(_el$14, _el$15);
          _$insert(_el$14, () => props.data.quotaError() ?? "loading\u2026", null);
          _$effect((_$p) => _$setProp(_el$14, "fg", props.data.quotaError() === void 0 ? muted : RED, _$p));
          return _el$14;
        })();
      },
      children: (usage) => [_$createComponent(QuotaRow, {
        label: "Rolling",
        window: () => usage().usage.rolling,
        get now() {
          return props.data.now;
        },
        dim: () => usage().stale === true
      }), _$createComponent(QuotaRow, {
        label: "Weekly",
        window: () => usage().usage.weekly,
        get now() {
          return props.data.now;
        },
        dim: () => usage().stale === true
      }), _$createComponent(QuotaRow, {
        label: "Monthly",
        window: () => usage().usage.monthly,
        get now() {
          return props.data.now;
        },
        dim: () => usage().stale === true
      })]
    }), _el$12);
    _$insertNode(_el$12, _$createTextNode(`Local stats \xB7 this OpenCode server only \xB7 includes subagents`));
    _$setProp(_el$12, "fg", muted);
    _$effect((_$p) => _$setProp(_el$9, "attributes", TextAttributes.BOLD, _$p));
    return _el$7;
  })();
}
function QuotaRow(props) {
  const context = usePlugin2();
  const accent = () => props.dim() ? context.theme.text.muted : usageColor(props.window().percent);
  const percent = () => String(Math.round(props.window().percent)).padStart(3);
  return (() => {
    var _el$16 = _$createElement("box"), _el$17 = _$createElement("text"), _el$18 = _$createElement("text"), _el$19 = _$createElement("text"), _el$20 = _$createElement("text");
    _$insertNode(_el$16, _el$17);
    _$insertNode(_el$16, _el$18);
    _$insertNode(_el$16, _el$19);
    _$insertNode(_el$16, _el$20);
    _$setProp(_el$16, "flexDirection", "row");
    _$insert(_el$17, () => props.label.padEnd(9));
    _$insert(_el$18, () => barSegments(props.window().percent));
    _$insert(_el$19, () => `  ${percent()}%`);
    _$insert(_el$20, () => `  ${formatResetsIn(props.window().resetsAt, props.now())}`);
    _$effect((_p$) => {
      var _v$3 = context.theme.text.muted, _v$4 = accent(), _v$5 = accent(), _v$6 = context.theme.text.muted;
      _v$3 !== _p$.e && (_p$.e = _$setProp(_el$17, "fg", _v$3, _p$.e));
      _v$4 !== _p$.t && (_p$.t = _$setProp(_el$18, "fg", _v$4, _p$.t));
      _v$5 !== _p$.a && (_p$.a = _$setProp(_el$19, "fg", _v$5, _p$.a));
      _v$6 !== _p$.o && (_p$.o = _$setProp(_el$20, "fg", _v$6, _p$.o));
      return _p$;
    }, {
      e: void 0,
      t: void 0,
      a: void 0,
      o: void 0
    });
    return _el$16;
  })();
}
function FilterBar(props) {
  const context = usePlugin2();
  const muted = context.theme.text.muted;
  const base = context.theme.text.base;
  return (() => {
    var _el$21 = _$createElement("box"), _el$22 = _$createElement("box"), _el$23 = _$createElement("text"), _el$25 = _$createElement("text"), _el$27 = _$createElement("text"), _el$28 = _$createElement("text"), _el$30 = _$createElement("text"), _el$31 = _$createElement("box"), _el$32 = _$createElement("text"), _el$34 = _$createElement("text"), _el$35 = _$createElement("text"), _el$37 = _$createElement("text"), _el$38 = _$createTextNode(` `), _el$39 = _$createElement("text"), _el$41 = _$createElement("text"), _el$42 = _$createElement("text"), _el$44 = _$createElement("text"), _el$45 = _$createElement("text"), _el$47 = _$createElement("text"), _el$48 = _$createElement("text");
    _$insertNode(_el$21, _el$22);
    _$insertNode(_el$21, _el$31);
    _$insertNode(_el$21, _el$47);
    _$insertNode(_el$21, _el$48);
    _$setProp(_el$21, "flexDirection", "column");
    _$insertNode(_el$22, _el$23);
    _$insertNode(_el$22, _el$25);
    _$insertNode(_el$22, _el$27);
    _$insertNode(_el$22, _el$28);
    _$insertNode(_el$22, _el$30);
    _$setProp(_el$22, "flexDirection", "row");
    _$setProp(_el$22, "gap", 1);
    _$insertNode(_el$23, _$createTextNode(`Range`));
    _$setProp(_el$23, "fg", muted);
    _$insert(_el$22, _$createComponent(For, {
      each: RANGE_OPTIONS,
      children: (option) => (() => {
        var _el$49 = _$createElement("text");
        _$insert(_el$49, () => option.label);
        _$effect((_p$) => {
          var _v$7 = filters().range === option.key ? base : muted, _v$8 = filters().range === option.key ? TextAttributes.BOLD : void 0;
          _v$7 !== _p$.e && (_p$.e = _$setProp(_el$49, "fg", _v$7, _p$.e));
          _v$8 !== _p$.t && (_p$.t = _$setProp(_el$49, "attributes", _v$8, _p$.t));
          return _p$;
        }, {
          e: void 0,
          t: void 0
        });
        return _el$49;
      })()
    }), _el$25);
    _$insertNode(_el$25, _$createTextNode(`\xB7 Provider [p]`));
    _$setProp(_el$25, "fg", muted);
    _$setProp(_el$27, "fg", base);
    _$insert(_el$27, () => filters().provider);
    _$insertNode(_el$28, _$createTextNode(`\xB7 Model [m]`));
    _$setProp(_el$28, "fg", muted);
    _$setProp(_el$30, "fg", base);
    _$insert(_el$30, () => shorten(filters().model, 20));
    _$insertNode(_el$31, _el$32);
    _$insertNode(_el$31, _el$34);
    _$insertNode(_el$31, _el$35);
    _$insertNode(_el$31, _el$37);
    _$insertNode(_el$31, _el$39);
    _$insertNode(_el$31, _el$41);
    _$insertNode(_el$31, _el$42);
    _$insertNode(_el$31, _el$44);
    _$insertNode(_el$31, _el$45);
    _$setProp(_el$31, "flexDirection", "row");
    _$setProp(_el$31, "gap", 1);
    _$insertNode(_el$32, _$createTextNode(`Project [P]`));
    _$setProp(_el$32, "fg", muted);
    _$setProp(_el$34, "fg", base);
    _$insert(_el$34, () => shorten(props.data.projectLabel(), 16));
    _$insertNode(_el$35, _$createTextNode(`\xB7 Sort [s]`));
    _$setProp(_el$35, "fg", muted);
    _$insertNode(_el$37, _el$38);
    _$setProp(_el$37, "fg", base);
    _$insert(_el$37, () => SORT_LABELS[filters().sort], _el$38);
    _$insert(_el$37, () => filters().direction === "desc" ? "\u2193" : "\u2191", null);
    _$insertNode(_el$39, _$createTextNode(`\xB7 Cost [c]`));
    _$setProp(_el$39, "fg", muted);
    _$setProp(_el$41, "fg", base);
    _$insert(_el$41, () => filters().cost ? "on" : "off");
    _$insertNode(_el$42, _$createTextNode(`\xB7 Exact [t]`));
    _$setProp(_el$42, "fg", muted);
    _$setProp(_el$44, "fg", base);
    _$insert(_el$44, () => filters().exact ? "on" : "off");
    _$insertNode(_el$45, _$createTextNode(`\xB7 Copy [y/Y]`));
    _$setProp(_el$45, "fg", muted);
    _$setProp(_el$47, "wrapMode", "none");
    _$insert(_el$47, () => props.data.rangeLabel());
    _$setProp(_el$48, "fg", muted);
    _$setProp(_el$48, "wrapMode", "none");
    _$insert(_el$48, () => props.data.archiveNote());
    _$effect((_$p) => _$setProp(_el$47, "fg", props.data.approximate() ? YELLOW : muted, _$p));
    return _el$21;
  })();
}
function TableHeader(props) {
  return _$createComponent(TableRow, {
    get cells() {
      return props.columns.map((column) => cell(column.label, column));
    },
    muted: true
  });
}
function TableRow(props) {
  const context = usePlugin2();
  const defaultColor = () => props.muted ? context.theme.text.muted : context.theme.text.base;
  const bold = () => props.bold === true;
  return (() => {
    var _el$50 = _$createElement("box");
    _$setProp(_el$50, "flexDirection", "row");
    _$setProp(_el$50, "gap", 1);
    _$setProp(_el$50, "height", 1);
    _$insert(_el$50, _$createComponent(For, {
      get each() {
        return props.cells;
      },
      children: (item) => (() => {
        var _el$51 = _$createElement("box"), _el$52 = _$createElement("text");
        _$insertNode(_el$51, _el$52);
        _$setProp(_el$51, "flexShrink", 0);
        _$setProp(_el$52, "wrapMode", "none");
        _$insert(_el$52, (() => {
          var _c$3 = _$memo(() => item.align === "left");
          return () => _c$3() ? fitText(item.text, item.width) : fitNumber(item.text, item.width);
        })());
        _$effect((_p$) => {
          var _v$9 = item.width, _v$0 = item.color ?? defaultColor(), _v$1 = bold() || item.bold === true ? TextAttributes.BOLD : void 0;
          _v$9 !== _p$.e && (_p$.e = _$setProp(_el$51, "width", _v$9, _p$.e));
          _v$0 !== _p$.t && (_p$.t = _$setProp(_el$52, "fg", _v$0, _p$.t));
          _v$1 !== _p$.a && (_p$.a = _$setProp(_el$52, "attributes", _v$1, _p$.a));
          return _p$;
        }, {
          e: void 0,
          t: void 0,
          a: void 0
        });
        return _el$51;
      })()
    }));
    return _el$50;
  })();
}
function TotalArea(props) {
  const context = usePlugin2();
  const muted = context.theme.text.muted;
  const width = () => props.columns.reduce((sum, column) => sum + column.width, 0) + Math.max(0, props.columns.length - 1);
  return (() => {
    var _el$53 = _$createElement("box");
    _$setProp(_el$53, "height", 2);
    _$setProp(_el$53, "flexDirection", "column");
    _$insert(_el$53, _$createComponent(Show, {
      get when() {
        return props.visible;
      },
      get fallback() {
        return (() => {
          var _el$55 = _$createElement("text");
          _$insertNode(_el$55, _$createTextNode(` `));
          _$setProp(_el$55, "fg", muted);
          return _el$55;
        })();
      },
      get children() {
        return [(() => {
          var _el$54 = _$createElement("text");
          _$setProp(_el$54, "fg", muted);
          _$insert(_el$54, () => "\u2500".repeat(width()));
          return _el$54;
        })(), _$createComponent(TableRow, {
          get cells() {
            return totalCells(props.columns, props.totals, props.count, props.exact);
          },
          bold: true
        })];
      }
    }));
    return _el$53;
  })();
}
function LoadingState() {
  const context = usePlugin2();
  return (() => {
    var _el$57 = _$createElement("box"), _el$58 = _$createElement("text");
    _$insertNode(_el$57, _el$58);
    _$setProp(_el$57, "height", "100%");
    _$setProp(_el$57, "width", "100%");
    _$setProp(_el$57, "alignItems", "center");
    _$setProp(_el$57, "justifyContent", "center");
    _$insertNode(_el$58, _$createTextNode(`Gathering local usage\u2026`));
    _$effect((_$p) => _$setProp(_el$58, "fg", context.theme.text.muted, _$p));
    return _el$57;
  })();
}
function EmptyState(props) {
  const context = usePlugin2();
  const muted = context.theme.text.muted;
  return (() => {
    var _el$60 = _$createElement("box"), _el$61 = _$createElement("text"), _el$63 = _$createElement("text");
    _$insertNode(_el$60, _el$61);
    _$insertNode(_el$60, _el$63);
    _$setProp(_el$60, "height", "100%");
    _$setProp(_el$60, "width", "100%");
    _$setProp(_el$60, "flexDirection", "column");
    _$setProp(_el$60, "alignItems", "center");
    _$setProp(_el$60, "justifyContent", "center");
    _$setProp(_el$60, "gap", 1);
    _$insertNode(_el$61, _$createTextNode(`No usage for this range and filter.`));
    _$setProp(_el$61, "fg", muted);
    _$insertNode(_el$63, _$createTextNode(`Press p for provider, P for project, or 1-4 for range.`));
    _$setProp(_el$63, "fg", muted);
    return _el$60;
  })();
}
function ErrorState(props) {
  const context = usePlugin2();
  return (() => {
    var _el$65 = _$createElement("box"), _el$66 = _$createElement("text"), _el$67 = _$createElement("text");
    _$insertNode(_el$65, _el$66);
    _$insertNode(_el$65, _el$67);
    _$setProp(_el$65, "height", "100%");
    _$setProp(_el$65, "width", "100%");
    _$setProp(_el$65, "flexDirection", "column");
    _$setProp(_el$65, "alignItems", "center");
    _$setProp(_el$65, "justifyContent", "center");
    _$setProp(_el$65, "gap", 1);
    _$setProp(_el$66, "fg", RED);
    _$setProp(_el$66, "wrapMode", "word");
    _$insert(_el$66, () => props.text);
    _$insertNode(_el$67, _$createTextNode(`Press r to retry.`));
    _$effect((_$p) => _$setProp(_el$67, "fg", context.theme.text.muted, _$p));
    return _el$65;
  })();
}
function cell(text, column, color) {
  return {
    text,
    width: column.width,
    align: column.align,
    ...color === void 0 ? {} : {
      color
    }
  };
}
function rowCells(columns, row, exact) {
  return columns.map((column) => cell(columnText(column, row, exact), column));
}
function totalCells(columns, totals, count, exact) {
  return columns.map((column) => cell(totalColumnText(column, totals, count, exact), column));
}
function Summary(props) {
  const context = usePlugin2();
  const muted = context.theme.text.muted;
  const base = context.theme.text.base;
  const cardWidth = () => Math.max(16, Math.floor((props.width - 6) / 4));
  const totals = createMemo2(() => sumRows(props.data.rows()));
  const cachePercent = createMemo2(() => {
    const value = totals();
    const input = value.input + value.cacheRead;
    return input > 0 ? value.cacheRead / input * 100 : 0;
  });
  const top = createMemo2(() => {
    const rows = props.data.rows();
    return rows.reduce((best, row) => best === void 0 || row.total > best.total ? row : best, void 0);
  });
  const forecasts = createMemo2(() => FORECAST_WINDOWS.map((window) => ({
    label: window.label,
    text: forecastLabel(forecastQuota(props.data.quotaSamples(), window.key, props.data.now()), props.data.now())
  })));
  return (() => {
    var _el$69 = _$createElement("box"), _el$70 = _$createElement("box"), _el$71 = _$createElement("text");
    _$insertNode(_el$69, _el$70);
    _$setProp(_el$69, "flexDirection", "row");
    _$setProp(_el$69, "gap", 2);
    _$setProp(_el$69, "height", 4);
    _$insert(_el$69, _$createComponent(Card, {
      get width() {
        return cardWidth();
      },
      label: "Total tokens",
      get value() {
        return formatTokens(totals().total, filters().exact);
      },
      get detail() {
        return `${formatTokens(totals().steps, true)} steps`;
      }
    }), _el$70);
    _$insert(_el$69, _$createComponent(Card, {
      get width() {
        return cardWidth();
      },
      label: "Cached input",
      get value() {
        return `${cachePercent().toFixed(1)}%`;
      },
      detail: "cache read share"
    }), _el$70);
    _$insert(_el$69, _$createComponent(Card, {
      get width() {
        return cardWidth();
      },
      label: "Top model",
      get value() {
        return top()?.modelID ?? "\u2014";
      },
      get detail() {
        return _$memo(() => !!top())() ? `${formatTokens(top().total, filters().exact)} tokens \xB7 ${formatCost(top().cost)} est.` : "no usage";
      }
    }), _el$70);
    _$insertNode(_el$70, _el$71);
    _$setProp(_el$70, "flexDirection", "column");
    _$insertNode(_el$71, _$createTextNode(`Forecast`));
    _$setProp(_el$71, "fg", muted);
    _$insert(_el$70, _$createComponent(For, {
      get each() {
        return forecasts();
      },
      children: (forecast) => (() => {
        var _el$73 = _$createElement("text");
        _$setProp(_el$73, "fg", base);
        _$setProp(_el$73, "wrapMode", "none");
        _$insert(_el$73, () => shorten(`${forecast.label} ${forecast.text}`, cardWidth()));
        return _el$73;
      })()
    }), null);
    _$effect((_$p) => _$setProp(_el$70, "width", cardWidth(), _$p));
    return _el$69;
  })();
}
function Card(props) {
  const context = usePlugin2();
  const muted = context.theme.text.muted;
  const base = context.theme.text.base;
  return (() => {
    var _el$74 = _$createElement("box"), _el$75 = _$createElement("text"), _el$76 = _$createElement("text"), _el$77 = _$createElement("text");
    _$insertNode(_el$74, _el$75);
    _$insertNode(_el$74, _el$76);
    _$insertNode(_el$74, _el$77);
    _$setProp(_el$74, "flexDirection", "column");
    _$setProp(_el$75, "fg", muted);
    _$insert(_el$75, () => props.label);
    _$setProp(_el$76, "fg", base);
    _$setProp(_el$76, "wrapMode", "none");
    _$insert(_el$76, () => shorten(props.value, props.width));
    _$setProp(_el$77, "fg", muted);
    _$setProp(_el$77, "wrapMode", "none");
    _$insert(_el$77, () => shorten(props.detail, props.width));
    _$effect((_p$) => {
      var _v$10 = props.width, _v$11 = TextAttributes.BOLD;
      _v$10 !== _p$.e && (_p$.e = _$setProp(_el$74, "width", _v$10, _p$.e));
      _v$11 !== _p$.t && (_p$.t = _$setProp(_el$76, "attributes", _v$11, _p$.t));
      return _p$;
    }, {
      e: void 0,
      t: void 0
    });
    return _el$74;
  })();
}
function Trend(props) {
  const context = usePlugin2();
  const muted = context.theme.text.muted;
  const base = context.theme.text.base;
  const dates = createMemo2(() => props.data.trendDates());
  const levels = createMemo2(() => trendLevels(props.data.trendValues()));
  return (() => {
    var _el$78 = _$createElement("box"), _el$79 = _$createElement("text"), _el$81 = _$createElement("text"), _el$82 = _$createElement("box"), _el$83 = _$createElement("text"), _el$84 = _$createElement("text");
    _$insertNode(_el$78, _el$79);
    _$insertNode(_el$78, _el$81);
    _$insertNode(_el$78, _el$82);
    _$setProp(_el$78, "flexDirection", "column");
    _$setProp(_el$78, "height", 4);
    _$insertNode(_el$79, _$createTextNode(`90-day trend \xB7 all projects`));
    _$setProp(_el$79, "fg", muted);
    _$setProp(_el$81, "fg", base);
    _$setProp(_el$81, "wrapMode", "none");
    _$insert(_el$81, levels);
    _$insertNode(_el$82, _el$83);
    _$insertNode(_el$82, _el$84);
    _$setProp(_el$82, "flexDirection", "row");
    _$setProp(_el$82, "justifyContent", "space-between");
    _$setProp(_el$83, "fg", muted);
    _$insert(_el$83, () => dates()[0] ?? "");
    _$setProp(_el$84, "fg", muted);
    _$insert(_el$84, () => dates()[dates().length - 1] ?? "");
    return _el$78;
  })();
}
function shorten(value, width) {
  if (width <= 0) return "";
  if (value.length <= width) return value;
  if (width === 1) return "\u2026";
  return `${value.slice(0, width - 1)}\u2026`;
}
function formatClock(ms) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(new Date(ms));
}

// src/dashboard.tsx
function Dashboard(props) {
  const context = usePlugin3();
  const dimensions = useTerminalDimensions();
  const width = Math.max(60, Math.min(116, dimensions().width - 8));
  const maxTableHeight = Math.max(5, dimensions().height - 14 - 8 - 2 - (filters().cost ? 1 : 0));
  return (() => {
    var _el$ = _$createElement2("box");
    _$setProp2(_el$, "width", "100%");
    _$setProp2(_el$, "height", "100%");
    _$setProp2(_el$, "flexDirection", "column");
    _$setProp2(_el$, "alignItems", "center");
    _$setProp2(_el$, "paddingTop", 1);
    _$insert2(_el$, _$createComponent2(UsageView, {
      width,
      maxTableHeight,
      dashboard: true,
      get onClose() {
        return props.onClose;
      }
    }));
    _$effect2((_$p) => _$setProp2(_el$, "backgroundColor", context.theme.background.base, _$p));
    return _el$;
  })();
}

// src/modal.tsx
import { createComponent as _$createComponent3 } from "@opentui/solid";
import { usePlugin as usePlugin4 } from "@opencode/plugin/tui";
import { useTerminalDimensions as useTerminalDimensions2 } from "@opentui/solid";
function TokensModal() {
  const context = usePlugin4();
  const dimensions = useTerminalDimensions2();
  const width = Math.max(60, Math.min(112, dimensions().width - 8));
  const maxTableHeight = Math.min(12, Math.max(5, dimensions().height - 24 - (filters().cost ? 1 : 0)));
  return _$createComponent3(UsageView, {
    width,
    maxTableHeight,
    onClose: () => context.ui.dialog.clear()
  });
}

// src/quota.ts
import { Rpc } from "@opencode/plugin/rpc";
var WINDOW_SCHEMA = {
  type: "object",
  properties: {
    status: { type: "string" },
    percent: { type: "number" },
    resetsAt: { type: "string" }
  },
  required: ["status", "percent", "resetsAt"],
  additionalProperties: false
};
var ERROR_SCHEMA = {
  type: "object",
  properties: { message: { type: "string" } },
  required: ["message"],
  additionalProperties: false
};
var GoUsage = Rpc.define({
  id: "go-usage",
  methods: {
    get: {
      input: { type: "object", additionalProperties: false },
      output: {
        type: "object",
        properties: {
          usage: {
            type: "object",
            properties: {
              rolling: WINDOW_SCHEMA,
              weekly: WINDOW_SCHEMA,
              monthly: WINDOW_SCHEMA
            },
            required: ["rolling", "weekly", "monthly"],
            additionalProperties: false
          },
          fetchedAt: { type: "string" },
          stale: { type: "boolean" }
        },
        required: ["usage", "fetchedAt"],
        additionalProperties: false
      },
      errors: {
        no_credential: ERROR_SCHEMA,
        unauthorized: ERROR_SCHEMA,
        forbidden: ERROR_SCHEMA,
        upstream: ERROR_SCHEMA
      }
    }
  },
  events: {}
});
var QUOTA_TIMEOUT_MS = 5e3;
function quotaErrorText(error) {
  return describeRpcError(error);
}

// src/tui.tsx
var TIMEZONE2 = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
var tui_default = Plugin.define({
  id: "opencode-token-usage-dashboard.tui",
  setup(context) {
    const rpc = context.client.rpc(GoUsage);
    const [quota, setQuota] = createSignal3();
    const [quotaError, setQuotaError] = createSignal3();
    const [history, updateHistory] = context.storage.store("token-usage.history", {
      initial: emptyHistory()
    });
    const [quotaSamples, updateQuotaSamples] = context.storage.store("token-usage.quota", {
      initial: {
        samples: []
      }
    });
    let disposed = false;
    let quotaRequest = 0;
    let quotaTimer;
    const abort = new AbortController();
    const refreshQuota = async () => {
      const id = ++quotaRequest;
      try {
        const location = context.location ?? context.data.location.default();
        const result = await rpc.get({}, {
          location,
          signal: AbortSignal.timeout(QUOTA_TIMEOUT_MS)
        });
        if (disposed || id !== quotaRequest) return;
        const usage = result;
        setQuota(usage);
        setQuotaError(void 0);
        updateQuotaSamples((draft) => {
          draft.samples = appendQuotaSamples(draft.samples, usage, Date.now());
        });
      } catch (error) {
        if (disposed || id !== quotaRequest) return;
        setQuota(void 0);
        setQuotaError(quotaErrorText(error));
      }
    };
    setLiveData({
      quota,
      quotaError,
      refreshQuota: () => void refreshQuota(),
      history,
      updateHistory,
      quotaSamples,
      updateQuotaSamples
    });
    const runBackfill = async () => {
      try {
        const today = formatLocalDay(Date.now());
        const archived = Object.keys(history.days).sort();
        let activity = [];
        if (archived.length === 0 || history.backfill.failed > 0) {
          const all = await context.client.session.stats({
            timezone: TIMEZONE2,
            tools: "none"
          }, {
            signal: abort.signal
          });
          if (disposed) return;
          activity = Array.isArray(all.activity) ? all.activity.map((item) => ({
            date: item.date,
            steps: item.steps
          })) : [];
        } else {
          const last = archived[archived.length - 1];
          const from = localDayRange(last).to;
          const now = Date.now();
          if (from < now) {
            const recent = await context.client.session.stats({
              from,
              to: now + 1,
              timezone: TIMEZONE2,
              tools: "none"
            }, {
              signal: abort.signal
            });
            if (disposed) return;
            activity = Array.isArray(recent.activity) ? recent.activity.map((item) => ({
              date: item.date,
              steps: item.steps
            })) : [];
          }
        }
        const plan = planBackfill(activity, history.days, today);
        if (plan.length === 0) {
          if (history.backfill.status !== "done") {
            await updateHistory((draft) => {
              draft.backfill = {
                status: "done",
                total: 0,
                completed: 0,
                failed: 0,
                finishedAt: Date.now()
              };
            });
          }
          return;
        }
        await updateHistory((draft) => {
          draft.backfill = {
            status: "running",
            total: plan.length,
            completed: 0,
            failed: 0,
            startedAt: Date.now()
          };
        });
        for (const date of plan) {
          if (disposed) return;
          try {
            const {
              from,
              to
            } = localDayRange(date);
            const stats = await context.client.session.stats({
              from,
              to,
              timezone: TIMEZONE2,
              tools: "none"
            }, {
              signal: abort.signal
            });
            if (disposed) return;
            const parsed = parseStatsResponse(stats);
            const day = dailyUsage(date, aggregateModels(parsed.models));
            await updateHistory((draft) => {
              draft.days[date] = day;
              draft.backfill.completed += 1;
            });
          } catch {
            if (disposed) return;
            await updateHistory((draft) => {
              draft.backfill.failed += 1;
            });
          }
        }
        await updateHistory((draft) => {
          draft.backfill.status = "done";
          draft.backfill.finishedAt = Date.now();
        });
      } catch {
      }
    };
    void refreshQuota();
    const backfillTimer = setTimeout(() => void runBackfill(), 1e4);
    quotaTimer = setInterval(() => void refreshQuota(), 3e4);
    const [previous, setPrevious] = createSignal3(context.ui.router.current());
    const unregister = context.ui.router.register({
      name: "token-usage",
      render: () => _$createComponent4(Dashboard, {
        onClose: () => context.ui.router.navigate(previous())
      })
    });
    const openDashboard = () => {
      const current = context.ui.router.current();
      if (current.type === "plugin" && current.name === "token-usage") return;
      setPrevious({
        ...current
      });
      context.ui.dialog.clear();
      context.ui.router.navigate({
        type: "plugin",
        name: "token-usage"
      });
    };
    const openQuick = () => {
      context.ui.dialog.clear();
      context.ui.dialog.show(() => _$createComponent4(TokensModal, {}));
      context.ui.dialog.set({
        size: "xlarge",
        centered: true
      });
    };
    context.keymap.layer(() => ({
      mode: "global",
      priority: 10,
      commands: [{
        id: "opencode-token-usage.dashboard",
        title: "Token usage dashboard",
        group: "Token usage",
        palette: true,
        slash: {
          name: "tokens"
        },
        run: openDashboard
      }, {
        id: "opencode-token-usage.quick",
        title: "Token usage: quick view",
        group: "Token usage",
        palette: true,
        slash: {
          name: "tokens-quick"
        },
        run: openQuick
      }]
    }));
    return () => {
      disposed = true;
      quotaRequest += 1;
      abort.abort();
      if (quotaTimer) clearInterval(quotaTimer);
      clearTimeout(backfillTimer);
      unregister();
    };
  }
});
export {
  tui_default as default
};
