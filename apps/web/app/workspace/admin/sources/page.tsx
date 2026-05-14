"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ExternalLink, Globe2, ShieldAlert, SquarePen } from "lucide-react";

type AdminSource = {
  id: string;
  title: string;
  publisher: string;
  jurisdiction: string;
  url: string;
  sourceType: string;
  reviewedAt: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  confidenceStatus: string;
  notes: string | null;
  language: string | null;
  retrievedAt: string | null;
  versionLabel: string | null;
  updatedAt: string;
};

type SourceFormState = {
  title: string;
  publisher: string;
  jurisdiction: string;
  url: string;
  sourceType: string;
  confidenceStatus: string;
  reviewedAt: string;
  effectiveFrom: string;
  effectiveTo: string;
  language: string;
  retrievedAt: string;
  versionLabel: string;
  notes: string;
};

const DEFAULT_FORM: SourceFormState = {
  title: "",
  publisher: "",
  jurisdiction: "EU",
  url: "",
  sourceType: "eu_guidance",
  confidenceStatus: "draft",
  reviewedAt: "",
  effectiveFrom: "",
  effectiveTo: "",
  language: "",
  retrievedAt: "",
  versionLabel: "",
  notes: ""
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readNullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
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
    publisher: readString(value.publisher, "unknown"),
    jurisdiction: readString(value.jurisdiction, "EU"),
    url: readString(value.url),
    sourceType: readString(value.sourceType, "other"),
    reviewedAt: readNullableString(value.reviewedAt),
    effectiveFrom: readNullableString(value.effectiveFrom),
    effectiveTo: readNullableString(value.effectiveTo),
    confidenceStatus: readString(value.confidenceStatus, "draft"),
    notes: readNullableString(value.notes),
    language: readNullableString(value.language),
    retrievedAt: readNullableString(value.retrievedAt),
    versionLabel: readNullableString(value.versionLabel),
    updatedAt: readString(value.updatedAt)
  };
}

function toForm(source: AdminSource): SourceFormState {
  return {
    title: source.title,
    publisher: source.publisher,
    jurisdiction: source.jurisdiction,
    url: source.url,
    sourceType: source.sourceType,
    confidenceStatus: source.confidenceStatus,
    reviewedAt: source.reviewedAt ?? "",
    effectiveFrom: source.effectiveFrom ?? "",
    effectiveTo: source.effectiveTo ?? "",
    language: source.language ?? "",
    retrievedAt: source.retrievedAt ?? "",
    versionLabel: source.versionLabel ?? "",
    notes: source.notes ?? ""
  };
}

