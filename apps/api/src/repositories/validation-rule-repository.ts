import {
  CORE_VALIDATION_RULE_SET_CODE,
  CORE_VALIDATION_RULE_VERSION,
  listCoreValidationRuleCatalog,
  type LegalConfidence,
  type ValidationFindingSeverity,
  type ValidationRuleCategory,
  type ValidationRuleSetMetadata,
  type ValidationRuleSourceType,
  type ValidationRuleStatus
} from "@invoice-lantern/invoice-core";
import {
  getSupabaseServiceRoleClient,
  hasSupabaseServerConfig
} from "../lib/supabase/server-client.js";
import { listVatFormatValidationRuleCatalog } from "../services/vat-format-validation-findings.js";

export type ValidationRuleCatalogSource = {
  sourceName: string;
  sourceType: ValidationRuleSourceType;
  jurisdiction?: string;
};

export type ValidationRuleCatalogRule = {
  code: string;
  title: string;
  description: string;
  category: ValidationRuleCategory;
  severity: ValidationFindingSeverity;
  fieldPath?: string;
  messageTemplate: string;
  fixSuggestion?: string;
  legalConfidence: LegalConfidence;
  ruleSetCode: string;
  ruleVersion: string;
  sourceLabels: string[];
  sources: ValidationRuleCatalogSource[];
};

export type ValidationRuleCatalogRuleSet = {
  code: string;
  name: string;
  description: string;
  version: string;
  legalConfidence: LegalConfidence;
  rules: ValidationRuleCatalogRule[];
};

export type ValidationRuleCatalog = {
  ruleSets: ValidationRuleCatalogRuleSet[];
};

export type ValidationRuleSetRow = {
  id: string;
  code: string;
  name: string;
  description: string;
  version: string;
  status: ValidationRuleStatus;
  legal_confidence: LegalConfidence;
};

export type ValidationRuleRow = {
  id: string;
  rule_set_id: string;
  code: string;
  title: string;
  description: string;
  category: ValidationRuleCategory;
  severity: ValidationFindingSeverity;
  field_path: string | null;
  message_template: string;
  fix_suggestion: string | null;
  legal_confidence: LegalConfidence;
  version: string;
  status: ValidationRuleStatus;
};

export type ValidationRuleSourceRow = {
  rule_id: string;
  source_name: string;
  source_type: ValidationRuleSourceType;
  jurisdiction: string | null;
};

function toCatalogRuleSets(
  ruleSets: ValidationRuleSetMetadata[]
): ValidationRuleCatalogRuleSet[] {
  return ruleSets
    .filter((ruleSet) => ruleSet.status === "published")
    .map((ruleSet) => ({
      code: ruleSet.code,
      name: ruleSet.name,
      description: ruleSet.description,
      version: ruleSet.version,
      legalConfidence: ruleSet.legalConfidence,
      rules: ruleSet.rules
        .filter((rule) => rule.status === "published")
        .map((rule) => ({
          code: rule.code,
          title: rule.title,
          description: rule.description,
          category: rule.category,
          severity: rule.severity,
          ...(rule.fieldPath ? { fieldPath: rule.fieldPath } : {}),
          messageTemplate: rule.messageTemplate,
          ...(rule.fixSuggestion ? { fixSuggestion: rule.fixSuggestion } : {}),
          legalConfidence: rule.legalConfidence,
          ruleSetCode: rule.ruleSetCode,
          ruleVersion: rule.version,
          sourceLabels: [...rule.sourceLabels],
          sources: rule.sources.map((source) => ({
            sourceName: source.sourceName,
            sourceType: source.sourceType,
            jurisdiction: source.jurisdiction
          }))
        }))
    }));
}

export function mergeRuleCatalogWithBundledFallback(
  catalog: ValidationRuleCatalog,
  ruleSets: ValidationRuleSetMetadata[]
): ValidationRuleCatalog {
  const staticRuleSets = toCatalogRuleSets(ruleSets);
  const staticRuleSetsByCode = new Map(
    staticRuleSets.map((ruleSet) => [ruleSet.code, ruleSet])
  );
  const mergedRuleSets = catalog.ruleSets.map((ruleSet) => {
    const staticRuleSet = staticRuleSetsByCode.get(ruleSet.code);

    if (
      ruleSet.code === CORE_VALIDATION_RULE_SET_CODE &&
      staticRuleSet &&
      ruleSet.version !== CORE_VALIDATION_RULE_VERSION
    ) {
      return staticRuleSet;
    }

    return ruleSet;
  });
  const existingCodes = new Set(mergedRuleSets.map((ruleSet) => ruleSet.code));
  const missingRuleSets = staticRuleSets.filter(
    (ruleSet) => !existingCodes.has(ruleSet.code)
  );

  return {
    ruleSets: [...mergedRuleSets, ...missingRuleSets]
  };
}

