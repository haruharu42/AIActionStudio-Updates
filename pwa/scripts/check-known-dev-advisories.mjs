import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const ALLOWED_HIGH_DEV_PACKAGES = new Set([
  "braces",
  "micromatch",
  "fast-glob",
  "vite-plugin-dynamic-import",
  "vite-plugin-commonjs",
  "vinext",
  "@next/eslint-plugin-next",
  "eslint-config-next",
]);
const ALLOWED_GHSA = "GHSA-vfj7-8cjw-p6xm";

const audit = spawnSync(
  "npm",
  ["audit", "--json"],
  {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    shell: process.platform === "win32",
  },
);
if (audit.error) {
  console.error(`npm audit could not start: ${audit.error.message}`);
  process.exit(1);
}
if (!audit.stdout) {
  console.error(audit.stderr || "npm audit produced no JSON output");
  process.exit(1);
}

let report;
try {
  report = JSON.parse(audit.stdout);
} catch {
  console.error("npm audit output was not valid JSON");
  console.error(audit.stdout.slice(0, 4000));
  process.exit(1);
}

const vulnerabilities = report.vulnerabilities ?? {};
const blocking = Object.entries(vulnerabilities).filter(([, value]) =>
  value && (value.severity === "high" || value.severity === "critical")
);

if (blocking.length === 0) {
  console.log("Full dependency audit: no high/critical advisories.");
  process.exit(0);
}

const unexpected = blocking.filter(([name]) => !ALLOWED_HIGH_DEV_PACKAGES.has(name));
if (unexpected.length > 0) {
  console.error("Unexpected high/critical dependency advisories:");
  for (const [name, value] of unexpected) {
    console.error(`- ${name}: ${value.severity}`);
  }
  process.exit(1);
}

const braces = vulnerabilities.braces;
const bracesVia = Array.isArray(braces?.via) ? braces.via : [];
const hasExpectedGhsa = bracesVia.some((entry) =>
  entry && typeof entry === "object"
    && (String(entry.url ?? "").includes(ALLOWED_GHSA) || String(entry.source ?? "").includes(ALLOWED_GHSA))
);
if (!hasExpectedGhsa) {
  console.error(`The allowed dev-only chain no longer maps to ${ALLOWED_GHSA}; manual review required.`);
  process.exit(1);
}

const lock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));
const packages = lock.packages ?? {};
const affectedPaths = Object.entries(packages).filter(([path, value]) => {
  if (!path.includes("node_modules/")) return false;
  const name = path.split("node_modules/").pop();
  return ALLOWED_HIGH_DEV_PACKAGES.has(name) && value?.version;
});
const runtimeAffected = affectedPaths.filter(([, value]) => value.dev !== true);
if (runtimeAffected.length > 0) {
  console.error("Known advisory chain is no longer dev-only:");
  for (const [path, value] of runtimeAffected) {
    console.error(`- ${path}@${value.version}`);
  }
  process.exit(1);
}

console.warn(
  `Accepted temporarily: ${ALLOWED_GHSA} is currently unpatched upstream and is confined to repository-controlled development tooling.`,
);
console.warn("Production dependencies are audited separately with --omit=dev and remain blocking at high severity.");
