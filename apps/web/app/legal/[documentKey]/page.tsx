import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  FileClock,
  FileText,
  Globe2,
  Scale,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import { Reveal } from "../../../components/reveal";
import { SiteFooter } from "../../../components/site-footer";
import { SiteHeader } from "../../../components/site-header";
import {
  getPublicLegalDocument,
  listPublicLegalDocuments,
  type PublicLegalDocument
} from "../../../lib/legal-documents";

export const dynamic = "force-dynamic";

type LegalDocumentPageProps = {
  params: Promise<{
    documentKey: string;
  }>;
};

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

function formatLabel(value: string) {
  return (
    categoryLabels[value] ??
    value
      .split(/[_-]/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

export async function generateMetadata({ params }: LegalDocumentPageProps) {
  const { documentKey } = await params;
  const document = await getPublicLegalDocument(documentKey);

  return {
    title: document
      ? `${document.title} | Invoice Lantern`
      : "Legal document | Invoice Lantern",
    description:
      document?.summary ??
      "Invoice Lantern legal document notice. Professional review required."
  };
}

export async function generateStaticParams() {
  const documents = await listPublicLegalDocuments();

  return documents.map((document) => ({
    documentKey: document.documentKey
  }));
}

function renderMarkdown(bodyMd: string) {
  const blocks = bodyMd
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks.map((block, index) => {
    if (block.startsWith("## ")) {
      return <h2 key={`${block}-${index}`}>{block.slice(3)}</h2>;
    }

    if (block.startsWith("### ")) {
      return <h3 key={`${block}-${index}`}>{block.slice(4)}</h3>;
    }

    if (block.startsWith("- ")) {
      const items = block
        .split("\n")
        .map((item) => item.replace(/^- /, "").trim())
        .filter(Boolean);

      return (
        <ul key={`${block}-${index}`}>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      );
    }

    return <p key={`${block}-${index}`}>{block}</p>;
  });
}

function DocumentFacts({ document }: { document: PublicLegalDocument }) {
  const facts = [
    {
      icon: FileClock,
      label: "Version",
      value: document.version
    },
    {
      icon: CalendarDays,
      label: "Effective from",
      value: document.effectiveFrom
    },
    {
      icon: Globe2,
      label: "Audience",
      value: formatLabel(document.audience)
    },
    {
      icon: CheckCircle2,
      label: "Acceptance",
      value: document.requiresAcceptance
        ? "Tracked where applicable"
        : "Notice only"
    },
    {
      icon: ShieldCheck,
      label: "Professional review",
      value: document.professionalReviewRequired ? "Required" : "Not marked"
    }
  ];

  return (
    <div className="legal-fact-grid">
      {facts.map((fact) => {
        const Icon = fact.icon;

        return (
          <div key={fact.label} className="legal-fact-row">
            <div>
              <Icon size={18} />
              <span>{fact.label}</span>
            </div>

            <strong>{fact.value}</strong>
          </div>
        );
      })}
    </div>
  );
}

export default async function LegalDocumentPage({
  params
}: LegalDocumentPageProps) {
  const { documentKey } = await params;
  const document = await getPublicLegalDocument(documentKey);

  if (!document) {
    notFound();
  }

  return (
    <main className="site-shell subpage-shell legal-page legal-document-page">
      <SiteHeader />

      <section className="legal-hero">
        <div className="section-inner">
          <Reveal>
            <Link href="/legal" className="back-link">
              <ArrowLeft size={17} />
              Legal documents
            </Link>
          </Reveal>

          <div className="legal-hero-grid">
            <Reveal>
              <div className="legal-hero-copy">
                <div className="hero-badge">
                  <span />
                  {formatLabel(document.category)}
                </div>

                <h1 className="legal-title">{document.title}</h1>

                <p className="legal-lead">{document.summary}</p>

                <div className="hero-actions">
                  <a href="#notice-text" className="text-link-button">
                    Read notice
                    <ArrowRight size={18} />
                  </a>

                  <Link href="/legal" className="text-link-button">
                    All legal documents
                    <FileText size={18} />
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
                  <p>document_metadata.json</p>
                </div>

                <pre>{`{
  "documentKey": "${document.documentKey}",
  "version": "${document.version}",
  "audience": "${document.audience}",
  "requiresAcceptance": ${document.requiresAcceptance},
  "professionalReviewRequired": ${document.professionalReviewRequired}
}`}</pre>
              </div>
            </Reveal>
          </div>

          <div className="legal-stat-grid">
            <Reveal>
              <div className="legal-stat-card">
                <BookOpenCheck size={28} />
                <h3>Published policy notice</h3>
                <p>
                  This page renders a published version only. Draft and review
                  versions are not exposed through the public legal document
                  route.
                </p>
              </div>
            </Reveal>

            <Reveal>
              <div className="legal-stat-card">
                <ShieldCheck size={28} />
                <h3>No official affiliation</h3>
                <p>
                  Invoice Lantern is independent and non-official. These
                  notices do not claim EU, government, tax authority,
                  OpenPeppol, Peppol authority, or standards-body affiliation.
                </p>
              </div>
            </Reveal>

            <Reveal>
              <div className="legal-stat-card">
                <Scale size={28} />
                <h3>Review required</h3>
                <p>
                  Legal, tax, accounting, privacy, statutory retention,
                  incident, DPA, and subprocessor conclusions require
                  professional review.
                </p>
              </div>
            </Reveal>
          </div>

          <section className="legal-section">
            <Reveal>
              <div className="legal-section-heading legal-section-heading-split">
                <div>
                  <p className="section-kicker">Document facts</p>
                  <h2>Versioned metadata and acceptance context.</h2>
                </div>

                <p>
                  Invoice Lantern tracks document versions and acceptance
                  metadata where applicable, but these policy notices remain
                  product documentation requiring professional review before
                  production reliance.
                </p>
              </div>
            </Reveal>

            <Reveal>
              <DocumentFacts document={document} />
            </Reveal>
          </section>

          <section id="notice-text" className="legal-document-grid">
            <Reveal>
              <article className="legal-document-body">
                <div className="legal-document-body-head">
                  <div>
                    <p className="section-kicker">Notice text</p>
                    <h2>{document.title}</h2>
                  </div>

                  <BookOpenCheck size={28} />
                </div>

                <div className="legal-markdown">
                  {renderMarkdown(document.bodyMd)}
                </div>
              </article>
            </Reveal>

            <Reveal>
              <aside className="legal-boundary-panel">
                <div>
                  <div className="final-badge">
                    <ShieldCheck size={18} />
                    Important boundary
                  </div>

                  <h2>Professional review remains required.</h2>
                </div>

                <div className="legal-disclaimer-list">
                  {document.disclaimers.map((disclaimer) => (
                    <p key={disclaimer}>{disclaimer}</p>
                  ))}
                </div>

                {document.changeNotes ? (
                  <div className="legal-change-notes">
                    <p className="section-kicker">Change notes</p>
                    <p>{document.changeNotes}</p>
                  </div>
                ) : null}
              </aside>
            </Reveal>
          </section>

          <Reveal>
            <section className="legal-final-panel">
              <div>
                <div className="final-badge">
                  <Sparkles size={18} />
                  Non-official policy notice
                </div>

                <h2>Use this notice as product context, not legal advice.</h2>
              </div>

              <div>
                <p>
                  This document helps explain Invoice Lantern’s platform
                  boundaries, data handling, technical validation posture, or
                  developer responsibilities. It does not replace qualified
                  legal, privacy, tax, accounting, security, or competent
                  authority review.
                </p>

                <Link href="/workspace/privacy" className="text-link-button">
                  Workspace privacy controls
                  <ArrowRight size={18} />
                </Link>
              </div>
            </section>
          </Reveal>

          <div className="legal-card-grid legal-card-grid-two">
            <Reveal>
              <Link href="/legal" className="legal-card">
                <span className="legal-card-badge">Legal library</span>
                <h3>Back to all notices</h3>
                <p className="legal-card-summary">
                  Review the full policy library, including privacy, API,
                  webhook, country-pack, VIES, ViDA, XML, security, and
                  retention notices.
                </p>
                <strong>
                  Browse documents
                  <ArrowRight size={18} />
                </strong>
              </Link>
            </Reveal>

            <Reveal>
              <Link href="/boundaries" className="legal-card">
                <span className="legal-card-badge">Product boundaries</span>
                <h3>Independent sandbox limits</h3>
                <p className="legal-card-summary">
                  See how Invoice Lantern separates technical validation,
                  educational simulations, and professional-review-required
                  conclusions.
                </p>
                <strong>
                  Review boundaries
                  <ArrowRight size={18} />
                </strong>
              </Link>
            </Reveal>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