export default function WorkspaceAdminSourcesPage() {
  const [sources, setSources] = useState<AdminSource[]>([]);
  const [form, setForm] = useState<SourceFormState>(DEFAULT_FORM);
  const [selectedSourceId, setSelectedSourceId] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  const selectedSource = useMemo(
    () => sources.find((source) => source.id === selectedSourceId) ?? null,
    [selectedSourceId, sources]
  );

  const filteredSources = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return sources.filter((source) => {
      const matchesStatus =
        statusFilter === "all" || source.confidenceStatus === statusFilter;
      const matchesSearch =
        !normalizedSearch ||
        source.title.toLowerCase().includes(normalizedSearch) ||
        source.publisher.toLowerCase().includes(normalizedSearch) ||
        source.jurisdiction.toLowerCase().includes(normalizedSearch);

      return matchesStatus && matchesSearch;
    });
  }, [search, sources, statusFilter]);

  async function loadSources() {
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
          "Platform administrator access is required. Workspace roles cannot manage the platform source register."
        );
        return;
      }

      const response = await fetch("/api/local/admin/sources", {
        cache: "no-store"
      });
      const data = await readBody(response);

      if (!response.ok) {
        setMessage(getErrorMessage(data, "Could not load source references."));
        return;
      }

      setSources(
        isRecord(data) && Array.isArray(data.sources)
          ? data.sources
              .map((source) => normalizeSource(source))
              .filter((source): source is AdminSource => source !== null)
          : []
      );
    } catch {
      setMessage("The source register API is unavailable.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadSources();
  }, []);

  async function submitForm() {
    setMessage("");

    const payload = {
      ...form,
      reviewedAt: form.reviewedAt || null,
      effectiveFrom: form.effectiveFrom || null,
      effectiveTo: form.effectiveTo || null,
      language: form.language || null,
      retrievedAt: form.retrievedAt || null,
      versionLabel: form.versionLabel || null,
      notes: form.notes || null
    };
    const isPatch = Boolean(selectedSource);
    const response = await fetch(
      isPatch
        ? `/api/local/admin/sources/${encodeURIComponent(selectedSourceId)}`
        : "/api/local/admin/sources",
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
      setMessage(getErrorMessage(data, "Could not save source reference."));
      return;
    }

    setSelectedSourceId("");
    setForm(DEFAULT_FORM);
    setMessage(isPatch ? "Source reference updated." : "Source reference created.");
    await loadSources();
  }

  async function deprecateSource(source: AdminSource) {
    const response = await fetch(
      `/api/local/admin/sources/${encodeURIComponent(source.id)}/deprecate`,
      {
        method: "POST"
      }
    );
    const data = await readBody(response);

    if (!response.ok) {
      setMessage(getErrorMessage(data, "Could not deprecate source reference."));
      return;
    }

    setMessage("Source reference deprecated.");
    await loadSources();
  }

  return (
    <div className="workspace-page">
      <section className="workspace-page-head">
        <p className="workspace-kicker">Platform admin</p>
        <h2>Source register.</h2>
        <p>
          Manage metadata-only public source references for traceability. The
          register stores source labels, URLs, review notes, dates, and status;
          it does not scrape legal text or turn a source link into legal, tax,
          accounting, filing, or authority certainty.
        </p>
      </section>

      <section className="admin-console-tabs">
        <a href="/workspace/admin/rules">Rules</a>
        <a href="/workspace/admin/sources" className="is-active">
          <Globe2 size={16} />
          Sources
        </a>
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
                    "This source register is unavailable to regular workspace roles."}
              </p>
            </div>
          </div>
        </section>
      ) : (
        <>
          <section className="workspace-stat-strip">
            <div className="workspace-stat">
              <p>Sources</p>
              <strong>{sources.length}</strong>
              <span>Platform-managed source reference records.</span>
            </div>
            <div className="workspace-stat">
              <p>Reviewed</p>
              <strong>
                {
                  sources.filter(
                    (source) => source.confidenceStatus === "reviewed"
                  ).length
                }
              </strong>
              <span>Reviewed metadata, not official endorsement.</span>
            </div>
            <div className="workspace-stat">
              <p>Suspended/deprecated</p>
              <strong>
                {
                  sources.filter((source) =>
                    ["suspended", "deprecated"].includes(source.confidenceStatus)
                  ).length
                }
              </strong>
              <span>Sources kept for historical traceability.</span>
            </div>
            <div className="workspace-stat">
              <p>Remote fetch</p>
              <strong>None</strong>
              <span>No source crawling or SSRF surface is introduced.</span>
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
                <p>Source form</p>
                <h3>{selectedSource ? "Edit source" : "Create source"}</h3>
              </div>
              <button type="button" onClick={() => {
                setSelectedSourceId("");
                setForm(DEFAULT_FORM);
              }}>
                New source
              </button>
            </div>

            <div className="workspace-form-grid">
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
                <span>Publisher</span>
                <input
                  value={form.publisher}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      publisher: event.target.value
                    }))
                  }
                />
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
                <span>URL</span>
                <input
                  value={form.url}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, url: event.target.value }))
                  }
                  placeholder="https://..."
                />
              </label>
              <label>
                <span>Source type</span>
                <select
                  value={form.sourceType}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      sourceType: event.target.value
                    }))
                  }
                >
                  {[
                    "eu_law",
                    "eu_guidance",
                    "national_tax_authority",
                    "national_einvoicing_authority",
                    "standard",
                    "peppol",
                    "vies",
                    "country_pack",
                    "legal_notice",
                    "other"
                  ].map((sourceType) => (
                    <option key={sourceType} value={sourceType}>
                      {formatLabel(sourceType)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Status</span>
                <select
                  value={form.confidenceStatus}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      confidenceStatus: event.target.value
                    }))
                  }
                >
                  <option value="draft">Draft</option>
                  <option value="reviewed">Reviewed</option>
                  <option value="professional_review_required">
                    Professional review required
                  </option>
                  <option value="deprecated">Deprecated</option>
                  <option value="suspended">Suspended</option>
                </select>
              </label>
              <label>
                <span>Reviewed at</span>
                <input
                  type="date"
                  value={form.reviewedAt}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      reviewedAt: event.target.value
                    }))
                  }
                />
              </label>
              <label>
                <span>Retrieved at</span>
                <input
                  type="date"
                  value={form.retrievedAt}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      retrievedAt: event.target.value
                    }))
                  }
                />
              </label>
              <label>
                <span>Effective from</span>
                <input
                  type="date"
                  value={form.effectiveFrom}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      effectiveFrom: event.target.value
                    }))
                  }
                />
              </label>
              <label>
                <span>Effective to</span>
                <input
                  type="date"
                  value={form.effectiveTo}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      effectiveTo: event.target.value
                    }))
                  }
                />
              </label>
              <label>
                <span>Language</span>
                <input
                  value={form.language}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      language: event.target.value
                    }))
                  }
                />
              </label>
              <label>
                <span>Version label</span>
                <input
                  value={form.versionLabel}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      versionLabel: event.target.value
                    }))
                  }
                />
              </label>
              <label className="workspace-form-wide">
                <span>Notes</span>
                <textarea
                  value={form.notes}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, notes: event.target.value }))
                  }
                />
              </label>
            </div>
            <div className="workspace-row-actions">
              <button type="button" onClick={() => void submitForm()}>
                <SquarePen size={16} />
                {selectedSource ? "Update source" : "Create source"}
              </button>
              <span className="admin-inline-warning">
                <AlertTriangle size={14} />
                Metadata only; source text is not fetched or stored.
              </span>
            </div>
          </section>

          <section className="workspace-table-shell">
            <div className="workspace-table-head">
              <div>
                <p>Register</p>
                <h3>Source references</h3>
              </div>
              <div className="workspace-row-actions">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search title, publisher, jurisdiction"
                />
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <option value="all">All statuses</option>
                  {[
                    "draft",
                    "reviewed",
                    "professional_review_required",
                    "deprecated",
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
                  <Globe2 size={18} />
                  <div>
                    <strong>Loading sources</strong>
                    <p>Reading source register metadata.</p>
                  </div>
                  <span>loading</span>
                </div>
              ) : filteredSources.length === 0 ? (
                <div className="finding-console-row">
                  <AlertTriangle size={18} />
                  <div>
                    <strong>No sources</strong>
                    <p>No source references matched the active filters.</p>
                  </div>
                  <span>empty</span>
                </div>
              ) : (
                filteredSources.map((source) => (
                  <div className="finding-console-row" key={source.id}>
                    <Globe2 size={18} />
                    <div>
                      <strong>{source.title}</strong>
                      <p>
                        {source.publisher} - {source.jurisdiction} -{" "}
                        {formatLabel(source.sourceType)} -{" "}
                        {formatLabel(source.confidenceStatus)}
                      </p>
                      <p>
                        Reviewed: {source.reviewedAt ?? "not set"}. Effective:{" "}
                        {source.effectiveFrom ?? "not set"} to{" "}
                        {source.effectiveTo ?? "open"}.
                      </p>
                      <p>{source.notes ?? "No source notes recorded."}</p>
                    </div>
                    <span>{source.confidenceStatus}</span>
                    <div className="admin-row-actions">
                      <a
                        href={source.url}
                        rel="noreferrer"
                        target="_blank"
                        title="Open source URL"
                      >
                        <ExternalLink size={15} />
                      </a>
                      <button
                        type="button"
                        title="Edit source"
                        onClick={() => {
                          setSelectedSourceId(source.id);
                          setForm(toForm(source));
                        }}
                      >
                        <SquarePen size={15} />
                      </button>
                      <button
                        type="button"
                        title="Deprecate source"
                        onClick={() => void deprecateSource(source)}
                      >
                        <AlertTriangle size={15} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

