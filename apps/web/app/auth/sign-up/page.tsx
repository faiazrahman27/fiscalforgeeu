"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, UserPlus } from "lucide-react";
import { SiteFooter } from "../../../components/site-footer";
import {
  ACCOUNT_LEGAL_DOCUMENT_KEYS,
  ACCOUNT_LEGAL_DOCUMENT_LABELS,
  ACCOUNT_LEGAL_DOCUMENT_VERSION,
  type AccountLegalDocumentKey,
  getLegalDocumentHref
} from "../../../lib/legal-documents";
import { createSupabaseBrowserClient } from "../../../lib/supabase/client";
import styles from "../auth.module.css";

function getSafeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/workspace";
  }

  if (value.startsWith("/auth/")) {
    return "/workspace";
  }

  return value;
}

function createInitialAcceptanceState() {
  return ACCOUNT_LEGAL_DOCUMENT_KEYS.reduce(
    (state, documentKey) => ({
      ...state,
      [documentKey]: false
    }),
    {} as Record<AccountLegalDocumentKey, boolean>
  );
}

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [nextPath, setNextPath] = useState("/workspace");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [acceptedDocuments, setAcceptedDocuments] = useState(
    createInitialAcceptanceState
  );

  const allRequiredAccepted = ACCOUNT_LEGAL_DOCUMENT_KEYS.every(
    (documentKey) => acceptedDocuments[documentKey]
  );

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);

    setNextPath(getSafeNextPath(searchParams.get("next")));
  }, []);

  async function handleSignUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setMessage("");

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || password.length < 12) {
      setMessage("Use a valid email and a password with at least 12 characters.");
      return;
    }

    if (!allRequiredAccepted) {
      setMessage(
        "Review and accept every required Invoice Lantern platform document before creating an account."
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const acceptedAt = new Date().toISOString();

      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(
        nextPath
      )}`;

      const { error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: redirectTo,
          data: {
            invoice_lantern_required_legal_acknowledgement: {
              version: ACCOUNT_LEGAL_DOCUMENT_VERSION,
              acceptedAt,
              documents: ACCOUNT_LEGAL_DOCUMENT_KEYS.map((documentKey) => ({
                documentKey,
                version: ACCOUNT_LEGAL_DOCUMENT_VERSION,
                acceptedAt,
                source: "sign_up"
              }))
            }
          }
        }
      });

      if (error) {
        setMessage(
          "Could not create this account. Check the email address, password strength, and Supabase Auth configuration."
        );
        return;
      }

      setEmail("");
      setPassword("");
      setAcceptedDocuments(createInitialAcceptanceState());
      setMessage(
        "Account request created. Check your email for the verification link before signing in. Required legal acceptance is finalized after sign-in if the server still needs it."
      );
    } catch {
      setMessage(
        "Sign-up is unavailable. Check your Supabase environment values and try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
    <main className={styles.authShell}>
      <section className={styles.authCard}>
        <Link href="/" className={styles.authBackLink}>
          <ArrowLeft size={17} />
          Home
        </Link>

        <div className={styles.authBrand}>
          <Image
            src="/brand/invoice-lantern.png"
            alt="Invoice Lantern"
            width={72}
            height={72}
            priority
          />
          <span>Invoice Lantern</span>
        </div>

        <p className={styles.authKicker}>Verified account</p>
        <h1 className={styles.authTitle}>Create account</h1>

        <p className={styles.authLead}>
          Create an Invoice Lantern account for the independent validation and
          ViDA-readiness sandbox. The workspace is not official filing and does
          not replace professional review.
        </p>

        <form className={styles.authForm} onSubmit={handleSignUp}>
          <label className={styles.authField}>
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              maxLength={254}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label className={styles.authField}>
            <span>Password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              minLength={12}
              maxLength={128}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          <fieldset className={styles.authChecklist}>
            <legend>Required platform acknowledgements</legend>
            {ACCOUNT_LEGAL_DOCUMENT_KEYS.map((documentKey) => (
              <label key={documentKey} className={styles.authCheckbox}>
                <input
                  type="checkbox"
                  checked={acceptedDocuments[documentKey]}
                  onChange={(event) =>
                    setAcceptedDocuments((current) => ({
                      ...current,
                      [documentKey]: event.target.checked
                    }))
                  }
                />
                <span>
                  {documentKey === "privacy" || documentKey === "cookies"
                    ? "I acknowledge the "
                    : documentKey === "disclaimer"
                      ? "I acknowledge the "
                      : "I accept the "}
                  <Link href={getLegalDocumentHref(documentKey)}>
                    {ACCOUNT_LEGAL_DOCUMENT_LABELS[documentKey]}
                  </Link>
                  .
                </span>
              </label>
            ))}
            {!allRequiredAccepted ? (
              <p className={styles.authChecklistHint}>
                All required boxes must be selected before account creation.
              </p>
            ) : null}
          </fieldset>

          <button
            className={styles.authButton}
            type="submit"
            disabled={isSubmitting || !allRequiredAccepted}
          >
            <UserPlus size={17} />
            {isSubmitting ? "Creating account..." : "Create account"}
          </button>
        </form>

        {message ? (
          <div className={styles.authMessage}>
            <ShieldCheck size={18} />
            <p>{message}</p>
          </div>
        ) : null}

        <p className={styles.authSwitch}>
          Already have an account?{" "}
          <Link href={`/auth/sign-in?next=${encodeURIComponent(nextPath)}`}>
            Sign in
          </Link>
          .
        </p>

        <p className={styles.authNotice}>
          Use a strong password. Organization access, RBAC, audit logs, API-key
          scopes, privacy controls, and protected API/database behavior remain
          enforced after sign-in.
        </p>
      </section>
    </main>
    <SiteFooter compact />
    </>
  );
}
