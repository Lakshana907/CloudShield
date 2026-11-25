
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Load DATABASE_URL and other variables from the workspace root .env
const envFile = fileURLToPath(new URL("../../.env", import.meta.url));
process.loadEnvFile(envFile);

const env = { ...process.env, NODE_ENV: "development" };

console.log(
  "DATABASE_URL loaded:",
  Boolean(env.DATABASE_URL),
);

for (const args of [
  ["./build.mjs"],
  ["--enable-source-maps", "./dist/index.mjs"],
]) {
  const result = spawnSync(process.execPath, args, {
    env,
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
