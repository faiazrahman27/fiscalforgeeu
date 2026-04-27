"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, UserPlus } from "lucide-react";
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

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [nextPath, setNextPath] = useState("/workspace");
  const [isSubmitting, setIsSubmitting] = useState(false);

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

    setIsSubmitting(true);

    try {
      const supabase = createSupabaseBrowserClient();

      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(
        nextPath
      )}`;

      const { error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: redirectTo
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
      setMessage(
        "Account request created. Check your email for the verification link before signing in."
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
    <main className={styles.authShell}>
      <section className={styles.authCard}>
        <Link href="/" className={styles.authBackLink}>
          <ArrowLeft size={17} />
          Home
        </Link>

        <p className={styles.authKicker}>Verified account</p>
        <h1 className={styles.authTitle}>Create account</h1>

        <p className={styles.authLead}>
          Create an Invoice Lantern account. Verification emails should be sent
          through your branded Supabase Auth SMTP setup using Resend.
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

          <button className={styles.authButton} type="submit" disabled={isSubmitting}>
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
          Use a strong password. Later phases will add organization ownership,
          RBAC, audit logs, and protected API/database access.
        </p>
      </section>
    </main>
  );
}
