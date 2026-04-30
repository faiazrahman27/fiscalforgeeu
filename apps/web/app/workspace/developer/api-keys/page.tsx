"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Clock3,
  Copy,
  KeyRound,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Trash2
} from "lucide-react";

type ApiKeyScope =
  | "invoices:validate"
  | "invoices:export_ubl"
  | "invoices:parse_ubl"
  | "invoices:import_ubl"
  | "vat:validate_format"
  | "validation_runs:read"
  | "rules:read";

type ApiKeyEnvironment = "test" | "live";
type ApiKeyStatus = "active" | "revoked" | "expired";

type ApiKeyRecord = {
  id: string;
  name: string;
  keyPrefix: string;
  environment: ApiKeyEnvironment;
  scopes: ApiKeyScope[];
  status: ApiKeyStatus;
  expiresAt: string | null;
  lastUsedAt: string | null;
  lastUsedIp: string | null;
  createdAt: string;
  revokedAt: string | null;
};

type ApiKeyFormState = {
  name: string;
  environment: ApiKeyEnvironment;
  scopes: ApiKeyScope[];
  expiresAt: string;
};

const scopeOptions: {
  value: ApiKeyScope;
  label: string;
  description: string;
}[] = [
  {
    value: "invoices:validate",
    label: "Validate invoices",
    description: "POST /api/v1/invoices/validate"
  },
  {
    value: "invoices:export_ubl",
    label: "Export UBL",
    description: "POST /api/v1/invoices/export/ubl"
  },
  {
    value: "invoices:parse_ubl",
    label: "Parse UBL",
    description: "POST /api/v1/invoices/parse/ubl"
  },
  {
    value: "invoices:import_ubl",
    label: "Import UBL",
    description: "Reserved until draft ownership is API-key safe"
  },
  {
    value: "vat:validate_format",
    label: "VAT format",
    description: "POST /api/v1/vat/validate-format"
  },
  {
    value: "validation_runs:read",
    label: "Read reports",
    description: "GET /api/v1/validation-runs/:id"
  },
  {
    value: "rules:read",
    label: "Read rules",
    description: "GET /api/v1/validation/rules"
  }
];

