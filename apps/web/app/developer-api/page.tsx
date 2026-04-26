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
      "POST structured invoice JSON and receive a validation run ID, status fields, findings, rule versions, and safe disclaimers."
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
      "Developers can test webhook delivery for validation results, XML generation events, and report availability without official filing."
  },
  {
    icon: <ShieldCheck size={22} />,
    title: "Security controls",
    description:
      "Every endpoint will need schema validation, object authorization, rate limits, input size limits, and audit logging."
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
              The Developer API will expose validation, UBL export, XML parsing,
              VAT-number checks, ViDA simulation, country packs, rule sets, validation
              runs, and webhook testing through secure organization-aware endpoints.
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
  "validationRunId": "val_01HXABC",
  "valid": false,
  "technicalStatus": "failed",
  "standardStatus": "warning",
  "countrySimulationStatus": "review_required",
  "vidaReadinessStatus": "relevant_simulation",
  "findings": [
    {
      "code": "BUYER_VAT_ID_REQUIRED",
      "severity": "fatal",
      "category": "VAT_ID",
      "field": "buyer.vatId",
      "legalConfidence": "educational_simulation"
    }
  ],
  "disclaimer": "This validation is not legal, tax, or accounting advice."
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
