import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const pwaRoot = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = path.resolve(pwaRoot, "..");

const legacyTerms = [
  ["アク", "シア"].join(""),
  ["ルー", "モ"].join(""),
  ["ax", "ia"].join(""),
  ["ru", "mo"].join(""),
];

const textExtensions = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".css", ".scss", ".json", ".webmanifest", ".md", ".txt",
  ".yml", ".yaml", ".sql", ".ps1", ".py", ".html", ".svg",
]);

const skippedDirectories = new Set([".git", "node_modules", "dist", ".next"]);
const skippedFiles = new Set(["package-lock.json"]);

async function collectTextFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (skippedDirectories.has(entry.name)) continue;
      files.push(...await collectTextFiles(path.join(dir, entry.name)));
      continue;
    }
    if (!entry.isFile()) continue;
    if (skippedFiles.has(entry.name)) continue;
    if (!textExtensions.has(path.extname(entry.name).toLowerCase())) continue;
    files.push(path.join(dir, entry.name));
  }
  return files;
}

function withoutEmbeddedRaster(text) {
  return text.replace(/data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/gi, "");
}

test("legacy AAS character names are absent from repository text and filenames", async () => {
  const files = await collectTextFiles(repoRoot);
  const findings = [];

  for (const file of files) {
    const relative = path.relative(repoRoot, file).replaceAll("\\", "/");
    const lowerPath = relative.toLowerCase();
    for (const term of legacyTerms) {
      if (lowerPath.includes(term.toLowerCase())) {
        findings.push(`filename: ${relative}`);
      }
    }

    const source = withoutEmbeddedRaster(await readFile(file, "utf8"));
    const lowerSource = source.toLowerCase();
    for (const term of legacyTerms) {
      if (lowerSource.includes(term.toLowerCase())) {
        findings.push(`content: ${relative} -> ${term}`);
      }
    }
  }

  assert.deepEqual(findings, []);
});
