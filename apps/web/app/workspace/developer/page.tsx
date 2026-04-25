import {
  Braces,
  Clock3,
  KeyRound,
  RadioTower,
  RotateCcw,
  ShieldCheck
} from "lucide-react";
import {
  apiControls,
  apiEventTypes,
  developerEndpointPreview
} from "../../../lib/mock-data";
import type { WorkspaceIconKey } from "../../../lib/types";

function getDeveloperIcon(iconKey: WorkspaceIconKey) {
  const icons: Record<string, React.ReactNode> = {
    apiKey: <KeyRound size={22} />,
    rbac: <ShieldCheck size={22} />,
    logs: <Clock3 size={22} />,
    webhook: <RadioTower size={22} />
  };

  return icons[iconKey] ?? <Braces size={22} />;
}

export default function WorkspaceDeveloperPage() {
  return (
    <div className="workspace-page">
      <section className="workspace-page-head">
        <p className="workspace-kicker">Developer Console</p>
        <h2>Sandbox API controls without production risk.</h2>
        <p>
          This screen will become the developer console for API keys, scopes, logs,
          endpoint testing, OpenAPI documentation, and webhook simulation.
        </p>
      </section>

      <section className="workspace-step-grid">
        {apiControls.map((item) => (
          <div className="workspace-step" key={item.title}>
            <div>{getDeveloperIcon(item.iconKey)}</div>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
          </div>
        ))}
      </section>

      <section className="developer-console">
        <div className="developer-console-head">
          <div>
            <p>Sandbox endpoint</p>
            <h3>
              {developerEndpointPreview.method} {developerEndpointPreview.path}
            </h3>
          </div>

          <button type="button">
            <RotateCcw size={16} />
            Test request
          </button>
        </div>

        <pre>{JSON.stringify(developerEndpointPreview.payload, null, 2)}</pre>
      </section>

      <section className="api-event-strip">
        {apiEventTypes.map((item) => (
          <div key={item.name} title={item.description}>
            <Braces size={18} />
            {item.name}
          </div>
        ))}
      </section>
    </div>
  );
}