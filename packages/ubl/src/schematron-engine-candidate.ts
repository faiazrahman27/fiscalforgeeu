import { createRequire } from "node:module";

export const SCHEMATRON_ENGINE_CANDIDATE_VERSION =
  "schematron_engine_candidate_v1";

export type SchematronEngineCandidateId =
  | "none"
  | "placeholder"
  | "future_xslt2"
  | "future_schxslt"
  | "xpath_engine"
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
  | "test_only"
  | "xml_dom_execution"
  | "xpath_assertion_execution";

export type SchematronEngineCandidatePackage = {
  packageName: string;
  packageVersion: string | null;
  available: boolean;
  reason: string;
};

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
  detectedPackages: SchematronEngineCandidatePackage[];
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
  detectedPackages: SchematronEngineCandidatePackage[];
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

const XPATH_FONTOXPATH_PACKAGE = {
  packageName: "fontoxpath",
  installedReason:
    "schematron_xpath_engine_candidate_available_execution_disabled_by_default",
  notInstalledReason: "schematron_xpath_fontoxpath_not_installed"
} satisfies CandidatePackageDescriptor;

const XPATH_SLIMDOM_PACKAGE = {
  packageName: "slimdom",
  installedReason:
    "schematron_xpath_engine_candidate_available_execution_disabled_by_default",
  notInstalledReason: "schematron_xpath_slimdom_not_installed"
} satisfies CandidatePackageDescriptor;

const requirePackageMetadata = createRequire(import.meta.url);

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

  if (token === "xpath" || token === "xpath_engine" || token === "fontoxpath") {
    return "xpath_engine";
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
  detectedPackages?: SchematronEngineCandidatePackage[];
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
    detectedPackages: input.detectedPackages ?? [],
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

function getDetectedPackageJsonVersion(packageName: string) {
  try {
    const packageJson = requirePackageMetadata(
      `${packageName}/package.json`
    ) as unknown;

    if (typeof packageJson !== "object" || packageJson === null) {
      return null;
    }

    return getStringProperty(packageJson as Record<string, unknown>, "version");
  } catch {
    return null;
  }
}

async function inspectOptionalPackage(
  descriptor: CandidatePackageDescriptor
) {
  try {
    const moduleNamespace = await import(descriptor.packageName);
    const packageVersion =
      getDetectedPackageVersion(moduleNamespace) ??
      getDetectedPackageJsonVersion(descriptor.packageName);

    return {
      available: true,
      packageVersion
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
      detectedPackages: [
        {
          packageName: input.descriptor.packageName,
          packageVersion: null,
          available: false,
          reason: input.descriptor.notInstalledReason
        }
      ],
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
    detectedPackages: [
      {
        packageName: input.descriptor.packageName,
        packageVersion: inspectedPackage.packageVersion,
        available: true,
        reason: input.descriptor.installedReason
      }
    ],
    reason: input.descriptor.installedReason
  });
}

function combinePackageVersions(
  packages: readonly SchematronEngineCandidatePackage[]
) {
  const versions = packages
    .filter((candidatePackage) => candidatePackage.available)
    .map((candidatePackage) =>
      candidatePackage.packageVersion
        ? `${candidatePackage.packageName}@${candidatePackage.packageVersion}`
        : candidatePackage.packageName
    );

  return versions.length > 0 ? versions.join("; ") : null;
}

async function inspectXPathEngineCandidate() {
  const [fontoxpathPackage, slimdomPackage] = await Promise.all([
    inspectOptionalPackage(XPATH_FONTOXPATH_PACKAGE),
    inspectOptionalPackage(XPATH_SLIMDOM_PACKAGE)
  ]);
  const detectedPackages: SchematronEngineCandidatePackage[] = [
    {
      packageName: XPATH_FONTOXPATH_PACKAGE.packageName,
      packageVersion: fontoxpathPackage.packageVersion,
      available: fontoxpathPackage.available,
      reason: fontoxpathPackage.available
        ? XPATH_FONTOXPATH_PACKAGE.installedReason
        : XPATH_FONTOXPATH_PACKAGE.notInstalledReason
    },
    {
      packageName: XPATH_SLIMDOM_PACKAGE.packageName,
      packageVersion: slimdomPackage.packageVersion,
      available: slimdomPackage.available,
      reason: slimdomPackage.available
        ? XPATH_SLIMDOM_PACKAGE.installedReason
        : XPATH_SLIMDOM_PACKAGE.notInstalledReason
    }
  ];

  if (!fontoxpathPackage.available) {
    return buildCandidateInfo({
      engineId: "xpath_engine",
      availabilityStatus: "unavailable",
      executionSupported: false,
      capabilities: ["metadata_only", "no_remote_fetch", "test_only"],
      packageName: null,
      packageVersion: null,
      detectedPackages,
      reason: XPATH_FONTOXPATH_PACKAGE.notInstalledReason
    });
  }

  if (!slimdomPackage.available) {
    return buildCandidateInfo({
      engineId: "xpath_engine",
      availabilityStatus: "unavailable",
      executionSupported: false,
      capabilities: ["metadata_only", "no_remote_fetch", "test_only"],
      packageName: null,
      packageVersion: null,
      detectedPackages,
      reason: XPATH_SLIMDOM_PACKAGE.notInstalledReason
    });
  }

  return buildCandidateInfo({
    engineId: "xpath_engine",
    availabilityStatus: "available",
    executionSupported: true,
    capabilities: [
      "metadata_only",
      "local_execution_candidate",
      "no_remote_fetch",
      "windows_compatible",
      "esm_compatible",
      "test_only",
      "xml_dom_execution",
      "xpath_assertion_execution"
    ],
    packageName: "fontoxpath+slimdom",
    packageVersion: combinePackageVersions(detectedPackages),
    detectedPackages,
    reason:
      "schematron_xpath_engine_candidate_available_execution_disabled_by_default"
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

  if (engineId === "xpath_engine") {
    return inspectXPathEngineCandidate();
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
