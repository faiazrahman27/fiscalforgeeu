"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { Archive, ContactRound, RefreshCw, Save, UsersRound } from "lucide-react";

type ContactStatus = "active" | "archived";
type ContactType = "business" | "person" | "department" | "other";

type BusinessProfileOption = {
  id: string;
  displayName: string;
  profileType: string;
};

type ContactRecord = {
  id: string;
  businessProfileId: string | null;
  contactType: ContactType;
  displayName: string;
  legalName: string | null;
  email: string | null;
  phone: string | null;
  countryCode: string | null;
  vatId: string | null;
  taxRegistrationNumber: string | null;
  electronicAddress: string | null;
  electronicAddressScheme: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  notes: string | null;
  status: ContactStatus;
  updatedAt: string;
};

type ContactForm = {
  businessProfileId: string;
  contactType: ContactType;
  displayName: string;
  legalName: string;
  email: string;
  phone: string;
  countryCode: string;
  vatId: string;
  taxRegistrationNumber: string;
  electronicAddress: string;
  electronicAddressScheme: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
  notes: string;
};

const emptyForm: ContactForm = {
  businessProfileId: "",
  contactType: "business",
  displayName: "",
  legalName: "",
  email: "",
  phone: "",
  countryCode: "",
  vatId: "",
  taxRegistrationNumber: "",
  electronicAddress: "",
  electronicAddressScheme: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  region: "",
  postalCode: "",
  notes: ""
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

function normalizeContactType(value: unknown): ContactType {
  if (value === "person" || value === "department" || value === "other") {
    return value;
  }

  return "business";
}

function normalizeStatus(value: unknown): ContactStatus {
  return value === "archived" ? "archived" : "active";
}

function normalizeBusinessProfileOption(
  value: unknown
): BusinessProfileOption | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const id = readStringField(value, "id");
  const displayName = readStringField(value, "displayName");

  if (!id || !displayName) {
    return null;
  }

  return {
    id,
    displayName,
    profileType: readStringField(value, "profileType", "profile")
  };
}

