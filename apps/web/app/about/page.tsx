import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  Building2,
  Code2,
  FileCheck2,
  FileText,
  Globe2,
  GraduationCap,
  KeyRound,
  Landmark,
  LockKeyhole,
  ScrollText,
  ShieldCheck,
  UsersRound
} from "lucide-react";
import { Reveal } from "../../components/reveal";
import { SiteFooter } from "../../components/site-footer";
import { SiteHeader } from "../../components/site-header";

const productPillars = [
  {
    icon: <FileText size={22} />,
    title: "Structured invoice workspace",
    description:
      "Invoice Lantern starts with canonical invoice data, not image scanning. It helps users prepare invoice fields, line items, parties, VAT details, totals, and structured export-ready data."
  },
  {
    icon: <FileCheck2 size={22} />,
    title: "Validation-style review",
    description:
      "The platform checks invoice structure, calculation consistency, UBL/XML readiness, validation findings, confidence labels, and report-style explanations for technical review."
  },
  {
    icon: <Globe2 size={22} />,
    title: "EU readiness simulation",
    description:
      "Country packs, VAT-number context, VIES evidence, and ViDA-readiness signals are treated as source-linked simulations that require professional review before real-world reliance."
  },
  {
    icon: <Code2 size={22} />,
    title: "Developer-facing sandbox",
    description:
      "Scoped API keys, OpenAPI documentation, request logs, webhook testing, and validation endpoints give developers a controlled environment for integration and testing."
  }
];

const audienceCards = [
  {
    icon: <UsersRound size={22} />,
    title: "Freelancers and SMEs",
    description:
      "Use the workspace to understand structured invoice data, buyer/seller details, totals, VAT identifiers, XML exports, and readiness signals before professional review."
  },
  {
    icon: <GraduationCap size={22} />,
    title: "Students and learners",
    description:
      "Compare valid and invalid invoice scenarios, inspect findings, learn how structured e-invoicing works, and understand why XML data matters more than invoice images."
  },
  {
    icon: <Building2 size={22} />,
    title: "Accountants and reviewers",
    description:
      "Use validation-style reports, source labels, confidence levels, country context, and rule versions as technical support material, not as a substitute for professional judgment."
  },
  {
    icon: <KeyRound size={22} />,
    title: "Developers and integrators",
    description:
      "Test sandbox endpoints, UBL generation/parsing flows, XML validation jobs, API scopes, request metadata, webhook signatures, and rate-limit behavior."
  }
];

const workflowSteps = [
  {
    title: "Create or import invoice data",
    description:
      "Enter structured invoice data manually, use workspace invoice tools, or test via API payloads and UBL XML import flows."
  },
  {
    title: "Normalize into a canonical model",
    description:
      "Invoice data is treated through a consistent internal model so form input, API input, and XML input can be reviewed through the same validation surface."
  },
  {
    title: "Run technical and simulation checks",
    description:
      "Review calculation logic, required fields, XML readiness, VAT-number format, VIES evidence where configured, country-pack context, and ViDA-readiness simulation."
  },
  {
    title: "Export and explain results",
    description:
      "Generate structured outputs, validation findings, report-style summaries, UBL XML, and developer responses with clear source/version/legal-confidence boundaries."
  }
];

const boundaryItems = [
  {
    icon: <ShieldCheck size={22} />,
    title: "Independent and non-official",
    description:
      "Invoice Lantern is not operated, endorsed, certified, or approved by the EU, European Commission, national tax authorities, OpenPeppol, Peppol authorities, or standards bodies."
  },
  {
    icon: <Landmark size={22} />,
    title: "No legal or tax advice",
    description:
      "Results are informational technical outputs and educational simulations. They do not replace accountants, tax advisers, lawyers, competent authorities, or official filing systems."
  },
  {
    icon: <BookOpenCheck size={22} />,
    title: "Source-linked where needed",
    description:
      "Legal, tax, standards, country-pack, VIES, Peppol-style, EN 16931-style, and ViDA-like rules should be linked to sources and reviewed before production reliance."
  }
];

const buildPrinciples = [
  {
    label: "Technical first",
    text: "Validation focuses on structured data, XML, calculations, schemas, rule versions, and explainable findings."
  },
  {
    label: "No false certainty",
    text: "The product avoids wording that suggests official acceptance, filing success, certification, or guaranteed compliance."
  },
  {
    label: "Security-aware",
    text: "The platform is designed around RBAC, tenant isolation, rate limits, safe XML handling, redaction, audit trails, and privacy-support workflows."
  },
  {
    label: "Review required",
    text: "Country-specific VAT, e-invoicing, reporting, retention, legal, tax, accounting, and privacy decisions require professional review."
  }
];

export const metadata = {
  title: "About Invoice Lantern",
  description:
    "About Invoice Lantern, an independent e-invoice validation and ViDA-readiness sandbox."
};

