import assert from "node:assert/strict";
import test, { after } from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({ appType: "custom", configFile: false, root,
  resolve: { alias: { "@": root } }, server: { middlewareMode: true, hmr: false } });
after(() => vite.close());
const transfer = await vite.ssrLoadModule("/lib/note-operations-transfer.ts");
const progress = await vite.ssrLoadModule("/features/side-hustles/progress.ts");
const { getSideHustleDefinition } = await vite.ssrLoadModule("/features/side-hustles/catalog.ts");
const { initialSideHustleDraft } = await vite.ssrLoadModule("/features/side-hustles/prompt-builder.ts");
const { normalizeNotificationInbox } = await vite.ssrLoadModule("/lib/notifications.ts");
const { replaceNoteScheduleAtomically } = await vite.ssrLoadModule("/lib/note-schedule-persistence.ts");
const { createSessionRequestLoader } = await vite.ssrLoadModule("/lib/session-request-loader.ts");
const scheduleItem = (overrides = {}) => ({ scheduledDate: "2026-10-01", scheduledTime: "20:00",
  itemType: "free_note", title: '記事,"タイトル"', theme: "テーマ", status: "planned",
  source: "imported", notes: "1行目\r\n2行目\n3行目", ...overrides });

test("note CSV export/import preserves quoted multiline content and all rows", () => {
  const items = [scheduleItem(), scheduleItem({ scheduledDate: "2026-10-02", notes: "末尾" })];
  assert.deepEqual(transfer.parseNoteOperationsImport(transfer.exportNoteScheduleCsv(items), "backup.csv").schedule, items);
});

test("broken CSV quoting is rejected instead of silently discarding rows", () => {
  assert.throws(() => transfer.parseNoteOperationsImport('date,title\n2026-10-01,"unfinished', "backup.csv"));
});

test("impossible imported dates are rejected before a schedule replacement", () => {
  assert.throws(() => transfer.parseNoteOperationsImport('date,title\n2026-02-30,記事', "backup.csv"));
  assert.throws(() => transfer.parseNoteOperationsImport(JSON.stringify({schema: "aas-note-operations-v1", schedule: [null]}), "backup.json"));
  assert.throws(() => transfer.parseNoteOperationsImport('date,title\n' + '2026-10-01,記事\n'.repeat(501), "backup.csv"));
  assert.throws(() => transfer.parseNoteOperationsImport(JSON.stringify({schema: "aas-note-operations-v1", schedule: Array(501).fill({date:"2026-10-01",title:"記事"})}), "backup.json"));
});

test("side-hustle storage failures return a failure result without interrupting the wizard", () => {
  const definition = getSideHustleDefinition("content-sales");
  globalThis.window = { get localStorage() { throw new Error("SecurityError"); } };
  try {
    assert.equal(progress.hasStoredSideHustleDraft("owner", definition), false);
    assert.deepEqual(progress.readSideHustleDraft("owner", definition), initialSideHustleDraft(definition));
    assert.equal(progress.writeSideHustleDraft("owner", definition, initialSideHustleDraft(definition)), false);
    assert.equal(progress.clearSideHustleDraft("owner", definition), false);
  } finally { delete globalThis.window; }
});

test("side-hustle drafts preserve custom inputs and remain owner and feature scoped", () => {
  const storage = new Map();
  globalThis.window = { localStorage: { getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) } };
  try {
    const definition = getSideHustleDefinition("content-sales");
    const draft = initialSideHustleDraft(definition);
    draft.step = 4;
    draft.resultText = "保存した結果";
    draft.values[definition.fields[0].key] = { selected: "__custom__", custom: "独自条件" };
    progress.writeSideHustleDraft("owner", definition, draft);
    assert.deepEqual(progress.readSideHustleDraft("owner", definition), draft);
    assert.equal(progress.readSideHustleDraft("other", definition).resultText, "");
    assert.equal(progress.readSideHustleDraft("owner", getSideHustleDefinition("resale")).resultText, "");
  } finally { delete globalThis.window; }
});

