/** @jsxImportSource @opentui/solid */
import { usePlugin } from "@opencode/plugin/tui"
import { useTerminalDimensions } from "@opentui/solid"
import { UsageView } from "./components"
import { filters } from "./state"

export function Dashboard(props: { onClose: () => void }) {
  const context = usePlugin()
  const dimensions = useTerminalDimensions()
  const width = Math.max(60, Math.min(116, dimensions().width - 8))
  const maxTableHeight = Math.max(5, dimensions().height - 14 - 8 - 2 - (filters().cost ? 1 : 0))

  return (
    <box
      width="100%"
      height="100%"
      flexDirection="column"
      alignItems="center"
      paddingTop={1}
      backgroundColor={context.theme.background.base}
    >
      <UsageView width={width} maxTableHeight={maxTableHeight} dashboard={true} onClose={props.onClose} />
    </box>
  )
}
