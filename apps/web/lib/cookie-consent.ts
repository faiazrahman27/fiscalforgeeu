export const COOKIE_CONSENT_STORAGE_KEY = "il-cookie-consent";
export const COOKIE_CONSENT_VERSION = "2026.05.15";

export type CookieConsentCategory =
  | "essential"
  | "functional"
  | "analytics"
  | "marketing";

export type CookieConsentRecord = {
  version: string;
  savedAt: string;
  categories: Record<CookieConsentCategory, boolean>;
};

export const COOKIE_CONSENT_CATEGORIES: Array<{
  key: CookieConsentCategory;
  label: string;
  description: string;
  required: boolean;
  available: boolean;
}> = [
  {
    key: "essential",
    label: "Essential",
    description:
      "Required for auth sessions, security checks, legal preference storage, and safe platform operation.",
    required: true,
    available: true
  },
  {
    key: "functional",
    label: "Functional and PWA preferences",
    description:
      "Optional browser-only preferences for install prompts, offline capability notices, and non-sensitive UI state. This never stores raw XML, invoices, API keys, webhook secrets, VIES data, or workspace data.",
    required: false,
    available: true
  },
  {
    key: "analytics",
    label: "Analytics",
    description:
      "Not used in this release candidate. No analytics provider or tracking script is installed.",
    required: false,
    available: false
  },
  {
    key: "marketing",
    label: "Marketing",
    description:
      "Not used in this release candidate. No advertising or marketing cookie provider is installed.",
    required: false,
    available: false
  }
];

export function createCookieConsentRecord(
  categories: Partial<Record<CookieConsentCategory, boolean>>
): CookieConsentRecord {
  return {
    version: COOKIE_CONSENT_VERSION,
    savedAt: new Date().toISOString(),
    categories: {
      essential: true,
      functional: categories.functional === true,
      analytics: false,
      marketing: false
    }
  };
}

export function parseCookieConsentRecord(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<CookieConsentRecord>;

    if (
      parsed.version !== COOKIE_CONSENT_VERSION ||
      typeof parsed.savedAt !== "string" ||
      typeof parsed.categories !== "object" ||
      parsed.categories === null
    ) {
      return null;
    }

    return {
      ...createCookieConsentRecord({
        functional: parsed.categories.functional === true
      }),
      savedAt: parsed.savedAt
    };
  } catch {
    return null;
  }
}
