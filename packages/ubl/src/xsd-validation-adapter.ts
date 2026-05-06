import { accessSync, constants, statSync } from "node:fs";
import { join, resolve } from "node:path";

export const UBL_XSD_VALIDATOR_NAME =
  "Invoice Lantern local UBL XSD adapter";

export type UblXsdArtifactConfigInput = {
  rootDir?: string;
  invoiceXsdPath?: string;
  creditNoteXsdPath?: string;
  artifactVersion?: string;
};

export type UblXsdArtifactEnv = {
  UBL_XSD_ROOT_DIR?: string;
  UBL_INVOICE_XSD_PATH?: string;
  UBL_CREDIT_NOTE_XSD_PATH?: string;
  UBL_XSD_ARTIFACT_VERSION?: string;
};

export type UblXsdArtifactInfo = {
  configured: boolean;
  rootPath?: string;
  invoiceXsdPath?: string;
  creditNoteXsdPath?: string;
  artifactVersion?: string;
  validatorName: string;
};

export type UblXsdValidationStatus =
  | "passed"
  | "failed"
  | "not_configured"
  | "error";

export type UblXsdValidationFinding = {
  code: string;
  severity: "info" | "warning" | "fatal";
  field: string;
  message: string;
  status: UblXsdValidationStatus;
  fixSuggestion?: string;
  sourceLabels?: string[];
};

export type UblXsdValidationResult = {
  status: UblXsdValidationStatus;
  artifactInfo: UblXsdArtifactInfo;
  validationExecuted: boolean;
  markedValid: boolean;
  findings: UblXsdValidationFinding[];
  summary: Record<string, unknown>;
};

export type UblXsdValidationInput = {
  xml: string;
  rootElement: string;
  documentType: string;
  artifactConfig?: UblXsdArtifactConfigInput;
};

type ResolvedUblXsdArtifactConfig = {
  rootPath?: string;
  invoiceXsdPath?: string;
  creditNoteXsdPath?: string;
  artifactVersion?: string;
};

type ReadableFileInspection = {
  path: string;
  readable: boolean;
  reason?: string;
};

function cleanOptionalValue(value: string | undefined) {
  const trimmed = value?.trim();

  return trimmed ? trimmed : undefined;
}

function normalizeConfiguredPath(value: string | undefined) {
  const cleaned = cleanOptionalValue(value);

  return cleaned ? resolve(cleaned) : undefined;
}

function getDerivableUblVersion(artifactVersion: string | undefined) {
  if (!artifactVersion) {
    return "2.1";
  }

  return /^\d+\.\d+$/.test(artifactVersion) ? artifactVersion : undefined;
}

export function readUblXsdArtifactConfigFromEnv(
  env: UblXsdArtifactEnv = process.env
): UblXsdArtifactConfigInput {
  return {
    ...(env.UBL_XSD_ROOT_DIR ? { rootDir: env.UBL_XSD_ROOT_DIR } : {}),
    ...(env.UBL_INVOICE_XSD_PATH
      ? { invoiceXsdPath: env.UBL_INVOICE_XSD_PATH }
      : {}),
    ...(env.UBL_CREDIT_NOTE_XSD_PATH
      ? { creditNoteXsdPath: env.UBL_CREDIT_NOTE_XSD_PATH }
      : {}),
    ...(env.UBL_XSD_ARTIFACT_VERSION
      ? { artifactVersion: env.UBL_XSD_ARTIFACT_VERSION }
      : {})
  };
}

function resolveUblXsdArtifactConfig(
  input: UblXsdArtifactConfigInput | undefined
): ResolvedUblXsdArtifactConfig {
  const rootPath = normalizeConfiguredPath(input?.rootDir);
  const artifactVersion = cleanOptionalValue(input?.artifactVersion);
  const derivableVersion = getDerivableUblVersion(artifactVersion);
  const invoiceXsdPath =
    normalizeConfiguredPath(input?.invoiceXsdPath) ??
    (rootPath && derivableVersion
      ? join(rootPath, "xsd", "maindoc", `UBL-Invoice-${derivableVersion}.xsd`)
      : undefined);
  const creditNoteXsdPath =
    normalizeConfiguredPath(input?.creditNoteXsdPath) ??
    (rootPath && derivableVersion
      ? join(
          rootPath,
          "xsd",
          "maindoc",
          `UBL-CreditNote-${derivableVersion}.xsd`
        )
      : undefined);

  return {
    ...(rootPath ? { rootPath } : {}),
    ...(invoiceXsdPath ? { invoiceXsdPath } : {}),
    ...(creditNoteXsdPath ? { creditNoteXsdPath } : {}),
    ...(artifactVersion ? { artifactVersion } : {})
  };
}

function inspectReadableFile(path: string): ReadableFileInspection {
  try {
    const stat = statSync(path);

    if (!stat.isFile()) {
      return {
        path,
        readable: false,
        reason: "not_a_file"
      };
    }

    accessSync(path, constants.R_OK);

    return {
      path,
      readable: true
    };
  } catch (error) {
    return {
      path,
      readable: false,
      reason:
        error instanceof Error && "code" in error
          ? String(error.code)
          : "not_readable"
    };
  }
}

function buildArtifactInfo(input: {
  resolvedConfig: ResolvedUblXsdArtifactConfig;
  configured: boolean;
}): UblXsdArtifactInfo {
  return {
    configured: input.configured,
    validatorName: UBL_XSD_VALIDATOR_NAME,
    ...(input.resolvedConfig.rootPath
      ? { rootPath: input.resolvedConfig.rootPath }
      : {}),
    ...(input.resolvedConfig.invoiceXsdPath
      ? { invoiceXsdPath: input.resolvedConfig.invoiceXsdPath }
      : {}),
    ...(input.resolvedConfig.creditNoteXsdPath
      ? { creditNoteXsdPath: input.resolvedConfig.creditNoteXsdPath }
      : {}),
    ...(input.resolvedConfig.artifactVersion
      ? { artifactVersion: input.resolvedConfig.artifactVersion }
      : {})
  };
}

