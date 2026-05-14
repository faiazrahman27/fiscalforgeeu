"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Globe2, Link2, ShieldAlert, ShieldCheck, SquarePen, Unlink } from "lucide-react";

type AdminSource = {
  id: string;
  title: string;
  jurisdiction: string;
  confidenceStatus: string;
};

type CountryPackReview = {
  countryCode: string;
  reviewStatus: string;
  legalConfidence: string;
  reviewNotes: string | null;
  sourceRefIds: string[];
  sourceCount: number;
  reviewedAt: string | null;
  reviewerLabel: string | null;
  versionLabel: string | null;
  professionalReviewRequired: boolean;
  warnings: string[];
};

type CountryPackAdminRecord = {
  countryCode: string;
  countryName: string;
  packageStatus: string;
  packageVersion: string;
  packageLegalConfidence: string;
  euMemberState: boolean;
  sourceCoverageSummary: Record<string, unknown>;
  packageSourceCount: number;
  packageRuleCount: number;
  packageWarnings: unknown[];
  review: CountryPackReview | null;
  reviewSourceCount: number;
  sourceReferences: AdminSource[];
  professionalReviewRequired: boolean;
  grElCompatibilityNote: string | null;
  disclaimer: string;
};

type ReviewFormState = {
  reviewStatus: string;
  legalConfidence: string;
  reviewNotes: string;
  sourceRefIds: string[];
  reviewedAt: string;
  reviewerLabel: string;
  versionLabel: string;
  professionalReviewRequired: boolean;
  warningsText: string;
};

const DEFAULT_FORM: ReviewFormState = {
  reviewStatus: "professional_review_required",
  legalConfidence: "professional_review_required",
  reviewNotes: "",
  sourceRefIds: [],
  reviewedAt: "",
  reviewerLabel: "",
  versionLabel: "",
  professionalReviewRequired: true,
  warningsText: ""
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

function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
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
    jurisdiction: readString(value.jurisdiction, "EU"),
    confidenceStatus: readString(value.confidenceStatus, "draft")
  };
}

function normalizeReview(value: unknown): CountryPackReview | null {
  if (!isRecord(value)) {
    return null;
  }

  const countryCode = readString(value.countryCode);

  if (!countryCode) {
    return null;
  }

  return {
    countryCode,
    reviewStatus: readString(value.reviewStatus, "professional_review_required"),
    legalConfidence: readString(
      value.legalConfidence,
      "professional_review_required"
    ),
    reviewNotes: readNullableString(value.reviewNotes),
    sourceRefIds: readStringArray(value.sourceRefIds),
    sourceCount:
      typeof value.sourceCount === "number" ? value.sourceCount : 0,
    reviewedAt: readNullableString(value.reviewedAt),
    reviewerLabel: readNullableString(value.reviewerLabel),
    versionLabel: readNullableString(value.versionLabel),
    professionalReviewRequired: value.professionalReviewRequired !== false,
    warnings: readStringArray(value.warnings)
  };
}

function normalizeCountryPack(value: unknown): CountryPackAdminRecord | null {
  if (!isRecord(value)) {
    return null;
  }

  const countryCode = readString(value.countryCode);

  if (!countryCode) {
    return null;
  }

  return {
    countryCode,
    countryName: readString(value.countryName, countryCode),
    packageStatus: readString(value.packageStatus, "unknown"),
    packageVersion: readString(value.packageVersion, "unversioned"),
    packageLegalConfidence: readString(
      value.packageLegalConfidence,
      "professional_review_required"
    ),
    euMemberState: value.euMemberState === true,
    sourceCoverageSummary: isRecord(value.sourceCoverageSummary)
      ? value.sourceCoverageSummary
      : {},
    packageSourceCount:
      typeof value.packageSourceCount === "number" ? value.packageSourceCount : 0,
    packageRuleCount:
      typeof value.packageRuleCount === "number" ? value.packageRuleCount : 0,
    packageWarnings: Array.isArray(value.packageWarnings)
      ? value.packageWarnings
      : [],
    review: normalizeReview(value.review),
    reviewSourceCount:
      typeof value.reviewSourceCount === "number" ? value.reviewSourceCount : 0,
    sourceReferences: Array.isArray(value.sourceReferences)
      ? value.sourceReferences
          .map((source) => normalizeSource(source))
          .filter((source): source is AdminSource => source !== null)
      : [],
    professionalReviewRequired: value.professionalReviewRequired !== false,
    grElCompatibilityNote: readNullableString(value.grElCompatibilityNote),
    disclaimer: readString(value.disclaimer)
  };
}

