import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  LifeBuoy,
  LockKeyhole,
  Mail,
  ShieldAlert
} from "lucide-react";
import { Reveal } from "../../components/reveal";
import { SiteFooter } from "../../components/site-footer";
import { SiteHeader } from "../../components/site-header";
import { getLegalDocumentHref } from "../../lib/legal-documents";

type ContactChannel = {
  title: string;
  description: string;
  email: string;
  envName: string;
  icon: ReactNode;
};

function readPublicEmail(name: string) {
  return process.env[name]?.trim() ?? "";
}

function ContactCard({ channel }: { channel: ContactChannel }) {
  return (
    <Reveal>
      <article className="contact-card">
        <div className="subpage-card-icon">{channel.icon}</div>
        <h2>{channel.title}</h2>
        <p>{channel.description}</p>
        {channel.email ? (
          <a href={`mailto:${channel.email}`}>{channel.email}</a>
        ) : (
          <span>Configure {channel.envName} before public launch.</span>
        )}
      </article>
    </Reveal>
  );
}

export const metadata = {
  title: "Contact Invoice Lantern",
  description:
    "Contact channels and review boundaries for Invoice Lantern."
};

export default function ContactPage() {
  const channels: ContactChannel[] = [
    {
      title: "Product questions",
      description:
        "Use this channel for product access, sandbox behavior, documentation, and release-candidate setup questions.",
      email: readPublicEmail("NEXT_PUBLIC_CONTACT_EMAIL"),
      envName: "NEXT_PUBLIC_CONTACT_EMAIL",
      icon: <Mail size={22} />
    },
    {
      title: "Security contact",
      description:
        "Use this channel for vulnerability disclosure, security readiness, and responsible reporting coordination.",
      email: readPublicEmail("NEXT_PUBLIC_SECURITY_CONTACT_EMAIL"),
      envName: "NEXT_PUBLIC_SECURITY_CONTACT_EMAIL",
      icon: <LockKeyhole size={22} />
    },
    {
      title: "Privacy contact",
      description:
        "Use this channel for privacy requests, data export/deletion questions, subprocessors, and retention review coordination.",
      email: readPublicEmail("NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL"),
      envName: "NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL",
      icon: <LifeBuoy size={22} />
    },
    {
      title: "Incident contact",
      description:
        "Use this channel for suspected security or privacy incidents. Incident duties and notification decisions require professional review.",
      email: readPublicEmail("NEXT_PUBLIC_INCIDENT_CONTACT_EMAIL"),
      envName: "NEXT_PUBLIC_INCIDENT_CONTACT_EMAIL",
      icon: <ShieldAlert size={22} />
    }
  ];

  return (
    <main className="site-shell subpage-shell contact-page">
      <SiteHeader />

      <section className="subpage-hero">
        <div className="section-inner">
          <Reveal>
            <Link href="/" className="back-link">
              <ArrowLeft size={17} />
              Home
            </Link>

            <p className="section-kicker">Contact</p>

            <h1 className="subpage-title">
              Public contact channels without fake company details.
            </h1>

            <p className="subpage-lead">
              Configure public contact email values before launch. Invoice
              Lantern does not publish a fake address, phone number, or contact
              form without a working backend and reviewed operational process.
            </p>
          </Reveal>

          <div className="contact-grid">
            {channels.map((channel) => (
              <ContactCard channel={channel} key={channel.title} />
            ))}
          </div>

          <Reveal>
            <div className="deep-panel">
              <div>
                <p className="section-kicker">Professional review note</p>
                <h2>Contact does not replace qualified advice.</h2>
              </div>

              <p className="public-page-copy">
                Product support can explain platform behavior, but Invoice
                Lantern does not provide legal, tax, accounting, privacy,
                security, filing, or official compliance advice. Review your
                launch configuration and operational duties with qualified
                professionals.
              </p>
            </div>
          </Reveal>

          <div className="next-page-row">
            <Link href={getLegalDocumentHref("privacy")} className="text-link-button">
              Privacy Policy
              <ArrowRight size={18} />
            </Link>
            <Link href={getLegalDocumentHref("security")} className="text-link-button">
              Security Policy
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
