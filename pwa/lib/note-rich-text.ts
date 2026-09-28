function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderInline(value: string): string {
  let output = escapeHtml(value);
  const placeholders: string[] = [];
  const stash = (html: string) => {
    const token = `\u0000AAS${placeholders.length}\u0000`;
    placeholders.push(html);
    return token;
  };

  output = output.replace(/`([^`\n]+)`/g, (_match, code: string) => stash(`<code>${code}</code>`));
  output = output.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_match, label: string, url: string) => {
    const safeUrl = url.replace(/&amp;/g, "&");
    return stash(`<a href="${escapeHtml(safeUrl)}">${label}</a>`);
  });
  output = output.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  output = output.replace(/__([^_\n]+)__/g, "<strong>$1</strong>");
  output = output.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");

  return output.replace(/\u0000AAS(\d+)\u0000/g, (_match, index: string) => placeholders[Number(index)] ?? "");
}

function normalizeMarkdown(markdown: string): string {
  return markdown.replace(/\r\n?/g, "\n").trim();
}

export function markdownToNoteHtml(markdown: string): string {
  const source = normalizeMarkdown(markdown);
  if (!source) return "";

  const lines = source.split("\n");
  const html: string[] = [];
  let paragraph: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let listItems: string[] = [];
  let quoteLines: string[] = [];
  let codeLines: string[] = [];
  let codeFence = false;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    html.push(`<p>${paragraph.map(renderInline).join("<br>")}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (!listType || !listItems.length) return;
    html.push(`<${listType}>${listItems.map((item) => `<li>${renderInline(item)}</li>`).join("")}</${listType}>`);
    listType = null;
    listItems = [];
  };
  const flushQuote = () => {
    if (!quoteLines.length) return;
    html.push(`<blockquote>${quoteLines.map(renderInline).join("<br>")}</blockquote>`);
    quoteLines = [];
  };
  const flushAll = () => {
    flushParagraph();
    flushList();
    flushQuote();
  };

  for (const line of lines) {
    if (/^```/.test(line.trim())) {
      flushAll();
      if (codeFence) {
        html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
        codeLines = [];
        codeFence = false;
      } else {
        codeFence = true;
      }
      continue;
    }
    if (codeFence) {
      codeLines.push(line);
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      flushAll();
      continue;
    }

    const imageInsertion = /^\*\*【挿絵(\d+)をここに挿入】\*\*$/.exec(trimmed);
    if (imageInsertion) {
      flushAll();
      html.push(`<p><br></p><p><strong>【挿絵${Number(imageInsertion[1])}をここに挿入】</strong></p><p><br></p>`);
      continue;
    }

    if (trimmed === "**【ここから有料エリア】**") {
      flushAll();
      html.push("<p><br></p><p><strong>【ここから有料エリア】</strong></p><p><br></p>");
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      flushAll();
      const level = heading[1].length <= 2 ? 2 : 3;
      html.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      continue;
    }

    if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushAll();
      html.push("<hr>");
      continue;
    }

    const quote = /^>\s?(.*)$/.exec(line);
    if (quote) {
      flushParagraph();
      flushList();
      quoteLines.push(quote[1]);
      continue;
    }
    flushQuote();

    const unordered = /^[-+*]\s+(.+)$/.exec(line);
    if (unordered) {
      flushParagraph();
      if (listType && listType !== "ul") flushList();
      listType = "ul";
      listItems.push(unordered[1]);
      continue;
    }

    const ordered = /^\d+[.)]\s+(.+)$/.exec(line);
    if (ordered) {
      flushParagraph();
      if (listType && listType !== "ol") flushList();
      listType = "ol";
      listItems.push(ordered[1]);
      continue;
    }
    flushList();

    paragraph.push(line);
  }

  if (codeFence || codeLines.length) html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
  flushAll();
  return html.join("\n");
}

export function markdownToPlainText(markdown: string): string {
  const source = normalizeMarkdown(markdown);
  if (!source) return "";
  return source
    .replace(/^```[^\n]*\n?/gm, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^[-+*]\s+/gm, "• ")
    .replace(/^\d+[.)]\s+/gm, "")
    .replace(/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/gm, "")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1 ($2)")
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/__([^_\n]+)__/g, "$1")
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1$2")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function fallbackRichCopy(html: string): boolean {
  if (typeof document === "undefined") return false;
  const container = document.createElement("div");
  container.contentEditable = "true";
  container.setAttribute("aria-hidden", "true");
  container.style.position = "fixed";
  container.style.left = "-10000px";
  container.style.top = "0";
  container.innerHTML = html;
  document.body.append(container);

  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(container);
  selection?.removeAllRanges();
  selection?.addRange(range);
  const copied = document.execCommand("copy");
  selection?.removeAllRanges();
  container.remove();
  return copied;
}

export async function copyNoteRichText(markdown: string): Promise<"rich" | "fallback"> {
  const html = markdownToNoteHtml(markdown);
  const plain = markdownToPlainText(markdown);
  if (!html) throw new Error("コピーする本文がありません。");

  if (typeof navigator !== "undefined" && navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
    try {
      const item = new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([plain], { type: "text/plain" }),
      });
      await navigator.clipboard.write([item]);
      return "rich";
    } catch {
      // Safari/iOSなど、APIは存在してもHTML ClipboardItemの書き込みが拒否される環境では
      // 選択範囲コピーへフォールバックする。
    }
  }

  if (fallbackRichCopy(html)) return "fallback";
  throw new Error("装飾付きコピーに失敗しました。ブラウザーのクリップボード許可を確認して、もう一度お試しください。");
}
