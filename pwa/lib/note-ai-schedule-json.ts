function stripJsonFence(text: string): string {
  const trimmed = text.trim();
  const withoutOpen = trimmed.replace(/^\`\`\`(?:json)?\s*/i, "");
  return withoutOpen.replace(/\s*\`\`\`\s*$/i, "").trim();
}

function scheduleRootFromValue(value: unknown, depth = 0): Record<string, unknown> | null {
  if (depth > 5 || !value || typeof value !== "object") return null;
  if (!Array.isArray(value)) {
    const object = value as Record<string, unknown>;
    if (object.schema === "aas-note-schedule-v2") return object;
    if (
      (typeof object.target_month === "string" || typeof object.targetMonth === "string") &&
      (Array.isArray(object.schedule) || Array.isArray(object.calendar) || Array.isArray(object.items))
    ) {
      return object;
    }
    for (const nested of Object.values(object)) {
      const found = scheduleRootFromValue(nested, depth + 1);
      if (found) return found;
    }
    return null;
  }
  for (const nested of value) {
    const found = scheduleRootFromValue(nested, depth + 1);
    if (found) return found;
  }
  return null;
}

function balancedJsonObjects(text: string): string[] {
  const objects: string[] = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") {
      if (depth === 0) start = index;
      depth += 1;
      continue;
    }

    if (char === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        objects.push(text.slice(start, index + 1));
        start = -1;
      }
    }
  }

  return objects;
}

export function extractNoteAiScheduleJson(text: string): Record<string, unknown> {
  const rawText = text.trim();
  if (!rawText) throw new Error("AIの回答を貼り付けてください。");

  const candidates: string[] = [];
  const seen = new Set<string>();
  const addCandidate = (value: string) => {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    candidates.push(normalized);
  };

  addCandidate(stripJsonFence(rawText));

  const fencePattern = /\`\`\`(?:json)?\s*([\s\S]*?)\s*\`\`\`/gi;
  for (const match of rawText.matchAll(fencePattern)) {
    if (match[1]) addCandidate(match[1]);
  }

  for (const objectText of balancedJsonObjects(rawText)) addCandidate(objectText);

  let parsedJsonFound = false;
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      parsedJsonFound = true;
      const root = scheduleRootFromValue(parsed);
      if (root) return root;
    } catch {
      // Try the next candidate. ChatGPT may include prose around the JSON.
    }
  }

  if (parsedJsonFound) {
    throw new Error("AAS用の運用スケジュールが回答内に見つかりませんでした。AASからコピーしたスケジュール作成プロンプトをAIへ渡して、回答全文をそのまま貼り付けてください。");
  }
  throw new Error("AI回答の中から読み込めるJSON部分を見つけられませんでした。ChatGPTの回答全文を削らず、そのまま貼り付けてください。");
}
