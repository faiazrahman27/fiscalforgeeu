import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  FileClock,
  FileText,
  Globe2,
  LockKeyhole,
  Scale,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import { Reveal } from "../../components/reveal";
import { SiteFooter } from "../../components/site-footer";
import { SiteHeader } from "../../components/site-header";
import { listPublicLegalDocuments } from "../../lib/legal-documents";

export const dynamic = "force-dynamic";

const categoryLabels: Record<string, string> = {
  terms: "Terms",
  privacy: "Privacy",
  security: "Security",
  developer: "Developer",
  compliance_notice: "Notice",
  retention: "Retention",
  incident: "Incident",
  brand: "Brand",
  processor: "Processor",
  cookies: "Cookies",
  acceptable_use: "Acceptable Use",
  country_pack: "Country Packs",
  webhook: "Webhooks",
  vida: "ViDA",
  vies: "VIES",
  xml_validation: "XML"
};

function formatCategory(category: string) {
  return (
    categoryLabels[category] ??
    category
      .split(/[_-]/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

function formatAudience(audience: string) {
  return audience
    .split(/[_-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default async function LegalIndexPage() {
  const documents = await listPublicLegalDocuments();

  const requiredCount = documents.filter(
    (document) => document.requiresAcceptance
  ).length;

  const professionalReviewCount = documents.filter(
    (document) => document.professionalReviewRequired
  ).length;

  const featuredDocumentKeys = [
    "terms",
    "privacy",
    "dpa",
    "disclaimer"
  ];

  const featuredDocuments = documents.filter((document) =>
    featuredDocumentKeys.includes(document.documentKey)
  );

  const remainingDocuments = documents.filter(
    (document) => !featuredDocumentKeys.includes(document.documentKey)
  );

  return (
    <main className="site-shell subpage-shell legal-page legal-index-page">
      <SiteHeader />

      <section className="legal-hero">
        <div className="section-inner">
          <Reveal>
            <Link href="/" className="back-link">
              <ArrowLeft size={17} />
              Home
            </Link>
          </Reveal>

          <div className="legal-hero-grid">
            <Reveal>
              <div className="legal-hero-copy">
                <div className="hero-badge">
                  <span />
                  Versioned platform policies
                </div>

                <h1 className="legal-title">
                  Legal, privacy, security, and simulation notices.
                </h1>

                <p className="legal-lead">
                  Invoice Lantern publishes versioned product policies,
                  privacy notices, developer terms, and technical disclaimers
                  for its independent e-invoice validation and ViDA-readiness
                  sandbox. These pages are informational platform policies, not
                  legal, tax, accounting, privacy, filing, or official
                  compliance advice.
                </p>

                <div className="hero-actions">
                  <a href="#legal-documents" className="text-link-button">
                    Browse notices
                    <ArrowRight size={18} />
                  </a>

                  <Link href="/boundaries" className="text-link-button">
                    Review boundaries
                    <ShieldCheck size={18} />
                  </Link>
                </div>
              </div>
            </Reveal>

            <Reveal>
              <div className="terminal-shell legal-terminal">
                <div className="terminal-top">
                  <span />
                  <span />
                  <span />
                  <p>policy_scope.json</p>
                </div>

                <pre>{`{
  "product": "Invoice Lantern",
  "status": "independent_non_official_sandbox",
  "legalAdvice": false,
  "taxAdvice": false,
  "officialFiling": false,
  "professionalReviewRequired": true,
  "documents": ${documents.length},
  "acceptanceTracked": ${requiredCount}
}`}</pre>
              </div>
            </Reveal>
          </div>

          <div className="legal-stat-grid">
            <Reveal>
              <div className="legal-stat-card">
                <BookOpenCheck size={28} />
                <h3>{documents.length} published notices</h3>
                <p>
                  Public legal pages render published document versions with
                  metadata, summaries, review status, and safe markdown-only
                  content.
                </p>
              </div>
            </Reveal>

            <Reveal>
              <div className="legal-stat-card">
                <FileClock size={28} />
                <h3>{requiredCount} acceptance-tracked</h3>
                <p>
                  Required policy acknowledgements are version-specific for
                  signed-in users and avoid storing raw IP address or user-agent
                  details.
                </p>
              </div>
            </Reveal>

            <Reveal>
              <div className="legal-stat-card">
                <ShieldCheck size={28} />
                <h3>{professionalReviewCount} review-required</h3>
                <p>
                  Policy drafts and notices stay cautious. Professional legal,
                  privacy, tax, and security review is required before
                  production reliance.
                </p>
              </div>
            </Reveal>
          </div>

          {featuredDocuments.length > 0 ? (
            <section id="legal-documents" className="legal-section">
              <Reveal>
                <div className="legal-section-heading">
                  <p className="section-kicker">Primary policy set</p>
                  <h2>Start with the documents that define platform use.</h2>
                  <p>
                    These notices explain how Invoice Lantern positions the
                    service, handles privacy responsibilities, frames
                    processor/controller language, and limits reliance on
                    technical validation output.
                  </p>
                </div>
              </Reveal>

              <div className="legal-card-grid legal-card-grid-featured">
                {featuredDocuments.map((document) => (
                  <Reveal key={document.documentKey}>
                    <Link
                      href={`/legal/${document.documentKey}`}
                      className="legal-card legal-card-featured"
                    >
                      <span className="legal-card-badge">
                        {formatCategory(document.category)}
                      </span>

                      <h3>{document.title}</h3>

                      <p className="legal-card-summary">{document.summary}</p>

                      <p className="legal-card-meta">
                        Version {document.version} ·{" "}
                        {document.requiresAcceptance
                          ? "Acceptance tracked"
                          : "Notice only"}
                      </p>

                      <strong>
                        Read notice
                        <ArrowRight size={18} />
                      </strong>
                    </Link>
                  </Reveal>
                ))}
              </div>
            </section>
          ) : null}

          <section className="legal-section">
            <Reveal>
              <div className="legal-section-heading legal-section-heading-split">
                <div>
                  <p className="section-kicker">Document library</p>
                  <h2>All notices in one consistent policy library.</h2>
                </div>

                <p>
                  This library is intentionally broad because Invoice Lantern
                  includes structured invoices, XML validation, VIES evidence,
                  ViDA-readiness simulations, country-pack context, developer
                  APIs, webhook test events, and GDPR-aware privacy controls.
                </p>
              </div>
            </Reveal>

            <div className="legal-card-grid">
              {remainingDocuments.map((document) => (
                <Reveal key={document.documentKey}>
                  <Link
                    href={`/legal/${document.documentKey}`}
                    className="legal-card"
                  >
                    <span className="legal-card-badge">
                      {formatCategory(document.category)}
                    </span>

                    <h3>{document.title}</h3>

                    <p className="legal-card-summary">{document.summary}</p>

                    <p className="legal-card-meta">
                      {formatAudience(document.audience)} · Version{" "}
                      {document.version}
                    </p>

                    <strong>
                      Open document
                      <ArrowRight size={18} />
                    </strong>
                  </Link>
                </Reveal>
              ))}
            </div>
          </section>

          <section className="legal-section">
            <div className="legal-stat-grid">
              <Reveal>
                <div className="legal-stat-card">
                  <LockKeyhole size={28} />
                  <h3>Privacy-aware by design</h3>
                  <p>
                    Legal notices connect to workspace privacy controls, export
                    support, retention settings, deletion workflows,
                    subprocessor visibility, and cookie/tracking stance.
                  </p>
                </div>
              </Reveal>

              <Reveal>
                <div className="legal-stat-card">
                  <Globe2 size={28} />
                  <h3>Independent positioning</h3>
                  <p>
                    The policy set keeps clear separation from the European
                    Union, national tax authorities, OpenPeppol, standards
                    bodies, and official filing systems.
                  </p>
                </div>
              </Reveal>

              <Reveal>
                <div className="legal-stat-card">
                  <FileText size={28} />
                  <h3>Versioned notices</h3>
                  <p>
                    Each document carries version metadata, effective-date
                    context, review-required status, and acceptance information
                    where the platform tracks acknowledgement.
                  </p>
                </div>
              </Reveal>
            </div>
          </section>

          <Reveal>
            <section className="legal-final-panel">
              <div>
                <div className="final-badge">
                  <Sparkles size={18} />
                  Professional review required
                </div>

                <h2>Policy clarity without false certainty.</h2>
              </div>

              <div>
                <p>
                  These documents help explain platform behavior and user
                  responsibilities. They still require professional legal,
                  privacy, tax, accounting, and security review before public
                  production reliance.
                </p>

                <Link href="/workspace/privacy" className="text-link-button">
                  Workspace privacy controls
                  <ArrowRight size={18} />
                </Link>
              </div>
            </section>
          </Reveal>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
