import assert from "node:assert/strict";
import { test } from "node:test";
import { buildRuleCatalogFromRows } from "./validation-rule-repository.js";

test("rule catalog repository exposes only published rule sets and rules", () => {
  const catalog = buildRuleCatalogFromRows(
    [
      {
        id: "set_published",
        code: "PUBLISHED_SET",
        name: "Published rule set",
        description: "Published validation rule set.",
        version: "2026.04.1",
        status: "published",
        legal_confidence: "technical"
      },
      {
        id: "set_draft",
        code: "DRAFT_SET",
        name: "Draft rule set",
        description: "Draft validation rule set.",
        version: "2026.04.1",
        status: "draft",
        legal_confidence: "technical"
      }
    ],
    [
      {
        id: "rule_published",
        rule_set_id: "set_published",
        code: "PUBLISHED_RULE",
        title: "Published rule",
        description: "Published validation rule.",
        category: "CANONICAL",
        severity: "fatal",
        field_path: "document.number",
        message_template: "Document number is required.",
        fix_suggestion: "Add the document number.",
        legal_confidence: "technical",
        version: "2026.04.1",
        status: "published"
      },
      {
        id: "rule_suspended",
        rule_set_id: "set_published",
        code: "SUSPENDED_RULE",
        title: "Suspended rule",
        description: "Suspended validation rule.",
        category: "CANONICAL",
        severity: "warning",
        field_path: null,
        message_template: "Suspended.",
        fix_suggestion: null,
        legal_confidence: "technical",
        version: "2026.04.1",
        status: "suspended"
      },
      {
        id: "rule_draft_set",
        rule_set_id: "set_draft",
        code: "DRAFT_SET_RULE",
        title: "Draft set rule",
        description: "Rule in draft set.",
        category: "CANONICAL",
        severity: "warning",
        field_path: null,
        message_template: "Draft.",
        fix_suggestion: null,
        legal_confidence: "technical",
        version: "2026.04.1",
        status: "published"
      }
    ],
    [
      {
        rule_id: "rule_published",
        source_name: "Invoice Lantern internal technical validation policy",
        source_type: "internal_technical_policy",
        jurisdiction: "platform"
      }
    ]
  );

  assert.equal(catalog.ruleSets.length, 1);
  assert.equal(catalog.ruleSets[0]?.code, "PUBLISHED_SET");
  assert.equal(catalog.ruleSets[0]?.rules.length, 1);
  assert.equal(catalog.ruleSets[0]?.rules[0]?.code, "PUBLISHED_RULE");
  assert.equal(catalog.ruleSets[0]?.rules[0]?.ruleSetCode, "PUBLISHED_SET");
  assert.deepEqual(catalog.ruleSets[0]?.rules[0]?.sourceLabels, [
    "Invoice Lantern internal technical validation policy"
  ]);
});
