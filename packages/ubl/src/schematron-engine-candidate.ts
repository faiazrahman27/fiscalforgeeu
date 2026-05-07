export const SCHEMATRON_ENGINE_CANDIDATE_VERSION =
  "schematron_engine_candidate_v1";

export type SchematronEngineCandidateId =
  | "none"
  | "placeholder"
  | "future_xslt2"
  | "future_schxslt"
  | "internal_test_candidate";

export type SchematronEngineAvailabilityStatus =
  | "not_selected"
  | "placeholder_only"
  | "available"
  | "unavailable"
  | "unsupported"
  | "error";

export type SchematronEngineCapability =
  | "metadata_only"
  | "local_execution_candidate"
  | "no_remote_fetch"
  | "windows_compatible"
  | "esm_compatible"
  | "test_only";

export type SchematronEngineCandidateSummary = {
  diagnosticKind: "schematron_engine_candidate";
  engineCandidateVersion: string;
  engineId: SchematronEngineCandidateId;
  availabilityStatus: SchematronEngineAvailabilityStatus;
  executionSupported: boolean;
  executionEnabledByDefault: false;
  capabilities: SchematronEngineCapability[];
  packageName: string | null;
  packageVersion: string | null;
  reason: string;
};

export type SchematronEngineCandidateInfo = {
  engineCandidateVersion: typeof SCHEMATRON_ENGINE_CANDIDATE_VERSION;
  engineId: SchematronEngineCandidateId;
  availabilityStatus: SchematronEngineAvailabilityStatus;
  executionSupported: boolean;
  executionEnabledByDefault: false;
  capabilities: SchematronEngineCapability[];
  packageName: string | null;
  packageVersion: string | null;
  reason: string;
  safeSummary: SchematronEngineCandidateSummary;
};

type CandidatePackageDescriptor = {
  packageName: string;
  installedReason: string;
  notInstalledReason: string;
};

const FUTURE_XSLT2_PACKAGE = {
  packageName: "saxon-js",
  installedReason: "schematron_xslt2_engine_installed_but_execution_disabled",
  notInstalledReason: "schematron_xslt2_engine_not_installed"
} satisfies CandidatePackageDescriptor;

const FUTURE_SCHXSLT_PACKAGE = {
  packageName: "schxslt",
  installedReason: "schematron_schxslt_engine_installed_but_execution_disabled",
  notInstalledReason: "schematron_schxslt_engine_not_installed"
} satisfies CandidatePackageDescriptor;

