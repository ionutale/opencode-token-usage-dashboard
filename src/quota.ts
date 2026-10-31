import { Rpc } from "@opencode/plugin/rpc"
import { describeRpcError } from "./usage"

const WINDOW_SCHEMA = {
  type: "object",
  properties: {
    status: { type: "string" },
    percent: { type: "number" },
    resetsAt: { type: "string" },
  },
  required: ["status", "percent", "resetsAt"],
  additionalProperties: false,
} as const

const ERROR_SCHEMA = {
  type: "object",
  properties: { message: { type: "string" } },
  required: ["message"],
  additionalProperties: false,
} as const

/**
 * Client-side view of the contract registered by opencode-go-usage-plugin.
 * The new plugin never registers it; if the Go plugin is absent the RPC call
 * fails and the dashboard hides the quota/forecast instead of breaking.
 */
export const GoUsage = Rpc.define({
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
              monthly: WINDOW_SCHEMA,
            },
            required: ["rolling", "weekly", "monthly"],
            additionalProperties: false,
          },
          fetchedAt: { type: "string" },
          stale: { type: "boolean" },
        },
        required: ["usage", "fetchedAt"],
        additionalProperties: false,
      },
      errors: {
        no_credential: ERROR_SCHEMA,
        unauthorized: ERROR_SCHEMA,
        forbidden: ERROR_SCHEMA,
        upstream: ERROR_SCHEMA,
      },
    },
  },
  events: {},
})

export const QUOTA_TIMEOUT_MS = 5_000

export function quotaErrorText(error: unknown): string {
  return describeRpcError(error)
}
