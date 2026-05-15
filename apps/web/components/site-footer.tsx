"use client";

import Image from "next/image";
import Link from "next/link";
import { getLegalDocumentHref } from "../lib/legal-documents";

type SiteFooterProps = {
  compact?: boolean;
};

const platformLinks = [
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/developer-api", label: "Developer API" },
  { href: "/boundaries", label: "Boundaries" },
  { href: "/legal", label: "Legal documents" }
];

const legalLinks = [
  { href: getLegalDocumentHref("privacy"), label: "Privacy Policy" },
  { href: getLegalDocumentHref("terms"), label: "Terms of Service" },
  { href: getLegalDocumentHref("cookies"), label: "Cookie Policy" },
  { href: getLegalDocumentHref("acceptable-use"), label: "Acceptable Use Policy" },
  { href: getLegalDocumentHref("security"), label: "Security Policy" }
];

export function SiteFooter({ compact = false }: SiteFooterProps) {
  const year = new Date().getFullYear();

  function manageCookies() {
    window.dispatchEvent(new Event("invoice-lantern:manage-cookies"));
  }

  return (
    <footer className={compact ? "site-footer site-footer-compact" : "site-footer"}>
      <div className="site-footer-inner">
        <div className="site-footer-brand">
          <Link href="/" className="site-footer-logo" aria-label="Invoice Lantern home">
            <Image
              src="/brand/invoice-lantern.png"
              alt="Invoice Lantern"
              width={48}
              height={48}
            />
            <strong>Invoice Lantern</strong>
          </Link>

          <p>
            Independent, educational, technical, source-linked, versioned,
            simulation-focused, GDPR-aware e-invoice validation and
            ViDA-readiness sandbox.
          </p>
        </div>

        <nav className="site-footer-nav" aria-label="Footer navigation">
          <div>
            <h2>Platform</h2>
            {platformLinks.map((link) => (
              <Link href={link.href} key={link.href}>
                {link.label}
              </Link>
            ))}
          </div>

          <div>
            <h2>Legal</h2>
            {legalLinks.map((link) => (
              <Link href={link.href} key={link.href}>
                {link.label}
              </Link>
            ))}
            <button type="button" onClick={manageCookies}>
              Manage cookies
            </button>
          </div>
        </nav>
      </div>

      <div className="site-footer-bottom">
        <p>© {year} Invoice Lantern.</p>
        <p>
          Independent and non-official. No legal, tax, accounting, privacy,
          security, filing, certification, or compliance advice. Professional
          review required; no official filing.
        </p>
      </div>
    </footer>
  );
}
