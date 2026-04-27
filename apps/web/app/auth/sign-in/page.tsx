"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, LogIn, ShieldAlert } from "lucide-react";
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

function getReadableAuthMessage(value: string | null) {
  if (value === "missing_code") {
    return "The verification link was missing its auth code. Request a new sign-in or verification link.";
  }

  if (value === "auth_callback_failed") {
    return "The verification callback failed. The link may have expired or already been used.";
  }

  return "";
}

export default function SignInPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [nextPath, setNextPath] = useState("/workspace");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const resolvedNextPath = getSafeNextPath(searchParams.get("next"));
    const readableMessage = getReadableAuthMessage(searchParams.get("message"));

    setNextPath(resolvedNextPath);

    if (readableMessage) {
      setMessage(readableMessage);
    }
  }, []);

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setMessage("");

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setMessage("Enter your email and password.");
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createSupabaseBrowserClient();

      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password
      });

      if (error) {
        setMessage(
          "Could not sign in with those credentials. Check your email, password, and verification status."
        );
        return;
      }

      router.push(nextPath);
      router.refresh();
    } catch {
      setMessage(
        "Sign-in is unavailable. Check your Supabase environment values and try again."
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

        <p className={styles.authKicker}>Secure access</p>
        <h1 className={styles.authTitle}>Sign in</h1>

        <p className={styles.authLead}>
          Access your Invoice Lantern workspace with a verified account. The
          platform will use Supabase Auth sessions before API and database access.
        </p>

        <form className={styles.authForm} onSubmit={handleSignIn}>
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
              autoComplete="current-password"
              value={password}
              minLength={12}
              maxLength={128}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          <button className={styles.authButton} type="submit" disabled={isSubmitting}>
            <LogIn size={17} />
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </form>

        {message ? (
          <div className={styles.authMessage}>
            <ShieldAlert size={18} />
            <p>{message}</p>
          </div>
        ) : null}

        <p className={styles.authSwitch}>
          No account yet?{" "}
          <Link href={`/auth/sign-up?next=${encodeURIComponent(nextPath)}`}>
            Create one
          </Link>
          .
        </p>

        <p className={styles.authNotice}>
          Email verification must be enabled in Supabase Auth before production
          access. Resend SMTP can deliver the verification email from your own
          verified domain.
        </p>
      </section>
    </main>
  );
}
