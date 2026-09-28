import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (relative) => readFile(path.join(root, relative), "utf8");
const readNotePromptSource = async () => (await Promise.all(["lib/note-operations.ts", "lib/note-operation-prompts.ts"].map((relative) => read(relative)))).join("\n");
const readRepo = (relative) => readFile(path.join(root, "..", relative), "utf8");

test("workspace preset preferences are owner scoped and admin-only AAS is enforced by RLS", async () => {
  const migration = await readRepo("supabase/migrations/20260921034342_user_workspace_preset_preferences.sql");

  assert.match(migration, /create table if not exists public\.user_workspace_preset_preferences/);
  assert.match(migration, /preset_key in \('balanced','note_growth','longform','sns_growth','aas_official'\)/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /force row level security/);
  assert.match(migration, /user_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /private\.is_active_profile\(\)/);
  assert.match(migration, /public\.can_access_product\('AAS-PWA-BETA'\)/);
  assert.match(migration, /preset_key <> 'aas_official'.*private\.is_active_admin\(\)/s);
  assert.match(migration, /workspace_preset_update_own_active[\s\S]*?using \([\s\S]*?with check \(/);
  assert.match(migration, /revoke all on table public\.user_workspace_preset_preferences from public, anon, authenticated/);
  assert.match(migration, /grant select, insert, update, delete on table public\.user_workspace_preset_preferences to authenticated/);
  assert.doesNotMatch(migration, /service[_-]?role|sb_secret_|sk_(?:live|test)_|whsec_/i);
});

test("shared presets include an admin-only AAS official operating profile", async () => {
  const presets = await read("features/presets/workspace-presets.ts");

  for (const key of ["balanced", "note_growth", "longform", "sns_growth", "aas_official"]) {
    assert.match(presets, new RegExp(key + ": \\{"));
  }
  assert.match(presets, /label: "AI Action Studio（AAS）公式運営"/);
  assert.match(presets, /adminOnly: true/);
  assert.match(presets, /AI Action Studio（AAS）自体の公式発信/);
  assert.match(presets, /副業専用プロンプト/);
  assert.match(presets, /Knowledge/);
  assert.doesNotMatch(presets, /AI Article Studio（AAS）/);
  assert.match(presets, /実際に確認していないPV・売上・ユーザー反応・レビュー・改善効果を作らない/);
  assert.match(presets, /styleContext: "AAS公式発信では、白・明るいブルー・濃いネイビー/);
  assert.match(presets, /availableWorkspacePresets/);
  assert.match(presets, /filter\(\(preset\) => !preset\.adminOnly \|\| isAdmin\)/);
});

test("settings are compact accordion sections and include impact-preview preset controls", async () => {
  const [settings, control, css] = await Promise.all([
    read("components/pwa-settings-page.tsx"),
    read("features/presets/workspace-preset-settings.tsx"),
    read("app/phase44-shared-presets.css"),
  ]);

  for (const title of ["共通プリセット", "表示・ナビ", "AI・文章の好み", "アカウント・ヘルプ"]) {
    assert.match(settings, new RegExp(title));
  }
  assert.match(settings, /SettingsAccordion/);
  assert.match(settings, /aria-expanded=\{open\}/);
  assert.match(settings, /openSection === "preset"/);
  assert.match(settings, /openSection === "navigation"/);
  assert.match(settings, /openSection === "personalization"/);
  assert.match(settings, /openSection === "account"/);
  assert.match(settings, /useState<SettingsSection \| null>\(null\)/);
  assert.match(settings, /current === id \? null : id/);

  assert.match(control, /現在の共通プリセットで変わる内容/);
  assert.match(control, /FEATURE_SWITCHES/);
  assert.doesNotMatch(control, /key: "applyArticle"/);
  assert.match(control, /記事作成のジャンルは下の投稿アカウントプリセット/);
  assert.match(control, /画像計画/);
  assert.match(control, /note運営/);
  assert.match(control, /運営コックピット/);
  assert.match(control, /アカウント設計/);
  assert.match(control, /管理者限定/);
  assert.match(control, /共通プリセットを保存/);
  assert.match(control, /標準へ戻す/);
  assert.match(css, /\.settings-accordion/);
  assert.match(css, /@media \(max-width: 600px\)/);
});

test("shared preset is injected into prompt generation and visible across feature screens", async () => {
  const [personalization, create, imageLib, imagePage, snsPage, noteLib, notePage, starter, lifecycle, workflow, promotion] = await Promise.all([
    read("lib/user-personalization.ts"),
    read("components/phase11-create-page.tsx"),
    read("lib/phase13-image-prompts.ts"),
    read("components/phase13-image-page.tsx"),
    read("components/phase14-sns-page.tsx"),
    readNotePromptSource(),
    read("components/note-operations-page.tsx"),
    read("lib/platform-account-starter.ts"),
    read("lib/content-lifecycle.ts"),
    read("components/content-workflow-page.tsx"),
    read("components/admin-promotion-page.tsx"),
  ]);

  assert.match(personalization, /buildWorkspacePresetPromptContext/);
  assert.match(personalization, /if \(!profile\) return workspacePresetContext/);

  assert.doesNotMatch(create, /applyWorkspacePresetToArticleDraft/);
  assert.doesNotMatch(create, /ActiveWorkspacePresetBadge feature="article"/);
  assert.match(create, /accountPresets/);
  assert.match(create, /activeAccountPreset/);
  assert.match(create, /投稿アカウントプリセット/);

  assert.match(imageLib, /getRuntimeWorkspacePresetDefinition/);
  assert.match(imageLib, /styleContext/);
  assert.match(imagePage, /workspacePresetImageDefaults/);
  assert.match(imagePage, /ActiveWorkspacePresetBadge feature="images"/);

  assert.match(snsPage, /workspacePresetSocialDefaults/);
  assert.match(snsPage, /ActiveWorkspacePresetBadge feature="sns"/);

  assert.match(noteLib, /applyRuntimeWorkspacePresetToNoteProfile/);
  assert.match(noteLib, /buildWorkspacePresetPromptContext\("note"\)/);
  assert.match(notePage, /note設定へ反映/);
  assert.match(notePage, /ActiveWorkspacePresetBadge feature="note"/);

  assert.match(starter, /buildWorkspacePresetPromptContext\("account_design"\)/);

  assert.match(lifecycle, /buildWorkspacePresetPromptContext\("workflow"\)/);
  assert.match(workflow, /workspacePresetWorkflowDefaults/);
  assert.match(workflow, /ActiveWorkspacePresetBadge feature="workflow"/);

  assert.match(promotion, /useWorkspacePreset/);
  assert.match(promotion, /WORKSPACE_PRESETS\[workspacePreference\.presetKey\]/);
  assert.match(promotion, /ActiveWorkspacePresetBadge feature="sns"/);
});

test("explicit feature settings remain editable and article choices stay outside shared presets", async () => {
  const [presets, adapters, create] = await Promise.all([
    read("features/presets/workspace-presets.ts"),
    read("features/presets/preset-adapters.ts"),
    read("components/phase11-create-page.tsx"),
  ]);

  assert.match(presets, /今回の画面でユーザーが明示的に指定した条件がある場合は、その指定をプリセットより優先する/);
  assert.match(presets, /if \(feature === "article"\) return false/);
  assert.match(adapters, /if \(!preference\.applyArticle\) return draft/);
  assert.match(adapters, /if \(!preference\?\.applyImages\) return null/);
  assert.match(adapters, /if \(!preference\?\.applySns\) return null/);
  assert.match(adapters, /if \(!preference\?\.applyWorkflow\) return null/);
  assert.match(adapters, /if \(!preference\.applyAccountDesign\) return design/);
  assert.match(create, /activeAccountPreset/);
  assert.match(create, /params\.has\("from"\) \|\| params\.has\("genre"\) \|\| params\.has\("title"\)/);
});

test("workspace preset provider persists across routes and recomputes dependent prompts safely", async () => {
  const [layout, provider, workflow, promotion] = await Promise.all([
    read("app/layout.tsx"),
    read("features/presets/workspace-preset-provider.tsx"),
    read("components/content-workflow-page.tsx"),
    read("components/admin-promotion-page.tsx"),
  ]);

  assert.match(layout, /<AccessStateProvider>[\s\S]*?<WorkspacePresetProvider>[\s\S]*?\{children\}[\s\S]*?<\/WorkspacePresetProvider>/);
  assert.match(provider, /useCallback/);
  assert.match(provider, /loadWorkspacePresetPreference/);
  assert.match(provider, /setRuntimeWorkspacePresetPreference/);
  assert.match(provider, /accountPresets/);
  assert.match(provider, /accountPresetsLoading/);
  assert.match(provider, /saveAccountPreset/);
  assert.match(provider, /deleteAccountPreset/);
  assert.match(workflow, /const preflightPrompt = preflightDetail && preflightReport[\s\S]*?buildPrePublishReviewPrompt/);
  assert.match(workflow, /const reusePrompt = reuseDetail[\s\S]*?buildArticleReusePrompt/);
  assert.match(workflow, /const seriesPrompt = buildSeriesPlanPrompt/);
  assert.doesNotMatch(workflow, /\[preflightDetail, preflightReport, workspacePreference\]/);
  assert.doesNotMatch(workflow, /\[reuseDetail, enabledReuseChannels, workspacePreference\]/);
  assert.match(promotion, /\[facts, article, workspacePreference\]/);
  assert.match(promotion, /\[facts, preview, socialLengths, advancedSocialStyle, workspacePreference\]/);
  assert.match(promotion, /void workspacePreference; \/\/ Prompt context reads the runtime workspace preset\./);
});


test("Phase 45 feature boundaries keep domain imports stable without deleting legacy contracts", async () => {
  const [structure, readme, workflow, note, support, create, nav] = await Promise.all([
    read("STRUCTURE.md"),
    read("features/README.md"),
    read("components/content-workflow-page.tsx"),
    read("components/note-operations-page.tsx"),
    read("components/user-inquiries-page.tsx"),
    read("components/phase11-create-page.tsx"),
    read("components/persistent-mobile-nav.tsx"),
  ]);

  assert.match(structure, /Phase 45 feature-oriented structure/);
  for (const domain of ["article", "account-design", "note", "workflow", "social", "images", "presets", "support", "admin", "navigation"]) {
    assert.ok(readme.includes("`" + domain + "/`"));
  }

  assert.match(workflow, /from "@\/features\/workflow"/);
  assert.match(workflow, /from "@\/features\/note"/);
  assert.match(workflow, /from "@\/features\/article"/);
  assert.match(note, /from "@\/features\/note"/);
  assert.match(support, /from "@\/features\/support"/);
  assert.match(create, /from "@\/features\/account-design"/);
  assert.match(nav, /from "@\/features\/navigation"/);

  assert.match(structure, /Feature modules may temporarily re-export legacy implementation/);
  assert.match(structure, /risky mass rename/);
});
