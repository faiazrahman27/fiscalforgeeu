import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  Code2,
  FileText,
  ShieldCheck
} from "lucide-react";
import { Reveal } from "../../components/reveal";
import { SiteFooter } from "../../components/site-footer";
import { SiteHeader } from "../../components/site-header";

const aboutCards = [
  {
    icon: <FileText size={22} />,
    title: "Structured invoice readiness",
    description:
      "Invoice Lantern works from canonical invoice data before validation, XML generation, import, export, reporting, or API use."
  },
  {
    icon: <BookOpenCheck size={22} />,
    title: "Source-linked simulations",
    description:
      "Country packs, ViDA-readiness, VIES evidence, and standards-style checks are versioned technical context, not official determinations."
  },
  {
    icon: <Code2 size={22} />,
    title: "API-first product surface",
    description:
      "Developer endpoints, scoped API keys, OpenAPI documentation, and signed-user workspace routes are designed for controlled integration testing."
  },
  {
    icon: <ShieldCheck size={22} />,
    title: "Secure-by-design boundaries",
    description:
      "The platform preserves tenant isolation, RBAC, XML safety, privacy-support workflows, redaction, and professional-review-required wording."
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
              Independent invoice validation and readiness simulation.
            </h1>

            <p className="subpage-lead">
              Invoice Lantern is built for European freelancers, SMEs,
              students, accountants, and developers who need to inspect
              structured e-invoice data, UBL XML, calculation logic, VAT-number
              checks, Peppol-style rules, EN 16931-style checks, country-pack
              simulations, and ViDA-readiness signals without implying official
              legal, tax, accounting, filing, or authority certification.
            </p>
          </Reveal>

          <div className="subpage-grid">
            {aboutCards.map((card) => (
              <Reveal key={card.title}>
                <div className="subpage-card">
                  <div className="subpage-card-icon">{card.icon}</div>
                  <h2>{card.title}</h2>
                  <p>{card.description}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal>
            <div className="deep-panel">
              <div>
                <p className="section-kicker">Product boundary</p>
                <h2>Technical confidence without false certainty.</h2>
              </div>

              <p className="public-page-copy">
                Invoice Lantern is independent and non-official. It does not
                provide official EU software, national tax authority software,
                OpenPeppol certification, EN 16931 certification, official
                filing, authority acceptance, legal advice, tax advice,
                accounting advice, privacy advice, security certification, or a
                compliance guarantee. Professional review remains required
                before production reliance.
              </p>
            </div>
          </Reveal>

          <div className="next-page-row">
            <Link href="/developer-api" className="text-link-button">
              Developer API
              <ArrowRight size={18} />
            </Link>
            <Link href="/boundaries" className="text-link-button">
              Boundaries
              <ArrowRight size={18} />
            </Link>
            <Link href="/legal" className="text-link-button">
              Legal documents
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
