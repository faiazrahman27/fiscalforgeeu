import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  ReceiptText,
  Rows3,
  WandSparkles
} from "lucide-react";
import { Reveal } from "../../components/reveal";
import { SiteFooter } from "../../components/site-footer";
import { SiteHeader } from "../../components/site-header";
import { workflowSteps } from "../../lib/constants";
import "./studio.css";

const studioModules = [
  {
    icon: <ReceiptText size={22} />,
    title: "Invoice builder",
    description:
      "Create invoice data through a structured interface designed for seller, buyer, delivery, payment, references, and line items."
  },
  {
    icon: <Rows3 size={22} />,
    title: "Line item control",
    description:
      "Model quantity, unit code, unit price, allowance, charge, net amount, VAT category, VAT rate, and totals with decimal-safe behavior."
  },
  {
    icon: <FileText size={22} />,
    title: "Canonical preview",
    description:
      "User input is prepared as structured invoice data before validation, XML preparation, reporting, or API use."
  },
  {
    icon: <WandSparkles size={22} />,
    title: "UBL preparation",
    description:
      "Prepare invoice data for UBL-style XML output while keeping technical, legal, tax, Peppol, EN 16931, ViDA, and authority boundaries clear."
  }
];

export default function StudioPage() {
  return (
    <main className="site-shell subpage-shell studio-page">
      <SiteHeader />

      <section className="subpage-hero">
        <div className="section-inner">
          <Reveal>
            <Link href="/" className="back-link">
              <ArrowLeft size={17} />
              Home
            </Link>

            <p className="section-kicker">Invoice Studio</p>

            <h1 className="subpage-title">
              Build structured invoices before they become XML.
            </h1>

            <p className="subpage-lead">
              The Studio is the user-facing invoice creation layer. It turns
              business data, buyer and seller profiles, invoice lines, VAT
              categories, and payment information into structured invoice data
              that can later support validation, XML preparation, parsing, and
              reporting workflows.
            </p>
          </Reveal>

          <div className="subpage-grid">
            {studioModules.map((item) => (
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
                <p className="section-kicker">Studio workflow</p>
                <h2>From human invoice input to structured invoice data.</h2>
              </div>

              <div className="deep-list">
                {workflowSteps.map((step, index) => (
                  <div key={step.title} className="deep-row">
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

          <div className="next-page-row">
            <Link href="/validation" className="text-link-button">
              Continue to Validation
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
