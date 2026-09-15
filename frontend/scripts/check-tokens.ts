/**
 * ATOS design tokens drift check.
 *
 * Regenerates the CSS in memory and compares it with the committed
 * src/styles/tokens.generated.css. Exits 1 with instructions if they differ.
 * If the file is missing, generates it and exits 0 with a notice.
 *
 * Run: bun run --filter frontend tokens:check
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs"
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

const expected = [
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

if (!existsSync(OUTPUT)) {
  writeFileSync(OUTPUT, expected, "utf8")
  console.log(
    `tokens:check — ${OUTPUT} was missing, generated it (run tokens:build and commit it)`,
  )
  process.exit(0)
}

const actual = readFileSync(OUTPUT, "utf8")
if (actual === expected) {
  console.log("tokens:check — OK, no drift")
  process.exit(0)
}

console.error(
  "tokens:check — DRIFT DETECTED in src/styles/tokens.generated.css",
)
console.error(
  "Run `bun run --filter frontend tokens:build` and commit the regenerated file.",
)
process.exit(1)
