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
import {
  apiControls,
  apiEventTypes,
  developerEndpointPreview
} from "../../../lib/mock-data";
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

const API_KEY_STORAGE_KEY = "fiscalforge.eu.workspace.apiKeys";
const REQUEST_LOG_STORAGE_KEY = "fiscalforge.eu.workspace.requestLogs";

const defaultApiKeys: SandboxApiKey[] = [
  {
    id: "key_sbx_001",
    name: "Local validation testing",
    prefix: "ff_sbx",
    lastFour: "A19K",
    scopes: ["invoices:read", "validation:run", "reports:read"],
    createdAt: "2026-04-24 16:20",
    lastUsedAt: "2026-04-24 18:10",
    status: "active"
  },
  {
    id: "key_sbx_002",
    name: "Webhook simulation client",
    prefix: "ff_sbx",
    lastFour: "Q72M",
    scopes: ["webhooks:test", "validation:read"],
    createdAt: "2026-04-22 11:45",
    lastUsedAt: "Never",
    status: "active"
  }
];

const defaultRequestLogs: RequestLog[] = [
  {
    id: "req_001",
    method: "POST",
    path: "/api/v1/invoices/validate",
    status: 422,
    latency: "84ms",
    createdAt: "2026-04-24 18:10"
  },
  {
    id: "req_002",
    method: "GET",
    path: "/api/v1/validation-runs/val_01HXABC",
    status: 200,
    latency: "39ms",
    createdAt: "2026-04-24 18:11"
  },
  {
    id: "req_003",
    method: "POST",
    path: "/api/v1/webhooks/test",
    status: 202,
    latency: "121ms",
    createdAt: "2026-04-24 18:13"
  }
];

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

  return `ff_sbx_${secret}`;
}

function readStoredArray<T>(key: string, fallback: T[]): T[] {
  if (typeof window === "undefined") {
    return fallback;
  }

  const storedValue = window.localStorage.getItem(key);

  if (!storedValue) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(storedValue);

    if (!Array.isArray(parsed)) {
      return fallback;
    }

    return parsed as T[];
  } catch {
    return fallback;
  }
}

export default function WorkspaceDeveloperPage() {
  const [apiKeys, setApiKeys] = useState<SandboxApiKey[]>(defaultApiKeys);
  const [requestLogs, setRequestLogs] =
    useState<RequestLog[]>(defaultRequestLogs);
  const [generatedKey, setGeneratedKey] = useState<string>("");
  const [copyMessage, setCopyMessage] = useState<string>("");
  const [hasLoadedStorage, setHasLoadedStorage] = useState(false);

  const activeKeyCount = useMemo(() => {
    return apiKeys.filter((apiKey) => apiKey.status === "active").length;
  }, [apiKeys]);

  const revokedKeyCount = useMemo(() => {
    return apiKeys.filter((apiKey) => apiKey.status === "revoked").length;
  }, [apiKeys]);

  useEffect(() => {
    setApiKeys(readStoredArray(API_KEY_STORAGE_KEY, defaultApiKeys));
    setRequestLogs(readStoredArray(REQUEST_LOG_STORAGE_KEY, defaultRequestLogs));
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
      prefix: "ff_sbx",
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

  async function copyGeneratedKey() {
    if (!generatedKey) {
      return;
    }

    try {
      await navigator.clipboard.writeText(generatedKey);
      setCopyMessage("Copied. Store it now — it will not be shown again later.");
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
      method: developerEndpointPreview.method,
      path: developerEndpointPreview.path,
      status: 422,
      latency: `${Math.floor(55 + Math.random() * 120)}ms`,
      createdAt: now
    };

    setRequestLogs((current) => [nextLog, ...current].slice(0, 8));
  }

  return (
    <div className="workspace-page">
      <section className="workspace-page-head">
        <p className="workspace-kicker">Developer Console</p>
        <h2>Sandbox API controls without production risk.</h2>
        <p>
          This screen models the future developer console for API keys, scoped
          access, request logs, endpoint testing, OpenAPI documentation, and
          webhook simulation. Everything here is still local browser-side state.
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
          <span>Local sandbox API keys currently marked as usable.</span>
        </div>

        <div className="workspace-stat">
          <p>Revoked keys</p>
          <strong>{revokedKeyCount}</strong>
          <span>Keys disabled from the local developer console preview.</span>
        </div>

        <div className="workspace-stat">
          <p>Recent requests</p>
          <strong>{requestLogs.length}</strong>
          <span>Browser-side request log entries for API interface testing.</span>
        </div>

        <div className="workspace-stat">
          <p>Mode</p>
          <strong>SBX</strong>
          <span>No real API service is connected yet.</span>
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
            <button type="button" className="text-link-button" onClick={copyGeneratedKey}>
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
          {apiKeys.map((apiKey) => (
            <div className="workspace-table-row" key={apiKey.id}>
              <div>
                <strong>{apiKey.name}</strong>
                <span>
                  {apiKey.prefix}••••••••{apiKey.lastFour}
                </span>
              </div>

              <div>
                <Clock3 size={15} />
                <span>{apiKey.createdAt}</span>
              </div>

              <div>
                <span>{apiKey.scopes.join(", ")}</span>
              </div>

              <strong>{apiKey.status}</strong>

              {apiKey.status === "active" ? (
                <button
                  type="button"
                  className="text-link-button"
                  onClick={() => revokeSandboxKey(apiKey.id)}
                  title="Revoke key"
                >
                  <Trash2 size={15} />
                </button>
              ) : (
                <ShieldCheck size={17} />
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="developer-console">
        <div className="developer-console-head">
          <div>
            <p>Sandbox endpoint</p>
            <h3>
              <span style={{ color: "var(--ff-teal, #64d2ff)" }}>
                {developerEndpointPreview.method}
              </span>{" "}
              {developerEndpointPreview.path}
            </h3>
          </div>

          <button type="button" onClick={testRequest}>
            <RotateCcw size={16} />
            Test request
          </button>
        </div>

        <pre>{JSON.stringify(developerEndpointPreview.payload, null, 2)}</pre>
      </section>

      <section className="workspace-table-shell">
        <div className="workspace-table-head">
          <div>
            <p>Request logs</p>
            <h3>Recent sandbox API events</h3>
          </div>

          <div className="confidence-label">
            <Activity size={17} />
            local logs
          </div>
        </div>

        <div className="workspace-table">
          {requestLogs.map((request) => (
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
          ))}
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
