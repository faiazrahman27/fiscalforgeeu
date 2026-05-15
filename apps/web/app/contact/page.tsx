import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  FileText,
  LifeBuoy,
  LockKeyhole,
  Mail,
  MessageSquareText,
  Send,
  ShieldAlert,
  ShieldCheck
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
    <article
      className="contact-card"
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column"
      }}
    >
      <div className="subpage-card-icon">{channel.icon}</div>

      <h2>{channel.title}</h2>

      <p>{channel.description}</p>

      <div style={{ marginTop: "auto" }}>
        {channel.email ? (
          <a href={`mailto:${channel.email}`}>{channel.email}</a>
        ) : (
          <span>Configure {channel.envName} before public launch.</span>
        )}
      </div>
    </article>
  );
}

const formGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(320px, 0.72fr)",
  gap: "1.25rem",
  alignItems: "start",
  marginTop: "4rem"
};

const formPanelStyle: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "2rem",
  background:
    "radial-gradient(circle at 12% 0%, rgba(100,210,255,0.1), transparent 24rem), rgba(255,255,255,0.03)",
  boxShadow: "0 30px 90px rgba(0,0,0,0.3)",
  padding: "clamp(1.4rem, 4vw, 2rem)"
};

const formStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
  marginTop: "1.5rem"
};

const fieldStyle: CSSProperties = {
  display: "grid",
  gap: "0.5rem"
};

const labelTextStyle: CSSProperties = {
  color: "rgba(255,255,255,0.58)",
  fontSize: "0.74rem",
  fontWeight: 850,
  letterSpacing: "0.14em",
  textTransform: "uppercase"
};

const inputStyle: CSSProperties = {
  width: "100%",
  minHeight: "3.2rem",
  border: "1px solid rgba(255,255,255,0.13)",
  borderRadius: "1rem",
  background:
    "linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.028)), rgba(0,0,0,0.28)",
  color: "white",
  font: "inherit",
  outline: "none",
  padding: "0.9rem 1rem"
};

const textareaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: "9.5rem",
  resize: "vertical",
  lineHeight: 1.65
};

const disabledButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.65rem",
  width: "fit-content",
  border: "1px solid rgba(255,255,255,0.16)",
  borderRadius: "999px",
  background: "rgba(255,255,255,0.16)",
  color: "rgba(255,255,255,0.68)",
  cursor: "not-allowed",
  font: "inherit",
  fontSize: "0.78rem",
  fontWeight: 850,
  letterSpacing: "0.12em",
  marginTop: "0.35rem",
  padding: "0.9rem 1.15rem",
  textTransform: "uppercase"
};

export const metadata = {
  title: "Contact Invoice Lantern",
  description:
    "Contact Invoice Lantern for product, security, privacy, incident, and platform questions."
};

