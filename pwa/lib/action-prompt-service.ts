import type { SupabaseClient } from "@supabase/supabase-js";

import type { ActionPromptField, ActionPromptTemplate } from "@/lib/action-prompt-catalog";

export type ActionPromptCategoryRecord = {
  id: string;
  categoryKey: string;
  displayName: string;
  description: string;
  icon: string;
  sortOrder: number;
  status: "active" | "inactive";
};

export type ActionPromptTemplateRecord = ActionPromptTemplate & {
  databaseId: string;
  categoryKey: string;
  status: "draft" | "active" | "inactive";
  sortOrder: number;
  version: number;
};

type Row = Record<string, unknown>;

function asRows(value: unknown): Row[] {
  if (!Array.isArray(value)) throw new Error("プロンプトDBの応答形式が不正です。");
  return value.filter((item): item is Row => Boolean(item) && typeof item === "object" && !Array.isArray(item));
}

function str(row: Row, key: string): string {
  const value = row[key];
  if (typeof value !== "string") throw new Error(`${key}の形式が不正です。`);
  return value;
}

function int(row: Row, key: string): number {
  const value = row[key];
  if (typeof value !== "number" || !Number.isSafeInteger(value)) throw new Error(`${key}の形式が不正です。`);
  return value;
}

function parseFields(value: unknown): ActionPromptField[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as Row;
    if (typeof row.key !== "string" || typeof row.label !== "string" || typeof row.placeholder !== "string") return [];
    if (!/^[a-zA-Z0-9_-]{1,40}$/.test(row.key)) return [];
    return [{
      key: row.key,
      label: row.label,
      placeholder: row.placeholder,
      multiline: row.multiline === true,
      options: Array.isArray(row.options)
        ? row.options.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean).slice(0, 30)
        : undefined,
    }];
  }).slice(0, 20);
}

function recommendedAi(value: string): ActionPromptTemplate["recommendedAi"] {
  return value === "Claude" || value === "Gemini" ? value : "ChatGPT";
}

export async function loadActionPromptCatalog(client: SupabaseClient): Promise<{
  categories: ActionPromptCategoryRecord[];
  templates: ActionPromptTemplateRecord[];
}> {
  const [categoryResult, templateResult] = await Promise.all([
    client
      .from("action_prompt_categories")
      .select("id,category_key,display_name,description,icon,sort_order,status")
      .order("sort_order", { ascending: true })
      .order("display_name", { ascending: true }),
    client
      .from("action_prompt_templates")
      .select("id,slug,title,category_key,side_hustle,description,recommended_ai,input_schema,prompt_template,status,sort_order,version")
      .order("sort_order", { ascending: true })
      .order("title", { ascending: true }),
  ]);

  if (categoryResult.error) throw new Error("プロンプトカテゴリを取得できませんでした。");
  if (templateResult.error) throw new Error("プロンプトテンプレートを取得できませんでした。");

  const categories = asRows(categoryResult.data).map((row): ActionPromptCategoryRecord => ({
    id: str(row, "id"),
    categoryKey: str(row, "category_key"),
    displayName: str(row, "display_name"),
    description: str(row, "description"),
    icon: str(row, "icon"),
    sortOrder: int(row, "sort_order"),
    status: str(row, "status") === "inactive" ? "inactive" : "active",
  }));

  const categoryNames = new Map(categories.map((item) => [item.categoryKey, item.displayName]));
  const templates = asRows(templateResult.data).map((row): ActionPromptTemplateRecord => ({
    databaseId: str(row, "id"),
    id: str(row, "slug"),
    title: str(row, "title"),
    categoryKey: str(row, "category_key"),
    category: categoryNames.get(str(row, "category_key")) ?? str(row, "category_key"),
    sideHustle: str(row, "side_hustle"),
    description: str(row, "description"),
    recommendedAi: recommendedAi(str(row, "recommended_ai")),
    fields: parseFields(row.input_schema),
    prompt: str(row, "prompt_template"),
    status: (["draft", "active", "inactive"] as const).includes(str(row, "status") as "draft" | "active" | "inactive")
      ? str(row, "status") as "draft" | "active" | "inactive"
      : "draft",
    sortOrder: int(row, "sort_order"),
    version: int(row, "version"),
  }));

  return { categories, templates };
}

async function currentUserId(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user?.id) throw new Error("管理者セッションを確認できませんでした。");
  return data.user.id;
}

export async function saveActionPromptCategory(
  client: SupabaseClient,
  input: Omit<ActionPromptCategoryRecord, "id"> & { id?: string },
): Promise<void> {
  const userId = await currentUserId(client);
  const payload = {
    category_key: input.categoryKey.trim(),
    display_name: input.displayName.trim(),
    description: input.description.trim(),
    icon: input.icon.trim() || "⌘",
    sort_order: input.sortOrder,
    status: input.status,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { error } = await client.from("action_prompt_categories").update(payload).eq("id", input.id);
    if (error) throw new Error(error.code === "23505" ? "同じカテゴリキーが既にあります。" : "カテゴリを保存できませんでした。");
    return;
  }

  const { error } = await client.from("action_prompt_categories").insert({ ...payload, created_by: userId });
  if (error) throw new Error(error.code === "23505" ? "同じカテゴリキーが既にあります。" : "カテゴリを追加できませんでした。");
}

export async function saveActionPromptTemplate(
  client: SupabaseClient,
  input: Omit<ActionPromptTemplateRecord, "databaseId" | "category"> & { databaseId?: string },
): Promise<void> {
  const userId = await currentUserId(client);
  const payload = {
    slug: input.id.trim(),
    title: input.title.trim(),
    category_key: input.categoryKey,
    side_hustle: input.sideHustle.trim(),
    description: input.description.trim(),
    recommended_ai: input.recommendedAi,
    input_schema: input.fields.map((field) => ({
      key: field.key.trim(),
      label: field.label.trim(),
      placeholder: field.placeholder.trim(),
      multiline: field.multiline === true,
      options: field.options?.map((option) => option.trim()).filter(Boolean).slice(0, 30) ?? [],
    })),
    prompt_template: input.prompt.trim(),
    status: input.status,
    sort_order: input.sortOrder,
    version: input.version,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  };

  if (input.databaseId) {
    const { error } = await client.from("action_prompt_templates").update(payload).eq("id", input.databaseId);
    if (error) throw new Error(error.code === "23505" ? "同じプロンプトIDが既にあります。" : "プロンプトを保存できませんでした。");
    return;
  }

  const { error } = await client.from("action_prompt_templates").insert({ ...payload, created_by: userId });
  if (error) throw new Error(error.code === "23505" ? "同じプロンプトIDが既にあります。" : "プロンプトを追加できませんでした。");
}
