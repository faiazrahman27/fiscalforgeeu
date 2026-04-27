"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Braces,
  Clock3,
  Copy,
  KeyRound,
  Plus,
  RadioTower,
  RotateCcw,
  ShieldCheck,
  Trash2
} from "lucide-react";
import { apiControls, apiEventTypes } from "../../../lib/mock-data";
import type { WorkspaceIconKey } from "../../../lib/types";

type ApiKeyStatus = "active" | "revoked";

type SandboxApiKey = {
  id: string;
  name: string;
  prefix: string;
  lastFour: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string;
  status: ApiKeyStatus;
};

type RequestLog = {
  id: string;
  method: string;
  path: string;
  status: number;
  latency: string;
  createdAt: string;
};

const API_KEY_STORAGE_KEY = "invoice-lantern.workspace.apiKeys";
const REQUEST_LOG_STORAGE_KEY = "invoice-lantern.workspace.requestLogs";

const endpointPreview = {
  method: "POST",
  path: "/api/v1/invoices/validate",
  payload: {
    requiredHeaders: ["content-type: application/json", "x-api-key: <api-key>"],
    requiredScope: "validation:run",
    rateLimit: "Configured on the API service",
    status: "planned developer test surface",
    note: "Real API keys must be stored securely and shown only once."
  }
};

const legacySeedApiKeyIds = new Set(["key_sbx_001", "key_sbx_002"]);
const legacySeedRequestLogIds = new Set(["req_001", "req_002", "req_003"]);

function getDeveloperIcon(iconKey: WorkspaceIconKey) {
  const icons: Record<string, ReactNode> = {
    apiKey: <KeyRound size={22} />,
    rbac: <ShieldCheck size={22} />,
    logs: <Clock3 size={22} />,
    webhook: <RadioTower size={22} />
  };

  return icons[iconKey] ?? <Braces size={22} />;
}

function formatDateTime(date: Date) {
  return date
    .toLocaleString("sv-SE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    })
    .replace("T", " ");
}

function generateApiKeyValue() {
  const bytes = new Uint8Array(24);

  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  const secret = Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return `il_sbx_${secret}`;
}

function isApiKeyStatus(value: unknown): value is ApiKeyStatus {
  return value === "active" || value === "revoked";
}

function readStringField(
  record: Record<string, unknown>,
  key: string,
  fallback: string
) {
  const value = record[key];

  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  return fallback;
}

function readNumberField(
  record: Record<string, unknown>,
  key: string,
  fallback: number
) {
  const value = record[key];

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return fallback;
}

function readStringArrayField(record: Record<string, unknown>, key: string) {
  const value = record[key];

  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function normalizeApiKey(value: unknown): SandboxApiKey | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = readStringField(record, "id", "");

  if (!id || legacySeedApiKeyIds.has(id)) {
    return null;
  }

  const lastFour = readStringField(record, "lastFour", "");

  if (!lastFour) {
    return null;
  }

  const status = isApiKeyStatus(record.status) ? record.status : "active";

  return {
    id,
    name: readStringField(record, "name", "Sandbox API key"),
    prefix: readStringField(record, "prefix", "il_sbx"),
    lastFour,
    scopes: readStringArrayField(record, "scopes"),
    createdAt: readStringField(record, "createdAt", "Unknown"),
    lastUsedAt: readStringField(record, "lastUsedAt", "Never"),
    status
  };
}

function normalizeRequestLog(value: unknown): RequestLog | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = readStringField(record, "id", "");

  if (!id || legacySeedRequestLogIds.has(id)) {
    return null;
  }

  const path = readStringField(record, "path", "");

  if (!path) {
    return null;
  }

  return {
    id,
    method: readStringField(record, "method", "GET").toUpperCase(),
    path,
    status: readNumberField(record, "status", 0),
    latency: readStringField(record, "latency", "0ms"),
    createdAt: readStringField(record, "createdAt", "Unknown")
  };
}

function readStoredArray<T>(
  key: string,
  normalizeItem: (value: unknown) => T | null
): T[] {
  if (typeof window === "undefined") {
    return [];
  }

  const storedValue = window.localStorage.getItem(key);

  if (!storedValue) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(storedValue);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => normalizeItem(item))
      .filter((item): item is T => item !== null);
  } catch {
    return [];
  }
}

