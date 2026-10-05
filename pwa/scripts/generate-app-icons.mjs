// Official AAS character: Mirea. Mascot partner: Rupii.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = path.dirname(fileURLToPath(import.meta.url));
const pwaRoot = path.resolve(here, "..");
const publicDir = path.join(pwaRoot, "public");
const sourcePath = path.join(publicDir, "aas-mirea-app-icon-v1.svg");

const sourceSvg = await readFile(sourcePath, "utf8");
const embedded = sourceSvg.match(/data:image\/(?:webp|jpeg);base64,([^"]+)/);
if (!embedded?.[1]) {
  throw new Error("Mirea WebP/JPEG raster source is missing from aas-mirea-app-icon-v1.svg");
}

const sourceRaster = Buffer.from(embedded[1], "base64");
const sourceInfo = await sharp(sourceRaster).metadata();
const sourceStats = await sharp(sourceRaster).stats();
if (
  !sourceInfo.width
  || !sourceInfo.height
  || sourceInfo.width < 512
  || sourceInfo.height < 512
  || sourceStats.entropy < 3
) {
  throw new Error("Embedded Mirea source image is invalid or too small");
}

const targets = [
  { size: 180, name: "aas-mirea-icon-180.png" },
  { size: 192, name: "aas-mirea-icon-192.png" },
  { size: 512, name: "aas-mirea-icon-512.png" },
];

for (const target of targets) {
  const output = path.join(publicDir, target.name);
  await sharp(sourceRaster)
    .resize(target.size, target.size, { fit: "cover", position: "centre" })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(output);

  const image = sharp(output);
  const info = await image.metadata();
  const stats = await image.stats();
  if (
    info.width !== target.size
    || info.height !== target.size
    || stats.entropy < 3
  ) {
    throw new Error(`Invalid generated Mirea icon: ${target.name}`);
  }
}

console.log(
  "Generated Mirea app icons from embedded raster:",
  targets.map((target) => target.name).join(", "),
);
