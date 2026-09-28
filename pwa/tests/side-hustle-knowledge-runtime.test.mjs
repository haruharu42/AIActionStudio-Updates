import assert from "node:assert/strict";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true, hmr: false },
});
after(() => vite.close());

const catalog = await vite.ssrLoadModule("/features/side-hustles/catalog.ts");
const builder = await vite.ssrLoadModule("/features/side-hustles/prompt-builder.ts");
const scenario = await vite.ssrLoadModule("/features/side-hustles/scenario-knowledge.ts");
const combination = await vite.ssrLoadModule("/features/side-hustles/combination-knowledge.ts");

function allowedValues(field) {
  return new Set(field.options.map((option) => option.value));
}

function chooseExpected(value) {
  return Array.isArray(value) ? value[0] : value;
}

test("all 12 side-hustles have six real dropdown fields and six matching scenario rules", () => {
  assert.equal(catalog.SIDE_HUSTLE_DEFINITIONS.length, 12);
  assert.equal(new Set(catalog.SIDE_HUSTLE_DEFINITIONS.map((item) => item.slug)).size, 12);

  for (const definition of catalog.SIDE_HUSTLE_DEFINITIONS) {
    assert.equal(definition.fields.length, 6, definition.slug + " should keep six focused inputs");
    assert.equal(
      new Set(definition.fields.map((field) => field.key)).size,
      definition.fields.length,
      definition.slug + " field keys must be unique",
    );

    const rules = scenario.SIDE_HUSTLE_SCENARIO_KNOWLEDGE[definition.slug] ?? [];
    assert.equal(rules.length, definition.fields.length, definition.slug + " scenario rules must cover every input");

    const fieldKeys = new Set(definition.fields.map((field) => field.key));
    assert.equal(new Set(rules.map((rule) => rule.fieldKey)).size, rules.length);
    for (const rule of rules) {
      assert.ok(fieldKeys.has(rule.fieldKey), definition.slug + " scenario rule references unknown field " + rule.fieldKey);
      assert.ok(rule.guidance.length > 0, definition.slug + " scenario guidance must not be empty");
    }
  }
});

test("every curated combination references selectable values from its own wizard", () => {
  for (const definition of catalog.SIDE_HUSTLE_DEFINITIONS) {
    const rules = combination.SIDE_HUSTLE_COMBINATION_KNOWLEDGE[definition.slug] ?? [];
    assert.equal(rules.length, 5, definition.slug + " should keep five curated combinations");

    const fields = new Map(definition.fields.map((field) => [field.key, field]));
    for (const rule of rules) {
      assert.ok(Object.keys(rule.when).length >= 2, definition.slug + "/" + rule.key + " must be a real multi-condition rule");
      for (const [fieldKey, expected] of Object.entries(rule.when)) {
        const field = fields.get(fieldKey);
        assert.ok(field, definition.slug + "/" + rule.key + " references unknown field " + fieldKey);
        const allowed = allowedValues(field);
        const values = Array.isArray(expected) ? expected : [expected];
        for (const value of values) {
          assert.ok(
            allowed.has(value),
            definition.slug + "/" + rule.key + " references unavailable option " + fieldKey + "=" + value,
          );
        }
      }
    }
  }
});

test("default side-hustle selections inject scenario knowledge for all six inputs", () => {
  for (const definition of catalog.SIDE_HUSTLE_DEFINITIONS) {
    const draft = builder.initialSideHustleDraft(definition);
    const result = builder.buildSideHustlePrompt(definition, draft);

    assert.match(result.prompt, /【状況別副業KNOWLEDGE】/, definition.slug);
    assert.equal(
      result.appliedKnowledge.filter((label) => label.startsWith("状況別: ")).length,
      6,
      definition.slug + " should apply six scenario rules to complete defaults",
    );
    assert.match(result.prompt, /【最終出力ルール】/);
    assert.match(result.prompt, /最新の公式情報を確認/);
  }
});

test("at least one curated combination can actually fire for every side-hustle", () => {
  for (const definition of catalog.SIDE_HUSTLE_DEFINITIONS) {
    const rule = combination.SIDE_HUSTLE_COMBINATION_KNOWLEDGE[definition.slug]?.[0];
    assert.ok(rule, "missing first combination for " + definition.slug);

    const draft = builder.initialSideHustleDraft(definition);
    for (const [fieldKey, expected] of Object.entries(rule.when)) {
      draft.values[fieldKey] = {
        selected: chooseExpected(expected),
        custom: "",
      };
    }

    const result = builder.buildSideHustlePrompt(definition, draft);
    assert.match(result.prompt, /【複合条件KNOWLEDGE】/, definition.slug);
    assert.ok(
      result.appliedKnowledge.includes("複合: " + rule.label),
      definition.slug + " first curated combination should be applied",
    );
  }
});

test("side-hustle prompts keep task-specific Knowledge and safety instead of collapsing to a generic prompt", () => {
  const prompts = new Set();
  for (const definition of catalog.SIDE_HUSTLE_DEFINITIONS) {
    const draft = builder.initialSideHustleDraft(definition);
    const result = builder.buildSideHustlePrompt(definition, draft);
    prompts.add(result.prompt);

    assert.ok(result.appliedKnowledge.length >= 6, definition.slug + " should expose applied Knowledge");
    assert.match(result.prompt, /実体験・実績・資格・レビュー・売上・使用経験を事実として作らない/);
    assert.match(result.prompt, /一般論の水増しをしない/);
  }
  assert.equal(prompts.size, 12, "all side-hustles should produce distinct prompts");
});
