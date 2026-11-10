// The chart script of the skill mingli-chart-reading: node chart.mjs <盘> [选项] (--help for them).
// The build (core/skill/build.mjs) bundles this with chroniq-core and its three libraries into one
// scripts/chart.mjs, so the skill runs it with node alone. What it does is in run.ts.
import { run, UsageError } from './run'

try {
  console.log(run(process.argv.slice(2)))
} catch (e) {
  if (!(e instanceof UsageError)) throw e
  console.error(`错误：${e.message}
（node chart.mjs --help 看用法）`)
  process.exitCode = 2
}