function toForm(pack: CountryPackAdminRecord): ReviewFormState {
  const review = pack.review;

  return {
    reviewStatus: review?.reviewStatus ?? "professional_review_required",
    legalConfidence:
      review?.legalConfidence ?? pack.packageLegalConfidence,
    reviewNotes: review?.reviewNotes ?? "",
    sourceRefIds: review?.sourceRefIds ?? [],
    reviewedAt: review?.reviewedAt ?? "",
    reviewerLabel: review?.reviewerLabel ?? "",
    versionLabel: review?.versionLabel ?? "",
    professionalReviewRequired:
      review?.professionalReviewRequired ??
      pack.professionalReviewRequired,
    warningsText: review?.warnings.join("\n") ?? ""
  };
}

function reviewNeedsSource(form: ReviewFormState) {
  return (
    form.reviewStatus === "reviewed" ||
    form.professionalReviewRequired === false ||
    form.legalConfidence === "standard_based" ||
    form.legalConfidence === "official_source_derived"
  );
}

export default function WorkspaceAdminCountryPacksPage() {
  const [countryPacks, setCountryPacks] = useState<CountryPackAdminRecord[]>([]);
  const [sources, setSources] = useState<AdminSource[]>([]);
  const [selectedCountryCode, setSelectedCountryCode] = useState("EU");
  const [form, setForm] = useState<ReviewFormState>(DEFAULT_FORM);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [linkSourceId, setLinkSourceId] = useState("");

  const selectedCountryPack = useMemo(
    () =>
      countryPacks.find((pack) => pack.countryCode === selectedCountryCode) ??
      countryPacks.find((pack) => pack.countryCode === "EU") ??
      null,
    [countryPacks, selectedCountryCode]
  );

  const filteredPacks = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return countryPacks.filter(
      (pack) =>
        !normalizedSearch ||
        pack.countryCode.toLowerCase().includes(normalizedSearch) ||
        pack.countryName.toLowerCase().includes(normalizedSearch) ||
        pack.packageStatus.toLowerCase().includes(normalizedSearch)
    );
  }, [countryPacks, search]);

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
          "Platform administrator access is required. Workspace roles cannot review platform country-pack metadata."
        );
        return;
      }

      const [packResponse, sourceResponse] = await Promise.all([
        fetch("/api/local/admin/country-packs", { cache: "no-store" }),
        fetch("/api/local/admin/sources", { cache: "no-store" })
      ]);
      const [packData, sourceData] = await Promise.all([
        readBody(packResponse),
        readBody(sourceResponse)
      ]);

      if (!packResponse.ok) {
        setMessage(getErrorMessage(packData, "Could not load country packs."));
        return;
      }

      if (!sourceResponse.ok) {
        setMessage(getErrorMessage(sourceData, "Could not load sources."));
        return;
      }

      const normalizedPacks =
        isRecord(packData) && Array.isArray(packData.countryPacks)
          ? packData.countryPacks
              .map((pack) => normalizeCountryPack(pack))
              .filter(
                (pack): pack is CountryPackAdminRecord => pack !== null
              )
          : [];

      setCountryPacks(normalizedPacks);
      setSources(
        isRecord(sourceData) && Array.isArray(sourceData.sources)
          ? sourceData.sources
              .map((source) => normalizeSource(source))
              .filter((source): source is AdminSource => source !== null)
          : []
      );

      const selected =
        normalizedPacks.find((pack) => pack.countryCode === selectedCountryCode) ??
        normalizedPacks.find((pack) => pack.countryCode === "EU") ??
        null;

      if (selected) {
        setSelectedCountryCode(selected.countryCode);
        setForm(toForm(selected));
      }
    } catch {
      setMessage("The country-pack admin API is unavailable.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadConsole();
  }, []);

  function selectPack(pack: CountryPackAdminRecord) {
    setSelectedCountryCode(pack.countryCode);
    setForm(toForm(pack));
  }

  async function saveReview() {
    if (!selectedCountryPack) {
      return;
    }

    setMessage("");

    const payload = {
      reviewStatus: form.reviewStatus,
      legalConfidence: form.legalConfidence,
      reviewNotes: form.reviewNotes || null,
      sourceRefIds: form.sourceRefIds,
      reviewedAt: form.reviewedAt || null,
      reviewerLabel: form.reviewerLabel || null,
      versionLabel: form.versionLabel || null,
      professionalReviewRequired: form.professionalReviewRequired,
      warnings: form.warningsText
        .split("\n")
        .map((warning) => warning.trim())
        .filter(Boolean),
      metadata: {}
    };
    const response = await fetch(
      `/api/local/admin/country-packs/${encodeURIComponent(
        selectedCountryPack.countryCode
      )}/review`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(payload)
      }
    );
    const data = await readBody(response);

    if (!response.ok) {
      setMessage(
        getErrorMessage(data, "Could not update country-pack review metadata.")
      );
      return;
    }

    setMessage("Country-pack review metadata updated.");
    await loadConsole();
  }

  async function linkSource() {
    if (!selectedCountryPack || !linkSourceId) {
      return;
    }

    const response = await fetch(
      `/api/local/admin/country-packs/${encodeURIComponent(
        selectedCountryPack.countryCode
      )}/sources`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          sourceRefId: linkSourceId,
          linkType: "reviewed_against"
        })
      }
    );
    const data = await readBody(response);

    if (!response.ok) {
      setMessage(getErrorMessage(data, "Could not link source."));
      return;
    }

    setLinkSourceId("");
    setMessage("Country-pack source linked.");
    await loadConsole();
  }

  async function unlinkSource(sourceId: string) {
    if (!selectedCountryPack) {
      return;
    }

    const response = await fetch(
      `/api/local/admin/country-packs/${encodeURIComponent(
        selectedCountryPack.countryCode
      )}/sources/${encodeURIComponent(sourceId)}`,
      {
        method: "DELETE"
      }
    );
    const data = await readBody(response);

    if (!response.ok) {
      setMessage(getErrorMessage(data, "Could not unlink source."));
      return;
    }

    setMessage("Country-pack source unlinked.");
    await loadConsole();
  }

  return (
    <div className="workspace-page">
      <section className="workspace-page-head">
        <p className="workspace-kicker">Platform admin</p>
        <h2>Country-pack review metadata.</h2>
        <p>
          Review source coverage and platform notes for EU core plus all 27 EU
          country-pack simulations. This console stores metadata overlays only;
          it does not mutate static country-pack code, invent VAT rates, or
          imply tax authority endorsement.
        </p>
      </section>

      <section className="admin-console-tabs">
        <a href="/workspace/admin/rules">Rules</a>
        <a href="/workspace/admin/sources">Sources</a>
        <a href="/workspace/admin/country-packs" className="is-active">
          <Globe2 size={16} />
          Country packs
        </a>
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
                    "This country-pack review console is unavailable to regular workspace roles."}
              </p>
            </div>
          </div>
        </section>
      ) : (
        <>
          <section className="workspace-stat-strip">
            <div className="workspace-stat">
              <p>Total packs</p>
              <strong>{countryPacks.length}</strong>
              <span>EU core and EU Member State simulations.</span>
            </div>
            <div className="workspace-stat">
              <p>EU member states</p>
              <strong>
                {countryPacks.filter((pack) => pack.euMemberState).length}
              </strong>
              <span>EL remains VAT-prefix compatibility, not a pack.</span>
            </div>
            <div className="workspace-stat">
              <p>Review overlays</p>
              <strong>
                {countryPacks.filter((pack) => pack.review !== null).length}
              </strong>
              <span>Metadata overlays stored separately from package code.</span>
            </div>
            <div className="workspace-stat">
              <p>Boundary</p>
              <strong>Simulation</strong>
              <span>Professional review remains required where unknown.</span>
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
                <p>Country catalogue</p>
                <h3>Package status and review overlays</h3>
              </div>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search country, code, status"
              />
            </div>

            <div className="workspace-data-grid">
              {isLoading ? (
                <div className="workspace-data-card is-full">
                  <p>Loading</p>
                  <strong>Reading country-pack review metadata.</strong>
                  <span>Package data remains code-owned.</span>
                </div>
              ) : filteredPacks.length === 0 ? (
                <div className="workspace-data-card is-full">
                  <p>No matching packs</p>
                  <strong>No country pack matched the active search.</strong>
                  <span>Clear the search to see EU core and all 27 countries.</span>
                </div>
              ) : (
                filteredPacks.map((pack) => (
                  <button
                    className="workspace-data-card is-wide"
                    key={pack.countryCode}
                    type="button"
                    onClick={() => selectPack(pack)}
                  >
                    <p>{pack.countryCode}</p>
                    <strong>{pack.countryName}</strong>
                    <span>
                      Package: {formatLabel(pack.packageStatus)} - version{" "}
                      {pack.packageVersion}
                    </span>
                    <span>
                      Review:{" "}
                      {formatLabel(
                        pack.review?.reviewStatus ??
                          "professional_review_required"
                      )}
                      . Sources: {pack.reviewSourceCount}.
                    </span>
                  </button>
                ))
              )}
            </div>
          </section>

          {selectedCountryPack ? (
            <section className="workspace-table-shell">
              <div className="workspace-table-head">
                <div>
                  <p>Selected pack</p>
                  <h3>
                    {selectedCountryPack.countryCode} -{" "}
                    {selectedCountryPack.countryName}
                  </h3>
                </div>
                <div className="confidence-label">
                  <ShieldCheck size={17} />
                  {formatLabel(selectedCountryPack.packageLegalConfidence)}
                </div>
              </div>

              <div className="finding-console-list">
                <div className="finding-console-row">
                  <Globe2 size={18} />
                  <div>
                    <strong>PACKAGE_METADATA</strong>
                    <p>
                      Package status: {formatLabel(selectedCountryPack.packageStatus)}.
                      Version: {selectedCountryPack.packageVersion}. Package
                      sources: {selectedCountryPack.packageSourceCount}. Rules:{" "}
                      {selectedCountryPack.packageRuleCount}.
                    </p>
                    <p>
                      Coverage overall:{" "}
                      {formatLabel(
                        readString(
                          selectedCountryPack.sourceCoverageSummary.overall,
                          "unknown"
                        )
                      )}
                      . Review sources: {selectedCountryPack.reviewSourceCount}.
                    </p>
                    <p>
                      {selectedCountryPack.grElCompatibilityNote ??
                        "Country-code aliases are not duplicated as country packs."}
                    </p>
                  </div>
                  <span>{selectedCountryPack.packageStatus}</span>
                </div>
              </div>

              <div className="workspace-form-grid">
                <label>
                  <span>Review status</span>
                  <select
                    value={form.reviewStatus}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        reviewStatus: event.target.value
                      }))
                    }
                  >
                    <option value="draft">Draft</option>
                    <option value="internal_review">Internal review</option>
                    <option value="reviewed">Reviewed</option>
                    <option value="professional_review_required">
                      Professional review required
                    </option>
                    <option value="deprecated">Deprecated</option>
                    <option value="suspended">Suspended</option>
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
                  <span>Reviewer label</span>
                  <input
                    value={form.reviewerLabel}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        reviewerLabel: event.target.value
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
                  <span>Review source links</span>
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
                <label className="workspace-form-wide">
                  <span>Review notes</span>
                  <textarea
                    value={form.reviewNotes}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        reviewNotes: event.target.value
                      }))
                    }
                  />
                </label>
                <label className="workspace-form-wide">
                  <span>Warnings</span>
                  <textarea
                    value={form.warningsText}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        warningsText: event.target.value
                      }))
                    }
                    placeholder="One warning per line"
                  />
                </label>
              </div>

              <div className="workspace-row-actions">
                <button type="button" onClick={() => void saveReview()}>
                  <SquarePen size={16} />
                  Save review metadata
                </button>
                {reviewNeedsSource(form) && form.sourceRefIds.length === 0 ? (
                  <span className="admin-inline-warning">
                    <AlertTriangle size={14} />
                    Reviewed or stronger metadata requires at least one source.
                  </span>
                ) : null}
              </div>

              <div className="workspace-form-grid">
                <label>
                  <span>Link source</span>
                  <select
                    value={linkSourceId}
                    onChange={(event) => setLinkSourceId(event.target.value)}
                  >
                    <option value="">Select source</option>
                    {sources.map((source) => (
                      <option key={source.id} value={source.id}>
                        {source.title}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="workspace-row-actions">
                  <button
                    type="button"
                    disabled={!linkSourceId}
                    onClick={() => void linkSource()}
                  >
                    <Link2 size={16} />
                    Link source
                  </button>
                </div>
              </div>

              <div className="finding-console-list">
                {selectedCountryPack.sourceReferences.length === 0 ? (
                  <div className="finding-console-row">
                    <AlertTriangle size={18} />
                    <div>
                      <strong>NO_REVIEW_SOURCE_LINKS</strong>
                      <p>
                        No review overlay source references are linked yet.
                        Package sources still remain visible in the read-only
                        country-pack catalog.
                      </p>
                    </div>
                    <span>warning</span>
                  </div>
                ) : (
                  selectedCountryPack.sourceReferences.map((source) => (
                    <div className="finding-console-row" key={source.id}>
                      <Globe2 size={18} />
                      <div>
                        <strong>{source.title}</strong>
                        <p>
                          {source.jurisdiction} -{" "}
                          {formatLabel(source.confidenceStatus)}
                        </p>
                      </div>
                      <span>source</span>
                      <div className="admin-row-actions">
                        <button
                          type="button"
                          title="Unlink source"
                          onClick={() => void unlinkSource(source.id)}
                        >
                          <Unlink size={15} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

