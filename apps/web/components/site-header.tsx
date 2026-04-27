import Link from "next/link";
import { ShieldCheck } from "lucide-react";

const navItems = [
  { href: "/studio", label: "Studio" },
  { href: "/validation", label: "Validation" },
  { href: "/developer-api", label: "API" },
  { href: "/boundaries", label: "Boundaries" }
];

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="brand-mark">
          <span>
            <ShieldCheck size={18} />
          </span>

          <strong>Invoice Lantern</strong>
        </Link>

        <nav>
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
