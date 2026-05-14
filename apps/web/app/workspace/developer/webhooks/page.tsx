"use client";

import Link from "next/link";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Copy,
  ExternalLink,
  KeyRound,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Webhook
} from "lucide-react";

type WebhookEventType =
  | "invoice.validation.completed"
  | "invoice.ubl.exported"
  | "xml.validation.completed"
  | "vat.vies.checked"
  | "vida.simulation.completed"
  | "country_pack.review_required"
  | "webhook.test";

type WebhookEndpointStatus = "active" | "disabled" | "failing" | "suspended";
type WebhookDeliveryStatus =
  | "pending"
  | "delivered"
  | "failed"
  | "retry_scheduled"
  | "skipped"
  | "blocked";

type WebhookEndpoint = {
  id: string;
  organizationId: string;
  name: string;
  url: string;
  status: WebhookEndpointStatus;
  eventTypes: WebhookEventType[];
  description: string | null;
  signingSecretLast4: string | null;
  signingSecretKeyId: string | null;
  lastDeliveryAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  failureCount: number;
  createdAt: string;
  updatedAt: string;
  disabledAt: string | null;
};

type WebhookDelivery = {
  id: string;
  organizationId: string;
  webhookEndpointId: string;
  eventType: WebhookEventType;
  status: WebhookDeliveryStatus;
  attemptNumber: number;
  maxAttempts: number;
  requestUrl: string;
  requestMethod: "POST";
  requestHeadersRedacted: Record<string, string>;
  requestPayload: Record<string, unknown>;
  payloadHash: string;
  signatureHeaderPresent: boolean;
  responseStatus: number | null;
  responseHeadersRedacted: Record<string, string>;
  responseBodyPreview: string | null;
  responseTimeMs: number | null;
  errorCode: string | null;
  errorMessageSafe: string | null;
  nextRetryAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
};

type EndpointFormState = {
  name: string;
  url: string;
  description: string;
  eventTypes: WebhookEventType[];
};

type OneTimeSecretState = {
  endpointName: string;
  signingSecret: string;
  warning: string;
};

const eventOptions: {
  value: WebhookEventType;
  label: string;
}[] = [
  {
    value: "webhook.test",
    label: "Webhook test"
  },
  {
    value: "invoice.validation.completed",
    label: "Invoice validation"
  },
  {
    value: "invoice.ubl.exported",
    label: "UBL export"
  },
  {
    value: "xml.validation.completed",
    label: "XML validation"
  },
  {
    value: "vat.vies.checked",
    label: "VIES check"
  },
  {
    value: "vida.simulation.completed",
    label: "ViDA simulation"
  },
  {
    value: "country_pack.review_required",
    label: "Country-pack review"
  }
];

const defaultEndpointForm: EndpointFormState = {
  name: "",
  url: "",
  description: "",
  eventTypes: ["webhook.test"]
};

const defaultPayload = `{
  "message": "Receiver smoke test"
}`;

