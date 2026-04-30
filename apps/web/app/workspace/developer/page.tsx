import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Braces,
  FileCode2,
  KeyRound,
  RadioTower,
  ShieldAlert,
  ShieldCheck
} from "lucide-react";

const developerModules = [
  {
    title: "API keys",
    status: "active",
    actionLabel: "Manage",
    description:
      "Create, list, scope, expire, revoke, test, and review usage logs for organization-owned sandbox developer API keys.",
    href: "/workspace/developer/api-keys",
    icon: <KeyRound size={22} />
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
      "Export and parse UBL XML through scoped sandbox developer API endpoints.",
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
    status: "planned",
    actionLabel: "Planned",
    description:
      "VIES checks are planned for a later step and are not active in this sandbox API yet.",
    href: "/boundaries",
    icon: <ShieldAlert size={22} />
  },
  {
    title: "Country packs",
    status: "planned",
    actionLabel: "Planned",
    description:
      "Country packs are planned for later technical simulation work and are not active in this step.",
    href: "/boundaries",
    icon: <ShieldAlert size={22} />
  },
  {
    title: "ViDA simulator",
    status: "planned",
    actionLabel: "Planned",
    description:
      "ViDA simulator work is planned later and is not a compliance guarantee.",
    href: "/boundaries",
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
          Manage organization-owned keys and review the safe boundaries for
          Invoice Lantern technical validation endpoints. API keys do not grant
          workspace UI permissions.
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
