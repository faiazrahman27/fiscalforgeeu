import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Ban,
  FileText,
  Landmark,
  Scale
} from "lucide-react";
import { Reveal } from "../../components/reveal";
import { SiteHeader } from "../../components/site-header";
import { legalBoundaries } from "../../lib/constants";
import "./boundaries.css";

const notices = [
  {
    icon: <Landmark size={22} />,
    title: "Not official software",
    description:
      "Invoice Lantern is not affiliated with, endorsed by, sponsored by, or operated by the European Union, European Commission, national tax authorities, OpenPeppol, Peppol authorities, or standards bodies."
  },
  {
    icon: <Scale size={22} />,
    title: "Not legal or tax advice",
    description:
      "The platform can provide technical validation and readiness simulations, but it must never present its output as legal, tax, accounting, financial, or professional advice."
  },
  {
    icon: <Ban size={22} />,
    title: "No compliance guarantee",
    description:
      "Validation results must never claim that an invoice is legally valid, tax compliant, accepted by any authority, or suitable for filing."
  },
  {
    icon: <FileText size={22} />,
    title: "Source-linked rule packs",
    description:
      "Country-context and standards-style rules must be source-linked, versioned, reviewed, and clearly marked as simulations when professional interpretation is required."
  }
];

export default function BoundariesPage() {
  return (
    <main className="site-shell subpage-shell boundaries-page">
      <SiteHeader />

      <section className="subpage-hero">
        <div className="section-inner">
          <Reveal>
            <Link href="/" className="back-link">
              <ArrowLeft size={17} />
              Home
            </Link>

            <p className="section-kicker">Legal Boundaries</p>

            <h1 className="subpage-title">
              Professional trust starts with clear limits.
            </h1>

            <p className="subpage-lead">
              Invoice Lantern can be useful only if its claims are precise. The
              platform should communicate strong technical competence while never
              implying official certification, tax authority acceptance, legal
              advice, or guaranteed compliance.
            </p>
          </Reveal>

          <div className="subpage-grid">
            {notices.map((item) => (
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
            <div className="deep-panel">
              <div>
                <p className="section-kicker">Core positioning</p>
                <h2>Independent, technical, and review-required.</h2>
              </div>

              <div className="boundary-grid boundary-grid-subpage">
                {legalBoundaries.map((item) => (
                  <div className="boundary-slab" key={item.title}>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          <div className="next-page-row">
            <Link href="/workspace" className="text-link-button">
              Continue to Workspace
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
