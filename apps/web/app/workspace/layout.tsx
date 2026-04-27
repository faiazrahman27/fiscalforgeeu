import type { ReactNode } from "react";
import Link from "next/link";
import {
  Braces,
  FileCheck2,
  FileCode2,
  FileInput,
  Home,
  KeyRound,
  LockKeyhole,
  ShieldCheck
} from "lucide-react";
import "./workspace.css";

const workspaceNav = [
  {
    href: "/workspace",
    label: "Command",
    icon: <Home size={18} />
  },
  {
    href: "/workspace/invoices",
    label: "Invoices",
    icon: <FileInput size={18} />
  },
  {
    href: "/workspace/validation-runs",
    label: "Reports",
    icon: <FileCheck2 size={18} />
  },
  {
    href: "/workspace/xml-upload",
    label: "XML Upload",
    icon: <FileCode2 size={18} />
  },
  {
    href: "/workspace/developer",
    label: "Developer",
    icon: <Braces size={18} />
  },
  {
    href: "/workspace/privacy",
    label: "Privacy",
    icon: <LockKeyhole size={18} />
  }
];

export default function WorkspaceLayout({
  children
}: {
  children: ReactNode;
}) {
  return (
    <main className="workspace-shell">
      <aside className="workspace-sidebar">
        <Link href="/" className="workspace-logo">
          <span>
            <ShieldCheck size={20} />
          </span>
          <strong>Invoice Lantern</strong>
        </Link>

        <div className="workspace-org">
          <p>Workspace status</p>
          <h2>Local workspace</h2>
          <span>No organization account connected</span>
        </div>

        <nav className="workspace-nav">
          {workspaceNav.map((item) => (
            <Link href={item.href} key={item.href}>
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="workspace-side-note">
          <FileCode2 size={18} />
          <p>
            Web routes use local Next.js proxy handlers, which forward requests to
            the dedicated API service.
          </p>
        </div>
      </aside>

      <section className="workspace-main">
        <header className="workspace-topbar">
          <div>
            <p>Independent readiness sandbox</p>
            <h1>Workspace Console</h1>
          </div>

          <div className="workspace-top-actions">
            <Link href="/developer-api">
              <KeyRound size={16} />
              API docs
            </Link>

            <Link href="/boundaries">
              <ShieldCheck size={16} />
              Legal limits
            </Link>
          </div>
        </header>

        {children}
      </section>
    </main>
  );
}