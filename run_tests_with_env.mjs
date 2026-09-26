import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { spawn } from "child_process";
// CLI arguments are forwarded to Playwright, e.g.
//   node run_tests_with_env.mjs __tests__/security/foo.spec.ts --reporter=list
const child = spawn("npx", ["playwright", "test", ...process.argv.slice(2)], { stdio: "inherit", env: process.env });
child.on("exit", (code) => process.exit(code ?? 1));
