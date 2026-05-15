import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Braces,
  CheckCircle2,
  Code2,
  FileCheck2,
  Fingerprint,
  Globe2,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  TerminalSquare
} from "lucide-react";
import { DocumentTheatre } from "../components/document-theatre";
import { MagneticButton } from "../components/magnetic-button";
import { Reveal } from "../components/reveal";
import { SiteFooter } from "../components/site-footer";
import { SiteHeader } from "../components/site-header";
import {
  audiences,
  legalBoundaries,
  validationLayers,
  workflowSteps
} from "../lib/constants";

const tickerItems = [
  "UBL XML generation planning",
  "EN 16931-style readiness checks",
  "Peppol-style profile signals",
  "VAT-number format logic",
  "VIES evidence planning",
  "ViDA-readiness simulation",
  "Country rule-pack sandbox",
  "Developer API testing",
  "Audit-ready report structure",
  "Technical validation, not tax advice"
];

const pageLinks = [
  {
    href: "/studio",
    label: "Invoice Studio",
    description:
      "Create structured invoices, manage buyer and seller profiles, model VAT logic, and prepare canonical invoice data for validation and export.",
    tag: "Creation"
  },
  {
    href: "/validation",
    label: "Validation Engine",
    description:
      "Inspect schema checks, calculation rules, UBL mapping, EN 16931-style rules, Peppol-style findings, country simulations, and confidence labels.",
    tag: "Rules"
  },
  {
    href: "/developer-api",
    label: "Developer API",
    description:
      "Explore sandbox endpoints, API key boundaries, scoped access, request logging plans, validation run IDs, UBL export planning, VAT checks, and webhook simulation.",
    tag: "API"
  },
  {
    href: "/boundaries",
    label: "Legal Boundaries",
    description:
      "Review the platform's independent positioning, non-affiliation language, no-tax-advice notices, and professional-review requirements.",
    tag: "Trust"
  },
  {
    href: "/legal",
    label: "Legal Documents",
    description:
      "Read versioned platform policies, API terms, privacy notices, cookie stance, subprocessor list, retention notice, and simulation disclaimers.",
    tag: "Policy"
  }
];

