"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, ShieldCheck } from "lucide-react";
import { clearInvoiceLanternBrowserCaches } from "../../../../lib/pwa/cache-management";
import { createSupabaseBrowserClient } from "../../../../lib/supabase/client";
import styles from "../../auth.module.css";

export default function SignOutClearPage() {
  const router = useRouter();
  const [message, setMessage] = useState(
    "Clearing local PWA caches and encrypted offline drafts."
  );

  useEffect(() => {
    let isMounted = true;

    async function clearLocalSessionState() {
      try {
        await clearInvoiceLanternBrowserCaches();

        try {
          const supabase = createSupabaseBrowserClient();
          await supabase.auth.signOut();
        } catch {
          /*
           * Server-side sign-out already ran. Browser sign-out is a best-effort
           * cleanup for local Supabase state in partially configured environments.
           */
        }

        if (isMounted) {
          setMessage("Local session caches cleared.");
        }
      } finally {
        router.replace("/auth/sign-in?message=signed_out");
        router.refresh();
      }
    }

    void clearLocalSessionState();

    return () => {
      isMounted = false;
    };
  }, [router]);

  return (
    <main className={styles.authShell}>
      <section className={styles.authCard}>
        <p className={styles.authKicker}>Session cleanup</p>
        <h1 className={styles.authTitle}>Signing out</h1>
        <p className={styles.authLead}>{message}</p>

        <div className={styles.authMessage}>
          <ShieldCheck size={18} />
          <p>
            Authenticated API responses, workspace pages, XML/SOAP bodies, API
            keys, webhook secrets, and private logs are not kept in the PWA
            cache.
          </p>
        </div>

        <div className={styles.authMessage}>
          <LogOut size={18} />
          <p>You will be returned to sign-in automatically.</p>
        </div>
      </section>
    </main>
  );
}
