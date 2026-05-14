"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  BookOpenCheck,
  Eye,
  FileWarning,
  Send,
  ShieldAlert,
  ShieldCheck,
  SquarePen,
  ToggleLeft
} from "lucide-react";

type AdminRule = {
  id: string;
  code: string;
  title: string;
  description: string;
  message: string;
  category: string;
  severity: string;
  legalConfidence: string;
  checkType: string | null;
  layer: string | null;
  jurisdiction: string;
  countryCode: string | null;
  ruleSet: string;
  ruleVersion: string;
  status: string;
  sourceRefIds: string[];
  sourceCount: number;
  fixSuggestion: string | null;
  professionalReviewRequired: boolean;
  internalNotes: string | null;
  updatedAt: string;
  catalogSource: string;
};

type AdminSource = {
  id: string;
  title: string;
  jurisdiction: string;
  sourceType: string;
  confidenceStatus: string;
};

type RuleFormState = {
  code: string;
  title: string;
  description: string;
  message: string;
  category: string;
  severity: string;
  legalConfidence: string;
  checkType: string;
  layer: string;
  jurisdiction: string;
  countryCode: string;
  ruleSet: string;
  ruleVersion: string;
  sourceRefIds: string[];
  fixSuggestion: string;
  professionalReviewRequired: boolean;
  internalNotes: string;
};

const DEFAULT_FORM: RuleFormState = {
  code: "",
  title: "",
  description: "",
  message: "",
  category: "CANONICAL",
  severity: "warning",
  legalConfidence: "technical",
  checkType: "",
  layer: "",
  jurisdiction: "EU",
  countryCode: "",
  ruleSet: "INVOICE_LANTERN_ADMIN_RULES",
  ruleVersion: "2026.05.1",
  sourceRefIds: [],
  fixSuggestion: "",
  professionalReviewRequired: true,
  internalNotes: ""
};

const LEGAL_SOURCE_REQUIRED_CATEGORIES = new Set([
  "VAT_ID",
  "VIES",
  "EN16931",
  "PEPPOL",
  "COUNTRY_PACK",
  "VIDA_SIMULATION",
  "LEGAL_LABEL"
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readNullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

function normalizeRule(value: unknown): AdminRule | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = readString(value.id);

  if (!id) {
    return null;
  }

  return {
    id,
    code: readString(value.code),
    title: readString(value.title),
    description: readString(value.description),
    message: readString(value.message),
    category: readString(value.category, "OTHER"),
    severity: readString(value.severity, "warning"),
    legalConfidence: readString(value.legalConfidence, "technical"),
    checkType: readNullableString(value.checkType),
    layer: readNullableString(value.layer),
    jurisdiction: readString(value.jurisdiction, "EU"),
    countryCode: readNullableString(value.countryCode),
    ruleSet: readString(value.ruleSet, "INVOICE_LANTERN_ADMIN_RULES"),
    ruleVersion: readString(value.ruleVersion),
    status: readString(value.status, "draft"),
    sourceRefIds: readStringArray(value.sourceRefIds),
    sourceCount:
      typeof value.sourceCount === "number" ? value.sourceCount : 0,
    fixSuggestion: readNullableString(value.fixSuggestion),
    professionalReviewRequired: value.professionalReviewRequired !== false,
    internalNotes: readNullableString(value.internalNotes),
    updatedAt: readString(value.updatedAt),
    catalogSource: readString(value.catalogSource, "admin")
  };
}

function normalizeSource(value: unknown): AdminSource | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = readString(value.id);

  if (!id) {
    return null;
  }

  return {
    id,
    title: readString(value.title, id),
    jurisdiction: readString(value.jurisdiction, "EU"),
    sourceType: readString(value.sourceType, "other"),
    confidenceStatus: readString(value.confidenceStatus, "draft")
  };
}

