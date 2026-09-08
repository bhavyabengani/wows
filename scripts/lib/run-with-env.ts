/** Runs a command with `.env.local` loaded (see load-env.ts). Usage: tsx scripts/lib/run-with-env.ts <cmd> [args]. */
import "./load-env";
import { spawnSync } from "node:child_process";

const [cmd, ...args] = process.argv.slice(2);
if (!cmd) {
  console.error("usage: run-with-env <command> [args...]");
  process.exit(2);
}
const result = spawnSync(cmd, args, {
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});
process.exit(result.status ?? 1);