function getSelectedXsdPath(input: {
  resolvedConfig: ResolvedUblXsdArtifactConfig;
  documentType: string;
  rootElement: string;
}) {
  const normalizedDocumentType = input.documentType.toLowerCase();
  const normalizedRoot = input.rootElement.toLowerCase();

  if (
    normalizedDocumentType === "invoice" ||
    normalizedRoot === "invoice" ||
    normalizedRoot.endsWith(":invoice")
  ) {
    return {
      selectedDocumentType: "invoice",
      selectedXsdPath: input.resolvedConfig.invoiceXsdPath
    };
  }

  if (
    normalizedDocumentType === "credit_note" ||
    normalizedRoot === "creditnote" ||
    normalizedRoot.endsWith(":creditnote")
  ) {
    return {
      selectedDocumentType: "credit_note",
      selectedXsdPath: input.resolvedConfig.creditNoteXsdPath
    };
  }

  return {
    selectedDocumentType: "unknown"
  };
}

function notConfiguredResult(input: {
  artifactInfo: UblXsdArtifactInfo;
  code: string;
  message: string;
  reason: string;
  selectedDocumentType: string;
  selectedXsdPath?: string;
  configuredPathReadable?: boolean;
  configuredPathReason?: string;
}): UblXsdValidationResult {
  const finding: UblXsdValidationFinding = {
    code: input.code,
    severity: "warning",
    field: "xml",
    message: input.message,
    status: "not_configured",
    fixSuggestion:
      "Configure readable local UBL XSD artefact paths before relying on technical UBL XSD validation.",
    sourceLabels: ["Local UBL XSD artefacts required"]
  };

  return {
    status: "not_configured",
    artifactInfo: input.artifactInfo,
    validationExecuted: false,
    markedValid: false,
    findings: [finding],
    summary: {
      configured: false,
      validationExecuted: false,
      markedValid: false,
      reason: input.reason,
      selectedDocumentType: input.selectedDocumentType,
      ...(input.selectedXsdPath ? { selectedXsdPath: input.selectedXsdPath } : {}),
      ...(input.configuredPathReadable !== undefined
        ? { configuredPathReadable: input.configuredPathReadable }
        : {}),
      ...(input.configuredPathReason
        ? { configuredPathReason: input.configuredPathReason }
        : {})
    }
  };
}

export function validateUblXsd(
  input: UblXsdValidationInput
): UblXsdValidationResult {
  void input.xml;

  const resolvedConfig = resolveUblXsdArtifactConfig(input.artifactConfig);
  const selected = getSelectedXsdPath({
    resolvedConfig,
    documentType: input.documentType,
    rootElement: input.rootElement
  });

  if (!selected.selectedXsdPath) {
    return notConfiguredResult({
      artifactInfo: buildArtifactInfo({
        resolvedConfig,
        configured: false
      }),
      code:
        selected.selectedDocumentType === "unknown"
          ? "UBL_XSD_DOCUMENT_TYPE_UNSUPPORTED"
          : "UBL_XSD_NOT_CONFIGURED",
      message:
        selected.selectedDocumentType === "unknown"
          ? "UBL XSD validation was requested, but the XML root element is not mapped to a local Invoice or CreditNote XSD artefact. The XML has not been marked as XSD-valid."
          : "UBL XSD validation was requested, but the required local UBL XSD artefact path is not configured in this environment. The XML has not been marked as XSD-valid.",
      reason:
        selected.selectedDocumentType === "unknown"
          ? "unsupported_document_type"
          : "local_ubl_xsd_artifact_path_not_configured",
      selectedDocumentType: selected.selectedDocumentType
    });
  }

  const readableFile = inspectReadableFile(selected.selectedXsdPath);

  if (!readableFile.readable) {
    return notConfiguredResult({
      artifactInfo: buildArtifactInfo({
        resolvedConfig,
        configured: false
      }),
      code: "UBL_XSD_ARTIFACT_UNREADABLE",
      message:
        "UBL XSD validation was requested, but the configured local UBL XSD artefact is missing or not readable. The XML has not been marked as XSD-valid.",
      reason: "local_ubl_xsd_artifact_unreadable",
      selectedDocumentType: selected.selectedDocumentType,
      selectedXsdPath: readableFile.path,
      configuredPathReadable: false,
      ...(readableFile.reason
        ? { configuredPathReason: readableFile.reason }
        : {})
    });
  }

  const artifactInfo = buildArtifactInfo({
    resolvedConfig,
    configured: true
  });
  const finding: UblXsdValidationFinding = {
    code: "UBL_XSD_VALIDATOR_UNAVAILABLE",
    severity: "fatal",
    field: "xml",
    message:
      "Local UBL XSD artefacts are configured and readable, but this runtime has no enabled dependency-light XSD validation engine. The XML has not been marked as XSD-valid.",
    status: "error",
    fixSuggestion:
      "Wire a reviewed local XSD validation backend into this adapter before returning passed or failed UBL XSD results.",
    sourceLabels: ["Local UBL XSD artefacts detected", "Validator backend required"]
  };

  return {
    status: "error",
    artifactInfo,
    validationExecuted: false,
    markedValid: false,
    findings: [finding],
    summary: {
      configured: true,
      validationExecuted: false,
      markedValid: false,
      reason: "xsd_validator_backend_unavailable",
      selectedDocumentType: selected.selectedDocumentType,
      selectedXsdPath: readableFile.path,
      configuredPathReadable: true
    }
  };
}
