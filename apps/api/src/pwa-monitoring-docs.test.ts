import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const repoRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../.."
);

function readRepoFile(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

test("PWA service worker keeps sensitive routes out of runtime caches", () => {
  const serviceWorker = readRepoFile("apps/web/public/sw.js");

  for (const deniedPrefix of [
    "/api/",
    "/api/local/",
    "/api/v1/",
    "/workspace",
    "/auth/callback",
    "/auth/sign-out"
  ]) {
    assert.match(serviceWorker, new RegExp(deniedPrefix.replaceAll("/", "\\/")));
  }

  assert.match(serviceWorker, /networkOnly/);
  assert.match(serviceWorker, /no-store/);
  assert.doesNotMatch(serviceWorker, /FiscalForge/i);
});

test("encrypted offline draft storage does not persist keys or plaintext fallback", () => {
  const secureStore = readRepoFile("apps/web/lib/pwa/secure-local-store.ts");
  const offlineDrafts = readRepoFile("apps/web/lib/pwa/offline-drafts.ts");
  const combined = `${secureStore}\n${offlineDrafts}`;

  assert.match(combined, /AES-GCM/);
  assert.match(combined, /PBKDF2-SHA-256/);
  assert.match(combined, /IndexedDB|indexedDB/);
  assert.match(combined, /localOnly/);
  assert.doesNotMatch(combined, /localStorage\.setItem/);
  assert.doesNotMatch(combined, /sessionStorage\.setItem/);
  assert.doesNotMatch(combined, /store.*passphrase/i);
  assert.doesNotMatch(combined, /FiscalForge/i);
});

test("PWA, monitoring, and incident readiness docs exist with required boundaries", () => {
  const docs = [
    "docs/architecture/pwa-mobile-offline-security.md",
    "docs/architecture/monitoring-security-incident-readiness.md",
    "docs/security/incident-response.md",
    "docs/security/security-readiness-checklist.md",
    "docs/security/pwa-cache-offline-policy.md"
  ].map((path) => readRepoFile(path));
  const combined = docs.join("\n");

  for (const phrase of [
    "offline capability",
    "Encrypted local drafts",
    "Cache Deny List",
    "detect",
    "Classify severity",
    "Contain",
    "Investigate",
    "Notify if required",
    "Post-incident review",
    "validation_runs_total",
    "security_events",
    "professional review"
  ]) {
    assert.match(combined, new RegExp(phrase, "i"));
  }

  assert.doesNotMatch(combined, /FiscalForge/i);
  assert.doesNotMatch(
    combined,
    /\bis official EU software\b|\bprovides official filing\b|\bguarantees uptime\b|\bis security certified\b|\bis GDPR compliant\b|\bproves compliance\b/i
  );
});

test("release-candidate public web hardening surfaces are present and safe", () => {
  const cookieConsent = readRepoFile("apps/web/lib/cookie-consent.ts");
  const cookieBanner = readRepoFile("apps/web/components/cookie-consent-banner.tsx");
  const siteFooter = readRepoFile("apps/web/components/site-footer.tsx");
  const signUpPage = readRepoFile("apps/web/app/auth/sign-up/page.tsx");
  const signInPage = readRepoFile("apps/web/app/auth/sign-in/page.tsx");
  const legalGate = readRepoFile("apps/web/components/legal-acceptance-gate.tsx");
  const legalAcceptancePage = readRepoFile(
    "apps/web/app/workspace/legal-acceptance/page.tsx"
  );
  const legalDocuments = readRepoFile("apps/web/lib/legal-documents.ts");
  const aboutPage = readRepoFile("apps/web/app/about/page.tsx");
  const contactPage = readRepoFile("apps/web/app/contact/page.tsx");
  const webEnvExample = readRepoFile("apps/web/.env.example");
  const combined = [
    cookieConsent,
    cookieBanner,
    siteFooter,
    signUpPage,
    signInPage,
    legalGate,
    legalAcceptancePage,
    legalDocuments,
    aboutPage,
    contactPage,
    webEnvExample
  ].join("\n");

  for (const phrase of [
    "COOKIE_CONSENT_VERSION",
    "essential",
    "functional",
    "analytics",
    "marketing",
    "Manage cookies",
    "Cookie Policy",
    "Privacy Policy",
    "Terms of Service",
    "Acceptable Use Policy",
    "Disclaimer / No Tax Advice / No Official Filing boundary",
    "invoice_lantern_required_legal_acknowledgement",
    "/api/local/legal/acceptances/me",
    "/workspace/legal-acceptance",
    "NEXT_PUBLIC_CONTACT_EMAIL",
    "NEXT_PUBLIC_SECURITY_CONTACT_EMAIL",
    "NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL",
    "NEXT_PUBLIC_INCIDENT_CONTACT_EMAIL"
  ]) {
    assert.match(combined, new RegExp(phrase.replaceAll("/", "\\/")));
  }

  for (const documentKey of [
    "terms",
    "privacy",
    "cookies",
    "acceptable-use",
    "disclaimer"
  ]) {
    assert.match(
      legalDocuments,
      new RegExp(`"${documentKey}"`),
      `Expected canonical legal document key ${documentKey}`
    );
  }

  assert.match(cookieBanner, /localStorage/);
  assert.match(cookieConsent, /raw XML, invoices, API keys, webhook secrets, VIES data, or workspace data/);
  assert.match(signUpPage, /disabled=\{isSubmitting \|\| !allRequiredAccepted\}/);
  assert.match(legalAcceptancePage, /acceptanceContext: "workspace"/);
  assert.doesNotMatch(combined, /FiscalForge/i);
  assert.doesNotMatch(combined, /analytics\.js|gtag|Google Analytics|marketing pixel/i);
});

test("deployment release-candidate docs exist without false launch claims", () => {
  const docs = [
    "docs/deployment/production-release-candidate.md",
    "docs/deployment/supabase-production-setup.md",
    "docs/deployment/environment-variables.md",
    "docs/deployment/preflight-checklist.md",
    "docs/development/verification.md",
    "docs/security/security-readiness-checklist.md",
    "docs/api/developer-api.md",
    "docs/api/examples.md",
    "docs/api/scopes-and-rate-limits.md"
  ].map((path) => readRepoFile(path));
  const combined = docs.join("\n");

  for (const phrase of [
    "Supabase project",
    "Auth callback",
    "XSD",
    "Schematron",
    "VIES",
    "platform admin",
    "webhook encryption key",
    "Cookie Policy",
    "legal acceptance",
    "professional review",
    "not official filing"
  ]) {
    assert.match(combined, new RegExp(phrase, "i"));
  }

  assert.doesNotMatch(combined, /FiscalForge/i);
  assert.doesNotMatch(
    combined,
    /\bis official EU software\b|\bprovides official filing\b|\bcertified compliance\b|\bguaranteed tax result\b|\bguaranteed privacy compliance\b/i
  );
});
