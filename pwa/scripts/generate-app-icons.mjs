import { access, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = path.dirname(fileURLToPath(import.meta.url));
const pwaRoot = path.resolve(here, "..");
const publicDir = path.join(pwaRoot, "public");
const source = path.join(publicDir, "aas-axia-app-icon-v1.svg");

await access(source);

const targets = [
  { size: 180, name: "aas-axia-icon-180.png" },
  { size: 192, name: "aas-axia-icon-192.png" },
  { size: 512, name: "aas-axia-icon-512.png" },
];

for (const target of targets) {
  const output = path.join(publicDir, target.name);
  await sharp(source, { density: 384 })
    .resize(target.size, target.size, { fit: "cover", position: "centre" })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(output);

  const image = sharp(output);
  const info = await image.metadata();
  const stats = await image.stats();
  const file = await stat(output);
  if (
    info.width !== target.size
    || info.height !== target.size
    || file.size < 10_000
    || stats.entropy < 3
  ) {
    throw new Error(`Invalid generated Axia icon: ${target.name}`);
  }
}

console.log("Generated Axia app icons:", targets.map((target) => target.name).join(", "));
