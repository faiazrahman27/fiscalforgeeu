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
  LogIn,
  LogOut,
  ShieldCheck
} from "lucide-react";
import { createSupabaseServerClient } from "../../lib/supabase/server";
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

function hasSupabasePublicConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabasePublicKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  return Boolean(supabaseUrl && supabasePublicKey);
}

async function getSignedInUserEmail() {
  if (!hasSupabasePublicConfig()) {
    return "";
  }

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    return user?.email ?? "";
  } catch {
    return "";
  }
}

export default async function WorkspaceLayout({
  children
}: {
  children: ReactNode;
}) {
  const signedInUserEmail = await getSignedInUserEmail();

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
          <h2>{signedInUserEmail ? "Personal workspace" : "Local workspace"}</h2>
          <span>
            {signedInUserEmail || "No organization account connected"}
          </span>
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
            {signedInUserEmail ? (
              <form action="/auth/sign-out" method="post">
                <button type="submit" className="workspace-auth-action">
                  <LogOut size={16} />
                  Sign out
                </button>
              </form>
            ) : (
              <Link href="/auth/sign-in">
                <LogIn size={16} />
                Sign in
              </Link>
            )}

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
