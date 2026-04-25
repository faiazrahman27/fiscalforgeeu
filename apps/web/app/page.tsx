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
import { SiteHeader } from "../components/site-header";
import {
  audiences,
  legalBoundaries,
  validationLayers,
  workflowSteps
} from "../lib/constants";

const tickerItems = [
  "UBL XML generation",
  "EN 16931-style checks",
  "Peppol-style validation",
  "VAT-number format logic",
  "VIES evidence tracking",
  "ViDA-readiness simulation",
  "Country rule-pack sandbox",
  "Developer API testing",
  "Audit-ready validation reports",
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
      "Explore sandbox endpoints, API keys, scoped access, request logging, validation run IDs, UBL export, VAT checks, and webhook simulation.",
    tag: "API"
  },
  {
    href: "/boundaries",
    label: "Legal Boundaries",
    description:
      "Review the platform’s independent positioning, non-affiliation language, no-tax-advice notices, and professional-review requirements.",
    tag: "Trust"
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
                Independent EU invoice validation sandbox
              </div>

              <h1 className="hero-title">
                Fiscal
                <span>Forge EU</span>
              </h1>

              <p className="hero-lead">
                Build, inspect, validate, export, and explain structured European
                invoice data with a serious technical sandbox for UBL, EN 16931,
                Peppol-style checks, VAT-number logic, and ViDA-readiness simulation.
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
                  Not official. Not tax advice. Not certification theatre.
                  A professional technical environment for structured invoice validation.
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

      <section className="ticker-section" aria-label="FiscalForge EU platform highlights">
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
                The homepage gives users the complete product story. The deeper pages
                carry the full workflows, technical details, rule explanations, API
                behavior, and legal boundaries connected to each module.
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
                The Studio page expands this into the full invoice-building flow:
                business profiles, contacts, line items, VAT breakdowns, payment data,
                canonical model preview, and UBL export preparation.
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
                    <p>FiscalForge workspace</p>
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
                  <p>Live validation surface</p>
                  <h3>Errors should feel fixable, traceable, and human.</h3>
                </div>

                <div className="findings-list">
                  <ValidationFinding
                    icon={<FileCheck2 size={18} />}
                    code="BR-CO-10"
                    title="Invoice total mismatch"
                    message="Payable amount does not match the sum of line totals, taxes, allowances, and charges."
                    severity="Fatal"
                  />

                  <ValidationFinding
                    icon={<Globe2 size={18} />}
                    code="INTRA_EU_B2B_REVERSE_CHARGE_WARNING"
                    title="Possible reverse-charge scenario"
                    message="The transaction appears to involve two EU Member States and a business buyer. Professional review required."
                    severity="Warning"
                  />

                  <ValidationFinding
                    icon={<Fingerprint size={18} />}
                    code="BUYER_VAT_ID_REQUIRED"
                    title="Buyer VAT ID missing"
                    message="Buyer VAT ID is required for this intra-EU B2B simulation."
                    severity="Fatal"
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
                  The Validation page expands each layer with rule examples, severity
                  mapping, legal-confidence labels, source references, and report logic.
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
                The Developer API page expands this into endpoint documentation, API key
                rules, scopes, request logs, rate limits, validation responses, and
                webhook testing.
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
  "profile": "PEPPOL_BIS_3",
  "document": {
    "type": "invoice",
    "number": "FF-2026-001",
    "currency": "EUR"
  },
  "seller": {
    "country": "HU",
    "vatId": "HU12345678"
  },
  "buyer": {
    "country": "DE",
    "vatId": "DE123456789"
  },
  "result": {
    "technicalStatus": "failed",
    "standardStatus": "warning",
    "legalConfidence": "educational_simulation"
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
                The Boundaries page expands the independent positioning, non-affiliation
                language, validation-result disclaimers, country-pack disclaimers, and
                developer API notices.
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
                Homepage hub ready
              </div>

              <h2>Next: build the real workspace shell.</h2>
            </div>

            <div>
              <p>
                The Sandbox page will become the authenticated product area: organization
                switcher, invoice studio, validation runs, XML uploads, API key area,
                audit logs, and privacy dashboard.
              </p>

              <MagneticButton href="/workspace">
                Open sandbox
                <ArrowRight size={18} />
              </MagneticButton>
            </div>
          </div>
        </Reveal>
      </section>
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

function SecurityPill({
  icon,
  label
}: {
  icon: ReactNode;
  label: string;
}) {
  return (
    <span className="security-pill">
      {icon}
      {label}
    </span>
  );
}