"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cookie, SlidersHorizontal, X } from "lucide-react";
import {
  COOKIE_CONSENT_CATEGORIES,
  COOKIE_CONSENT_STORAGE_KEY,
  createCookieConsentRecord,
  parseCookieConsentRecord
} from "../lib/cookie-consent";
import { getLegalDocumentHref } from "../lib/legal-documents";
import { usePathname } from "next/navigation";

function shouldHideCookieBanner(pathname: string | null) {
  if (!pathname) {
    return true;
  }

  return (
    pathname.startsWith("/workspace") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/auth/sign-out")
  );
}

function readStoredCookieConsent() {
  try {
    return parseCookieConsentRecord(
      window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)
    );
  } catch {
    return null;
  }
}

export function CookieConsentBanner() {
  const pathname = usePathname();
  const [isReady, setIsReady] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [functionalEnabled, setFunctionalEnabled] = useState(false);

  useEffect(() => {
    if (shouldHideCookieBanner(pathname)) {
      setIsReady(true);
      setIsVisible(false);
      setShowPreferences(false);
      return;
    }

    const storedRecord = readStoredCookieConsent();

    setFunctionalEnabled(storedRecord?.categories.functional === true);
    setIsVisible(!storedRecord);
    setIsReady(true);

    function handleManageCookies() {
      const latestRecord = readStoredCookieConsent();

      setFunctionalEnabled(latestRecord?.categories.functional === true);
      setIsVisible(true);
      setShowPreferences(true);
    }

    window.addEventListener("invoice-lantern:manage-cookies", handleManageCookies);

    return () => {
      window.removeEventListener(
        "invoice-lantern:manage-cookies",
        handleManageCookies
      );
    };
  }, [pathname]);

  function savePreferences(nextFunctionalEnabled: boolean) {
    const record = createCookieConsentRecord({
      functional: nextFunctionalEnabled
    });

    try {
      window.localStorage.setItem(
        COOKIE_CONSENT_STORAGE_KEY,
        JSON.stringify(record)
      );
    } catch {
      // Keep the UI usable if browser storage is unavailable.
    }
    setFunctionalEnabled(record.categories.functional);
    setIsVisible(false);
    setShowPreferences(false);
  }

  if (!isReady || !isVisible || shouldHideCookieBanner(pathname)) {
    return null;
  }

  return (
    <section
      className="cookie-consent"
      aria-label="Cookie preferences"
      data-testid="cookie-consent-banner"
    >
      <div className="cookie-consent-panel">
        <div className="cookie-consent-icon" aria-hidden="true">
          <Cookie size={20} />
        </div>

        <div className="cookie-consent-copy">
          <p className="cookie-consent-kicker">Cookie preferences</p>
          <h2>Essential cookies stay on. Optional tracking is not used.</h2>
          <p>
            Invoice Lantern may use essential cookies or browser storage for
            authentication, security, legal preference storage, and PWA safety.
            Analytics and marketing cookies are not enabled in this release
            candidate.
          </p>

          <div className="cookie-consent-links">
            <Link href={getLegalDocumentHref("cookies")}>Cookie Policy</Link>
            <Link href={getLegalDocumentHref("privacy")}>Privacy Policy</Link>
            <Link href={getLegalDocumentHref("terms")}>Terms</Link>
          </div>
        </div>

        <div className="cookie-consent-actions">
          <button
            type="button"
            className="cookie-secondary-button"
            onClick={() => setShowPreferences(true)}
          >
            <SlidersHorizontal size={16} />
            Manage options
          </button>
          <button
            type="button"
            className="cookie-primary-button"
            onClick={() => savePreferences(false)}
          >
            Essential only
          </button>
        </div>
      </div>

      {showPreferences ? (
        <div
          className="cookie-preferences"
          role="dialog"
          aria-modal="false"
          aria-labelledby="cookie-preferences-title"
        >
          <div className="cookie-preferences-head">
            <div>
              <p className="cookie-consent-kicker">Preference center</p>
              <h2 id="cookie-preferences-title">Manage cookie categories</h2>
            </div>

            <button
              type="button"
              className="cookie-icon-button"
              aria-label="Close cookie preferences"
              onClick={() => setShowPreferences(false)}
            >
              <X size={18} />
            </button>
          </div>

          <div className="cookie-category-list">
            {COOKIE_CONSENT_CATEGORIES.map((category) => {
              const checked =
                category.key === "essential"
                  ? true
                  : category.key === "functional"
                    ? functionalEnabled
                    : false;
              const disabled = category.required || !category.available;

              return (
                <label className="cookie-category-row" key={category.key}>
                  <span>
                    <strong>{category.label}</strong>
                    <small>{category.description}</small>
                  </span>

                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={(event) => {
                      if (category.key === "functional") {
                        setFunctionalEnabled(event.target.checked);
                      }
                    }}
                  />
                </label>
              );
            })}
          </div>

          <p className="cookie-storage-note">
            Preferences are stored only as a version, timestamp, and category
            choices in this browser. This flow does not store raw XML, invoice
            data, API keys, webhook secrets, VIES data, or workspace records.
          </p>

          <div className="cookie-preferences-actions">
            <button
              type="button"
              className="cookie-secondary-button"
              onClick={() => savePreferences(false)}
            >
              Essential only
            </button>
            <button
              type="button"
              className="cookie-primary-button"
              onClick={() => savePreferences(functionalEnabled)}
            >
              Save preferences
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