export default function WorkspaceDeveloperPage() {
  const [apiKeys, setApiKeys] = useState<SandboxApiKey[]>([]);
  const [requestLogs, setRequestLogs] = useState<RequestLog[]>([]);
  const [generatedKey, setGeneratedKey] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [hasLoadedStorage, setHasLoadedStorage] = useState(false);

  const activeKeyCount = useMemo(() => {
    return apiKeys.filter((apiKey) => apiKey.status === "active").length;
  }, [apiKeys]);

  const revokedKeyCount = useMemo(() => {
    return apiKeys.filter((apiKey) => apiKey.status === "revoked").length;
  }, [apiKeys]);

  useEffect(() => {
    const storedApiKeys = readStoredArray<SandboxApiKey>(
      API_KEY_STORAGE_KEY,
      normalizeApiKey
    );

    const storedRequestLogs = readStoredArray<RequestLog>(
      REQUEST_LOG_STORAGE_KEY,
      normalizeRequestLog
    );

    setApiKeys(storedApiKeys);
    setRequestLogs(storedRequestLogs);
    setHasLoadedStorage(true);
  }, []);

  useEffect(() => {
    if (!hasLoadedStorage) {
      return;
    }

    window.localStorage.setItem(API_KEY_STORAGE_KEY, JSON.stringify(apiKeys));
  }, [apiKeys, hasLoadedStorage]);

  useEffect(() => {
    if (!hasLoadedStorage) {
      return;
    }

    window.localStorage.setItem(
      REQUEST_LOG_STORAGE_KEY,
      JSON.stringify(requestLogs)
    );
  }, [requestLogs, hasLoadedStorage]);

  function createSandboxKey() {
    const fullKey = generateApiKeyValue();
    const now = formatDateTime(new Date());

    const nextKey: SandboxApiKey = {
      id: `key_sbx_${Date.now()}`,
      name: `Sandbox key ${apiKeys.length + 1}`,
      prefix: "il_sbx",
      lastFour: fullKey.slice(-4).toUpperCase(),
      scopes: ["invoices:read", "validation:run", "reports:read"],
      createdAt: now,
      lastUsedAt: "Never",
      status: "active"
    };

    setApiKeys((current) => [nextKey, ...current]);
    setGeneratedKey(fullKey);
    setCopyMessage("");
  }

  function revokeSandboxKey(keyId: string) {
    setApiKeys((current) =>
      current.map((apiKey) => {
        if (apiKey.id !== keyId) {
          return apiKey;
        }

        return {
          ...apiKey,
          status: "revoked"
        };
      })
    );
  }

  function deleteSandboxKey(keyId: string) {
    setApiKeys((current) => current.filter((apiKey) => apiKey.id !== keyId));
  }

  async function copyGeneratedKey() {
    if (!generatedKey) {
      return;
    }

    try {
      await navigator.clipboard.writeText(generatedKey);
      setCopyMessage("Copied. Store it now - it will not be shown again later.");
    } catch {
      setCopyMessage("Copy failed. Select and copy the key manually.");
    }
  }

  function hideGeneratedKey() {
    setGeneratedKey("");
    setCopyMessage("");
  }

  function testRequest() {
    const now = formatDateTime(new Date());

    const nextLog: RequestLog = {
      id: `req_${Date.now()}`,
      method: endpointPreview.method,
      path: endpointPreview.path,
      status: activeKeyCount > 0 ? 202 : 401,
      latency: `${Math.floor(55 + Math.random() * 120)}ms`,
      createdAt: now
    };

    setRequestLogs((current) => [nextLog, ...current].slice(0, 20));
  }

  function clearRequestLogs() {
    setRequestLogs([]);
  }

  return (
    <div className="workspace-page">
      <section className="workspace-page-head">
        <p className="workspace-kicker">Developer Console</p>
        <h2>Sandbox API controls without production risk.</h2>
        <p>
          This screen models the future developer console for API keys, scoped
          access, local request-test events, endpoint previews, OpenAPI planning,
          and webhook simulation. No seeded demo keys or seeded demo logs are shown.
        </p>
      </section>

      <section className="workspace-step-grid">
        {apiControls.map((item) => (
          <div className="workspace-step" key={item.title}>
            <div>{getDeveloperIcon(item.iconKey)}</div>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
          </div>
        ))}
      </section>

      <section className="workspace-stat-strip">
        <div className="workspace-stat">
          <p>Active keys</p>
          <strong>{activeKeyCount}</strong>
          <span>Sandbox API keys currently marked as usable.</span>
        </div>

        <div className="workspace-stat">
          <p>Revoked keys</p>
          <strong>{revokedKeyCount}</strong>
          <span>Keys disabled from this developer console.</span>
        </div>

        <div className="workspace-stat">
          <p>Local test events</p>
          <strong>{requestLogs.length}</strong>
          <span>Request-test entries generated from this console.</span>
        </div>

        <div className="workspace-stat">
          <p>Mode</p>
          <strong>SBX</strong>
          <span>Local sandbox interface for developer testing.</span>
        </div>
      </section>

      {generatedKey ? (
        <section className="developer-console">
          <div className="developer-console-head">
            <div>
              <p>New sandbox API key</p>
              <h3>Shown once only</h3>
            </div>

            <button type="button" onClick={hideGeneratedKey}>
              Hide key
            </button>
          </div>

          <pre>{generatedKey}</pre>

          <div className="workspace-top-actions" style={{ marginTop: "1rem" }}>
            <button
              type="button"
              className="text-link-button"
              onClick={copyGeneratedKey}
            >
              <Copy size={16} />
              Copy key
            </button>
          </div>

          {copyMessage ? (
            <p style={{ color: "rgba(255,255,255,0.58)", lineHeight: 1.7 }}>
              {copyMessage}
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="workspace-table-shell">
        <div className="workspace-table-head">
          <div>
            <p>API keys</p>
            <h3>Sandbox key management</h3>
          </div>

          <button type="button" onClick={createSandboxKey}>
            <Plus size={16} />
            Create key
          </button>
        </div>

        <div className="workspace-table">
          {apiKeys.length === 0 ? (
            <div className="workspace-table-row">
              <div>
                <strong>No sandbox API keys</strong>
                <span>Create a key to test the developer console flow.</span>
              </div>

              <div>
                <Clock3 size={15} />
                <span>waiting</span>
              </div>

              <div>
                <span>No scopes assigned yet</span>
              </div>

              <strong>empty</strong>

              <ShieldCheck size={17} />
            </div>
          ) : (
            apiKeys.map((apiKey) => (
              <div className="workspace-table-row" key={apiKey.id}>
                <div>
                  <strong>{apiKey.name}</strong>
                  <span>
                    {apiKey.prefix}************{apiKey.lastFour}
                  </span>
                </div>

                <div>
                  <Clock3 size={15} />
                  <span>{apiKey.createdAt}</span>
                </div>

                <div>
                  <span>
                    {apiKey.scopes.length > 0
                      ? apiKey.scopes.join(", ")
                      : "No scopes assigned"}
                  </span>
                </div>

                <strong>{apiKey.status}</strong>

                <div className="workspace-row-actions">
                  {apiKey.status === "active" ? (
                    <button
                      type="button"
                      className="text-link-button"
                      onClick={() => revokeSandboxKey(apiKey.id)}
                      title="Revoke key"
                    >
                      <ShieldCheck size={15} />
                      Revoke
                    </button>
                  ) : null}

                  <button
                    type="button"
                    className="text-link-button"
                    onClick={() => deleteSandboxKey(apiKey.id)}
                    title="Delete key"
                  >
                    <Trash2 size={15} />
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="developer-console">
        <div className="developer-console-head">
          <div>
            <p>Endpoint preview</p>
            <h3>
              <span style={{ color: "var(--ff-teal, #64d2ff)" }}>
                {endpointPreview.method}
              </span>{" "}
              {endpointPreview.path}
            </h3>
          </div>

          <button type="button" onClick={testRequest}>
            <RotateCcw size={16} />
            Add test event
          </button>
        </div>

        <pre>{JSON.stringify(endpointPreview.payload, null, 2)}</pre>
      </section>

      <section className="workspace-table-shell">
        <div className="workspace-table-head">
          <div>
            <p>Local request-test events</p>
            <h3>Developer console event log</h3>
          </div>

          <div className="workspace-row-actions">
            <div className="confidence-label">
              <Activity size={17} />
              local only
            </div>

            <button
              type="button"
              className="text-link-button"
              onClick={clearRequestLogs}
              disabled={requestLogs.length === 0}
            >
              <Trash2 size={16} />
              Clear logs
            </button>
          </div>
        </div>

        <div className="workspace-table">
          {requestLogs.length === 0 ? (
            <div className="workspace-table-row">
              <div>
                <strong>No local request-test events</strong>
                <span>Add a test event to verify the developer console flow.</span>
              </div>

              <div>
                <span className="status-pill">empty</span>
              </div>

              <div>
                <span>waiting</span>
              </div>

              <strong>0</strong>

              <span>0ms</span>
            </div>
          ) : (
            requestLogs.map((request) => (
              <div className="workspace-table-row" key={request.id}>
                <div>
                  <strong>{request.id}</strong>
                  <span>{request.path}</span>
                </div>

                <div>
                  <span className="status-pill">{request.method}</span>
                </div>

                <div>
                  <span>{request.createdAt}</span>
                </div>

                <strong>{request.status}</strong>

                <span>{request.latency}</span>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="api-event-strip">
        {apiEventTypes.map((item) => (
          <div key={item.name} title={item.description}>
            <Braces size={18} />
            {item.name}
          </div>
        ))}
      </section>
    </div>
  );
}
