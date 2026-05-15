"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { Archive, BadgeCheck, Building2, RefreshCw, Save } from "lucide-react";

type BusinessProfileStatus = "active" | "archived";
type BusinessProfileType = "seller" | "buyer" | "both";

type BusinessProfileRecord = {
  id: string;
  profileType: BusinessProfileType;
  displayName: string;
  legalName: string | null;
  tradingName: string | null;
  countryCode: string;
  vatId: string | null;
  taxRegistrationNumber: string | null;
  electronicAddress: string | null;
  electronicAddressScheme: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  defaultCurrency: string | null;
  paymentTerms: string | null;
  bankAccountLabel: string | null;
  bankAccountLast4: string | null;
  status: BusinessProfileStatus;
  updatedAt: string;
};

type BusinessProfileForm = {
  profileType: BusinessProfileType;
  displayName: string;
  legalName: string;
  tradingName: string;
  countryCode: string;
  vatId: string;
  taxRegistrationNumber: string;
  electronicAddress: string;
  electronicAddressScheme: string;
  email: string;
  phone: string;
  website: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
  defaultCurrency: string;
  paymentTerms: string;
  bankAccountLabel: string;
  bankAccountLast4: string;
};

const emptyForm: BusinessProfileForm = {
  profileType: "seller",
  displayName: "",
  legalName: "",
  tradingName: "",
  countryCode: "DE",
  vatId: "",
  taxRegistrationNumber: "",
  electronicAddress: "",
  electronicAddressScheme: "",
  email: "",
  phone: "",
  website: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  region: "",
  postalCode: "",
  defaultCurrency: "EUR",
  paymentTerms: "",
  bankAccountLabel: "",
  bankAccountLast4: ""
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

function normalizeProfileType(value: unknown): BusinessProfileType {
  if (value === "buyer" || value === "both") {
    return value;
  }

  return "seller";
}

function normalizeStatus(value: unknown): BusinessProfileStatus {
  return value === "archived" ? "archived" : "active";
}

function normalizeBusinessProfile(value: unknown): BusinessProfileRecord | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const id = readStringField(value, "id");
  const displayName = readStringField(value, "displayName");
  const countryCode = readStringField(value, "countryCode");

  if (!id || !displayName || !countryCode) {
    return null;
  }

  return {
    id,
    profileType: normalizeProfileType(value.profileType),
    displayName,
    legalName: readNullableStringField(value, "legalName"),
    tradingName: readNullableStringField(value, "tradingName"),
    countryCode,
    vatId: readNullableStringField(value, "vatId"),
    taxRegistrationNumber: readNullableStringField(
      value,
      "taxRegistrationNumber"
    ),
    electronicAddress: readNullableStringField(value, "electronicAddress"),
    electronicAddressScheme: readNullableStringField(
      value,
      "electronicAddressScheme"
    ),
    email: readNullableStringField(value, "email"),
    phone: readNullableStringField(value, "phone"),
    website: readNullableStringField(value, "website"),
    addressLine1: readNullableStringField(value, "addressLine1"),
    addressLine2: readNullableStringField(value, "addressLine2"),
    city: readNullableStringField(value, "city"),
    region: readNullableStringField(value, "region"),
    postalCode: readNullableStringField(value, "postalCode"),
    defaultCurrency: readNullableStringField(value, "defaultCurrency"),
    paymentTerms: readNullableStringField(value, "paymentTerms"),
    bankAccountLabel: readNullableStringField(value, "bankAccountLabel"),
    bankAccountLast4: readNullableStringField(value, "bankAccountLast4"),
    status: normalizeStatus(value.status),
    updatedAt: readStringField(value, "updatedAt")
  };
}