export default function HomePage() {
  return (
    <main className="site-shell">
      <SiteHeader />

      <section className="hero-section">
        <div className="hero-inner">
          <Reveal>
            <div className="hero-copy">
              <div className="hero-badge">
                <span />
                Independent invoice readiness sandbox
              </div>

              <h1 className="hero-title">
                Invoice <span>Lantern</span>
              </h1>

              <p className="hero-lead">
                Build, inspect, validate, export, and explain structured European
                invoice data with a technical sandbox for UBL, EN 16931-style
                checks, Peppol-style profile signals, VAT-number logic, and
                ViDA-readiness simulation.
              </p>

              <div className="hero-actions">
                <MagneticButton href="/workspace">
                  Enter sandbox
                  <ArrowRight size={18} />
                </MagneticButton>

                <MagneticButton href="/developer-api" variant="secondary">
                  API preview
                  <TerminalSquare size={18} />
                </MagneticButton>
              </div>

              <div className="hero-quote">
                <p>
                  Clarity before compliance. Not official. Not tax advice. A
                  technical environment for structured invoice readiness review.
                </p>
              </div>
            </div>
          </Reveal>

          <DocumentTheatre />
        </div>
      </section>

      <section className="audience-strip">
        <div className="audience-inner">
          <p>Designed for real users</p>

          <div>
            {audiences.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>
      </section>

      <section
        className="ticker-section"
        aria-label="Invoice Lantern platform highlights"
      >
        <div className="ticker-label">
          <span />
          Platform radar
        </div>

        <div className="ticker-window">
          <div className="ticker-track">
            {tickerItems.map((item) => (
              <div className="ticker-item" key={item}>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-inner">
          <Reveal>
            <div className="section-heading">
              <p className="section-kicker">Platform map</p>
              <h2>Everything starts here. Each area opens into its own working page.</h2>
              <p>
                The homepage gives users the product story. The deeper pages carry
                the workflows, technical details, rule explanations, API behavior,
                and legal boundaries connected to each module.
              </p>
            </div>
          </Reveal>

          <div className="page-link-grid">
            {pageLinks.map((item) => (
              <Reveal key={item.href}>
                <Link href={item.href} className="page-link-panel">
                  <span>{item.tag}</span>
                  <h3>{item.label}</h3>
                  <p>{item.description}</p>
                  <strong>
                    Open page
                    <ArrowRight size={17} />
                  </strong>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-inner">
          <Reveal>
            <div className="section-heading">
              <p className="section-kicker">Invoice creation studio</p>
              <h2>
                A workspace that feels like a command center, not an accounting form.
              </h2>
              <p>
                The Studio page expands this into the invoice-building flow:
                business profiles, contacts, line items, VAT breakdowns, payment
                data, canonical model preview, and UBL export preparation.
              </p>

              <div className="section-action-row">
                <Link href="/studio" className="text-link-button">
                  Open Studio page
                  <ArrowRight size={18} />
                </Link>
              </div>
            </div>
          </Reveal>

          <div className="studio-grid">
            <Reveal>
              <div className="cinema-panel flow-panel">
                <div className="panel-title-row">
                  <div>
                    <p>Invoice Lantern workspace</p>
                    <h3>Invoice flow</h3>
                  </div>

                  <span>Draft safe</span>
                </div>

                <div className="flow-list">
                  {workflowSteps.map((step, index) => (
                    <div className="flow-row" key={step.title}>
                      <span className="flow-index">
                        {String(index + 1).padStart(2, "0")}
                      </span>

                      <div>
                        <h4>{step.title}</h4>
                        <p>{step.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.12}>
              <div className="cinema-panel findings-panel">
                <div className="panel-orb" />

                <div className="findings-heading">
                  <p>Validation surface</p>
                  <h3>Errors should feel fixable, traceable, and human.</h3>
                </div>

                <div className="findings-list">
                  <ValidationFinding
                    icon={<FileCheck2 size={18} />}
                    code="TOTAL_CONSISTENCY_REVIEW"
                    title="Invoice total review"
                    message="Payable amount should be explainable from line totals, tax totals, allowances, charges, prepaid amounts, and rounding."
                    severity="Review"
                  />

                  <ValidationFinding
                    icon={<Globe2 size={18} />}
                    code="CROSS_BORDER_REVIEW_REQUIRED"
                    title="Cross-border context"
                    message="Different seller and buyer country signals require VAT, routing, and reporting review."
                    severity="Warning"
                  />

                  <ValidationFinding
                    icon={<Fingerprint size={18} />}
                    code="BUYER_TAX_IDENTIFIER_REVIEW"
                    title="Buyer tax identifier"
                    message="Some business flows may require a buyer tax identifier or electronic address before submission."
                    severity="Review"
                  />
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-inner">
          <Reveal>
            <div className="split-heading">
              <div>
                <p className="section-kicker">Validation engine</p>
                <h2>Layered validation, visible confidence, clear boundaries.</h2>
              </div>

              <div>
                <p>
                  The Validation page expands each layer with rule examples,
                  severity mapping, confidence labels, source references, and
                  report logic.
                </p>

                <Link href="/validation" className="text-link-button compact">
                  Open Validation page
                  <ArrowRight size={18} />
                </Link>
              </div>
            </div>
          </Reveal>

          <div className="validation-stack">
            {validationLayers.map((layer, index) => (
              <Reveal key={layer.title} delay={index * 0.035}>
                <div className="validation-band">
                  <div className="validation-number">
                    {String(index + 1).padStart(2, "0")}
                  </div>

                  <div>
                    <h3>{layer.title}</h3>
                    <p>{layer.description}</p>
                  </div>

                  <span>{layer.confidence}</span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-inner api-grid">
          <Reveal>
            <div>
              <p className="section-kicker">Developer platform</p>
              <h2>API-first, sandbox-safe, rate-limited from day one.</h2>
              <p className="api-copy">
                The Developer API page expands this into endpoint documentation,
                API key rules, scopes, request logs, rate limits, validation
                responses, and webhook testing.
              </p>

              <div className="security-pills">
                <SecurityPill icon={<ShieldCheck size={15} />} label="Scoped API keys" />
                <SecurityPill icon={<LockKeyhole size={15} />} label="RBAC-aware access" />
                <SecurityPill icon={<Braces size={15} />} label="Schema validation" />
                <SecurityPill icon={<Code2 size={15} />} label="OpenAPI-ready" />
              </div>

              <div className="section-action-row">
                <Link href="/developer-api" className="text-link-button">
                  Open API page
                  <ArrowRight size={18} />
                </Link>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="terminal-shell">
              <div className="terminal-top">
                <span />
                <span />
                <span />
                <p>POST /api/v1/invoices/validate</p>
              </div>

              <pre>{`{
  "document": {
    "type": "invoice",
    "number": "<invoice-number>",
    "currency": "EUR"
  },
  "seller": {
    "country": "<seller-country-code>",
    "vatId": "<seller-tax-id>"
  },
  "buyer": {
    "country": "<buyer-country-code>",
    "vatId": "<buyer-tax-id>"
  },
  "result": {
    "technicalStatus": "passed_or_failed",
    "standardStatus": "ready_or_warning",
    "confidence": "technical_or_simulation"
  }
}`}</pre>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section">
        <div className="section-inner">
          <Reveal>
            <div className="section-heading">
              <p className="section-kicker">Legal positioning</p>
              <h2>Serious software needs honest boundaries.</h2>
              <p>
                The Boundaries page expands the independent positioning,
                non-affiliation language, validation-result disclaimers,
                country-pack disclaimers, and developer API notices.
              </p>

              <div className="section-action-row">
                <Link href="/boundaries" className="text-link-button">
                  Open Boundaries page
                  <ArrowRight size={18} />
                </Link>
              </div>
            </div>
          </Reveal>

          <div className="boundary-grid">
            {legalBoundaries.map((item) => (
              <Reveal key={item.title}>
                <div className="boundary-slab">
                  <CheckCircle2 size={22} />
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="final-section">
        <Reveal>
          <div className="final-panel">
            <div>
              <div className="final-badge">
                <Sparkles size={14} />
                Workspace hub
              </div>

              <h2>Continue in the working product shell.</h2>
            </div>

            <div>
              <p>
                The workspace is the product area for invoice creation,
                validation runs, XML uploads, API key previews, audit planning,
                and privacy controls.
              </p>

              <MagneticButton href="/workspace">
                Open sandbox
                <ArrowRight size={18} />
              </MagneticButton>
            </div>
          </div>
        </Reveal>
      </section>

      <SiteFooter />
    </main>
  );
}

function ValidationFinding({
  icon,
  code,
  title,
  message,
  severity
}: {
  icon: ReactNode;
  code: string;
  title: string;
  message: string;
  severity: string;
}) {
  return (
    <div className="finding-row">
      <div className="finding-icon">{icon}</div>

      <div className="finding-main">
        <div>
          <p>{title}</p>
          <span>{code}</span>
        </div>

        <p>{message}</p>
      </div>

      <strong>{severity}</strong>
    </div>
  );
}

function SecurityPill({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="security-pill">
      {icon}
      {label}
    </span>
  );
}
