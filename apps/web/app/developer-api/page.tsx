import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Braces,
  KeyRound,
  RadioTower,
  ShieldCheck
} from "lucide-react";
import { Reveal } from "../../components/reveal";
import { SiteHeader } from "../../components/site-header";
import "./developer-api.css";

const apiModules = [
  {
    icon: <Braces size={22} />,
    title: "Validation endpoint",
    description:
      "POST structured invoice JSON and receive a validation run ID, status fields, findings, confidence labels, and safe disclaimers."
  },
  {
    icon: <KeyRound size={22} />,
    title: "API key management",
    description:
      "Keys should be scoped, hashed at rest, shown only once, revocable, rotatable, rate-limited, and connected to organizations."
  },
  {
    icon: <RadioTower size={22} />,
    title: "Webhook simulator",
    description:
      "Developers should be able to test webhook delivery for validation results, XML generation events, and report availability without official filing."
  },
  {
    icon: <ShieldCheck size={22} />,
    title: "Security controls",
    description:
      "Every endpoint needs schema validation, object authorization, rate limits, input size limits, secure API-key handling, and audit logging."
  }
];

export default function DeveloperApiPage() {
  return (
    <main className="site-shell subpage-shell developer-api-page">
      <SiteHeader />

      <section className="subpage-hero">
        <div className="section-inner">
          <Reveal>
            <Link href="/" className="back-link">
              <ArrowLeft size={17} />
              Home
            </Link>

            <p className="section-kicker">Developer API</p>

            <h1 className="subpage-title">
              A sandbox API for structured invoice testing.
            </h1>

            <p className="subpage-lead">
              The Developer API is being built to expose validation, UBL export,
              XML parsing, VAT-number checks, ViDA simulation, country packs, rule
              sets, validation runs, and webhook testing through secure
              organization-aware endpoints.
            </p>
          </Reveal>

          <div className="subpage-grid">
            {apiModules.map((item) => (
              <Reveal key={item.title}>
                <div className="subpage-card">
                  <div className="subpage-card-icon">{item.icon}</div>
                  <h2>{item.title}</h2>
                  <p>{item.description}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal>
            <div className="terminal-shell subpage-terminal">
              <div className="terminal-top">
                <span />
                <span />
                <span />
                <p>POST /api/v1/invoices/validate</p>
              </div>

              <pre>{`{
  "validationRunId": "<generated-validation-run-id>",
  "technicalStatus": "passed_or_failed",
  "standardStatus": "ready_or_warning",
  "countrySimulationStatus": "not_relevant_or_review_required",
  "vidaReadinessStatus": "not_relevant_or_relevant_simulation",
  "findings": [
    {
      "code": "<finding-code>",
      "severity": "info_warning_or_fatal",
      "field": "<field-path>",
      "confidence": "technical_or_simulation_or_review_required"
    }
  ],
  "disclaimer": "This result is not legal, tax, accounting, Peppol, EN 16931, ViDA, government, or authority validation."
}`}</pre>
            </div>
          </Reveal>

          <div className="next-page-row">
            <Link href="/boundaries" className="text-link-button">
              Continue to Boundaries
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
