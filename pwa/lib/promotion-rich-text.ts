import { copyRichHtmlContent, markdownToNoteHtml, markdownToPlainText } from "@/lib/note-rich-text";

export type PromotionRichImage = {
  assetId: string;
  filename: string;
  caption: string;
  dataUrl: string;
};

const MARKER_RE = /<!--\s*PROMO_SCREENSHOT:([0-9a-f-]{36})\s*-->/gi;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function promotionMarkdownToRichHtml(
  markdown: string,
  images: readonly PromotionRichImage[],
): string {
  const byId = new Map(images.map((image) => [image.assetId, image]));
  const parts: string[] = [];
  let lastIndex = 0;

  for (const match of markdown.matchAll(MARKER_RE)) {
    const index = match.index ?? 0;
    const before = markdown.slice(lastIndex, index);
    if (before.trim()) parts.push(markdownToNoteHtml(before));

    const image = byId.get(match[1]);
    if (image) {
      const alt = escapeHtml(image.caption || image.filename || "スクリーンショット");
      const caption = image.caption
        ? `<figcaption>${escapeHtml(image.caption)}</figcaption>`
        : "";
      parts.push(
        `<figure data-aas-promotion-screenshot="${escapeHtml(image.assetId)}"><img src="${image.dataUrl}" alt="${alt}">${caption}</figure>`,
      );
    }
    lastIndex = index + match[0].length;
  }

  const tail = markdown.slice(lastIndex);
  if (tail.trim()) parts.push(markdownToNoteHtml(tail));
  return parts.join("\n");
}

export function promotionMarkdownToPlainText(
  markdown: string,
  images: readonly PromotionRichImage[],
): string {
  const byId = new Map(images.map((image) => [image.assetId, image]));
  const replaced = markdown.replace(MARKER_RE, (_full, assetId: string) => {
    const image = byId.get(assetId);
    if (!image) return "";
    return `\n[スクリーンショット: ${image.caption || image.filename}]\n`;
  });
  return markdownToPlainText(replaced);
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("画像の読み込みに失敗しました。"));
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("画像の読み込み結果が不正です。"));
        return;
      }
      resolve(reader.result);
    };
    reader.readAsDataURL(blob);
  });
}

export async function copyPromotionRichText(
  markdown: string,
  images: readonly PromotionRichImage[],
): Promise<"rich" | "fallback"> {
  const html = promotionMarkdownToRichHtml(markdown, images);
  const plain = promotionMarkdownToPlainText(markdown, images);
  return copyRichHtmlContent(html, plain);
}