function getRecords(data: unknown) {
  if (!isPlainObject(data) || !Array.isArray(data.records)) {
    return [];
  }

  return data.records;
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

function formatDateTime(value: string) {
  if (!value) {
    return "Not recorded";
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

function nullableText(value: string) {
  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function buildPayload(form: BusinessProfileForm) {
  return {
    profileType: form.profileType,
    displayName: form.displayName.trim(),
    legalName: nullableText(form.legalName),
    tradingName: nullableText(form.tradingName),
    countryCode: form.countryCode.trim().toUpperCase(),
    vatId: nullableText(form.vatId.toUpperCase()),
    taxRegistrationNumber: nullableText(form.taxRegistrationNumber),
    electronicAddress: nullableText(form.electronicAddress),
    electronicAddressScheme: nullableText(form.electronicAddressScheme),
    email: nullableText(form.email),
    phone: nullableText(form.phone),
    website: nullableText(form.website),
    addressLine1: nullableText(form.addressLine1),
    addressLine2: nullableText(form.addressLine2),
    city: nullableText(form.city),
    region: nullableText(form.region),
    postalCode: nullableText(form.postalCode),
    defaultCurrency: nullableText(form.defaultCurrency.toUpperCase()),
    paymentTerms: nullableText(form.paymentTerms),
    bankAccountLabel: nullableText(form.bankAccountLabel),
    bankAccountLast4: nullableText(form.bankAccountLast4),
    status: "active" as const
  };
}

function formFromRecord(record: BusinessProfileRecord): BusinessProfileForm {
  return {
    profileType: record.profileType,
    displayName: record.displayName,
    legalName: record.legalName ?? "",
    tradingName: record.tradingName ?? "",
    countryCode: record.countryCode,
    vatId: record.vatId ?? "",
    taxRegistrationNumber: record.taxRegistrationNumber ?? "",
    electronicAddress: record.electronicAddress ?? "",
    electronicAddressScheme: record.electronicAddressScheme ?? "",
    email: record.email ?? "",
    phone: record.phone ?? "",
    website: record.website ?? "",
    addressLine1: record.addressLine1 ?? "",
    addressLine2: record.addressLine2 ?? "",
    city: record.city ?? "",
    region: record.region ?? "",
    postalCode: record.postalCode ?? "",
    defaultCurrency: record.defaultCurrency ?? "",
    paymentTerms: record.paymentTerms ?? "",
    bankAccountLabel: record.bankAccountLabel ?? "",
    bankAccountLast4: record.bankAccountLast4 ?? ""
  };
}

export default function WorkspaceBusinessProfilesPage() {
  const [records, setRecords] = useState<BusinessProfileRecord[]>([]);
  const [form, setForm] = useState<BusinessProfileForm>(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [archivingId, setArchivingId] = useState("");

  const sellerCount = useMemo(
    () =>
      records.filter(
        (record) => record.profileType === "seller" || record.profileType === "both"
      ).length,
    [records]
  );
  const buyerCount = useMemo(
    () =>
      records.filter(
        (record) => record.profileType === "buyer" || record.profileType === "both"
      ).length,
    [records]
  );

  async function loadProfiles() {
    setIsLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/local/workspace/business-profiles", {
        method: "GET",
        cache: "no-store"
      });
      const data = await readResponseBody(response);

      if (!response.ok) {
        setRecords([]);
        setMessage(
          getApiErrorMessage(data, "Workspace business profiles are unavailable.")
        );
        return;
      }

      setRecords(
        getRecords(data)
          .map((record) => normalizeBusinessProfile(record))
          .filter((record): record is BusinessProfileRecord => record !== null)
      );
    } catch {
      setRecords([]);
      setMessage(
        "Workspace business profiles are unavailable through the local API proxy."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadProfiles();
  }, []);

  function updateForm<K extends keyof BusinessProfileForm>(
    key: K,
    value: BusinessProfileForm[K]
  ) {
    setForm((current) => ({
      ...current,
      [key]: value
    }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId("");
  }

  async function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");

    const payload = buildPayload(form);
    const url = editingId
      ? `/api/local/workspace/business-profiles/${encodeURIComponent(editingId)}`
      : "/api/local/workspace/business-profiles";

    try {
      const response = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(payload),
        cache: "no-store"
      });
      const data = await readResponseBody(response);

      if (!response.ok) {
        setMessage(getApiErrorMessage(data, "Could not save business profile."));
        return;
      }

      setMessage(editingId ? "Business profile updated." : "Business profile created.");
      resetForm();
      await loadProfiles();
    } catch {
      setMessage("Could not save business profile through the local API proxy.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function archiveProfile(record: BusinessProfileRecord) {
    setArchivingId(record.id);
    setMessage("");

    try {
      const response = await fetch(
        `/api/local/workspace/business-profiles/${encodeURIComponent(record.id)}`,
        {
          method: "DELETE",
          cache: "no-store"
        }
      );
      const data = await readResponseBody(response);

      if (!response.ok) {
        setMessage(getApiErrorMessage(data, "Could not archive business profile."));
        return;
      }

      setMessage("Business profile archived.");
      await loadProfiles();
    } catch {
      setMessage("Could not archive business profile through the local API proxy.");
    } finally {
      setArchivingId("");
    }
  }

  return (
    <div className="workspace-page">
      <section className="workspace-page-head">
        <p className="workspace-kicker">Business profiles</p>
        <h2>Maintain reusable seller and buyer records.</h2>
        <p>
          Profiles are workspace records for faster invoice drafting. They are
          not official registration verification, tax advice, accounting advice,
          filing, authority acceptance, or a compliance guarantee.
        </p>
      </section>

      <section className="workspace-data-grid">
        <article className="workspace-data-card">
          <p>Active profiles</p>
          <strong>{isLoading ? "Loading" : records.length}</strong>
          <span>Reusable workspace records visible to allowed members.</span>
        </article>

        <article className="workspace-data-card is-good">
          <p>Seller-ready</p>
          <strong>{isLoading ? "Loading" : sellerCount}</strong>
          <span>Profiles available for seller-side draft copying.</span>
        </article>

        <article className="workspace-data-card is-warn">
          <p>Buyer-ready</p>
          <strong>{isLoading ? "Loading" : buyerCount}</strong>
          <span>Profiles available for buyer-side draft copying.</span>
        </article>
      </section>

      {message ? (
        <section className="workspace-alerts">
          <div className="alert-item">
            <span />
            <p>{message}</p>
          </div>
        </section>
      ) : null}

      <section className="workspace-table-shell">
        <div className="workspace-table-head">
          <div>
            <p>{editingId ? "Edit profile" : "Create profile"}</p>
            <h3>Profile details</h3>
          </div>

          <div className="workspace-row-actions">
            <button type="button" onClick={() => void loadProfiles()}>
              <RefreshCw size={16} />
              Refresh
            </button>
            {editingId ? (
              <button type="button" onClick={resetForm}>
                Cancel edit
              </button>
            ) : null}
          </div>
        </div>

        <form className="workspace-form-grid" onSubmit={submitProfile}>
          <label>
            <span>Profile type</span>
            <select
              value={form.profileType}
              onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                updateForm("profileType", event.target.value as BusinessProfileType)
              }
            >
              <option value="seller">Seller</option>
              <option value="buyer">Buyer</option>
              <option value="both">Both</option>
            </select>
          </label>

          <FormInput
            label="Display name"
            value={form.displayName}
            onChange={(value) => updateForm("displayName", value)}
            required
          />
          <FormInput
            label="Legal name"
            value={form.legalName}
            onChange={(value) => updateForm("legalName", value)}
          />
          <FormInput
            label="Trading name"
            value={form.tradingName}
            onChange={(value) => updateForm("tradingName", value)}
          />
          <FormInput
            label="Country code"
            value={form.countryCode}
            maxLength={2}
            onChange={(value) => updateForm("countryCode", value.toUpperCase())}
            required
          />
          <FormInput
            label="VAT ID"
            value={form.vatId}
            onChange={(value) => updateForm("vatId", value.toUpperCase())}
          />
          <FormInput
            label="Tax registration number"
            value={form.taxRegistrationNumber}
            onChange={(value) => updateForm("taxRegistrationNumber", value)}
          />
          <FormInput
            label="Electronic address"
            value={form.electronicAddress}
            onChange={(value) => updateForm("electronicAddress", value)}
          />
          <FormInput
            label="Electronic address scheme"
            value={form.electronicAddressScheme}
            onChange={(value) => updateForm("electronicAddressScheme", value)}
          />
          <FormInput
            label="Email"
            value={form.email}
            type="email"
            onChange={(value) => updateForm("email", value)}
          />
          <FormInput
            label="Phone"
            value={form.phone}
            onChange={(value) => updateForm("phone", value)}
          />
          <FormInput
            label="Website"
            value={form.website}
            onChange={(value) => updateForm("website", value)}
          />
          <FormInput
            label="Address line 1"
            value={form.addressLine1}
            onChange={(value) => updateForm("addressLine1", value)}
          />
          <FormInput
            label="Address line 2"
            value={form.addressLine2}
            onChange={(value) => updateForm("addressLine2", value)}
          />
          <FormInput
            label="City"
            value={form.city}
            onChange={(value) => updateForm("city", value)}
          />
          <FormInput
            label="Region"
            value={form.region}
            onChange={(value) => updateForm("region", value)}
          />
          <FormInput
            label="Postal code"
            value={form.postalCode}
            onChange={(value) => updateForm("postalCode", value)}
          />
          <FormInput
            label="Default currency"
            value={form.defaultCurrency}
            maxLength={3}
            onChange={(value) => updateForm("defaultCurrency", value.toUpperCase())}
          />
          <FormInput
            label="Payment terms"
            value={form.paymentTerms}
            onChange={(value) => updateForm("paymentTerms", value)}
          />
          <FormInput
            label="Bank account label"
            value={form.bankAccountLabel}
            onChange={(value) => updateForm("bankAccountLabel", value)}
          />
          <FormInput
            label="Bank account last 4"
            value={form.bankAccountLast4}
            maxLength={4}
            onChange={(value) => updateForm("bankAccountLast4", value)}
          />

          <button
            type="submit"
            className="workspace-auth-action"
            disabled={isSubmitting || !form.displayName.trim() || !form.countryCode.trim()}
          >
            <Save size={16} />
            {isSubmitting ? "Saving" : editingId ? "Update profile" : "Create profile"}
          </button>
        </form>
      </section>

      <section className="workspace-table-shell">
        <div className="workspace-table-head">
          <div>
            <p>Active records</p>
            <h3>Reusable profiles</h3>
          </div>

          <Building2 size={20} />
        </div>

        <div className="workspace-table">
          {isLoading ? (
            <ProfileRow title="Loading business profiles" detail="Reading workspace records." />
          ) : records.length === 0 ? (
            <ProfileRow
              title="No active business profiles"
              detail="Create a profile above to copy seller or buyer data into invoice drafts."
            />
          ) : (
            records.map((record) => (
              <article className="workspace-table-row" key={record.id}>
                <div>
                  <strong>{record.displayName}</strong>
                  <span>
                    {record.profileType} profile - {record.countryCode}
                    {record.vatId ? ` - ${record.vatId}` : ""}
                  </span>
                  <span>
                    {record.city || "No city"} {record.postalCode || ""}. Updated{" "}
                    {formatDateTime(record.updatedAt)}.
                  </span>
                  <span>
                    Bank storage: {record.bankAccountLabel || "label not set"}
                    {record.bankAccountLast4
                      ? `, last 4 ${record.bankAccountLast4}`
                      : ", no account digits"}
                    . Full bank account numbers are not stored.
                  </span>
                </div>

                <div>
                  <span className="status-pill">{record.status}</span>
                </div>

                <div className="workspace-row-actions">
                  <button
                    type="button"
                    onClick={() => {
                      setForm(formFromRecord(record));
                      setEditingId(record.id);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void archiveProfile(record)}
                    disabled={archivingId === record.id}
                  >
                    <Archive size={16} />
                    {archivingId === record.id ? "Archiving" : "Archive"}
                  </button>
                </div>

                <strong>{record.defaultCurrency || "No currency"}</strong>

                <BadgeCheck size={17} />
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function FormInput({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  maxLength
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  maxLength?: number;
}) {
  return (
    <label>
      <span>{label}</span>
      <input
        type={type}
        value={value}
        maxLength={maxLength}
        required={required}
        onChange={(event: ChangeEvent<HTMLInputElement>) =>
          onChange(event.target.value)
        }
      />
    </label>
  );
}

function ProfileRow({ title, detail }: { title: string; detail: string }) {
  return (
    <article className="workspace-table-row">
      <div>
        <strong>{title}</strong>
        <span>{detail}</span>
      </div>
      <div>
        <span className="status-pill">workspace</span>
      </div>
      <div>
        <span>profiles</span>
      </div>
      <strong>0</strong>
      <Building2 size={17} />
    </article>
  );
}