function normalizedToken(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function normalizeSchematronEngineCandidateId(
  value: unknown
): SchematronEngineCandidateId {
  const token = normalizedToken(value);

  if (!token) {
    return "placeholder";
  }

  if (token === "none") {
    return "none";
  }

  if (token === "placeholder") {
    return "placeholder";
  }

  if (token === "xslt2" || token === "saxon" || token === "future_xslt2") {
    return "future_xslt2";
  }

  if (token === "schxslt" || token === "future_schxslt") {
    return "future_schxslt";
  }

  if (token === "internal_test_candidate") {
    return "internal_test_candidate";
  }

  return "none";
}

function buildCandidateInfo(input: {
  engineId: SchematronEngineCandidateId;
  availabilityStatus: SchematronEngineAvailabilityStatus;
  executionSupported: boolean;
  capabilities: SchematronEngineCapability[];
  packageName: string | null;
  packageVersion: string | null;
  reason: string;
}): SchematronEngineCandidateInfo {
  const base = {
    engineCandidateVersion: SCHEMATRON_ENGINE_CANDIDATE_VERSION,
    engineId: input.engineId,
    availabilityStatus: input.availabilityStatus,
    executionSupported: input.executionSupported,
    executionEnabledByDefault: false,
    capabilities: input.capabilities,
    packageName: input.packageName,
    packageVersion: input.packageVersion,
    reason: input.reason
  } satisfies Omit<SchematronEngineCandidateInfo, "safeSummary">;

  return {
    ...base,
    safeSummary: {
      diagnosticKind: "schematron_engine_candidate",
      ...base
    }
  };
}

function getStringProperty(
  value: Record<string, unknown>,
  key: string
): string | null {
  const property = value[key];

  return typeof property === "string" && property.trim()
    ? property.trim()
    : null;
}

function getDetectedPackageVersion(moduleNamespace: unknown) {
  if (typeof moduleNamespace !== "object" || moduleNamespace === null) {
    return null;
  }

  const directVersion = getStringProperty(
    moduleNamespace as Record<string, unknown>,
    "version"
  );

  if (directVersion) {
    return directVersion;
  }

  const defaultExport = (moduleNamespace as Record<string, unknown>).default;

  if (typeof defaultExport !== "object" || defaultExport === null) {
    return null;
  }

  return getStringProperty(defaultExport as Record<string, unknown>, "version");
}

async function inspectOptionalPackage(
  descriptor: CandidatePackageDescriptor
) {
  try {
    const moduleNamespace = await import(descriptor.packageName);

    return {
      available: true,
      packageVersion: getDetectedPackageVersion(moduleNamespace)
    };
  } catch {
    return {
      available: false,
      packageVersion: null
    };
  }
}

async function inspectFuturePackageCandidate(input: {
  engineId: "future_xslt2" | "future_schxslt";
  descriptor: CandidatePackageDescriptor;
}): Promise<SchematronEngineCandidateInfo> {
  const inspectedPackage = await inspectOptionalPackage(input.descriptor);

  if (!inspectedPackage.available) {
    return buildCandidateInfo({
      engineId: input.engineId,
      availabilityStatus: "unavailable",
      executionSupported: false,
      capabilities: ["metadata_only", "no_remote_fetch"],
      packageName: null,
      packageVersion: null,
      reason: input.descriptor.notInstalledReason
    });
  }

  return buildCandidateInfo({
    engineId: input.engineId,
    availabilityStatus: "available",
    executionSupported: false,
    capabilities: [
      "metadata_only",
      "local_execution_candidate",
      "no_remote_fetch",
      "windows_compatible",
      "esm_compatible"
    ],
    packageName: input.descriptor.packageName,
    packageVersion: inspectedPackage.packageVersion,
    reason: input.descriptor.installedReason
  });
}

export async function inspectSchematronEngineCandidate(
  input: { engineId?: string } = {}
): Promise<SchematronEngineCandidateInfo> {
  const engineId = normalizeSchematronEngineCandidateId(input.engineId);

  if (engineId === "none") {
    return buildCandidateInfo({
      engineId,
      availabilityStatus: "not_selected",
      executionSupported: false,
      capabilities: ["metadata_only"],
      packageName: null,
      packageVersion: null,
      reason: "schematron_engine_not_selected"
    });
  }

  if (engineId === "placeholder") {
    return buildCandidateInfo({
      engineId,
      availabilityStatus: "placeholder_only",
      executionSupported: false,
      capabilities: ["metadata_only"],
      packageName: null,
      packageVersion: null,
      reason: "schematron_placeholder_engine_selected"
    });
  }

  if (engineId === "future_xslt2") {
    return inspectFuturePackageCandidate({
      engineId,
      descriptor: FUTURE_XSLT2_PACKAGE
    });
  }

  if (engineId === "future_schxslt") {
    return inspectFuturePackageCandidate({
      engineId,
      descriptor: FUTURE_SCHXSLT_PACKAGE
    });
  }

  return buildCandidateInfo({
    engineId,
    availabilityStatus: "available",
    executionSupported: true,
    capabilities: [
      "metadata_only",
      "local_execution_candidate",
      "no_remote_fetch",
      "windows_compatible",
      "esm_compatible",
      "test_only"
    ],
    packageName: null,
    packageVersion: null,
    reason: "schematron_internal_test_candidate_available"
  });
}
