"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpenCheck,
  Database,
  Layers3,
  ShieldAlert
} from "lucide-react";

type RuleSource = {
  sourceName: string;
  sourceType: string;
  jurisdiction?: string;
};

type RuleCatalogRule = {
  code: string;
  title: string;
  description: string;
  category: string;
  severity: string;
  fieldPath?: string;
  fixSuggestion?: string;
  legalConfidence: string;
  ruleSetCode: string;
  ruleVersion: string;
  sourceLabels: string[];
  sources: RuleSource[];
};

type RuleCatalogRuleSet = {
  code: string;
  name: string;
  description: string;
  version: string;
  legalConfidence: string;
  rules: RuleCatalogRule[];
};

type RuleCatalogResponse = {
  ruleSets?: unknown[];
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readStringField(
  record: Record<string, unknown>,
  key: string,
  fallback = ""
) {
  const value = record[key];

  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : fallback;
}

function readStringArrayField(record: Record<string, unknown>, key: string) {
  const value = record[key];

  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function readResponseBody(response: Response) {
  const responseText = await response.text();

  if (!responseText.trim()) {
    return null;
  }

  try {
    return JSON.parse(responseText) as unknown;
  } catch {
    return responseText;
  }
}

function getApiErrorMessage(
  data: unknown,
  fallback = "The validation rules request failed."
) {
  if (typeof data === "string" && data.trim().length > 0) {
    return data.slice(0, 240);
  }

  if (!isPlainObject(data) || !isPlainObject(data.error)) {
    return fallback;
  }

  const message = data.error.message;

  return typeof message === "string" && message.trim().length > 0
    ? message
    : fallback;
}

function formatStatus(status: string) {
  return status.replaceAll("_", " ");
}

function formatLegalConfidence(value: string) {
  const labels: Record<string, string> = {
    technical: "Technical",
    standard_based: "Standard-based",
    official_source_derived: "Source-derived",
    educational_simulation: "Educational simulation",
    professional_review_required: "Professional review required"
  };

  return labels[value] ?? formatStatus(value || "not labelled");
}

function normalizeSource(value: unknown): RuleSource | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const sourceName = readStringField(value, "sourceName");

  if (!sourceName) {
    return null;
  }

  return {
    sourceName,
    sourceType: readStringField(value, "sourceType", "public_reference"),
    jurisdiction: readStringField(value, "jurisdiction")
  };
}

function normalizeRule(value: unknown): RuleCatalogRule | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const code = readStringField(value, "code");

  if (!code) {
    return null;
  }

  return {
    code,
    title: readStringField(value, "title", code),
    description: readStringField(value, "description"),
    category: readStringField(value, "category", "CANONICAL"),
    severity: readStringField(value, "severity", "info"),
    fieldPath: readStringField(value, "fieldPath"),
    fixSuggestion: readStringField(value, "fixSuggestion"),
    legalConfidence: readStringField(value, "legalConfidence", "technical"),
    ruleSetCode: readStringField(value, "ruleSetCode"),
    ruleVersion: readStringField(value, "ruleVersion"),
    sourceLabels: readStringArrayField(value, "sourceLabels"),
    sources: Array.isArray(value.sources)
      ? value.sources
          .map((source) => normalizeSource(source))
          .filter((source): source is RuleSource => source !== null)
      : []
  };
}

function normalizeRuleSet(value: unknown): RuleCatalogRuleSet | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const code = readStringField(value, "code");

  if (!code) {
    return null;
  }

  return {
    code,
    name: readStringField(value, "name", code),
    description: readStringField(value, "description"),
    version: readStringField(value, "version"),
    legalConfidence: readStringField(value, "legalConfidence", "technical"),
    rules: Array.isArray(value.rules)
      ? value.rules
          .map((rule) => normalizeRule(rule))
          .filter((rule): rule is RuleCatalogRule => rule !== null)
      : []
  };
}

