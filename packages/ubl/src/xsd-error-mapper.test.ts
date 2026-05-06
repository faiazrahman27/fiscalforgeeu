import assert from "node:assert/strict";
import { test } from "node:test";
import {
  inferUblFieldFromXsdError,
  mapUblXsdValidationErrors,
  normalizeXsdTechnicalMessage
} from "./xsd-error-mapper.js";

function rawError(message: string, lineNumber = 7) {
  return {
    rawMessage: `document.xml:${lineNumber}: ${message}`,
    message,
    loc: {
      fileName: "document.xml",
      lineNumber
    }
  };
}

test("UBL XSD mapper converts a missing required element message into a stable finding", () => {
  const [finding] = mapUblXsdValidationErrors({
    errors: [
      rawError(
        "Schemas validity error : Element 'Invoice': Missing child element(s). Expected is ( cbc:ID ).",
        4
      )
    ],
    context: {
      rootElement: "Invoice",
      documentType: "invoice"
    }
  });

  assert.equal(finding?.code, "UBL_XSD_REQUIRED_ELEMENT_MISSING");
  assert.equal(finding?.severity, "fatal");
  assert.equal(finding?.checkType, "xsd_ubl");
  assert.equal(finding?.field, "document.number");
  assert.equal(finding?.status, "failed");
  assert.equal(finding?.legalConfidence, "technical");
  assert.equal(finding?.technicalCode, "required_element_missing");
  assert.equal(finding?.xmlLine, 4);
  assert.match(finding?.message ?? "", /missing the required UBL element cbc:ID/i);
  assert.ok(finding?.fixSuggestion);
  assert.deepEqual(finding?.sourceLabels, [
    "Local UBL XSD validation",
    "xmllint-wasm",
    "Configured local UBL XSD artefacts"
  ]);
});

test("UBL XSD mapper converts an invalid element message into a stable finding", () => {
  const [finding] = mapUblXsdValidationErrors({
    errors: [
      rawError(
        "Schemas validity error : Element 'Unexpected': This element is not expected. Expected is ( cbc:ID )."
      )
    ],
    context: {
      rootElement: "Invoice",
      documentType: "invoice"
    }
  });

  assert.equal(finding?.code, "UBL_XSD_ELEMENT_INVALID");
  assert.equal(finding?.field, "xml");
  assert.match(finding?.message ?? "", /Unexpected/);
  assert.equal(finding?.technicalCode, "element_invalid");
});

test("UBL XSD mapper falls back to field xml for unknown messages", () => {
  const [finding] = mapUblXsdValidationErrors({
    errors: [
      rawError("Schemas validity error : Validator reported an unmapped schema issue.")
    ],
    context: {
      rootElement: "Invoice",
      documentType: "invoice"
    }
  });

  assert.equal(finding?.code, "UBL_XSD_VALIDATION_FAILED");
  assert.equal(finding?.field, "xml");
  assert.equal(finding?.technicalCode, "xsd_validation_failed");
});

test("UBL XSD mapper sanitizes raw XML-like content from technical messages", () => {
  const technicalMessage = normalizeXsdTechnicalMessage(
    "Schemas validity error : Element 'cbc:IssueDate': '2026-foo <cbc:ID>INV-SECRET-001</cbc:ID>' is not a valid value of the atomic type 'xs:date'."
  );

  assert.doesNotMatch(technicalMessage, /<cbc:ID>/);
  assert.doesNotMatch(technicalMessage, /INV-SECRET-001/);
  assert.doesNotMatch(technicalMessage, /<\/cbc:ID>/);
  assert.match(technicalMessage, /\[value\]/);
});

test("UBL XSD mapper infers common UBL fields where safe", () => {
  assert.equal(
    inferUblFieldFromXsdError(
      rawError(
        "Schemas validity error : Element 'cbc:IssueDate': [value] is not a valid value of the atomic type 'xs:date'."
      ),
      {
        rootElement: "Invoice",
        documentType: "invoice"
      }
    ),
    "document.issueDate"
  );
  assert.equal(
    inferUblFieldFromXsdError(
      rawError(
        "Schemas validity error : Element 'cac:AccountingSupplierParty': Missing child element(s). Expected is ( cac:Party )."
      ),
      {
        rootElement: "Invoice",
        documentType: "invoice"
      }
    ),
    "seller"
  );
  assert.equal(
    inferUblFieldFromXsdError(
      rawError(
        "Schemas validity error : Element 'cbc:InvoicedQuantity': [value] is not a valid value of the atomic type 'xs:decimal'."
      ),
      {
        rootElement: "Invoice",
        documentType: "invoice"
      }
    ),
    "lines.quantity"
  );
  assert.equal(
    inferUblFieldFromXsdError(
      rawError(
        "Schemas validity error : Element 'BadRoot': No matching global declaration available for the validation root."
      ),
      {
        rootElement: "BadRoot",
        documentType: "unknown"
      }
    ),
    "xml.schema"
  );
});
