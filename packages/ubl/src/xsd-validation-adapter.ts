import { accessSync, constants, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import {
  basename,
  dirname,
  isAbsolute,
  resolve
} from "node:path";
import type {
  XMLFileInfo,
  XMLValidationResult
} from "xmllint-wasm";
import {
  UBL_XSD_VALIDATOR_NAME,
  inspectUblSchemaDependencyGraph,
  isPathInside,
  resolveUblSchemaForDocumentType,
  withUblXsdDependencyGraph,
  withUblXsdValidatorAvailability,
  type ResolvedUblXsdArtifactConfig,
  type UblXsdArtifactConfigInput,
  type UblXsdArtifactInfo,
  type UblXsdDependencyGraphInfo,
  type UblXsdSchemaArtifactInfo
} from "./xsd-artifact-registry.js";
import {
  UBL_XSD_CHECK_TYPE,
  UBL_XSD_ERROR_MAPPING_VERSION,
  UBL_XSD_SOURCE_LABELS,
  buildUblXsdValidatorErrorFinding,
  mapUblXsdValidationErrors,
  type UblXsdMappedFinding
} from "./xsd-error-mapper.js";

const XSD_CHECK_TYPE = UBL_XSD_CHECK_TYPE;
const VALIDATOR_XML_FILE_NAME = "document.xml";
const MAX_SCHEMA_DEPENDENCY_FILES = 500;
const SCHEMA_LOCATION_ATTRIBUTE_PATTERN =
  /\bschemaLocation\s*=\s*(["'])([^"']+)\1/gi;

export type UblXsdValidationStatus =
  | "passed"
  | "failed"
  | "not_configured"
  | "error";

export type UblXsdValidationFinding = UblXsdMappedFinding;

export type UblXsdValidationResult = {
  checkType: typeof XSD_CHECK_TYPE;
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

type ReadableFileInspection = {
  path: string;
  readable: boolean;
  reason?: string;
};

type LocalSchemaFile = {
  absolutePath: string;
  virtualFileName: string;
  contents: string;
};

type PreparedLocalSchemaSet = {
  schema: XMLFileInfo;
  preload: XMLFileInfo[];
  schemaPathUsed: string;
  schemaResolutionRoot: string;
  schemaDependencyCount: number;
};

class UblXsdControlledError extends Error {
  readonly reason: string;
  readonly validationExecuted: boolean;

  constructor(input: {
    reason: string;
    message: string;
    validationExecuted?: boolean;
  }) {
    super(input.message);
    this.name = "UblXsdControlledError";
    this.reason = input.reason;
    this.validationExecuted = input.validationExecuted ?? false;
  }
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

function buildCommonSummary(input: {
  configured: boolean;
  validationExecuted: boolean;
  markedValid: boolean;
  validatorAvailable: boolean;
  documentType: string;
  rootElement: string;
  selectedDocumentType?: string;
  schemaPathUsed?: string;
  reason?: string;
  errorCount?: number;
  rawErrorCount?: number;
  mappedFindingCount?: number;
  configuredPathReadable?: boolean;
  configuredPathReason?: string;
  schemaDependencyCount?: number;
  schemaResolutionRoot?: string;
  artifactVersion?: string | null;
  artifactCheckedAt?: string;
  dependencyGraphStatus?: string;
}) {
  return {
    configured: input.configured,
    validationExecuted: input.validationExecuted,
    markedValid: input.markedValid,
    validatorAvailable: input.validatorAvailable,
    validatorName: UBL_XSD_VALIDATOR_NAME,
    findingMappingVersion: UBL_XSD_ERROR_MAPPING_VERSION,
    documentType: input.documentType,
    rootElement: input.rootElement,
    ...(input.selectedDocumentType
      ? { selectedDocumentType: input.selectedDocumentType }
      : {}),
    ...(input.schemaPathUsed
      ? {
          schemaPathUsed: input.schemaPathUsed,
          selectedXsdPath: input.schemaPathUsed
        }
      : {}),
    ...(input.reason ? { reason: input.reason } : {}),
    ...(input.errorCount !== undefined ? { errorCount: input.errorCount } : {}),
    ...(input.rawErrorCount !== undefined
      ? { rawErrorCount: input.rawErrorCount }
      : {}),
    ...(input.mappedFindingCount !== undefined
      ? { mappedFindingCount: input.mappedFindingCount }
      : {}),
    ...(input.configuredPathReadable !== undefined
      ? { configuredPathReadable: input.configuredPathReadable }
      : {}),
    ...(input.configuredPathReason
      ? { configuredPathReason: input.configuredPathReason }
      : {}),
    ...(input.schemaDependencyCount !== undefined
      ? { schemaDependencyCount: input.schemaDependencyCount }
      : {}),
    ...(input.schemaResolutionRoot
      ? { schemaResolutionRoot: input.schemaResolutionRoot }
      : {}),
    ...(input.artifactVersion !== undefined
      ? { artifactVersion: input.artifactVersion }
      : {}),
    ...(input.artifactCheckedAt ? { artifactCheckedAt: input.artifactCheckedAt } : {}),
    ...(input.dependencyGraphStatus
      ? { dependencyGraphStatus: input.dependencyGraphStatus }
      : {})
  };
}

function notConfiguredResult(input: {
  artifactInfo: UblXsdArtifactInfo;
  message: string;
  reason: string;
  documentType: string;
  rootElement: string;
  selectedDocumentType: string;
  selectedXsdPath?: string;
  configuredPathReadable?: boolean;
  configuredPathReason?: string;
}): UblXsdValidationResult {
  const finding: UblXsdValidationFinding = {
    code: "UBL_XSD_NOT_CONFIGURED",
    severity: "warning",
    checkType: XSD_CHECK_TYPE,
    field: "xml",
    message: input.message,
    status: "not_configured",
    legalConfidence: "technical",
    fixSuggestion:
      "Configure readable local UBL XSD artefact paths before relying on technical UBL XSD validation.",
    sourceLabels: [...UBL_XSD_SOURCE_LABELS]
  };

  return {
    checkType: XSD_CHECK_TYPE,
    status: "not_configured",
    artifactInfo: input.artifactInfo,
    validationExecuted: false,
    markedValid: false,
    findings: [finding],
    summary: buildCommonSummary({
      configured: false,
      validationExecuted: false,
      markedValid: false,
      validatorAvailable: true,
      documentType: input.documentType,
      rootElement: input.rootElement,
      selectedDocumentType: input.selectedDocumentType,
      reason: input.reason,
      ...(input.selectedXsdPath
        ? { schemaPathUsed: input.selectedXsdPath }
        : {}),
      ...(input.configuredPathReadable !== undefined
        ? { configuredPathReadable: input.configuredPathReadable }
        : {}),
      ...(input.configuredPathReason
        ? { configuredPathReason: input.configuredPathReason }
        : {}),
      artifactVersion: input.artifactInfo.artifactVersion,
      artifactCheckedAt: input.artifactInfo.checkedAt,
      dependencyGraphStatus: input.artifactInfo.dependencyGraph.status
    })
  };
}

function unsupportedDocumentTypeResult(input: {
  artifactInfo: UblXsdArtifactInfo;
  documentType: string;
  rootElement: string;
}): UblXsdValidationResult {
  const finding: UblXsdValidationFinding = {
    code: "UBL_XSD_UNSUPPORTED_DOCUMENT_TYPE",
    severity: "warning",
    checkType: XSD_CHECK_TYPE,
    field: "rootElement",
    message:
      "UBL XSD validation was requested, but the XML root element is not mapped to a local Invoice or CreditNote XSD artefact. The XML has not been marked as XSD-valid.",
    status: "error",
    legalConfidence: "technical",
    fixSuggestion:
      "Use a supported UBL Invoice or CreditNote XML root for local technical XSD validation.",
    sourceLabels: [...UBL_XSD_SOURCE_LABELS],
    technicalCode: "unsupported_document_type"
  };

  return {
    checkType: XSD_CHECK_TYPE,
    status: "error",
    artifactInfo: input.artifactInfo,
    validationExecuted: false,
    markedValid: false,
    findings: [finding],
    summary: buildCommonSummary({
      configured: false,
      validationExecuted: false,
      markedValid: false,
      validatorAvailable: true,
      documentType: input.documentType,
      rootElement: input.rootElement,
      selectedDocumentType: "unknown",
      reason: "unsupported_document_type",
      artifactVersion: input.artifactInfo.artifactVersion,
      artifactCheckedAt: input.artifactInfo.checkedAt,
      dependencyGraphStatus: input.artifactInfo.dependencyGraph.status
    })
  };
}

function validatorErrorResult(input: {
  artifactInfo: UblXsdArtifactInfo;
  message: string;
  reason: string;
  documentType: string;
  rootElement: string;
  selectedDocumentType: string;
  schemaPathUsed?: string;
  validationExecuted: boolean;
  validatorAvailable?: boolean;
  schemaDependencyCount?: number;
  schemaResolutionRoot?: string;
}): UblXsdValidationResult {
  const finding = buildUblXsdValidatorErrorFinding({
    message: input.message,
    status: "error",
    fixSuggestion:
      "Review the configured local XSD artefacts and validator runtime before rerunning this technical check."
  });

  return {
    checkType: XSD_CHECK_TYPE,
    status: "error",
    artifactInfo: input.artifactInfo,
    validationExecuted: input.validationExecuted,
    markedValid: false,
    findings: [finding],
    summary: buildCommonSummary({
      configured: true,
      validationExecuted: input.validationExecuted,
      markedValid: false,
      validatorAvailable: input.validatorAvailable ?? true,
      documentType: input.documentType,
      rootElement: input.rootElement,
      selectedDocumentType: input.selectedDocumentType,
      reason: input.reason,
      ...(input.schemaPathUsed ? { schemaPathUsed: input.schemaPathUsed } : {}),
      ...(input.schemaDependencyCount !== undefined
        ? { schemaDependencyCount: input.schemaDependencyCount }
        : {}),
      ...(input.schemaResolutionRoot
        ? { schemaResolutionRoot: input.schemaResolutionRoot }
        : {}),
      artifactVersion: input.artifactInfo.artifactVersion,
      artifactCheckedAt: input.artifactInfo.checkedAt,
      dependencyGraphStatus: input.artifactInfo.dependencyGraph.status
    })
  };
}

function normalizePathKey(path: string) {
  return resolve(path);
}

function inferSchemaResolutionRoot(input: {
  selectedXsdPath: string;
  resolvedConfig: ResolvedUblXsdArtifactConfig;
}) {
  if (
    input.resolvedConfig.rootPath &&
    isPathInside(input.resolvedConfig.rootPath, input.selectedXsdPath)
  ) {
    return input.resolvedConfig.rootPath;
  }

  const selectedDirectory = dirname(input.selectedXsdPath);

  return basename(selectedDirectory).toLowerCase() === "maindoc"
    ? dirname(selectedDirectory)
    : selectedDirectory;
}

function isExternalSchemaLocation(schemaLocation: string) {
  return (
    /^[a-z][a-z0-9+.-]*:/i.test(schemaLocation) ||
    schemaLocation.startsWith("//") ||
    isAbsolute(schemaLocation)
  );
}

function getSchemaLocations(contents: string) {
  const locations: string[] = [];

  SCHEMA_LOCATION_ATTRIBUTE_PATTERN.lastIndex = 0;

  for (const match of contents.matchAll(SCHEMA_LOCATION_ATTRIBUTE_PATTERN)) {
    const location = match[2]?.trim();

    if (location) {
      locations.push(location);
    }
  }

  return locations;
}

function resolveSchemaLocation(input: {
  currentSchemaPath: string;
  schemaLocation: string;
  schemaResolutionRoot: string;
}) {
  if (isExternalSchemaLocation(input.schemaLocation)) {
    throw new UblXsdControlledError({
      reason: "external_schema_location_not_supported",
      message:
        "The configured XSD artefact references an external or absolute schema location. Local UBL XSD validation requires reviewed local schema dependencies."
    });
  }

  const resolvedPath = resolve(dirname(input.currentSchemaPath), input.schemaLocation);

  if (!isPathInside(input.schemaResolutionRoot, resolvedPath)) {
    throw new UblXsdControlledError({
      reason: "schema_dependency_outside_configured_root",
      message:
        "The configured XSD artefact references a schema outside the configured local UBL XSD root. Validation was not run."
    });
  }

  return resolvedPath;
}

async function readSchemaFile(path: string) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    throw new UblXsdControlledError({
      reason: "schema_dependency_unreadable",
      message:
        error instanceof Error
          ? `A local XSD dependency could not be read: ${error.message.slice(
              0,
              240
            )}`
          : "A local XSD dependency could not be read."
    });
  }
}

function buildVirtualFileNames(schemaFiles: Map<string, string>) {
  const virtualNameByPath = new Map<string, string>();
  const pathByVirtualName = new Map<string, string>();

  for (const schemaPath of schemaFiles.keys()) {
    const virtualFileName = basename(schemaPath);
    const virtualNameKey = virtualFileName.toLowerCase();
    const existingPath = pathByVirtualName.get(virtualNameKey);

    if (existingPath && existingPath !== schemaPath) {
      throw new UblXsdControlledError({
        reason: "schema_dependency_filename_collision",
        message:
          "Two local XSD dependencies use the same filename. The xmllint-wasm backend cannot safely mirror this schema graph without ambiguous schemaLocation values."
      });
    }

    pathByVirtualName.set(virtualNameKey, schemaPath);
    virtualNameByPath.set(schemaPath, virtualFileName);
  }

  return virtualNameByPath;
}

function rewriteSchemaLocations(input: {
  schemaPath: string;
  contents: string;
  schemaResolutionRoot: string;
  virtualNameByPath: Map<string, string>;
}) {
  SCHEMA_LOCATION_ATTRIBUTE_PATTERN.lastIndex = 0;

  return input.contents.replace(
    SCHEMA_LOCATION_ATTRIBUTE_PATTERN,
    (match, quote: string, schemaLocation: string) => {
      const dependencyPath = resolveSchemaLocation({
        currentSchemaPath: input.schemaPath,
        schemaLocation: schemaLocation.trim(),
        schemaResolutionRoot: input.schemaResolutionRoot
      });
      const virtualFileName = input.virtualNameByPath.get(
        normalizePathKey(dependencyPath)
      );

      if (!virtualFileName) {
        throw new UblXsdControlledError({
          reason: "schema_dependency_not_preloaded",
          message:
            "A local XSD dependency was referenced but not prepared for the validator backend."
        });
      }

      return `schemaLocation=${quote}${virtualFileName}${quote}`;
    }
  );
}

async function collectLocalSchemaFiles(input: {
  selectedXsdPath: string;
  schemaResolutionRoot: string;
}) {
  const schemaFiles = new Map<string, string>();
  const queue = [resolve(input.selectedXsdPath)];

  while (queue.length > 0) {
    const currentSchemaPath = resolve(queue.shift() ?? "");
    const currentKey = normalizePathKey(currentSchemaPath);

    if (schemaFiles.has(currentKey)) {
      continue;
    }

    if (schemaFiles.size >= MAX_SCHEMA_DEPENDENCY_FILES) {
      throw new UblXsdControlledError({
        reason: "schema_dependency_limit_exceeded",
        message:
          "The local XSD dependency graph is larger than this sandbox validator limit. Validation was not run."
      });
    }

    const inspection = inspectReadableFile(currentSchemaPath);

    if (!inspection.readable) {
      throw new UblXsdControlledError({
        reason: "schema_dependency_unreadable",
        message:
          "A local XSD dependency is missing or not readable. Validation was not run."
      });
    }

    const contents = await readSchemaFile(currentSchemaPath);

    schemaFiles.set(currentKey, contents);

    for (const schemaLocation of getSchemaLocations(contents)) {
      const dependencyPath = resolveSchemaLocation({
        currentSchemaPath,
        schemaLocation,
        schemaResolutionRoot: input.schemaResolutionRoot
      });

      queue.push(dependencyPath);
    }
  }

  return schemaFiles;
}

async function prepareLocalSchemaSet(input: {
  selectedXsdPath: string;
  resolvedConfig: ResolvedUblXsdArtifactConfig;
}): Promise<PreparedLocalSchemaSet> {
  const schemaPathUsed = resolve(input.selectedXsdPath);
  const schemaResolutionRoot = inferSchemaResolutionRoot({
    selectedXsdPath: schemaPathUsed,
    resolvedConfig: input.resolvedConfig
  });
  const schemaFiles = await collectLocalSchemaFiles({
    selectedXsdPath: schemaPathUsed,
    schemaResolutionRoot
  });
  const virtualNameByPath = buildVirtualFileNames(schemaFiles);
  const localSchemaFiles: LocalSchemaFile[] = [];

  for (const [schemaPathKey, contents] of schemaFiles.entries()) {
    const virtualFileName = virtualNameByPath.get(schemaPathKey);

    if (!virtualFileName) {
      throw new UblXsdControlledError({
        reason: "schema_dependency_not_preloaded",
        message:
          "A local XSD dependency was read but could not be mapped for the validator backend."
      });
    }

    localSchemaFiles.push({
      absolutePath: schemaPathKey,
      virtualFileName,
      contents: rewriteSchemaLocations({
        schemaPath: schemaPathKey,
        contents,
        schemaResolutionRoot,
        virtualNameByPath
      })
    });
  }

  const mainVirtualFileName = virtualNameByPath.get(normalizePathKey(schemaPathUsed));
  const mainSchema = localSchemaFiles.find(
    (schemaFile) => schemaFile.virtualFileName === mainVirtualFileName
  );

  if (!mainSchema) {
    throw new UblXsdControlledError({
      reason: "schema_main_file_not_prepared",
      message:
        "The selected local XSD artefact could not be prepared for the validator backend."
    });
  }

  return {
    schema: {
      fileName: mainSchema.virtualFileName,
      contents: mainSchema.contents
    },
    preload: localSchemaFiles
      .filter((schemaFile) => schemaFile !== mainSchema)
      .map((schemaFile) => ({
        fileName: schemaFile.virtualFileName,
        contents: schemaFile.contents
      })),
    schemaPathUsed,
    schemaResolutionRoot,
    schemaDependencyCount: Math.max(localSchemaFiles.length - 1, 0)
  };
}

function passedResult(input: {
  artifactInfo: UblXsdArtifactInfo;
  documentType: string;
  rootElement: string;
  selectedDocumentType: string;
  preparedSchemaSet: PreparedLocalSchemaSet;
}): UblXsdValidationResult {
  const finding: UblXsdValidationFinding = {
    code: "UBL_XSD_VALIDATION_PASSED",
    severity: "info",
    checkType: XSD_CHECK_TYPE,
    field: "xml",
    message:
      "Local UBL XSD validation executed with the configured artefacts and reported no schema errors.",
    status: "passed",
    legalConfidence: "technical",
    fixSuggestion:
      "Continue with any additional technical business-rule checks that are relevant to your sandbox workflow.",
    sourceLabels: [...UBL_XSD_SOURCE_LABELS],
    technicalCode: "xsd_validation_passed"
  };

  return {
    checkType: XSD_CHECK_TYPE,
    status: "passed",
    artifactInfo: input.artifactInfo,
    validationExecuted: true,
    markedValid: true,
    findings: [finding],
    summary: buildCommonSummary({
      configured: true,
      validationExecuted: true,
      markedValid: true,
      validatorAvailable: true,
      documentType: input.documentType,
      rootElement: input.rootElement,
      selectedDocumentType: input.selectedDocumentType,
      schemaPathUsed: input.preparedSchemaSet.schemaPathUsed,
      errorCount: 0,
      schemaDependencyCount: input.preparedSchemaSet.schemaDependencyCount,
      schemaResolutionRoot: input.preparedSchemaSet.schemaResolutionRoot,
      artifactVersion: input.artifactInfo.artifactVersion,
      artifactCheckedAt: input.artifactInfo.checkedAt,
      dependencyGraphStatus: input.artifactInfo.dependencyGraph.status
    })
  };
}

function failedResult(input: {
  artifactInfo: UblXsdArtifactInfo;
  documentType: string;
  rootElement: string;
  selectedDocumentType: string;
  preparedSchemaSet: PreparedLocalSchemaSet;
  validationResult: XMLValidationResult;
}): UblXsdValidationResult {
  const schemaErrors = input.validationResult.errors;
  const findings = mapUblXsdValidationErrors({
    errors: schemaErrors,
    context: {
      rootElement: input.rootElement,
      documentType: input.documentType
    },
    maxFindings: 25
  });

  return {
    checkType: XSD_CHECK_TYPE,
    status: "failed",
    artifactInfo: input.artifactInfo,
    validationExecuted: true,
    markedValid: false,
    findings,
    summary: buildCommonSummary({
      configured: true,
      validationExecuted: true,
      markedValid: false,
      validatorAvailable: true,
      documentType: input.documentType,
      rootElement: input.rootElement,
      selectedDocumentType: input.selectedDocumentType,
      schemaPathUsed: input.preparedSchemaSet.schemaPathUsed,
      errorCount: findings.length,
      rawErrorCount: schemaErrors.length,
      mappedFindingCount: findings.length,
      schemaDependencyCount: input.preparedSchemaSet.schemaDependencyCount,
      schemaResolutionRoot: input.preparedSchemaSet.schemaResolutionRoot,
      artifactVersion: input.artifactInfo.artifactVersion,
      artifactCheckedAt: input.artifactInfo.checkedAt,
      dependencyGraphStatus: input.artifactInfo.dependencyGraph.status
    })
  };
}

function getControlledError(error: unknown) {
  return error instanceof UblXsdControlledError
    ? error
    : new UblXsdControlledError({
        reason: "xsd_validator_backend_error",
        message:
          error instanceof Error
            ? `The local XSD validator backend failed in a controlled way: ${error.message.slice(
                0,
                240
              )}`
            : "The local XSD validator backend failed in a controlled way.",
        validationExecuted: true
      });
}

function getSchemaUnavailableReason(schema: UblXsdSchemaArtifactInfo | null) {
  if (!schema || schema.status === "not_configured") {
    return "local_ubl_xsd_artifact_path_not_configured";
  }

  if (schema.status === "missing") {
    return "local_ubl_xsd_artifact_missing";
  }

  if (schema.status === "out_of_root") {
    return "local_ubl_xsd_artifact_outside_configured_root";
  }

  return "local_ubl_xsd_artifact_unreadable";
}

function getSchemaUnavailableMessage(schema: UblXsdSchemaArtifactInfo | null) {
  if (!schema || schema.status === "not_configured") {
    return "UBL XSD validation was requested, but the required local UBL XSD artefact path is not configured in this environment. The XML has not been marked as XSD-valid.";
  }

  if (schema.status === "out_of_root") {
    return "UBL XSD validation was requested, but the configured local UBL XSD artefact path is outside the configured artefact root. The XML has not been marked as XSD-valid.";
  }

  return "UBL XSD validation was requested, but the configured local UBL XSD artefact is missing or not readable. The XML has not been marked as XSD-valid.";
}

function getDependencyGraphErrorMessage(graph: UblXsdDependencyGraphInfo) {
  if (graph.status === "missing_dependency") {
    return "The configured local UBL XSD artefact references a missing local schema dependency. Validation was not run.";
  }

  if (graph.status === "unreadable_dependency") {
    return "The configured local UBL XSD artefact references an unreadable local schema dependency. Validation was not run.";
  }

  if (graph.status === "external_reference_blocked") {
    return "The configured local UBL XSD artefact references an external schema location. Local UBL XSD validation does not fetch remote artefacts.";
  }

  return "The configured local UBL XSD dependency graph could not be prepared safely. Validation was not run.";
}

function getDependencyGraphReason(graph: UblXsdDependencyGraphInfo) {
  if (graph.status === "missing_dependency") {
    return "schema_dependency_missing";
  }

  if (graph.status === "unreadable_dependency") {
    return "schema_dependency_unreadable";
  }

  if (graph.status === "external_reference_blocked") {
    return "external_schema_location_not_supported";
  }

  return graph.reason ?? `schema_dependency_graph_${graph.status}`;
}

export async function validateUblXsd(
  input: UblXsdValidationInput
): Promise<UblXsdValidationResult> {
  const selected = await resolveUblSchemaForDocumentType(
    input.artifactConfig,
    input.documentType,
    input.rootElement
  );

  if (selected.selectedDocumentType === "unknown") {
    return unsupportedDocumentTypeResult({
      artifactInfo: selected.artifactInfo,
      documentType: input.documentType,
      rootElement: input.rootElement
    });
  }

  const selectedDocumentType =
    selected.selectedDocumentType === "invoice" ? "invoice" : "credit_note";

  if (!selected.schema?.usable || !selected.schemaPath) {
    return notConfiguredResult({
      artifactInfo: selected.artifactInfo,
      message: getSchemaUnavailableMessage(selected.schema),
      reason: getSchemaUnavailableReason(selected.schema),
      documentType: input.documentType,
      rootElement: input.rootElement,
      selectedDocumentType,
      ...(selected.schemaPath ? { selectedXsdPath: selected.schemaPath } : {}),
      configuredPathReadable: selected.schema?.readable ?? false,
      ...(selected.schema?.reason
        ? { configuredPathReason: selected.schema.reason }
        : {})
    });
  }

  const dependencyGraph = await inspectUblSchemaDependencyGraph({
    selectedXsdPath: selected.schemaPath,
    resolvedConfig: selected.resolvedConfig
  });
  let artifactInfo = withUblXsdDependencyGraph(
    selected.artifactInfo,
    dependencyGraph
  );

  if (dependencyGraph.status !== "ready") {
    return validatorErrorResult({
      artifactInfo,
      message: getDependencyGraphErrorMessage(dependencyGraph),
      reason: getDependencyGraphReason(dependencyGraph),
      documentType: input.documentType,
      rootElement: input.rootElement,
      selectedDocumentType,
      schemaPathUsed: selected.schemaPath,
      validationExecuted: false,
      schemaDependencyCount: dependencyGraph.dependencyCount,
      ...(dependencyGraph.schemaResolutionRoot
        ? { schemaResolutionRoot: dependencyGraph.schemaResolutionRoot }
        : {})
    });
  }

  let preparedSchemaSet: PreparedLocalSchemaSet;

  try {
    preparedSchemaSet = await prepareLocalSchemaSet({
      selectedXsdPath: selected.schemaPath,
      resolvedConfig: selected.resolvedConfig
    });
  } catch (error) {
    const controlledError = getControlledError(error);

    return validatorErrorResult({
      artifactInfo,
      message: controlledError.message,
      reason: controlledError.reason,
      documentType: input.documentType,
      rootElement: input.rootElement,
      selectedDocumentType,
      schemaPathUsed: selected.schemaPath,
      validationExecuted: controlledError.validationExecuted
    });
  }

  let validatorModule: typeof import("xmllint-wasm");

  try {
    validatorModule = await import("xmllint-wasm");
  } catch (error) {
    artifactInfo = withUblXsdValidatorAvailability(artifactInfo, false);

    return validatorErrorResult({
      artifactInfo,
      message:
        error instanceof Error
          ? `The xmllint-wasm validator backend could not be loaded: ${error.message.slice(
              0,
              240
            )}`
          : "The xmllint-wasm validator backend could not be loaded.",
      reason: "xsd_validator_backend_unavailable",
      documentType: input.documentType,
      rootElement: input.rootElement,
      selectedDocumentType,
      schemaPathUsed: preparedSchemaSet.schemaPathUsed,
      validationExecuted: false,
      validatorAvailable: false,
      schemaDependencyCount: preparedSchemaSet.schemaDependencyCount,
      schemaResolutionRoot: preparedSchemaSet.schemaResolutionRoot
    });
  }

  try {
    const validationResult = await validatorModule.validateXML({
      xml: {
        fileName: VALIDATOR_XML_FILE_NAME,
        contents: input.xml
      },
      schema: preparedSchemaSet.schema,
      preload: preparedSchemaSet.preload,
      initialMemoryPages: 512,
      maxMemoryPages: 2048
    });

    if (validationResult.valid) {
      return passedResult({
        artifactInfo,
        documentType: input.documentType,
        rootElement: input.rootElement,
        selectedDocumentType,
        preparedSchemaSet
      });
    }

    return failedResult({
      artifactInfo,
      documentType: input.documentType,
      rootElement: input.rootElement,
      selectedDocumentType,
      preparedSchemaSet,
      validationResult
    });
  } catch (error) {
    const controlledError = getControlledError(error);

    return validatorErrorResult({
      artifactInfo,
      message: controlledError.message,
      reason: controlledError.reason,
      documentType: input.documentType,
      rootElement: input.rootElement,
      selectedDocumentType,
      schemaPathUsed: preparedSchemaSet.schemaPathUsed,
      validationExecuted: controlledError.validationExecuted,
      schemaDependencyCount: preparedSchemaSet.schemaDependencyCount,
      schemaResolutionRoot: preparedSchemaSet.schemaResolutionRoot
    });
  }
}
