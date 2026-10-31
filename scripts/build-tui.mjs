import { build } from "esbuild"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("..", import.meta.url))
const { transformSolidSource } = await import(
  new URL("../node_modules/@opentui/solid/scripts/solid-transform.js", import.meta.url)
)

const solid = {
  name: "solid",
  setup(builder) {
    builder.onLoad({ filter: /\.tsx$/ }, async (args) => {
      const source = await readFile(args.path, "utf8")
      const transformed = await transformSolidSource(source, { filename: args.path })
      return { contents: transformed, loader: "js" }
    })
  },
}

await build({
  entryPoints: [resolve(root, "src/tui.tsx")],
  outfile: resolve(root, "dist/tui.js"),
  bundle: true,
  format: "esm",
  platform: "neutral",
  target: "es2022",
  external: ["@opencode/*", "@opentui/*", "solid-js", "solid-js/*"],
  plugins: [solid],
  logLevel: "info",
})