function toStaticRuleCatalog(): ValidationRuleCatalog {
  return {
    ruleSets: toCatalogRuleSets([
      ...listCoreValidationRuleCatalog(),
      ...listVatFormatValidationRuleCatalog()
    ])
  };
}

export function buildRuleCatalogFromRows(
  ruleSetRows: ValidationRuleSetRow[],
  ruleRows: ValidationRuleRow[],
  sourceRows: ValidationRuleSourceRow[]
): ValidationRuleCatalog {
  const publishedRuleSets = ruleSetRows.filter(
    (ruleSet) => ruleSet.status === "published"
  );
  const publishedRuleSetIds = new Set(
    publishedRuleSets.map((ruleSet) => ruleSet.id)
  );
  const sourcesByRuleId = new Map<string, ValidationRuleCatalogSource[]>();

  for (const source of sourceRows) {
    const existingSources = sourcesByRuleId.get(source.rule_id) ?? [];
    const catalogSource: ValidationRuleCatalogSource = {
      sourceName: source.source_name,
      sourceType: source.source_type
    };

    if (source.jurisdiction) {
      catalogSource.jurisdiction = source.jurisdiction;
    }

    existingSources.push(catalogSource);
    sourcesByRuleId.set(source.rule_id, existingSources);
  }

  return {
    ruleSets: publishedRuleSets.map((ruleSet) => {
      const rules = ruleRows
        .filter(
          (rule) =>
            rule.status === "published" &&
            rule.rule_set_id === ruleSet.id &&
            publishedRuleSetIds.has(rule.rule_set_id)
        )
        .map((rule) => {
          const sources = sourcesByRuleId.get(rule.id) ?? [];
          const catalogRule: ValidationRuleCatalogRule = {
            code: rule.code,
            title: rule.title,
            description: rule.description,
            category: rule.category,
            severity: rule.severity,
            messageTemplate: rule.message_template,
            legalConfidence: rule.legal_confidence,
            ruleSetCode: ruleSet.code,
            ruleVersion: rule.version,
            sourceLabels: sources.map((source) => source.sourceName),
            sources
          };

          if (rule.field_path) {
            catalogRule.fieldPath = rule.field_path;
          }

          if (rule.fix_suggestion) {
            catalogRule.fixSuggestion = rule.fix_suggestion;
          }

          return catalogRule;
        });

      return {
        code: ruleSet.code,
        name: ruleSet.name,
        description: ruleSet.description,
        version: ruleSet.version,
        legalConfidence: ruleSet.legal_confidence,
        rules
      };
    })
  };
}

async function listDatabasePublishedValidationRules() {
  const supabase = getSupabaseServiceRoleClient();

  const { data: ruleSetData, error: ruleSetError } = await supabase
    .from("validation_rule_sets")
    .select("id, code, name, description, version, status, legal_confidence")
    .eq("status", "published")
    .order("code", {
      ascending: true
    });

  if (ruleSetError) {
    throw new Error(
      `Could not list validation rule sets: ${ruleSetError.message}`
    );
  }

  const ruleSets = (ruleSetData ?? []) as ValidationRuleSetRow[];
  const ruleSetIds = ruleSets.map((ruleSet) => ruleSet.id);

  if (ruleSetIds.length === 0) {
    return {
      ruleSets: []
    };
  }

  const { data: ruleData, error: ruleError } = await supabase
    .from("validation_rules")
    .select(
      "id, rule_set_id, code, title, description, category, severity, field_path, message_template, fix_suggestion, legal_confidence, version, status"
    )
    .in("rule_set_id", ruleSetIds)
    .eq("status", "published")
    .order("code", {
      ascending: true
    });

  if (ruleError) {
    throw new Error(`Could not list validation rules: ${ruleError.message}`);
  }

  const rules = (ruleData ?? []) as ValidationRuleRow[];
  const ruleIds = rules.map((rule) => rule.id);

  if (ruleIds.length === 0) {
    return buildRuleCatalogFromRows(ruleSets, [], []);
  }

  const { data: sourceData, error: sourceError } = await supabase
    .from("validation_rule_sources")
    .select("rule_id, source_name, source_type, jurisdiction")
    .in("rule_id", ruleIds)
    .order("source_name", {
      ascending: true
    });

  if (sourceError) {
    throw new Error(
      `Could not list validation rule sources: ${sourceError.message}`
    );
  }

  return buildRuleCatalogFromRows(
    ruleSets,
    rules,
    (sourceData ?? []) as ValidationRuleSourceRow[]
  );
}

export async function listPublishedValidationRules() {
  const staticCatalog = toStaticRuleCatalog();

  if (!hasSupabaseServerConfig()) {
    return staticCatalog;
  }

  try {
    return mergeRuleCatalogWithBundledFallback(
      await listDatabasePublishedValidationRules(),
      [...listCoreValidationRuleCatalog(), ...listVatFormatValidationRuleCatalog()]
    );
  } catch (error) {
    console.warn(
      "Database validation rule catalog was unavailable; using bundled rule catalog.",
      error
    );

    return staticCatalog;
  }
}