export default function WorkspaceValidationRulesPage() {
  const [ruleSets, setRuleSets] = useState<RuleCatalogRuleSet[]>([]);
  const [isLoadingRules, setIsLoadingRules] = useState(true);
  const [rulesMessage, setRulesMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadRuleCatalog() {
      setIsLoadingRules(true);
      setRulesMessage("");

      try {
        const response = await fetch("/api/local/validation/rules", {
          method: "GET",
          cache: "no-store"
        });
        const responseData = await readResponseBody(response);

        if (!response.ok) {
          if (isMounted) {
            setRuleSets([]);
            setRulesMessage(
              getApiErrorMessage(
                responseData,
                "Could not load the published validation rules."
              )
            );
          }

          return;
        }

        const apiData = responseData as RuleCatalogResponse;
        const normalizedRuleSets = Array.isArray(apiData.ruleSets)
          ? apiData.ruleSets
              .map((ruleSet) => normalizeRuleSet(ruleSet))
              .filter((ruleSet): ruleSet is RuleCatalogRuleSet => ruleSet !== null)
          : [];

        if (isMounted) {
          setRuleSets(normalizedRuleSets);
        }
      } catch {
        if (isMounted) {
          setRuleSets([]);
          setRulesMessage(
            "The local validation rules API is unavailable. Make sure apps/api and apps/web are both running."
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingRules(false);
        }
      }
    }

    loadRuleCatalog();

    return () => {
      isMounted = false;
    };
  }, []);

  const allRules = useMemo(
    () => ruleSets.flatMap((ruleSet) => ruleSet.rules),
    [ruleSets]
  );
  const categories = useMemo(
    () => [...new Set(allRules.map((rule) => rule.category))].sort(),
    [allRules]
  );

  return (
    <div className="workspace-page">
      <section className="workspace-page-head">
        <p className="workspace-kicker">Validation rules</p>
        <h2>Review the technical sandbox rule catalog.</h2>
        <p>
          These are Invoice Lantern current technical and sandbox validation
          rules. They are not legal, tax, or accounting advice. Country and legal
          rules will come later and require reviewed sources.
        </p>
      </section>

      <section className="workspace-stat-strip">
        <div className="workspace-stat">
          <p>Published sets</p>
          <strong>{ruleSets.length}</strong>
          <span>Rule sets exposed through the read-only catalog endpoint.</span>
        </div>

        <div className="workspace-stat">
          <p>Published rules</p>
          <strong>{allRules.length}</strong>
          <span>Technical findings currently linked to rule metadata.</span>
        </div>

        <div className="workspace-stat">
          <p>Categories</p>
          <strong>{categories.length}</strong>
          <span>{categories.length > 0 ? categories.join(", ") : "Loading"}</span>
        </div>

        <div className="workspace-stat">
          <p>Boundary</p>
          <strong>SBX</strong>
          <span>Independent readiness sandbox, not official validation.</span>
        </div>
      </section>

      <section className="workspace-alerts">
        <div className="alerts-head">
          <ShieldAlert size={22} />

          <div>
            <p>Safe use</p>
            <h3>Professional review remains required where appropriate.</h3>
          </div>
        </div>

        <div className="alert-list">
          <div className="alert-item">
            <span />
            <p>
              The catalog describes technical validation and generated finding
              metadata for sandbox use only.
            </p>
          </div>

          <div className="alert-item">
            <span />
            <p>
              It does not certify Peppol, EN 16931, ViDA, tax authority, legal,
              tax, or accounting outcomes.
            </p>
          </div>
        </div>
      </section>

      <section className="workspace-table-shell">
        <div className="workspace-table-head">
          <div>
            <p>Published catalog</p>
            <h3>Validation rule sets</h3>
          </div>

          <div className="confidence-label">
            <BookOpenCheck size={17} />
            read only
          </div>
        </div>

        {rulesMessage ? (
          <div className="alert-item">
            <span />
            <p>{rulesMessage}</p>
          </div>
        ) : null}

        <div className="workspace-data-grid">
          {isLoadingRules ? (
            <div className="workspace-data-card is-full">
              <p>Loading</p>
              <strong>Reading validation rules from the local API proxy.</strong>
              <span>Only API-owned rule catalog data is displayed here.</span>
            </div>
          ) : ruleSets.length === 0 ? (
            <div className="workspace-data-card is-full">
              <p>No published rules</p>
              <strong>No validation rule sets were returned.</strong>
              <span>
                The API may be unavailable or no published rule sets exist yet.
              </span>
            </div>
          ) : (
            ruleSets.map((ruleSet) => (
              <div className="workspace-data-card is-wide" key={ruleSet.code}>
                <p>{ruleSet.code}</p>
                <strong>{ruleSet.name}</strong>
                <span>
                  Version {ruleSet.version}. Confidence:{" "}
                  {formatLegalConfidence(ruleSet.legalConfidence)}. Rules:{" "}
                  {ruleSet.rules.length}.
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="findings-console">
        <div className="findings-console-head">
          <div>
            <p>Rules</p>
            <h3>Finding metadata</h3>
          </div>

          <div className="confidence-label">
            <Layers3 size={17} />
            versioned
          </div>
        </div>

        <div className="finding-console-list">
          {isLoadingRules ? (
            <div className="finding-console-row">
              <Database size={18} />

              <div>
                <strong>RULE_CATALOG_LOADING</strong>
                <p>Loading the published validation rule catalog.</p>
              </div>

              <span>info</span>
            </div>
          ) : allRules.length === 0 ? (
            <div className="finding-console-row">
              <AlertTriangle size={18} />

              <div>
                <strong>NO_RULES_RETURNED</strong>
                <p>No published validation rules are available from the API.</p>
              </div>

              <span>warning</span>
            </div>
          ) : (
            allRules.map((rule) => (
              <div className="finding-console-row" key={rule.code}>
                <BookOpenCheck size={18} />

                <div>
                  <strong>{rule.code}</strong>
                  <p>{rule.title}</p>
                  <p>
                    Category: {rule.category}. Field:{" "}
                    {rule.fieldPath || "rule-level"}. Rule set:{" "}
                    {rule.ruleSetCode}. Version: {rule.ruleVersion}.
                  </p>
                  <p>
                    Legal confidence:{" "}
                    {formatLegalConfidence(rule.legalConfidence)}. Sources:{" "}
                    {rule.sourceLabels.length > 0
                      ? rule.sourceLabels.join(", ")
                      : "No source label"}.
                  </p>
                  {rule.fixSuggestion ? (
                    <p>Fix suggestion: {rule.fixSuggestion}</p>
                  ) : null}
                </div>

                <span>{rule.severity}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
