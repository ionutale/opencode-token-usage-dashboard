import { Plugin } from "@opencode/plugin"

/**
 * The dashboard is a TUI feature. This no-op server entry keeps the package
 * loadable through the normal plugin path while the TUI module does the work.
 */
export default Plugin.define({
  id: "opencode-token-usage-dashboard",
  setup() {},
})
