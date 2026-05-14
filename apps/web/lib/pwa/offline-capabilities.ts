export type OfflineCapabilityStatus = "available" | "limited" | "online_only";

export type OfflineCapability = {
  key: string;
  label: string;
  status: OfflineCapabilityStatus;
  summary: string;
};

export const offlineCapabilities: OfflineCapability[] = [
  {
    key: "installable_shell",
    label: "Installable app shell",
    status: "available",
    summary:
      "The PWA shell, icons, manifest, offline page, and safe public assets can be available offline."
  },
  {
    key: "public_legal_pages",
    label: "Public legal pages",
    status: "limited",
    summary:
      "Public legal pages may be network-first cached. Legal text still requires professional review and should be refreshed when online."
  },
  {
    key: "encrypted_invoice_drafts",
    label: "Encrypted invoice drafts",
    status: "limited",
    summary:
      "Local-only drafts can be stored only when Web Crypto and IndexedDB are available and the user provides a passphrase that is not persisted."
  },
  {
    key: "local_calculation_hints",
    label: "Local calculation hints",
    status: "limited",
    summary:
      "Browser totals and VAT-format hints are draft assistance only and do not replace API validation or professional review."
  },
  {
    key: "server_validation",
    label: "Server validation, XML jobs, and VIES",
    status: "online_only",
    summary:
      "VIES, XSD, Schematron, ViDA persistence, XML upload history, and server validation require the online API boundary."
  },
  {
    key: "security_sensitive_admin",
    label: "Security-sensitive operations",
    status: "online_only",
    summary:
      "API-key management, webhook endpoints, delivery logs, privacy actions, deletion/export/retention execution, and platform-admin writes stay online-only."
  }
];

export function getOfflineCapability(key: string) {
  return offlineCapabilities.find((item) => item.key === key) ?? null;
}