export default function ContactPage() {
  const channels: ContactChannel[] = [
    {
      title: "Product questions",
      description:
        "Use this channel for product access, sandbox behavior, documentation, release-candidate setup, and general Invoice Lantern questions.",
      email: readPublicEmail("NEXT_PUBLIC_CONTACT_EMAIL"),
      envName: "NEXT_PUBLIC_CONTACT_EMAIL",
      icon: <Mail size={22} />
    },
    {
      title: "Security contact",
      description:
        "Use this channel for vulnerability disclosure, security readiness, responsible reporting, and coordinated security review.",
      email: readPublicEmail("NEXT_PUBLIC_SECURITY_CONTACT_EMAIL"),
      envName: "NEXT_PUBLIC_SECURITY_CONTACT_EMAIL",
      icon: <LockKeyhole size={22} />
    },
    {
      title: "Privacy contact",
      description:
        "Use this channel for privacy requests, data export/deletion questions, subprocessors, retention review, and GDPR-related coordination.",
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

            <p className="section-kicker">Contact Invoice Lantern</p>

            <h1 className="subpage-title">
              Talk to the builder behind the sandbox.
            </h1>

            <p className="subpage-lead">
              Use this page for product questions, setup questions, security
              coordination, privacy requests, incident reports, and professional
              review discussions around Invoice Lantern. The contact form is
              prepared for email delivery and will be connected to the reviewed
              production email flow later.
            </p>
          </Reveal>

          <div style={formGridStyle} className="contact-form-grid">
            <Reveal>
              <section style={formPanelStyle}>
                <div className="subpage-card-icon">
                  <MessageSquareText size={22} />
                </div>

                <p className="section-kicker" style={{ marginTop: "1.35rem" }}>
                  Contact form
                </p>

                <h2
                  style={{
                    margin: "0.85rem 0 0",
                    color: "white",
                    fontSize: "clamp(2rem, 4vw, 3.8rem)",
                    lineHeight: 0.95,
                    letterSpacing: "-0.065em"
                  }}
                >
                  Send a structured message.
                </h2>

                <p className="public-page-copy">
                  This form is intentionally not connected yet. It is ready for
                  a later Resend, SMTP, or API route integration after the
                  production email domain and abuse controls are configured.
                </p>

                <form style={formStyle}>
                  <label style={fieldStyle}>
                    <span style={labelTextStyle}>Name</span>
                    <input
                      style={inputStyle}
                      type="text"
                      name="name"
                      placeholder="Your name"
                      maxLength={120}
                      disabled
                    />
                  </label>

                  <label style={fieldStyle}>
                    <span style={labelTextStyle}>Email</span>
                    <input
                      style={inputStyle}
                      type="email"
                      name="email"
                      placeholder="you@example.com"
                      maxLength={254}
                      disabled
                    />
                  </label>

                  <label style={fieldStyle}>
                    <span style={labelTextStyle}>Organization / role</span>
                    <input
                      style={inputStyle}
                      type="text"
                      name="organization"
                      placeholder="Freelancer, SME, student, accountant, developer..."
                      maxLength={160}
                      disabled
                    />
                  </label>

                  <label style={fieldStyle}>
                    <span style={labelTextStyle}>Reason</span>
                    <select style={inputStyle} name="reason" disabled>
                      <option>Product question</option>
                      <option>Security report</option>
                      <option>Privacy request</option>
                      <option>Incident report</option>
                      <option>Professional review</option>
                      <option>Developer integration</option>
                    </select>
                  </label>

                  <label style={fieldStyle}>
                    <span style={labelTextStyle}>Message</span>
                    <textarea
                      style={textareaStyle}
                      name="message"
                      placeholder="Write your message..."
                      maxLength={4000}
                      disabled
                    />
                  </label>

                  <label
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto minmax(0, 1fr)",
                      gap: "0.75rem",
                      alignItems: "start",
                      color: "rgba(255,255,255,0.62)",
                      lineHeight: 1.6
                    }}
                  >
                    <input
                      type="checkbox"
                      disabled
                      style={{
                        width: "1.1rem",
                        height: "1.1rem",
                        marginTop: "0.22rem",
                        accentColor: "var(--ff-teal)"
                      }}
                    />
                    <span>
                      I understand this contact flow is not for emergency
                      services, official filing, tax authority submission, legal
                      advice, tax advice, accounting advice, or guaranteed
                      compliance decisions.
                    </span>
                  </label>

                  <button type="button" disabled style={disabledButtonStyle}>
                    <Send size={17} />
                    Email setup coming soon
                  </button>
                </form>
              </section>
            </Reveal>

            <Reveal delay={0.08}>
              <aside style={formPanelStyle}>
                <div className="subpage-card-icon">
                  <ShieldCheck size={22} />
                </div>

                <h2
                  style={{
                    margin: "1.5rem 0 0",
                    color: "white",
                    fontSize: "2rem",
                    lineHeight: 1,
                    letterSpacing: "-0.055em"
                  }}
                >
                  Before sending
                </h2>

                <div className="deep-list" style={{ marginTop: "1.5rem" }}>
                  <div className="deep-row">
                    <span>01</span>
                    <div>
                      <h3>No official filing</h3>
                      <p>
                        Invoice Lantern does not submit invoices to EU,
                        national tax authority, Peppol, or official reporting
                        systems.
                      </p>
                    </div>
                  </div>

                  <div className="deep-row">
                    <span>02</span>
                    <div>
                      <h3>No professional advice</h3>
                      <p>
                        Product support can explain platform behavior, but legal,
                        tax, accounting, privacy, and security conclusions need
                        qualified review.
                      </p>
                    </div>
                  </div>

                  <div className="deep-row">
                    <span>03</span>
                    <div>
                      <h3>Do not send secrets</h3>
                      <p>
                        Do not send passwords, private API keys, webhook
                        secrets, Supabase keys, raw sensitive XML, or production
                        credentials through a contact form.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="section-action-row">
                  <Link href="/boundaries" className="text-link-button">
                    Review boundaries
                    <ArrowRight size={18} />
                  </Link>
                </div>
              </aside>
            </Reveal>
          </div>

          <Reveal>
            <section className="section" style={{ paddingLeft: 0, paddingRight: 0 }}>
              <div className="section-heading">
                <p className="section-kicker">Direct channels</p>
                <h2>Use the reviewed email channel for the right topic.</h2>
                <p>
                  Public contact addresses are read from environment variables
                  so production can use verified domain emails without hardcoded
                  fake contact details.
                </p>
              </div>

              <div
                className="contact-grid"
                style={{
                  alignItems: "stretch"
                }}
              >
                {channels.map((channel) => (
                  <Reveal key={channel.title}>
                    <ContactCard channel={channel} />
                  </Reveal>
                ))}
              </div>
            </section>
          </Reveal>

          <Reveal>
            <div className="deep-panel">
              <div>
                <p className="section-kicker">Operational note</p>
                <h2>Real contact handling needs a real backend process.</h2>
              </div>

              <p className="public-page-copy">
                The contact form should be connected only after the production
                email domain, rate limits, spam prevention, schema validation,
                abuse handling, logging rules, privacy notice, and retention
                behavior are configured. Until then, use the configured email
                links above for reviewed communication.
              </p>

              <div className="validation-stack page-validation-stack">
                <div className="validation-band">
                  <div className="validation-number">
                    <Mail size={18} />
                  </div>
                  <div>
                    <h3>Email provider</h3>
                    <p>
                      Connect the form later through Resend, SMTP, or a secure
                      API route after domain verification and sender policy are
                      ready.
                    </p>
                  </div>
                  <span>Pending</span>
                </div>

                <div className="validation-band">
                  <div className="validation-number">
                    <ShieldCheck size={18} />
                  </div>
                  <div>
                    <h3>Abuse controls</h3>
                    <p>
                      Add rate limiting, bot protection, strict schema
                      validation, message length limits, and safe logging before
                      public form submission is enabled.
                    </p>
                  </div>
                  <span>Required</span>
                </div>

                <div className="validation-band">
                  <div className="validation-number">
                    <Building2 size={18} />
                  </div>
                  <div>
                    <h3>No fake company details</h3>
                    <p>
                      The page avoids fake addresses, phone numbers, and
                      invented operational claims. Add only reviewed production
                      contact details.
                    </p>
                  </div>
                  <span>Honest</span>
                </div>
              </div>
            </div>
          </Reveal>

          <div className="next-page-row">
            <Link
              href={getLegalDocumentHref("privacy")}
              className="text-link-button"
            >
              Privacy Policy
              <ArrowRight size={18} />
            </Link>
            <Link
              href={getLegalDocumentHref("security")}
              className="text-link-button"
            >
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
