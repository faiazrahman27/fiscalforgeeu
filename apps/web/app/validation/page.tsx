import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Calculator,
  FileWarning,
  Layers3
} from "lucide-react";
import { Reveal } from "../../components/reveal";
import { SiteHeader } from "../../components/site-header";
import { validationLayers } from "../../lib/constants";
import "./validation.css";

const validationFocus = [
  {
    icon: <Layers3 size={22} />,
    title: "Layered validation",
    description:
      "Checks should run in layers: input schema, canonical model, calculation logic, VAT format, VIES evidence, UBL mapping, standards rules, country simulation, and ViDA simulation."
  },
  {
    icon: <Calculator size={22} />,
    title: "Decimal-safe calculations",
    description:
      "Invoice totals must avoid JavaScript floating-point errors. The platform will use decimal strings and decimal-safe arithmetic."
  },
  {
    icon: <FileWarning size={22} />,
    title: "Friendly findings",
    description:
      "Raw rule errors should be mapped into readable findings with severity, field path, source, rule version, and fix suggestions."
  },
  {
    icon: <BadgeCheck size={22} />,
    title: "Confidence labels",
    description:
      "Every result must distinguish technical checks, standard-based checks, official-source-derived evidence, educational simulations, and professional-review requirements."
  }
];

export default function ValidationPage() {
  return (
    <main className="site-shell subpage-shell validation-page">
      <SiteHeader />

      <section className="subpage-hero">
        <div className="section-inner">
          <Reveal>
            <Link href="/" className="back-link">
              <ArrowLeft size={17} />
              Home
            </Link>

            <p className="section-kicker">Validation Engine</p>

            <h1 className="subpage-title">
              Validation that explains what it knows and what it cannot promise.
            </h1>

            <p className="subpage-lead">
              Invoice Lantern validation is not a single pass/fail badge. It is a layered
              result model that separates technical correctness, standard-style rules,
              country-pack simulation, and professional-review requirements.
            </p>
          </Reveal>

          <div className="subpage-grid">
            {validationFocus.map((item) => (
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
                <p className="section-kicker">Validation layers</p>
                <h2>The report should show every layer, source, and confidence level.</h2>
              </div>

              <div className="validation-stack page-validation-stack">
                {validationLayers.map((layer, index) => (
                  <div className="validation-band" key={layer.title}>
                    <div className="validation-number">
                      {String(index + 1).padStart(2, "0")}
                    </div>

                    <div>
                      <h3>{layer.title}</h3>
                      <p>{layer.description}</p>
                    </div>

                    <span>{layer.confidence}</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          <div className="next-page-row">
            <Link href="/developer-api" className="text-link-button">
              Continue to Developer API
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
