import Image from "next/image";
import Link from "next/link";

const navItems = [
  { href: "/studio", label: "Studio" },
  { href: "/validation", label: "Validation" },
  { href: "/developer-api", label: "API" },
  { href: "/boundaries", label: "Boundaries" },
  { href: "/legal", label: "Legal" }
];

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="brand-mark" aria-label="Invoice Lantern home">
          <Image
            src="/brand/invoice-lantern.png"
            alt="Invoice Lantern"
            width={46}
            height={46}
            className="brand-logo-image"
            priority
          />

          <strong>Invoice Lantern</strong>
        </Link>

        <nav aria-label="Primary navigation">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="site-header-actions">
          <Link href="/auth/sign-in" className="header-secondary-action">
            Sign in
          </Link>

          <Link href="/workspace" className="header-action">
            Sandbox
          </Link>
        </div>
      </div>
    </header>
  );
}