function normalizeContact(value: unknown): ContactRecord | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const id = readStringField(value, "id");
  const displayName = readStringField(value, "displayName");

  if (!id || !displayName) {
    return null;
  }

  return {
    id,
    businessProfileId: readNullableStringField(value, "businessProfileId"),
    contactType: normalizeContactType(value.contactType),
    displayName,
    legalName: readNullableStringField(value, "legalName"),
    email: readNullableStringField(value, "email"),
    phone: readNullableStringField(value, "phone"),
    countryCode: readNullableStringField(value, "countryCode"),
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
    addressLine1: readNullableStringField(value, "addressLine1"),
    addressLine2: readNullableStringField(value, "addressLine2"),
    city: readNullableStringField(value, "city"),
    region: readNullableStringField(value, "region"),
    postalCode: readNullableStringField(value, "postalCode"),
    notes: readNullableStringField(value, "notes"),
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

function nullableText(value: string) {
  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
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

function buildPayload(form: ContactForm) {
  return {
    businessProfileId: nullableText(form.businessProfileId),
    contactType: form.contactType,
    displayName: form.displayName.trim(),
    legalName: nullableText(form.legalName),
    email: nullableText(form.email),
    phone: nullableText(form.phone),
    countryCode: nullableText(form.countryCode.toUpperCase()),
    vatId: nullableText(form.vatId.toUpperCase()),
    taxRegistrationNumber: nullableText(form.taxRegistrationNumber),
    electronicAddress: nullableText(form.electronicAddress),
    electronicAddressScheme: nullableText(form.electronicAddressScheme),
    addressLine1: nullableText(form.addressLine1),
    addressLine2: nullableText(form.addressLine2),
    city: nullableText(form.city),
    region: nullableText(form.region),
    postalCode: nullableText(form.postalCode),
    notes: nullableText(form.notes),
    status: "active" as const
  };
}

function formFromRecord(record: ContactRecord): ContactForm {
  return {
    businessProfileId: record.businessProfileId ?? "",
    contactType: record.contactType,
    displayName: record.displayName,
    legalName: record.legalName ?? "",
    email: record.email ?? "",
    phone: record.phone ?? "",
    countryCode: record.countryCode ?? "",
    vatId: record.vatId ?? "",
    taxRegistrationNumber: record.taxRegistrationNumber ?? "",
    electronicAddress: record.electronicAddress ?? "",
    electronicAddressScheme: record.electronicAddressScheme ?? "",
    addressLine1: record.addressLine1 ?? "",
    addressLine2: record.addressLine2 ?? "",
    city: record.city ?? "",
    region: record.region ?? "",
    postalCode: record.postalCode ?? "",
    notes: record.notes ?? ""
  };
}

export default function WorkspaceContactsPage() {
  const [profiles, setProfiles] = useState<BusinessProfileOption[]>([]);
  const [records, setRecords] = useState<ContactRecord[]>([]);
  const [form, setForm] = useState<ContactForm>(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [archivingId, setArchivingId] = useState("");

  const linkedCount = useMemo(
    () => records.filter((record) => record.businessProfileId).length,
    [records]
  );

  async function loadContacts() {
    setIsLoading(true);
    setMessage("");

    try {
      const [contactsResponse, profilesResponse] = await Promise.all([
        fetch("/api/local/workspace/contacts", {
          method: "GET",
          cache: "no-store"
        }),
        fetch("/api/local/workspace/business-profiles", {
          method: "GET",
          cache: "no-store"
        })
      ]);
      const contactsData = await readResponseBody(contactsResponse);
      const profilesData = await readResponseBody(profilesResponse);
      const messages: string[] = [];

      if (contactsResponse.ok) {
        setRecords(
          getRecords(contactsData)
            .map((record) => normalizeContact(record))
            .filter((record): record is ContactRecord => record !== null)
        );
      } else {
        setRecords([]);
        messages.push(
          getApiErrorMessage(contactsData, "Workspace contacts are unavailable.")
        );
      }

      if (profilesResponse.ok) {
        setProfiles(
          getRecords(profilesData)
            .map((record) => normalizeBusinessProfileOption(record))
            .filter((record): record is BusinessProfileOption => record !== null)
        );
      } else {
        setProfiles([]);
        messages.push(
          getApiErrorMessage(
            profilesData,
            "Workspace business profile options are unavailable."
          )
        );
      }

      setMessage(messages.join(" "));
    } catch {
      setRecords([]);
      setProfiles([]);
      setMessage("Workspace contacts are unavailable through the local API proxy.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadContacts();
  }, []);

  function updateForm<K extends keyof ContactForm>(key: K, value: ContactForm[K]) {
    setForm((current) => ({
      ...current,
      [key]: value
    }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId("");
  }

  async function submitContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");

    const payload = buildPayload(form);
    const url = editingId
      ? `/api/local/workspace/contacts/${encodeURIComponent(editingId)}`
      : "/api/local/workspace/contacts";

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
        setMessage(getApiErrorMessage(data, "Could not save contact."));
        return;
      }

      setMessage(editingId ? "Contact updated." : "Contact created.");
      resetForm();
      await loadContacts();
    } catch {
      setMessage("Could not save contact through the local API proxy.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function archiveContact(record: ContactRecord) {
    setArchivingId(record.id);
    setMessage("");

    try {
      const response = await fetch(
        `/api/local/workspace/contacts/${encodeURIComponent(record.id)}`,
        {
          method: "DELETE",
          cache: "no-store"
        }
      );
      const data = await readResponseBody(response);

      if (!response.ok) {
        setMessage(getApiErrorMessage(data, "Could not archive contact."));
        return;
      }

      setMessage("Contact archived.");
      await loadContacts();
    } catch {
      setMessage("Could not archive contact through the local API proxy.");
    } finally {
      setArchivingId("");
    }
  }

  function getLinkedProfileLabel(record: ContactRecord) {
    if (!record.businessProfileId) {
      return "No linked profile";
    }

    return (
      profiles.find((profile) => profile.id === record.businessProfileId)
        ?.displayName ?? "Linked profile"
    );
  }

  return (
    <div className="workspace-page">
      <section className="workspace-page-head">
        <p className="workspace-kicker">Contacts</p>
        <h2>Maintain reusable buyer and party contacts.</h2>
        <p>
          Contacts are workspace drafting records. They are not official
          registration verification, VIES evidence, filing, authority
          acceptance, legal advice, tax advice, or accounting advice.
        </p>
      </section>

      <section className="workspace-data-grid">
        <article className="workspace-data-card">
          <p>Active contacts</p>
          <strong>{isLoading ? "Loading" : records.length}</strong>
          <span>Reusable contact records for invoice drafting.</span>
        </article>

        <article className="workspace-data-card is-good">
          <p>Linked profiles</p>
          <strong>{isLoading ? "Loading" : linkedCount}</strong>
          <span>Contacts connected to workspace business profiles.</span>
        </article>

        <article className="workspace-data-card is-warn">
          <p>Profile options</p>
          <strong>{isLoading ? "Loading" : profiles.length}</strong>
          <span>Optional links remain tenant-scoped.</span>
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
            <p>{editingId ? "Edit contact" : "Create contact"}</p>
            <h3>Contact details</h3>
          </div>

          <div className="workspace-row-actions">
            <button type="button" onClick={() => void loadContacts()}>
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

        <form className="workspace-form-grid" onSubmit={submitContact}>
          <label>
            <span>Business profile link</span>
            <select
              value={form.businessProfileId}
              onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                updateForm("businessProfileId", event.target.value)
              }
            >
              <option value="">No linked profile</option>
              {profiles.map((profile) => (
                <option value={profile.id} key={profile.id}>
                  {profile.displayName} ({profile.profileType})
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Contact type</span>
            <select
              value={form.contactType}
              onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                updateForm("contactType", event.target.value as ContactType)
              }
            >
              <option value="business">Business</option>
              <option value="person">Person</option>
              <option value="department">Department</option>
              <option value="other">Other</option>
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
            label="Country code"
            value={form.countryCode}
            maxLength={2}
            onChange={(value) => updateForm("countryCode", value.toUpperCase())}
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

          <label>
            <span>Notes</span>
            <textarea
              value={form.notes}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                updateForm("notes", event.target.value)
              }
              rows={4}
            />
          </label>

          <button
            type="submit"
            className="workspace-auth-action"
            disabled={isSubmitting || !form.displayName.trim()}
          >
            <Save size={16} />
            {isSubmitting ? "Saving" : editingId ? "Update contact" : "Create contact"}
          </button>
        </form>
      </section>

      <section className="workspace-table-shell">
        <div className="workspace-table-head">
          <div>
            <p>Active records</p>
            <h3>Reusable contacts</h3>
          </div>

          <UsersRound size={20} />
        </div>

        <div className="workspace-table">
          {isLoading ? (
            <ContactRow title="Loading contacts" detail="Reading workspace records." />
          ) : records.length === 0 ? (
            <ContactRow
              title="No active contacts"
              detail="Create a contact above to copy buyer data into invoice drafts."
            />
          ) : (
            records.map((record) => (
              <article className="workspace-table-row" key={record.id}>
                <div>
                  <strong>{record.displayName}</strong>
                  <span>
                    {record.contactType} contact - {record.countryCode || "No country"}
                    {record.vatId ? ` - ${record.vatId}` : ""}
                  </span>
                  <span>
                    {getLinkedProfileLabel(record)}. Updated{" "}
                    {formatDateTime(record.updatedAt)}.
                  </span>
                  <span>
                    {record.email || "No email"} {record.phone || ""}
                    {record.notes ? `. Notes: ${record.notes}` : ""}
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
                    onClick={() => void archiveContact(record)}
                    disabled={archivingId === record.id}
                  >
                    <Archive size={16} />
                    {archivingId === record.id ? "Archiving" : "Archive"}
                  </button>
                </div>

                <strong>{record.city || "No city"}</strong>

                <ContactRound size={17} />
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

function ContactRow({ title, detail }: { title: string; detail: string }) {
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
        <span>contacts</span>
      </div>
      <strong>0</strong>
      <ContactRound size={17} />
    </article>
  );
}
