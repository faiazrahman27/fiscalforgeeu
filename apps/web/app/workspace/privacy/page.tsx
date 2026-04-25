import {
  Archive,
  Download,
  EyeOff,
  FileClock,
  LockKeyhole,
  Trash2
} from "lucide-react";
import {
  privacyControls,
  retentionPolicies
} from "../../../lib/mock-data";
import type { WorkspaceIconKey } from "../../../lib/types";

function getPrivacyIcon(iconKey: WorkspaceIconKey) {
  const icons: Record<string, React.ReactNode> = {
    dataExport: <Download size={22} />,
    deletion: <Trash2 size={22} />,
    retention: <Archive size={22} />,
    minimisation: <EyeOff size={22} />
  };

  return icons[iconKey] ?? <LockKeyhole size={22} />;
}

export default function WorkspacePrivacyPage() {
  return (
    <div className="workspace-page">
      <section className="workspace-page-head">
        <p className="workspace-kicker">Privacy and Audit</p>
        <h2>GDPR-oriented controls for invoice data.</h2>
        <p>
          Invoices may contain personal data. This screen will later expose privacy
          controls, retention policies, audit events, exports, deletion requests, and
          data minimisation settings.
        </p>
      </section>

      <section className="workspace-step-grid">
        {privacyControls.map((item) => (
          <div className="workspace-step" key={item.title}>
            <div>{getPrivacyIcon(item.iconKey)}</div>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
          </div>
        ))}
      </section>

      <section className="privacy-retention">
        <div className="privacy-retention-head">
          <div>
            <p>Default retention policy</p>
            <h3>Configurable by organization later</h3>
          </div>

          <LockKeyhole size={26} />
        </div>

        <div className="retention-list">
          {retentionPolicies.map((item) => (
            <div className="retention-row" key={item.label}>
              <div>
                <FileClock size={16} />
                <span>{item.label}</span>
              </div>

              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}