async function readBody(response: Response) {
  const text = await response.text();

  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function getErrorMessage(data: unknown, fallback: string) {
  if (isRecord(data) && isRecord(data.error)) {
    return readString(data.error.message, fallback);
  }

  return fallback;
}

function toForm(rule: AdminRule): RuleFormState {
  return {
    code: rule.code,
    title: rule.title,
    description: rule.description,
    message: rule.message,
    category: rule.category,
    severity: rule.severity,
    legalConfidence: rule.legalConfidence,
    checkType: rule.checkType ?? "",
    layer: rule.layer ?? "",
    jurisdiction: rule.jurisdiction,
    countryCode: rule.countryCode ?? "",
    ruleSet: rule.ruleSet,
    ruleVersion: rule.ruleVersion,
    sourceRefIds: rule.sourceRefIds,
    fixSuggestion: rule.fixSuggestion ?? "",
    professionalReviewRequired: rule.professionalReviewRequired,
    internalNotes: rule.internalNotes ?? ""
  };
}

function requiresSource(form: Pick<RuleFormState, "category" | "legalConfidence" | "professionalReviewRequired">) {
  return (
    form.legalConfidence !== "technical" ||
    form.professionalReviewRequired ||
    LEGAL_SOURCE_REQUIRED_CATEGORIES.has(form.category)
  );
}

export default function WorkspaceAdminRulesPage() {
  const [rules, setRules] = useState<AdminRule[]>([]);
  const [sources, setSources] = useState<AdminSource[]>([]);
  const [form, setForm] = useState<RuleFormState>(DEFAULT_FORM);
  const [selectedRuleId, setSelectedRuleId] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  const selectedRule = useMemo(
    () => rules.find((rule) => rule.id === selectedRuleId) ?? null,
    [rules, selectedRuleId]
  );

  const canEditSelected =
    selectedRule?.catalogSource === "admin" &&
    (selectedRule.status === "draft" || selectedRule.status === "review");

  const filteredRules = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return rules.filter((rule) => {
      const matchesStatus =
        statusFilter === "all" || rule.status === statusFilter;
      const matchesSearch =
        !normalizedSearch ||
        rule.code.toLowerCase().includes(normalizedSearch) ||
        rule.title.toLowerCase().includes(normalizedSearch) ||
        rule.category.toLowerCase().includes(normalizedSearch);

      return matchesStatus && matchesSearch;
    });
  }, [rules, search, statusFilter]);

  async function loadConsole() {
    setIsLoading(true);
    setMessage("");

    try {
      const contextResponse = await fetch("/api/local/admin/context", {
        cache: "no-store"
      });
      const contextData = await readBody(contextResponse);

      if (!contextResponse.ok) {
        setIsPlatformAdmin(false);
        setMessage(
          getErrorMessage(
            contextData,
            "Sign in with a platform-admin account to use this console."
          )
        );
        return;
      }

      const admin =
        isRecord(contextData) && contextData.isPlatformAdmin === true;

      setIsPlatformAdmin(admin);

      if (!admin) {
        setMessage(
          "Platform administrator access is required. Workspace owner or admin role alone cannot publish platform rule intelligence."
        );
        return;
      }

      const [ruleResponse, sourceResponse] = await Promise.all([
        fetch("/api/local/admin/rules", { cache: "no-store" }),
        fetch("/api/local/admin/sources", { cache: "no-store" })
      ]);
      const [ruleData, sourceData] = await Promise.all([
        readBody(ruleResponse),
        readBody(sourceResponse)
      ]);

      if (!ruleResponse.ok) {
        setMessage(getErrorMessage(ruleData, "Could not load admin rules."));
        return;
      }

      if (!sourceResponse.ok) {
        setMessage(
          getErrorMessage(sourceData, "Could not load source references.")
        );
        return;
      }

      setRules(
        isRecord(ruleData) && Array.isArray(ruleData.rules)
          ? ruleData.rules
              .map((rule) => normalizeRule(rule))
              .filter((rule): rule is AdminRule => rule !== null)
          : []
      );
      setSources(
        isRecord(sourceData) && Array.isArray(sourceData.sources)
          ? sourceData.sources
              .map((source) => normalizeSource(source))
              .filter((source): source is AdminSource => source !== null)
          : []
      );
    } catch {
      setMessage("The admin console API is unavailable.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadConsole();
  }, []);

  async function submitForm() {
    setMessage("");

    const payload = {
      ...form,
      countryCode: form.countryCode || null,
      checkType: form.checkType || null,
      layer: form.layer || null,
      message: form.message || null,
      fixSuggestion: form.fixSuggestion || null,
      internalNotes: form.internalNotes || null
    };
    const isPatch = Boolean(selectedRule && canEditSelected);
    const response = await fetch(
      isPatch
        ? `/api/local/admin/rules/${encodeURIComponent(selectedRuleId)}`
        : "/api/local/admin/rules",
      {
        method: isPatch ? "PATCH" : "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(payload)
      }
    );
    const data = await readBody(response);

    if (!response.ok) {
      setMessage(
        getErrorMessage(data, "Could not save validation rule metadata.")
      );
      return;
    }

    setForm(DEFAULT_FORM);
    setSelectedRuleId("");
    setMessage(isPatch ? "Rule metadata updated." : "Draft rule created.");
    await loadConsole();
  }

  async function runAction(rule: AdminRule, action: string) {
    setMessage("");

    const response = await fetch(
      `/api/local/admin/rules/${encodeURIComponent(rule.id)}/${action}`,
      {
        method: "POST"
      }
    );
    const data = await readBody(response);

    if (!response.ok) {
      setMessage(getErrorMessage(data, `Could not ${action} rule.`));
      return;
    }

    setMessage(`Rule ${action.replace("-", " ")} completed.`);
    await loadConsole();
  }

  return (
    <div className="workspace-page">
      <section className="workspace-page-head">
        <p className="workspace-kicker">Platform admin</p>
        <h2>Validation rule intelligence.</h2>
        <p>
          Manage source-linked, versioned rule metadata for Invoice Lantern
          technical validation and educational simulation. Published metadata is
          not official law, tax advice, accounting advice, filing, authority
          acceptance, Peppol certification, EN 16931 certification, or ViDA
          compliance.
        </p>
      </section>

      <section className="admin-console-tabs">
        <a href="/workspace/admin/rules" className="is-active">
          <BookOpenCheck size={16} />
          Rules
        </a>
        <a href="/workspace/admin/sources">Sources</a>
        <a href="/workspace/admin/country-packs">Country packs</a>
      </section>

      {!isPlatformAdmin ? (
        <section className="workspace-alerts">
          <div className="alerts-head">
            <ShieldAlert size={22} />
            <div>
              <p>Access restricted</p>
              <h3>Platform administrator required.</h3>
            </div>
          </div>
          <div className="alert-list">
            <div className="alert-item">
              <span />
              <p>
                {isLoading
                  ? "Checking platform-admin access."
                  : message ||
                    "This console is unavailable to regular workspace roles."}
              </p>
            </div>
          </div>
        </section>
      ) : (
        <>
          <section className="workspace-stat-strip">
            <div className="workspace-stat">
              <p>Total rules</p>
              <strong>{rules.length}</strong>
              <span>Published catalog plus admin-managed drafts.</span>
            </div>
            <div className="workspace-stat">
              <p>Draft/review</p>
              <strong>
                {
                  rules.filter(
                    (rule) => rule.status === "draft" || rule.status === "review"
                  ).length
                }
              </strong>
              <span>Editable rule metadata awaiting source review.</span>
            </div>
            <div className="workspace-stat">
              <p>Sources</p>
              <strong>{sources.length}</strong>
              <span>Platform source references available for linking.</span>
            </div>
            <div className="workspace-stat">
              <p>Boundary</p>
              <strong>Non-official</strong>
              <span>Source links support traceability, not legal certainty.</span>
            </div>
          </section>

          <section className="workspace-alerts">
            <div className="alerts-head">
              <ShieldCheck size={22} />
              <div>
                <p>Publishing guard</p>
                <h3>No source means no legal or tax-like rule.</h3>
              </div>
            </div>
            <div className="alert-list">
              <div className="alert-item">
                <span />
                <p>
                  Publishing is disabled for legal, tax, VIES, country-pack,
                  Peppol-style, EN 16931-style, or ViDA-simulation metadata
                  until at least one source reference is linked.
                </p>
              </div>
            </div>
          </section>

          {message ? (
            <section className="workspace-alerts">
              <div className="alert-list">
                <div className="alert-item">
                  <span />
                  <p>{message}</p>
                </div>
              </div>
            </section>
          ) : null}

          <section className="workspace-table-shell">
            <div className="workspace-table-head">
              <div>
                <p>Rule form</p>
                <h3>{canEditSelected ? "Edit draft/review" : "Create draft"}</h3>
              </div>
              <button type="button" onClick={() => {
                setForm(DEFAULT_FORM);
                setSelectedRuleId("");
              }}>
                New draft
              </button>
            </div>

            <div className="workspace-form-grid">
              <label>
                <span>Code</span>
                <input
                  value={form.code}
                  disabled={canEditSelected}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, code: event.target.value }))
                  }
                  placeholder="VAT_RATE_SOURCE_REQUIRED"
                />
              </label>
              <label>
                <span>Title</span>
                <input
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, title: event.target.value }))
                  }
                />
              </label>
              <label>
                <span>Rule set</span>
                <input
                  value={form.ruleSet}
                  disabled={canEditSelected}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      ruleSet: event.target.value
                    }))
                  }
                />
              </label>
              <label>
                <span>Version</span>
                <input
                  value={form.ruleVersion}
                  disabled={canEditSelected}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      ruleVersion: event.target.value
                    }))
                  }
                />
              </label>
              <label>
                <span>Category</span>
                <select
                  value={form.category}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      category: event.target.value
                    }))
                  }
                >
                  {[
                    "CANONICAL",
                    "CALCULATION",
                    "SCHEMA",
                    "UBL",
                    "CII",
                    "EN16931",
                    "PEPPOL",
                    "VAT_ID",
                    "VIES",
                    "COUNTRY_PACK",
                    "VIDA_SIMULATION",
                    "API",
                    "SECURITY",
                    "LEGAL_LABEL",
                    "OTHER"
                  ].map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Severity</span>
                <select
                  value={form.severity}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      severity: event.target.value
                    }))
                  }
                >
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="fatal">Fatal</option>
                </select>
              </label>
              <label>
                <span>Legal confidence</span>
                <select
                  value={form.legalConfidence}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      legalConfidence: event.target.value
                    }))
                  }
                >
                  <option value="technical">Technical</option>
                  <option value="standard_based">Standard-based</option>
                  <option value="official_source_derived">Source-derived</option>
                  <option value="educational_simulation">
                    Educational simulation
                  </option>
                  <option value="professional_review_required">
                    Professional review required
                  </option>
                </select>
              </label>
              <label>
                <span>Jurisdiction</span>
                <input
                  value={form.jurisdiction}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      jurisdiction: event.target.value
                    }))
                  }
                />
              </label>
              <label>
                <span>Country code</span>
                <input
                  value={form.countryCode}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      countryCode: event.target.value.toUpperCase()
                    }))
                  }
                  placeholder="Optional"
                />
              </label>
              <label>
                <span>Check type</span>
                <input
                  value={form.checkType}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      checkType: event.target.value
                    }))
                  }
                />
              </label>
              <label>
                <span>Layer</span>
                <input
                  value={form.layer}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, layer: event.target.value }))
                  }
                />
              </label>
              <label className="workspace-form-wide">
                <span>Source links</span>
                <select
                  multiple
                  value={form.sourceRefIds}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      sourceRefIds: Array.from(
                        event.currentTarget.selectedOptions
                      ).map((option) => option.value)
                    }))
                  }
                >
                  {sources.map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.title} - {source.jurisdiction} -{" "}
                      {formatLabel(source.confidenceStatus)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="workspace-form-wide">
                <span>Description</span>
                <textarea
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      description: event.target.value
                    }))
                  }
                />
              </label>
              <label className="workspace-form-wide">
                <span>Message</span>
                <textarea
                  value={form.message}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      message: event.target.value
                    }))
                  }
                />
              </label>
              <label className="workspace-form-wide">
                <span>Fix suggestion</span>
                <textarea
                  value={form.fixSuggestion}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      fixSuggestion: event.target.value
                    }))
                  }
                />
              </label>
              <label className="workspace-form-wide">
                <span>Internal notes</span>
                <textarea
                  value={form.internalNotes}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      internalNotes: event.target.value
                    }))
                  }
                />
              </label>
              <label className="checkbox-line">
                <input
                  type="checkbox"
                  checked={form.professionalReviewRequired}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      professionalReviewRequired: event.target.checked
                    }))
                  }
                />
                <span>Professional review required</span>
              </label>
            </div>

            <div className="workspace-row-actions">
              <button type="button" onClick={() => void submitForm()}>
                <SquarePen size={16} />
                {canEditSelected ? "Update rule" : "Create draft"}
              </button>
              {requiresSource(form) && form.sourceRefIds.length === 0 ? (
                <span className="admin-inline-warning">
                  <AlertTriangle size={14} />
                  Link a source before publishing this rule type.
                </span>
              ) : null}
            </div>
          </section>

          <section className="workspace-table-shell">
            <div className="workspace-table-head">
              <div>
                <p>Rule catalog</p>
                <h3>Validation rule metadata</h3>
              </div>
              <div className="workspace-row-actions">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search code, title, category"
                />
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <option value="all">All statuses</option>
                  {[
                    "draft",
                    "review",
                    "published",
                    "deprecated",
                    "archived",
                    "disabled",
                    "suspended"
                  ].map((status) => (
                    <option key={status} value={status}>
                      {formatLabel(status)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="finding-console-list">
              {isLoading ? (
                <div className="finding-console-row">
                  <BookOpenCheck size={18} />
                  <div>
                    <strong>Loading rules</strong>
                    <p>Reading platform-admin rule metadata.</p>
                  </div>
                  <span>loading</span>
                </div>
              ) : filteredRules.length === 0 ? (
                <div className="finding-console-row">
                  <FileWarning size={18} />
                  <div>
                    <strong>No matching rules</strong>
                    <p>No validation rule metadata matched the active filters.</p>
                  </div>
                  <span>empty</span>
                </div>
              ) : (
                filteredRules.map((rule) => {
                  const publishBlocked =
                    isLegalOrTaxRule(rule) && rule.sourceCount === 0;

                  return (
                    <div className="finding-console-row" key={rule.id}>
                      <BookOpenCheck size={18} />
                      <div>
                        <strong>{rule.code}</strong>
                        <p>{rule.title}</p>
                        <p>
                          {rule.category} - {rule.severity} -{" "}
                          {formatLabel(rule.status)} - version{" "}
                          {rule.ruleVersion}
                        </p>
                        <p>
                          Sources: {rule.sourceCount}. Legal confidence:{" "}
                          {formatLabel(rule.legalConfidence)}. Catalog:{" "}
                          {rule.catalogSource}.
                        </p>
                      </div>
                      <span>{rule.status}</span>
                      <div className="admin-row-actions">
                        <button
                          type="button"
                          title="Load rule"
                          onClick={() => {
                            setSelectedRuleId(rule.id);
                            setForm(toForm(rule));
                          }}
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          type="button"
                          title="Submit for review"
                          disabled={
                            rule.catalogSource !== "admin" ||
                            rule.status !== "draft"
                          }
                          onClick={() => void runAction(rule, "submit-review")}
                        >
                          <Send size={15} />
                        </button>
                        <button
                          type="button"
                          title="Publish"
                          disabled={
                            rule.catalogSource !== "admin" ||
                            !["draft", "review"].includes(rule.status) ||
                            publishBlocked
                          }
                          onClick={() => void runAction(rule, "publish")}
                        >
                          <ShieldCheck size={15} />
                        </button>
                        <button
                          type="button"
                          title="Deprecate"
                          disabled={rule.catalogSource !== "admin"}
                          onClick={() => void runAction(rule, "deprecate")}
                        >
                          <Archive size={15} />
                        </button>
                        <button
                          type="button"
                          title="Disable"
                          disabled={rule.catalogSource !== "admin"}
                          onClick={() => void runAction(rule, "disable")}
                        >
                          <ToggleLeft size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function isLegalOrTaxRule(rule: AdminRule) {
  return (
    rule.legalConfidence !== "technical" ||
    rule.professionalReviewRequired ||
    LEGAL_SOURCE_REQUIRED_CATEGORIES.has(rule.category)
  );
}

