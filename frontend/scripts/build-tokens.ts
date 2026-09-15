/**
 * ATOS design tokens build (Fase 2).
 *
 * Single source of truth: frontend/tokens/source/tokens.json
 * Output: frontend/src/styles/tokens.generated.css
 *
 * - :root block = global tokens + modes.light (insertion order preserved)
 * - .dark block = modes.dark
 * - No ambient modes, no presets, no derived radius values
 *   (derived values stay in src/index.css @theme inline).
 *
 * Run: bun run --filter frontend tokens:build
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const SOURCE = join(ROOT, "tokens", "source", "tokens.json")
const OUTPUT = join(ROOT, "src", "styles", "tokens.generated.css")

const tokens = JSON.parse(readFileSync(SOURCE, "utf8"))

function toVars(entries: Record<string, string>) {
  return Object.entries(entries)
    .map(([key, value]) => `  --${key}: ${value};`)
    .join("\n")
}

const css = [
  "/* AUTO-GENERATED — do not edit. Run: bun run --filter frontend tokens:build */",
  `/* source: tokens/source/tokens.json v${tokens.meta.version} */`,
  "",
  ":root {",
  toVars({ ...tokens.global, ...tokens.modes.light }),
  "}",
  "",
  ".dark {",
  toVars(tokens.modes.dark),
  "}",
  "",
].join("\n")

mkdirSync(dirname(OUTPUT), { recursive: true })
writeFileSync(OUTPUT, css, "utf8")

console.log(`tokens:build — wrote ${OUTPUT}`)
