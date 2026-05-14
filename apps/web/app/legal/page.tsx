import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  FileClock,
  Scale,
  ShieldCheck
} from "lucide-react";
import { Reveal } from "../../components/reveal";
import { SiteHeader } from "../../components/site-header";
import { listPublicLegalDocuments } from "../../lib/legal-documents";

export const dynamic = "force-dynamic";

export default async function LegalIndexPage() {
  const documents = await listPublicLegalDocuments();
  const requiredCount = documents.filter(
    (document) => document.requiresAcceptance
  ).length;

  return (
    <main className="site-shell subpage-shell">
      <SiteHeader />

      <section className="subpage-hero">
        <div className="section-inner">
          <Reveal>
            <Link href="/" className="back-link">
              <ArrowLeft size={17} />
              Home
            </Link>

            <p className="section-kicker">Legal documents</p>

            <h1 className="subpage-title">
              Product policies and review-required notices.
            </h1>

            <p className="subpage-lead">
              Invoice Lantern publishes versioned platform policy notices for
              its independent educational e-invoice validation and
              ViDA-readiness sandbox. These documents are not legal, tax,
              accounting, privacy, filing, or official compliance advice, and
              they require professional review before production reliance.
            </p>
          </Reveal>

          <div className="subpage-grid">
            <Reveal>
              <div className="subpage-card">
                <div className="subpage-card-icon">
                  <BookOpenCheck size={22} />
                </div>
                <h2>{documents.length} published notices</h2>
                <p>
                  Public pages show only published document versions and avoid
                  rendering raw HTML from document content.
                </p>
              </div>
            </Reveal>

            <Reveal>
              <div className="subpage-card">
                <div className="subpage-card-icon">
                  <FileClock size={22} />
                </div>
                <h2>{requiredCount} acceptance-tracked</h2>
                <p>
                  Signed-in acceptance records are version-specific and store
                  hashed request evidence only when captured by the API.
                </p>
              </div>
            </Reveal>

            <Reveal>
              <div className="subpage-card">
                <div className="subpage-card-icon">
                  <ShieldCheck size={22} />
                </div>
                <h2>Professional review required</h2>
                <p>
                  Product notices do not claim EU, tax-authority, Peppol,
                  standards-body, legal, tax, privacy, or accounting approval.
                </p>
              </div>
            </Reveal>
          </div>

          <div className="subpage-grid">
            {documents.map((document) => (
              <Reveal key={document.documentKey}>
                <Link
                  href={`/legal/${document.documentKey}`}
                  className="subpage-card"
                >
                  <div className="subpage-card-icon">
                    <Scale size={22} />
                  </div>
                  <p className="section-kicker">{document.category}</p>
                  <h2>{document.title}</h2>
                  <p>{document.summary}</p>
                  <p>
                    Version {document.version} -{" "}
                    {document.requiresAcceptance
                      ? "Acceptance tracked"
                      : "Notice only"}
                  </p>
                  <strong className="text-link-button compact">
                    Read notice
                    <ArrowRight size={18} />
                  </strong>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