const defaultFormState: ApiKeyFormState = {
  name: "",
  environment: "test",
  scopes: ["invoices:validate", "vat:validate_format"],
  expiresAt: ""
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function readNullableStringField(record: Record<string, unknown>, key: string) {
  const value = record[key];

  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function isApiKeyScope(value: unknown): value is ApiKeyScope {
  return (
    value === "invoices:validate" ||
    value === "invoices:export_ubl" ||
    value === "invoices:parse_ubl" ||
    value === "invoices:import_ubl" ||
    value === "vat:validate_format" ||
    value === "validation_runs:read" ||
    value === "rules:read"
  );
}

function normalizeApiKey(value: unknown): ApiKeyRecord | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const id = readStringField(value, "id");
  const name = readStringField(value, "name");
  const keyPrefix = readStringField(value, "keyPrefix");
  const createdAt = readStringField(value, "createdAt");
  const environment = value.environment === "live" ? "live" : "test";
  const status =
    value.status === "revoked" || value.status === "expired"
      ? value.status
      : "active";

  if (!id || !name || !keyPrefix || !createdAt) {
    return null;
  }

  const scopes = Array.isArray(value.scopes)
    ? value.scopes.filter(isApiKeyScope)
    : [];

  return {
    id,
    name,
    keyPrefix,
    environment,
    scopes,
    status,
    expiresAt: readNullableStringField(value, "expiresAt"),
    lastUsedAt: readNullableStringField(value, "lastUsedAt"),
    lastUsedIp: readNullableStringField(value, "lastUsedIp"),
    createdAt,
    revokedAt: readNullableStringField(value, "revokedAt")
  };
}

function getApiErrorMessage(data: unknown, fallback: string) {
  if (typeof data === "string" && data.trim()) {
    return data.slice(0, 240);
  }

  if (!isPlainObject(data) || !isPlainObject(data.error)) {
    return fallback;
  }

  const message = data.error.message;

  return typeof message === "string" && message.trim() ? message : fallback;
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Never";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function formatStatus(value: string) {
  return value.replaceAll("_", " ");
}

function buildExpiryIso(value: string) {
  if (!value.trim()) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export default function WorkspaceApiKeysPage() {
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([]);
  const [formState, setFormState] = useState<ApiKeyFormState>(defaultFormState);
  const [createdSecret, setCreatedSecret] = useState("");
  const [createdWarning, setCreatedWarning] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [revokingId, setRevokingId] = useState("");

  const counts = useMemo(
    () => ({
      total: apiKeys.length,
      active: apiKeys.filter((apiKey) => apiKey.status === "active").length,
      revoked: apiKeys.filter((apiKey) => apiKey.status === "revoked").length,
      expired: apiKeys.filter((apiKey) => apiKey.status === "expired").length
    }),
    [apiKeys]
  );

  const loadApiKeys = useCallback(async () => {
    setIsLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/local/api-keys", {
        method: "GET",
        cache: "no-store"
      });
      const responseData = await readResponseBody(response);

      if (!response.ok) {
        setApiKeys([]);
        setMessage(
          getApiErrorMessage(
            responseData,
            "API keys could not be loaded for this workspace."
          )
        );
        return;
      }

      const records =
        isPlainObject(responseData) && Array.isArray(responseData.apiKeys)
          ? responseData.apiKeys
          : [];

      setApiKeys(
        records
          .map((record) => normalizeApiKey(record))
          .filter((record): record is ApiKeyRecord => record !== null)
      );
    } catch {
      setApiKeys([]);
      setMessage(
        "API key management is unavailable. Make sure apps/api and apps/web are both running."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadApiKeys();
  }, [loadApiKeys]);

  function updateScope(scope: ApiKeyScope, checked: boolean) {
    setFormState((current) => {
      if (checked) {
        return {
          ...current,
          scopes: current.scopes.includes(scope)
            ? current.scopes
            : [...current.scopes, scope]
        };
      }

      return {
        ...current,
        scopes: current.scopes.filter((item) => item !== scope)
      };
    });
  }

  async function createKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreating(true);
    setMessage("");
    setCopyMessage("");
    setCreatedSecret("");
    setCreatedWarning("");

    try {
      const response = await fetch("/api/local/api-keys", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          name: formState.name,
          environment: formState.environment,
          scopes: formState.scopes,
          expiresAt: buildExpiryIso(formState.expiresAt)
        })
      });
      const responseData = await readResponseBody(response);

      if (!response.ok || !isPlainObject(responseData)) {
        setMessage(
          getApiErrorMessage(responseData, "API key could not be created.")
        );
        return;
      }

      const createdApiKey = normalizeApiKey(responseData.apiKey);
      const secret =
        typeof responseData.secret === "string" ? responseData.secret : "";
      const warning =
        typeof responseData.warning === "string" ? responseData.warning : "";

      if (createdApiKey) {
        setApiKeys((current) => [createdApiKey, ...current]);
      }

      setCreatedSecret(secret);
      setCreatedWarning(warning);
      setFormState(defaultFormState);
    } catch {
      setMessage(
        "API key could not be created. Make sure apps/api and apps/web are both running."
      );
    } finally {
      setIsCreating(false);
    }
  }

  async function revokeKey(apiKey: ApiKeyRecord) {
    if (
      !window.confirm(
        `Revoke ${apiKey.name}? Requests using this key will stop working.`
      )
    ) {
      return;
    }

    setRevokingId(apiKey.id);
    setMessage("");

    try {
      const response = await fetch(
        `/api/local/api-keys/${encodeURIComponent(apiKey.id)}/revoke`,
        {
          method: "POST",
          cache: "no-store"
        }
      );
      const responseData = await readResponseBody(response);

      if (!response.ok || !isPlainObject(responseData)) {
        setMessage(
          getApiErrorMessage(responseData, "API key could not be revoked.")
        );
        return;
      }

      const revokedApiKey = normalizeApiKey(responseData.apiKey);

      if (!revokedApiKey) {
        void loadApiKeys();
        return;
      }

      setApiKeys((current) =>
        current.map((item) =>
          item.id === revokedApiKey.id ? revokedApiKey : item
        )
      );
    } catch {
      setMessage(
        "API key could not be revoked. Make sure apps/api and apps/web are both running."
      );
    } finally {
      setRevokingId("");
    }
  }

  async function copyCreatedSecret() {
    if (!createdSecret) {
      return;
    }

    try {
      await navigator.clipboard.writeText(createdSecret);
      setCopyMessage("Copied. Store it now; it will not be shown again.");
    } catch {
      setCopyMessage("Copy failed. Select and copy the key manually.");
    }
  }

  const canCreate =
    formState.name.trim().length > 0 &&
    formState.scopes.length > 0 &&
    !isCreating;

  return (
    <div className="workspace-page">
      <section className="workspace-page-head">
        <p className="workspace-kicker">Sandbox developer API</p>
        <h2>Organization API keys.</h2>
        <p>
          Create scoped keys for Invoice Lantern technical validation endpoints.
          This is not an official filing API, not authority submission, and not
          a compliance guarantee.
        </p>
      </section>

      <section className="workspace-stat-strip">
        <div className="workspace-stat">
          <p>Total keys</p>
          <strong>{isLoading ? "Loading" : counts.total}</strong>
          <span>Metadata only. Plaintext keys are never listed.</span>
        </div>

        <div className="workspace-stat">
          <p>Active</p>
          <strong>{isLoading ? "Loading" : counts.active}</strong>
          <span>Keys that can authenticate scoped developer API requests.</span>
        </div>

        <div className="workspace-stat">
          <p>Revoked</p>
          <strong>{isLoading ? "Loading" : counts.revoked}</strong>
          <span>Keys disabled by an organization owner or admin.</span>
        </div>

        <div className="workspace-stat">
          <p>Expired</p>
          <strong>{isLoading ? "Loading" : counts.expired}</strong>
          <span>Keys past their configured expiry date.</span>
        </div>
      </section>

      <section className="workspace-alerts">
        <div className="alerts-head">
          <ShieldAlert size={22} />
          <div>
            <p>Boundary</p>
            <h3>Technical validation only.</h3>
          </div>
        </div>

        <div className="alert-list">
          <div className="alert-item">
            <span />
            <p>
              Invoice Lantern API keys provide access to sandbox technical
              validation tools only. They are not official filing credentials and
              do not provide tax authority submission capability.
            </p>
          </div>
          <div className="alert-item">
            <span />
            <p>
              Do not use Invoice Lantern API responses as the sole basis for
              legal, tax, or accounting decisions.
            </p>
          </div>
        </div>
      </section>

      {createdSecret ? (
        <section className="developer-console">
          <div className="developer-console-head">
            <div>
              <p>New key</p>
              <h3>Copy this key now. It will not be shown again.</h3>
            </div>

            <button type="button" onClick={() => setCreatedSecret("")}>
              Hide key
            </button>
          </div>

          <pre>{createdSecret}</pre>

          <div className="workspace-row-actions">
            <button
              type="button"
              className="text-link-button"
              onClick={copyCreatedSecret}
            >
              <Copy size={16} />
              Copy key
            </button>
          </div>

          <p className="workspace-muted-copy">
            {copyMessage || createdWarning}
          </p>
        </section>
      ) : null}

      <section className="workspace-table-shell">
        <div className="workspace-table-head">
          <div>
            <p>Create key</p>
            <h3>Scoped API access</h3>
          </div>
        </div>

        <form className="api-key-form" onSubmit={createKey}>
          <label>
            <span>Name</span>
            <input
              value={formState.name}
              maxLength={120}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setFormState((current) => ({
                  ...current,
                  name: event.target.value
                }))
              }
              placeholder="Local test key"
            />
          </label>

          <label>
            <span>Environment</span>
            <select
              value={formState.environment}
              onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                setFormState((current) => ({
                  ...current,
                  environment: event.target.value === "live" ? "live" : "test"
                }))
              }
            >
              <option value="test">Test</option>
              <option value="live">Live</option>
            </select>
          </label>

          <label>
            <span>Expiry</span>
            <input
              type="datetime-local"
              value={formState.expiresAt}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setFormState((current) => ({
                  ...current,
                  expiresAt: event.target.value
                }))
              }
            />
          </label>

          <fieldset>
            <legend>Scopes</legend>
            <div className="api-key-scope-grid">
              {scopeOptions.map((scope) => (
                <label key={scope.value}>
                  <input
                    type="checkbox"
                    checked={formState.scopes.includes(scope.value)}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      updateScope(scope.value, event.target.checked)
                    }
                  />
                  <span>
                    <strong>{scope.label}</strong>
                    {scope.value}
                    <em>{scope.description}</em>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="workspace-row-actions">
            <button type="submit" disabled={!canCreate}>
              <Plus size={16} />
              {isCreating ? "Creating..." : "Create key"}
            </button>
          </div>
        </form>
      </section>

      <section className="workspace-table-shell">
        <div className="workspace-table-head">
          <div>
            <p>Keys</p>
            <h3>API key metadata</h3>
          </div>

          <button
            type="button"
            onClick={() => void loadApiKeys()}
            disabled={isLoading}
          >
            <Clock3 size={16} />
            Refresh
          </button>
        </div>

        {message ? (
          <div className="alert-item">
            <span />
            <p>{message}</p>
          </div>
        ) : null}

        <div className="workspace-table">
          {isLoading ? (
            <div className="workspace-table-row">
              <div>
                <strong>Loading API keys</strong>
                <span>Reading key metadata from the API service.</span>
              </div>
              <div>
                <span className="status-pill">loading</span>
              </div>
              <div>
                <span>metadata only</span>
              </div>
              <strong>pending</strong>
              <KeyRound size={17} />
            </div>
          ) : apiKeys.length === 0 ? (
            <div className="workspace-table-row">
              <div>
                <strong>No API keys</strong>
                <span>Create an organization-owned key to use the sandbox developer API.</span>
              </div>
              <div>
                <span className="status-pill">empty</span>
              </div>
              <div>
                <span>No plaintext key stored</span>
              </div>
              <strong>0</strong>
              <ShieldCheck size={17} />
            </div>
          ) : (
            apiKeys.map((apiKey) => (
              <div className="workspace-table-row" key={apiKey.id}>
                <div>
                  <strong>{apiKey.name}</strong>
                  <span>{apiKey.keyPrefix}...</span>
                  <span>
                    Scopes:{" "}
                    {apiKey.scopes.length > 0
                      ? apiKey.scopes.join(", ")
                      : "No scopes"}
                  </span>
                  <span>
                    Last used: {formatDateTime(apiKey.lastUsedAt)}. Expires:{" "}
                    {apiKey.expiresAt ? formatDateTime(apiKey.expiresAt) : "Never"}.
                  </span>
                </div>

                <div>
                  <span className="status-pill">{formatStatus(apiKey.environment)}</span>
                </div>

                <div>
                  <span>
                    <Clock3 size={14} /> {formatDateTime(apiKey.createdAt)}
                  </span>
                </div>

                <strong>{formatStatus(apiKey.status)}</strong>

                <div className="workspace-row-actions">
                  {apiKey.status === "active" ? (
                    <button
                      type="button"
                      className="text-link-button"
                      onClick={() => revokeKey(apiKey)}
                      disabled={revokingId === apiKey.id}
                    >
                      <Trash2 size={16} />
                      {revokingId === apiKey.id ? "Revoking..." : "Revoke"}
                    </button>
                  ) : (
                    <BadgeCheck size={17} />
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
