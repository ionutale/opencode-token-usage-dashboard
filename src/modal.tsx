/** @jsxImportSource @opentui/solid */
import { usePlugin } from "@opencode/plugin/tui"
import { useTerminalDimensions } from "@opentui/solid"
import { UsageView } from "./components"
import { filters } from "./state"

export function TokensModal() {
  const context = usePlugin()
  const dimensions = useTerminalDimensions()
  const width = Math.max(60, Math.min(112, dimensions().width - 8))
  const maxTableHeight = Math.min(12, Math.max(5, dimensions().height - 24 - (filters().cost ? 1 : 0)))

  return (
    <UsageView
      width={width}
      maxTableHeight={maxTableHeight}
      onClose={() => context.ui.dialog.clear()}
    />
  )
}