export default function AboutPage() {
  return (
    <main className="site-shell subpage-shell about-page">
      <SiteHeader />

      <section className="subpage-hero">
        <div className="section-inner">
          <Reveal>
            <Link href="/" className="back-link">
              <ArrowLeft size={17} />
              Home
            </Link>

            <p className="section-kicker">About Invoice Lantern</p>

            <h1 className="subpage-title">
              A technical sandbox for structured invoice readiness.
            </h1>

            <p className="subpage-lead">
              Invoice Lantern helps freelancers, SMEs, students, accountants,
              and developers understand, test, validate, export, and explain
              structured European invoice data. It focuses on canonical invoice
              models, UBL XML, validation-style findings, VAT-number checks,
              VIES evidence where configured, country-pack simulations,
              Peppol-style and EN 16931-style signals, ViDA-readiness context,
              developer APIs, auditability, and privacy-aware operations.
            </p>
          </Reveal>

          <div className="subpage-grid">
            {productPillars.map((card) => (
              <Reveal key={card.title}>
                <InfoCard
                  icon={card.icon}
                  title={card.title}
                  description={card.description}
                />
              </Reveal>
            ))}
          </div>

          <Reveal>
            <div className="deep-panel">
              <p className="section-kicker">Why it exists</p>
              <h2>Invoice data is becoming more structured, but testing it safely is still difficult.</h2>

              <p className="public-page-copy">
                European invoicing is moving toward more machine-readable
                formats, digital reporting, structured validation rules, and
                country-specific obligations. Many users need a place to learn,
                test, debug, and prepare invoice data before relying on official
                portals, accountants, commercial access points, tax authority
                systems, or production integrations. Invoice Lantern is built as
                that preparation layer: technical, educational, source-linked,
                privacy-aware, and clearly non-official.
              </p>
            </div>
          </Reveal>

          <section className="section" style={{ paddingLeft: 0, paddingRight: 0 }}>
            <Reveal>
              <div className="split-heading">
                <div>
                  <p className="section-kicker">Who it is for</p>
                  <h2>Different users, one structured invoice foundation.</h2>
                </div>

                <p>
                  The same invoice model can serve learning, technical testing,
                  accounting review, and developer integration. The output is
                  useful context, not an authority decision.
                </p>
              </div>
            </Reveal>

            <div className="subpage-grid">
              {audienceCards.map((card) => (
                <Reveal key={card.title}>
                  <InfoCard
                    icon={card.icon}
                    title={card.title}
                    description={card.description}
                  />
                </Reveal>
              ))}
            </div>
          </section>

          <Reveal>
            <div className="deep-panel">
              <p className="section-kicker">How the platform works</p>
              <h2>From invoice data to readable technical findings.</h2>

              <div className="deep-list">
                {workflowSteps.map((step, index) => (
                  <div className="deep-row" key={step.title}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <h3>{step.title}</h3>
                      <p>{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          <section className="section" style={{ paddingLeft: 0, paddingRight: 0 }}>
            <Reveal>
              <div className="section-heading">
                <p className="section-kicker">Product boundaries</p>
                <h2>Serious simulation needs honest limits.</h2>
                <p>
                  Invoice Lantern can be useful because it is clear about what
                  it does and what it does not do. It is a technical readiness
                  and simulation platform, not an official compliance product.
                </p>
              </div>
            </Reveal>

            <div className="boundary-grid">
              {boundaryItems.map((item) => (
                <Reveal key={item.title}>
                  <div className="boundary-slab">
                    {item.icon}
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>

          <Reveal>
            <div className="deep-panel">
              <p className="section-kicker">Build principles</p>
              <h2>Designed to be useful without pretending to be official.</h2>

              <div className="validation-stack page-validation-stack">
                {buildPrinciples.map((principle, index) => (
                  <div className="validation-band" key={principle.label}>
                    <div className="validation-number">
                      {String(index + 1).padStart(2, "0")}
                    </div>

                    <div>
                      <h3>{principle.label}</h3>
                      <p>{principle.text}</p>
                    </div>

                    <span>Review-aware</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal>
            <div className="final-panel" style={{ marginTop: "5rem" }}>
              <div>
                <div className="final-badge">
                  <ScrollText size={14} />
                  Non-official by design
                </div>

                <h2>Use it as a readiness layer, not a legal conclusion.</h2>
              </div>

              <div>
                <p>
                  Invoice Lantern is independent and non-official. It does not
                  provide official EU software, national tax authority software,
                  OpenPeppol certification, EN 16931 certification, official
                  filing, authority acceptance, legal advice, tax advice,
                  accounting advice, privacy advice, security certification, or
                  a compliance guarantee. Professional review remains required
                  before production reliance.
                </p>

                <Link href="/boundaries" className="text-link-button">
                  Review boundaries
                  <ArrowRight size={18} />
                </Link>
              </div>
            </div>
          </Reveal>

          <div className="next-page-row">
            <Link href="/developer-api" className="text-link-button">
              Developer API
              <ArrowRight size={18} />
            </Link>
            <Link href="/legal" className="text-link-button">
              Legal documents
              <ArrowRight size={18} />
            </Link>
            <Link href="/contact" className="text-link-button">
              Contact
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

function InfoCard({
  icon,
  title,
  description
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div
      className="subpage-card"
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column"
      }}
    >
      <div className="subpage-card-icon">{icon}</div>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}
