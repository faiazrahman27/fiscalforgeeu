"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
};

export function PwaInstallPrompt() {
  const [promptEvent, setPromptEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_ENABLE_PWA_INSTALL_PROMPT === "false") {
      return;
    }

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
    };
  }, []);

  if (!promptEvent || isDismissed) {
    return null;
  }

  async function install() {
    if (!promptEvent) {
      return;
    }

    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;

    if (choice.outcome === "accepted") {
      setPromptEvent(null);
    } else {
      setIsDismissed(true);
    }
  }

  return (
    <div className="pwa-install-prompt">
      <span>Install Invoice Lantern for a mobile-oriented app shell.</span>
      <button type="button" onClick={install}>
        <Download size={15} />
        Install
      </button>
      <button type="button" onClick={() => setIsDismissed(true)}>
        Later
      </button>
    </div>
  );
}
