import Link from "next/link";
import { AlertTriangle, FileText, LockKeyhole, WifiOff } from "lucide-react";

export const metadata = {
  title: "Offline - Invoice Lantern",
  description:
    "Offline capability boundaries for Invoice Lantern PWA sessions."
};

export default function OfflinePage() {
  return (
    <main className="offline-shell">
      <section className="offline-panel">
        <div className="offline-icon">
          <WifiOff size={28} />
        </div>

        <p className="offline-kicker">Offline mode</p>
        <h1>Invoice Lantern cannot reach the network.</h1>
        <p>
          The installable app shell and this offline notice are available without
          a connection. Authenticated workspace data, API responses, XML/SOAP
          bodies, VIES evidence, API keys, webhook logs, privacy workflows, and
          platform-admin writes are intentionally not served from stale cache.
        </p>

        <div className="offline-grid">
          <article>
            <LockKeyhole size={20} />
            <strong>Local-only drafts</strong>
            <span>
              Encrypted draft storage can be used where the browser supports Web
              Crypto and IndexedDB. Unsynced drafts remain local-only until saved
              through the API.
            </span>
          </article>

          <article>
            <AlertTriangle size={20} />
            <strong>Online-only checks</strong>
            <span>
              VIES, XML/XSD/Schematron validation, webhook management, API-key
              changes, retention/deletion/export execution, and admin writes
              require an online API session.
            </span>
          </article>

          <article>
            <FileText size={20} />
            <strong>Review boundary</strong>
            <span>
              PWA/offline behavior is technical support only. It is not legal,
              tax, accounting, privacy, security, filing, certification, or
              compliance advice.
            </span>
          </article>
        </div>

        <Link href="/workspace" className="offline-action">
          Try workspace again
        </Link>
      </section>
    </main>
  );
}
