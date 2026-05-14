import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BookOpenCheck,
  FileClock,
  Scale,
  ShieldCheck
} from "lucide-react";
import { Reveal } from "../../../components/reveal";
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
      label: "Version",
      value: document.version
    },
    {
      label: "Effective from",
      value: document.effectiveFrom
    },
    {
      label: "Audience",
      value: document.audience
    },
    {
      label: "Acceptance",
      value: document.requiresAcceptance ? "Required where applicable" : "Notice only"
    },
    {
      label: "Professional review",
      value: document.professionalReviewRequired ? "Required" : "Not marked"
    }
  ];

  return (
    <div className="retention-list">
      {facts.map((fact) => (
        <div className="retention-row" key={fact.label}>
          <div>
            <FileClock size={16} />
            <span>{fact.label}</span>
          </div>
          <strong>{fact.value}</strong>
        </div>
      ))}
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
    <main className="site-shell subpage-shell">
      <SiteHeader />

      <section className="subpage-hero">
        <div className="section-inner">
          <Reveal>
            <Link href="/legal" className="back-link">
              <ArrowLeft size={17} />
              Legal documents
            </Link>

            <p className="section-kicker">{document.category}</p>

            <h1 className="subpage-title">{document.title}</h1>

            <p className="subpage-lead">{document.summary}</p>
          </Reveal>

          <div className="subpage-grid">
            <Reveal>
              <div className="subpage-card">
                <div className="subpage-card-icon">
                  <BookOpenCheck size={22} />
                </div>
                <h2>Published policy notice</h2>
                <p>
                  This page renders a published version only. Draft and review
                  versions are not exposed through the public legal document
                  route.
                </p>
              </div>
            </Reveal>

            <Reveal>
              <div className="subpage-card">
                <div className="subpage-card-icon">
                  <ShieldCheck size={22} />
                </div>
                <h2>No official affiliation</h2>
                <p>
                  Invoice Lantern is independent and non-official. Product
                  notices do not claim EU, government, tax authority,
                  OpenPeppol, Peppol authority, or standards-body affiliation.
                </p>
              </div>
            </Reveal>

            <Reveal>
              <div className="subpage-card">
                <div className="subpage-card-icon">
                  <Scale size={22} />
                </div>
                <h2>Review required</h2>
                <p>
                  Legal, tax, accounting, privacy, statutory retention,
                  incident, DPA, and subprocessor conclusions require
                  professional review.
                </p>
              </div>
            </Reveal>
          </div>

          <Reveal>
            <section className="privacy-retention">
              <div className="privacy-retention-head">
                <div>
                  <p>Document facts</p>
                  <h3>Versioned legal document metadata</h3>
                </div>

                <FileClock size={26} />
              </div>

              <DocumentFacts document={document} />
            </section>
          </Reveal>

          <Reveal>
            <section className="privacy-retention">
              <div className="privacy-retention-head">
                <div>
                  <p>Notice text</p>
                  <h3>{document.title}</h3>
                </div>

                <BookOpenCheck size={26} />
              </div>

              <div className="workspace-map">
                <div>{renderMarkdown(document.bodyMd)}</div>
                <div>
                  <ShieldCheck size={24} />
                  <h3>Important boundary</h3>
                  {document.disclaimers.map((disclaimer) => (
                    <p key={disclaimer}>{disclaimer}</p>
                  ))}
                  {document.changeNotes ? (
                    <p>Change notes: {document.changeNotes}</p>
                  ) : null}
                </div>
              </div>
            </section>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
