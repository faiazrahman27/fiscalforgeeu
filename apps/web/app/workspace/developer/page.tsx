import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Braces,
  FileCode2,
  Globe2,
  KeyRound,
  RadioTower,
  ShieldAlert,
  ShieldCheck
} from "lucide-react";

type DeveloperModuleStatus = "active" | "planned";

type DeveloperModule = {
  title: string;
  status: DeveloperModuleStatus;
  actionLabel: string;
  description: string;
  href: string;
  icon: ReactNode;
};

const developerModules: DeveloperModule[] = [
  {
    title: "API keys",
    status: "active",
    actionLabel: "Manage",
    description:
      "Create, list, scope, expire, revoke, test, and review usage logs for organization-owned sandbox developer API keys. API key management is intended for owner, admin, and developer workspace roles.",
    href: "/workspace/developer/api-keys",
    icon: <KeyRound size={22} />
  },
  {
    title: "Rate limits",
    status: "active",
    actionLabel: "View",
    description:
      "Review sandbox developer API usage limits, current request windows, remaining counts, and rate-limit request logs.",
    href: "/workspace/developer/api-keys",
    icon: <ShieldCheck size={22} />
  },
  {
    title: "API reference",
    status: "active",
    actionLabel: "Open",
    description:
      "Browse the current OpenAPI document, X-API-Key auth model, scopes, examples, response schemas, and rate-limit headers.",
    href: "/developer-api/reference",
    icon: <BookOpen size={22} />
  },
  {
    title: "Validation API",
    status: "active",
    actionLabel: "Open",
    description:
      "Use X-API-Key for selected sandbox technical validation endpoints and validation-run read access.",
    href: "/developer-api",
    icon: <Braces size={22} />
  },
  {
    title: "UBL export/parse",
    status: "active",
    actionLabel: "Open",
    description:
      "Export, parse, and import UBL XML through scoped sandbox developer API endpoints.",
    href: "/developer-api",
    icon: <FileCode2 size={22} />
  },
  {
    title: "VAT format checks",
    status: "active",
    actionLabel: "Open",
    description:
      "Run local VAT ID format checks only. This is not VIES and is not proof of VAT registration.",
    href: "/workspace/vat-checks",
    icon: <BadgeCheck size={22} />
  },
  {
    title: "Country packs",
    status: "active",
    actionLabel: "Open",
    description:
      "Review the current country-pack registry, source labels, status levels, and educational simulation warnings. Country packs are not official tax authority guidance.",
    href: "/workspace/country-packs",
    icon: <Globe2 size={22} />
  },
  {
    title: "ViDA simulator",
    status: "active",
    actionLabel: "Open",
    description:
      "Run educational ViDA-readiness simulations for selected transaction scenarios. Results are readiness signals, not legal, tax, accounting, filing, or authority-submission conclusions.",
    href: "/workspace/vida-simulator",
    icon: <ShieldCheck size={22} />
  },
  {
    title: "Webhook simulator",
    status: "planned",
    actionLabel: "Planned",
    description:
      "Sandbox webhook testing is planned for a later step. No webhook events are sent yet. This is not an official filing, reporting, or authority-submission feature.",
    href: "/developer-api",
    icon: <RadioTower size={22} />
  },
  {
    title: "VIES checks",
    status: "active",
    actionLabel: "Open",
    description:
      "Run optional backend VIES evidence checks separately from local VAT format checks. VIES evidence is time-of-check evidence only, not legal or tax proof.",
    href: "/workspace/vat-checks",
    icon: <ShieldAlert size={22} />
  }
];

export default function WorkspaceDeveloperPage() {
  return (
    <div className="workspace-page">
      <section className="workspace-page-head">
        <p className="workspace-kicker">Developer console</p>
        <h2>Sandbox developer API controls.</h2>
        <p>
          Manage organization-owned keys, review API usage, and check the safe
          boundaries for Invoice Lantern technical validation endpoints. API keys
          do not grant workspace UI permissions. API key management is reserved
          for owner, admin, and developer workspace roles. The API reference
          documents active endpoints only; webhook work stays inactive until
          implemented.
        </p>
      </section>

      <section className="workspace-step-grid developer-module-grid">
        {developerModules.map((item) => (
          <div
            className={`workspace-step developer-module-card is-${item.status}`}
            key={item.title}
          >
            <header className="developer-module-heading">
              <span className="workspace-step-icon">{item.icon}</span>
              <span className={`developer-module-badge is-${item.status}`}>
                {item.status}
              </span>
            </header>

            <h3>{item.title}</h3>
            <p>{item.description}</p>

            <div className="workspace-row-actions">
              <Link
                href={item.href}
                className={`text-link-button developer-module-action is-${item.status}`}
              >
                <ArrowRight size={16} />
                {item.actionLabel}
              </Link>
            </div>
          </div>
        ))}
      </section>

      <section className="workspace-alerts">
        <div className="alerts-head">
          <ShieldCheck size={22} />
          <div>
            <p>Access model</p>
            <h3>API keys are not user sessions.</h3>
          </div>
        </div>

        <div className="alert-list">
          <div className="alert-item">
            <span />
            <p>
              Supabase bearer-token authentication remains the web workspace
              path. Organization API keys are for selected sandbox developer API
              endpoints only.
            </p>
          </div>

          <div className="alert-item">
            <span />
            <p>
              API key management and API request logs are available to owner,
              admin, and developer workspace roles. Privacy, retention, deletion,
              and workspace settings remain restricted to owner and admin roles.
            </p>
          </div>

          <div className="alert-item">
            <span />
            <p>
              Invoice Lantern does not provide official filing credentials,
              authority submission capability, tax advice, accounting advice, or
              a compliance guarantee.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