test("notification inbox rejects external and browser-normalized external paths", () => {
  for (const href of ["//example.org", "/\\example.org", "/\n/example.org", "https://example.org"]) {
    const inbox = normalizeNotificationInbox({ notifications: [{ id: 1, title: "通知", href }] });
    assert.equal(inbox.notifications[0].href, "/notifications", href);
  }
  assert.equal(normalizeNotificationInbox({ notifications: [{ id: 1, title: "通知", href: "/tools?q=a#b" }] }).notifications[0].href, "/tools?q=a#b");
});

test("push click revalidates old notification destinations before navigation", async () => {
  const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
  const handlers = new Map();
  let destination;
  const self = { location: { origin: "https://aas.example" },
    addEventListener: (type, handler) => handlers.set(type, handler),
    clients: { matchAll: async () => [], openWindow: async (url) => { destination = url; } } };
  vm.runInNewContext(source, { self, URL });
  for (const href of ["//example.org", "/\\example.org", "https://example.org", null]) {
    let task;
    handlers.get("notificationclick")({ notification: { close() {}, data: { href } }, waitUntil: (promise) => { task = promise; } });
    await task;
    assert.equal(destination, "https://aas.example/notifications");
  }
});

test("schedule replacement uses one atomic owner-checked RPC without a delete fallback", async () => {
  const calls = [];
  const client = { rpc: async (name, args) => { calls.push({ name, args }); return { data: [{ id: "saved" }], error: null }; } };
  assert.deepEqual(await replaceNoteScheduleAtomically(client, "owner", [scheduleItem()], "2026-10"), [{ id: "saved" }]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, "replace_my_note_schedule_v1");
  assert.equal(calls[0].args.p_expected_user_id, "owner");
  assert.equal(calls[0].args.p_target_month, "2026-10-01");
  assert.equal(calls[0].args.p_items[0].user_id, undefined);
  const failed = { rpc: async () => ({ data: null, error: { message: "offline" } }) };
  await assert.rejects(() => replaceNoteScheduleAtomically(failed, "owner", [scheduleItem()]));
});

test("empty, oversized and invalid replacements cannot call the database", async () => {
  const client = { rpc: () => { assert.fail("invalid input reached the database"); } };
  for (const items of [[], Array.from({ length: 501 }, () => scheduleItem()), [scheduleItem({ scheduledDate: "2026-02-30" })]]) {
    await assert.rejects(() => replaceNoteScheduleAtomically(client, "owner", items));
  }
  await assert.rejects(() => replaceNoteScheduleAtomically(client, "owner", [scheduleItem()], "2026-11"));
});

test("sign-out invalidates in-flight access results while same-session requests are deduplicated", async () => {
  let resolveOld;
  let calls = 0;
  const loader = createSessionRequestLoader(() => { calls += 1; return new Promise((resolve) => { resolveOld = resolve; }); });
  const first = loader.load({});
  const shared = loader.load({});
  assert.equal(calls, 1);
  loader.invalidate();
  resolveOld({ kind: "ready", owner: "previous-account" });
  assert.equal(await first, undefined);
  assert.equal(await shared, undefined);
});

test("old auth failures cannot overwrite a newer account and do not clear its pending request", async () => {
  const pending = [];
  const loader = createSessionRequestLoader(() => new Promise((resolve, reject) => pending.push({ resolve, reject })));
  const previous = loader.load({});
  loader.invalidate();
  const current = loader.load({});
  pending[0].reject(new Error("old request failed"));
  assert.equal(await previous, undefined);
  const shared = loader.load({});
  assert.equal(pending.length, 2);
  pending[1].resolve({ kind: "ready", owner: "current-account" });
  assert.deepEqual(await current, { kind: "ready", owner: "current-account" });
  assert.deepEqual(await shared, await current);
  const failure = loader.load({});
  pending[2].reject(new Error("current request failed"));
  await assert.rejects(failure, /current request failed/);
});
