import type { ReactNode } from "react";
import Link from "next/link";
import {
  Activity,
  BadgeCheck,
  BookOpenCheck,
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

export const dynamic = "force-dynamic";

const workspaceNav = [
  {
    href: "/workspace",
    label: "Command",
    icon: <Home size={18} />
  },
  {
    href: "/workspace/activity",
    label: "Activity",
    icon: <Activity size={18} />
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
    href: "/workspace/vat-checks",
    label: "VAT Checks",
    icon: <BadgeCheck size={18} />
  },
  {
    href: "/workspace/validation-rules",
    label: "Rules",
    icon: <BookOpenCheck size={18} />
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

type WorkspaceContext = {
  signedInUserEmail: string;
  workspaceTitle: string;
  workspaceSubtitle: string;
  workspaceStatusLabel: string;
};

type BootstrapWorkspaceRecord = {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  membershipRole: string;
  userEmail: string;
};

function hasSupabasePublicConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabasePublicKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  return Boolean(supabaseUrl && supabasePublicKey);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readStringField(
  record: Record<string, unknown>,
  key: string,
  fallback = ""
) {
  const value = record[key];

  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : fallback;
}

function normalizeBootstrapWorkspaceRecord(
  value: unknown
): BootstrapWorkspaceRecord | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const organizationId = readStringField(value, "organization_id");
  const organizationName = readStringField(value, "organization_name");
  const organizationSlug = readStringField(value, "organization_slug");
  const membershipRole = readStringField(value, "membership_role", "member");
  const userEmail = readStringField(value, "user_email");

  if (!organizationId || !organizationName || !organizationSlug) {
    return null;
  }

  return {
    organizationId,
    organizationName,
    organizationSlug,
    membershipRole,
    userEmail
  };
}

function getLocalWorkspaceContext(): WorkspaceContext {
  return {
    signedInUserEmail: "",
    workspaceTitle: "Local workspace",
    workspaceSubtitle: "No organization account connected",
    workspaceStatusLabel: "Workspace status"
  };
}

function getPersonalWorkspaceFallback(email: string): WorkspaceContext {
  return {
    signedInUserEmail: email,
    workspaceTitle: "Personal workspace",
    workspaceSubtitle: email || "Organization bootstrap pending",
    workspaceStatusLabel: "Workspace status"
  };
}

async function getWorkspaceContext(): Promise<WorkspaceContext> {
  if (!hasSupabasePublicConfig()) {
    return getLocalWorkspaceContext();
  }

  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return getLocalWorkspaceContext();
    }

    const signedInUserEmail = user.email ?? "";

    /*
     * This RPC creates or loads:
     * - public.profiles
     * - public.organizations
     * - public.organization_memberships
     *
     * It runs as a controlled security-definer database function, so the
     * bootstrap is atomic and avoids separate RLS-sensitive inserts here.
     */
    const { data, error } = await supabase.rpc("bootstrap_personal_workspace");

    if (error) {
      console.error("Workspace bootstrap failed:", error.message);
      return getPersonalWorkspaceFallback(signedInUserEmail);
    }

    const firstRecord = Array.isArray(data) ? data[0] : data;
    const bootstrapRecord = normalizeBootstrapWorkspaceRecord(firstRecord);

    if (!bootstrapRecord) {
      return getPersonalWorkspaceFallback(signedInUserEmail);
    }

    const visibleEmail = bootstrapRecord.userEmail || signedInUserEmail;

    return {
      signedInUserEmail: visibleEmail,
      workspaceTitle: bootstrapRecord.organizationName,
      workspaceSubtitle: `${bootstrapRecord.membershipRole} · ${visibleEmail}`,
      workspaceStatusLabel: "Organization workspace"
    };
  } catch (error) {
    console.error("Workspace context failed:", error);
    return getLocalWorkspaceContext();
  }
}

export default async function WorkspaceLayout({
  children
}: {
  children: ReactNode;
}) {
  const workspaceContext = await getWorkspaceContext();
  const {
    signedInUserEmail,
    workspaceTitle,
    workspaceSubtitle,
    workspaceStatusLabel
  } = workspaceContext;

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
          <p>{workspaceStatusLabel}</p>
          <h2>{workspaceTitle}</h2>
          <span>{workspaceSubtitle}</span>
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
