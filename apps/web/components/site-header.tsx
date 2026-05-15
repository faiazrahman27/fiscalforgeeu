"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

const navItems = [
  { href: "/studio", label: "Studio" },
  { href: "/validation", label: "Validation" },
  { href: "/developer-api", label: "API" },
  { href: "/boundaries", label: "Boundaries" },
  { href: "/legal", label: "Legal" }
];

const actionItems = [
  { href: "/auth/sign-in", label: "Sign in", variant: "secondary" },
  { href: "/workspace", label: "Sandbox", variant: "primary" }
];

export function SiteHeader() {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isMenuOpen]);

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="brand-mark" aria-label="Invoice Lantern home">
          <Image
            src="/brand/invoice-lantern.png"
            alt="Invoice Lantern"
            width={72}
            height={72}
            className="brand-logo-image"
            priority
          />

          <strong>Invoice Lantern</strong>
        </Link>

        <nav className="site-desktop-nav" aria-label="Primary navigation">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="site-header-actions site-desktop-actions">
          <Link href="/auth/sign-in" className="header-secondary-action">
            Sign in
          </Link>

          <Link href="/workspace" className="header-action">
            Sandbox
          </Link>
        </div>

        <button
          type="button"
          className="site-mobile-menu-button"
          aria-label={isMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={isMenuOpen}
          aria-controls="site-mobile-menu-panel"
          onClick={() => setIsMenuOpen((current) => !current)}
        >
          {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
          <span>Menu</span>
        </button>
      </div>

      {isMenuOpen ? (
        <>
          <button
            type="button"
            className="site-mobile-menu-backdrop"
            aria-label="Close navigation menu"
            onClick={() => setIsMenuOpen(false)}
          />

          <div
            id="site-mobile-menu-panel"
            className="site-mobile-menu-panel"
            role="dialog"
            aria-label="Mobile navigation"
          >
            <div className="site-mobile-menu-head">
              <p>Invoice Lantern</p>
              <strong>Navigation</strong>
            </div>

            <div className="site-mobile-menu-group">
              <p>Platform</p>

              {navItems.map((item) => (
                <Link key={item.href} href={item.href}>
                  {item.label}
                </Link>
              ))}
            </div>

            <div className="site-mobile-menu-actions">
              {actionItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    item.variant === "primary"
                      ? "site-mobile-menu-action site-mobile-menu-action-primary"
                      : "site-mobile-menu-action"
                  }
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </header>
  );
}
