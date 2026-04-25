import type { ReactNode } from "react";
import Link from "next/link";
import {
  Activity,
  Braces,
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
    label: "Validation",
    icon: <Activity size={18} />
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
          <strong>FiscalForge EU</strong>
        </Link>

        <div className="workspace-org">
          <p>Current workspace</p>
          <h2>Sandbox Organization</h2>
          <span>Educational simulation mode</span>
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
            API and web are separated. This interface will later consume secure
            endpoints from the dedicated API service.
          </p>
        </div>
      </aside>

      <section className="workspace-main">
        <header className="workspace-topbar">
          <div>
            <p>Independent validation sandbox</p>
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