export default function WorkspaceDeveloperWebhooksPage() {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [selectedEndpointId, setSelectedEndpointId] = useState("");
  const [selectedDeliveryId, setSelectedDeliveryId] = useState("");
  const [form, setForm] = useState<EndpointFormState>(defaultEndpointForm);
  const [testEventType, setTestEventType] =
    useState<WebhookEventType>("webhook.test");
  const [payloadText, setPayloadText] = useState(defaultPayload);
  const [oneTimeSecret, setOneTimeSecret] =
    useState<OneTimeSecretState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedEndpoint = useMemo(
    () => endpoints.find((endpoint) => endpoint.id === selectedEndpointId) ?? null,
    [endpoints, selectedEndpointId]
  );
  const selectedDelivery = useMemo(
    () => deliveries.find((delivery) => delivery.id === selectedDeliveryId) ?? null,
    [deliveries, selectedDeliveryId]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [endpointResponse, deliveryResponse] = await Promise.all([
        fetch("/api/local/webhooks/endpoints", {
          cache: "no-store"
        }),
        fetch("/api/local/webhooks/deliveries", {
          cache: "no-store"
        })
      ]);
      const endpointData = await readJson(endpointResponse);
      const deliveryData = await readJson(deliveryResponse);
      const nextEndpoints = Array.isArray(endpointData.endpoints)
        ? (endpointData.endpoints as WebhookEndpoint[])
        : [];
      const nextDeliveries = Array.isArray(deliveryData.deliveries)
        ? (deliveryData.deliveries as WebhookDelivery[])
        : [];

      setEndpoints(nextEndpoints);
      setDeliveries(nextDeliveries);
      setSelectedEndpointId((current) => current || nextEndpoints[0]?.id || "");
      setSelectedDeliveryId((current) => current || nextDeliveries[0]?.id || "");
    } catch (loadError) {
      setError(readError(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function updateFormField(
    field: keyof Omit<EndpointFormState, "eventTypes">,
    value: string
  ) {
    setForm((current) => ({
      ...current,
      [field]: value
    }));
  }

  function toggleEventType(eventType: WebhookEventType) {
    setForm((current) => {
      const eventTypes = current.eventTypes.includes(eventType)
        ? current.eventTypes.filter((item) => item !== eventType)
        : [...current.eventTypes, eventType];

      return {
        ...current,
        eventTypes: eventTypes.length > 0 ? eventTypes : ["webhook.test"]
      };
    });
  }

  async function createEndpoint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAction("create", async () => {
      const response = await fetch("/api/local/webhooks/endpoints", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          name: form.name,
          url: form.url,
          eventTypes: form.eventTypes,
          description: form.description.trim() || undefined
        })
      });
      const data = await readJson(response);
      const endpoint = data.endpoint as WebhookEndpoint;

      setOneTimeSecret({
        endpointName: endpoint.name,
        signingSecret: String(data.signingSecret),
        warning: String(data.warning)
      });
      setForm(defaultEndpointForm);
      setSelectedEndpointId(endpoint.id);
      setMessage("Webhook endpoint created.");
      await loadData();
    });
  }

  async function rotateSecret(endpoint: WebhookEndpoint) {
    await runAction(`rotate:${endpoint.id}`, async () => {
      const response = await fetch(
        `/api/local/webhooks/endpoints/${encodeURIComponent(
          endpoint.id
        )}/rotate-secret`,
        {
          method: "POST"
        }
      );
      const data = await readJson(response);

      setOneTimeSecret({
        endpointName: endpoint.name,
        signingSecret: String(data.signingSecret),
        warning: String(data.warning)
      });
      setMessage("Webhook signing secret rotated.");
      await loadData();
    });
  }

  async function disableEndpoint(endpoint: WebhookEndpoint) {
    await runAction(`disable:${endpoint.id}`, async () => {
      const response = await fetch(
        `/api/local/webhooks/endpoints/${encodeURIComponent(endpoint.id)}`,
        {
          method: "DELETE"
        }
      );

      await readJson(response);
      setMessage("Webhook endpoint disabled.");
      await loadData();
    });
  }

  async function sendTestEvent() {
    if (!selectedEndpoint) {
      setError("Create or select a webhook endpoint first.");
      return;
    }

    await runAction(`test:${selectedEndpoint.id}`, async () => {
      const payload = parsePayload(payloadText);
      const response = await fetch(
        `/api/local/webhooks/endpoints/${encodeURIComponent(
          selectedEndpoint.id
        )}/test`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            eventType: testEventType,
            payload
          })
        }
      );
      const data = await readJson(response);
      const delivery = data.delivery as WebhookDelivery;

      setSelectedDeliveryId(delivery.id);
      setMessage(`Webhook test delivery ${delivery.status}.`);
      await loadData();
    });
  }

  async function retryDelivery(delivery: WebhookDelivery) {
    await runAction(`retry:${delivery.id}`, async () => {
      const response = await fetch(
        `/api/local/webhooks/deliveries/${encodeURIComponent(
          delivery.id
        )}/retry`,
        {
          method: "POST"
        }
      );
      const data = await readJson(response);
      const retry = data.delivery as WebhookDelivery;

      setSelectedDeliveryId(retry.id);
      setMessage(`Webhook retry attempt ${retry.attemptNumber} ${retry.status}.`);
      await loadData();
    });
  }

  async function runAction(label: string, action: () => Promise<void>) {
    setBusyAction(label);
    setError(null);
    setMessage(null);

    try {
      await action();
    } catch (actionError) {
      setError(readError(actionError));
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="workspace-page">
      <section className="workspace-page-head">
        <p className="workspace-kicker">Webhook simulator</p>
        <div>
          <h1>Signed sandbox webhooks</h1>
          <p>
            Configure safe HTTPS test receivers, send signed sandbox events, inspect delivery
            attempts, and retry failed simulator deliveries.
          </p>
        </div>
        <div className="workspace-row-actions">
          <Link href="/developer-api/reference" className="text-link-button">
            <ExternalLink size={16} />
            API reference
          </Link>
          <button className="text-link-button" type="button" onClick={loadData}>
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </section>

      {oneTimeSecret ? (
        <section className="workspace-alerts">
          <div className="alerts-head">
            <KeyRound size={18} />
            <strong>Signing secret shown once</strong>
          </div>
          <div className="alert-item">
            <p>
              {oneTimeSecret.warning} Endpoint: <strong>{oneTimeSecret.endpointName}</strong>
            </p>
            <code>{oneTimeSecret.signingSecret}</code>
            <button
              className="text-link-button"
              type="button"
              onClick={() => void navigator.clipboard.writeText(oneTimeSecret.signingSecret)}
            >
              <Copy size={16} />
              Copy
            </button>
          </div>
        </section>
      ) : null}

      {message ? <p className="workspace-success-copy">{message}</p> : null}
      {error ? <p className="workspace-error-copy">{error}</p> : null}

      <section className="workspace-stat-strip">
        <div className="workspace-stat">
          <span>Endpoints</span>
          <strong>{endpoints.length}</strong>
        </div>
        <div className="workspace-stat">
          <span>Delivered</span>
          <strong>{deliveries.filter((delivery) => delivery.status === "delivered").length}</strong>
        </div>
        <div className="workspace-stat">
          <span>Failed or blocked</span>
          <strong>
            {
              deliveries.filter((delivery) =>
                ["failed", "blocked"].includes(delivery.status)
              ).length
            }
          </strong>
        </div>
        <div className="workspace-stat">
          <span>Signed</span>
          <strong>HMAC v1</strong>
        </div>
      </section>

      <section className="workspace-table-shell">
        <div className="workspace-table-head">
          <div>
            <h2>Create endpoint</h2>
            <p>HTTPS is required by default. Localhost delivery must be enabled server-side for development.</p>
          </div>
        </div>
        <form className="api-key-form" onSubmit={createEndpoint}>
          <label>
            Endpoint name
            <input
              value={form.name}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                updateFormField("name", event.target.value)
              }
              placeholder="Integration receiver"
              required
            />
          </label>
          <label>
            Endpoint URL
            <input
              value={form.url}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                updateFormField("url", event.target.value)
              }
              placeholder="https://webhooks.example.test/invoice-lantern"
              required
            />
          </label>
          <label className="is-full">
            Description
            <textarea
              value={form.description}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                updateFormField("description", event.target.value)
              }
              placeholder="Internal receiver owner or purpose"
              rows={3}
            />
          </label>
          <div className="api-key-scope-grid is-full">
            {eventOptions.map((option) => (
              <label key={option.value}>
                <input
                  type="checkbox"
                  checked={form.eventTypes.includes(option.value)}
                  onChange={() => toggleEventType(option.value)}
                />
                <span>{option.label}</span>
                <small>{option.value}</small>
              </label>
            ))}
          </div>
          <div className="workspace-row-actions is-full">
            <button className="primary-action" type="submit" disabled={busyAction === "create"}>
              <Webhook size={16} />
              Create endpoint
            </button>
          </div>
        </form>
      </section>

      <section className="workspace-table-shell">
        <div className="workspace-table-head">
          <div>
            <h2>Endpoints</h2>
            <p>Raw secrets are not returned after creation or rotation.</p>
          </div>
        </div>
        <div className="api-key-card-list">
          {loading ? (
            <article className="api-key-card">
              <span className="status-pill">loading</span>
              <p>Loading webhook endpoints.</p>
            </article>
          ) : endpoints.length === 0 ? (
            <article className="api-key-card">
              <span className="status-pill">empty</span>
              <p>No webhook endpoints configured yet.</p>
            </article>
          ) : (
            endpoints.map((endpoint) => (
              <article
                className="api-key-card"
                key={endpoint.id}
                onClick={() => setSelectedEndpointId(endpoint.id)}
              >
                <div className="workspace-table-head">
                  <div>
                    <h3>{endpoint.name}</h3>
                    <p>{endpoint.url}</p>
                  </div>
                  <span className="status-pill">{endpoint.status}</span>
                </div>
                <div className="api-key-meta-grid">
                  <span>
                    Secret
                    <strong>{endpoint.signingSecretLast4 ? `****${endpoint.signingSecretLast4}` : "rotate"}</strong>
                  </span>
                  <span>
                    Last success
                    <strong>{formatDate(endpoint.lastSuccessAt)}</strong>
                  </span>
                  <span>
                    Failures
                    <strong>{endpoint.failureCount}</strong>
                  </span>
                </div>
                <div className="api-key-scope-list">
                  {endpoint.eventTypes.map((eventType) => (
                    <span key={eventType}>{eventType}</span>
                  ))}
                </div>
                <div className="workspace-row-actions">
                  <button
                    className="text-link-button"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void rotateSecret(endpoint);
                    }}
                  >
                    <RotateCcw size={16} />
                    Rotate
                  </button>
                  <button
                    className="text-link-button"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void disableEndpoint(endpoint);
                    }}
                    disabled={endpoint.status === "disabled"}
                  >
                    <Trash2 size={16} />
                    Disable
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="workspace-table-shell">
        <div className="workspace-table-head">
          <div>
            <h2>Send test event</h2>
            <p>Payloads are JSON objects and are rejected when secret-like keys or raw XML/SOAP are present.</p>
          </div>
        </div>
        <div className="api-key-form">
          <label>
            Endpoint
            <select
              value={selectedEndpointId}
              onChange={(event) => setSelectedEndpointId(event.target.value)}
            >
              {endpoints.map((endpoint) => (
                <option key={endpoint.id} value={endpoint.id}>
                  {endpoint.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Event type
            <select
              value={testEventType}
              onChange={(event) => setTestEventType(event.target.value as WebhookEventType)}
            >
              {eventOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.value}
                </option>
              ))}
            </select>
          </label>
          <label className="is-full">
            JSON data
            <textarea
              value={payloadText}
              onChange={(event) => setPayloadText(event.target.value)}
              rows={8}
              spellCheck={false}
            />
          </label>
          <div className="workspace-row-actions is-full">
            <button
              className="primary-action"
              type="button"
              onClick={() => void sendTestEvent()}
              disabled={!selectedEndpoint || busyAction?.startsWith("test")}
            >
              <Play size={16} />
              Send signed test
            </button>
          </div>
        </div>
      </section>

      <section className="workspace-table-shell">
        <div className="workspace-table-head">
          <div>
            <h2>Delivery logs</h2>
            <p>Headers and response previews are redacted before display.</p>
          </div>
        </div>
        <div className="api-request-log-list">
          {deliveries.length === 0 ? (
            <article className="api-request-log-row">
              <span className="status-pill">empty</span>
              <p>No webhook delivery attempts yet.</p>
            </article>
          ) : (
            deliveries.map((delivery) => (
              <article
                className="api-request-log-row"
                key={delivery.id}
                onClick={() => setSelectedDeliveryId(delivery.id)}
              >
                <div>
                  <strong>{delivery.eventType}</strong>
                  <p>
                    attempt {delivery.attemptNumber}/{delivery.maxAttempts} - {formatDate(delivery.createdAt)}
                  </p>
                </div>
                <span className="status-pill">{delivery.status}</span>
                <span>{delivery.responseStatus ?? "no response"}</span>
                <span>{delivery.responseTimeMs ?? 0} ms</span>
                <button
                  className="text-link-button"
                  type="button"
                  disabled={
                    !["failed", "blocked", "retry_scheduled"].includes(delivery.status) ||
                    delivery.attemptNumber >= delivery.maxAttempts
                  }
                  onClick={(event) => {
                    event.stopPropagation();
                    void retryDelivery(delivery);
                  }}
                >
                  <RefreshCw size={16} />
                  Retry
                </button>
              </article>
            ))
          )}
        </div>
        {selectedDelivery ? (
          <div className="developer-console">
            <div className="developer-console-head">
              <ShieldCheck size={18} />
              <div>
                <h3>Delivery detail</h3>
                <p>{selectedDelivery.id}</p>
              </div>
            </div>
            <div className="api-key-meta-grid">
              <span>
                Signature
                <strong>{selectedDelivery.signatureHeaderPresent ? "present" : "not sent"}</strong>
              </span>
              <span>
                Error
                <strong>{selectedDelivery.errorCode ?? "none"}</strong>
              </span>
              <span>
                Next retry
                <strong>{formatDate(selectedDelivery.nextRetryAt)}</strong>
              </span>
            </div>
            <pre>{JSON.stringify(selectedDelivery.requestPayload, null, 2)}</pre>
            {selectedDelivery.responseBodyPreview ? (
              <pre>{selectedDelivery.responseBodyPreview}</pre>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="workspace-alerts">
        <div className="alerts-head">
          <ShieldCheck size={18} />
          <strong>Signing and safety notes</strong>
        </div>
        <div className="alert-list">
          <div className="alert-item">
            <p>
              Verify `Invoice-Lantern-Webhook-Signature` by computing HMAC SHA-256 over
              `timestamp.deliveryId.rawJsonPayload` and comparing it to `v1=...`.
            </p>
          </div>
          <div className="alert-item">
            <p>
              URLs must be HTTPS unless localhost delivery is explicitly enabled for local development.
              Private, internal, metadata, credentialed, non-http, and redirect targets are blocked.
            </p>
          </div>
          <div className="alert-item">
            <p>
              Webhook events are non-official sandbox events for technical integration testing. They are
              not filing, authority submission, downstream acceptance, legal advice, tax advice,
              accounting advice, or a compliance guarantee.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

async function readJson(response: Response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      typeof data?.error?.message === "string"
        ? data.error.message
        : "Webhook request failed.";

    throw new Error(message);
  }

  return data;
}

function readError(error: unknown) {
  return error instanceof Error ? error.message : "Webhook request failed.";
}

function parsePayload(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return {};
  }

  const parsed = JSON.parse(trimmed) as unknown;

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Webhook test payload must be a JSON object.");
  }

  return parsed as Record<string, unknown>;
}

function formatDate(value: string | null) {
  if (!value) {
    return "never";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
