import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { after, before, test } from "node:test";
import { canonicalToCiiInvoiceXml } from "@invoice-lantern/cii";
import type { CanonicalInvoice } from "@invoice-lantern/invoice-core";
import { buildApp } from "../../app.js";
import { env } from "../../config/env.js";
import {
  API_RATE_LIMIT_POLICIES
} from "../../services/api-rate-limit-policy.js";
import {
  createTestOrganizationApiKey,
  installSignedUserAndApiKeyTestAuth,
  resetSignedUserAndApiKeyTestAuth,
  testBearerToken
} from "../../test/auth-test-helpers.js";

const invoiceDraftDataPath = join(process.cwd(), ".data", "invoice-drafts.json");
const exportDataPath = join(process.cwd(), ".data", "invoice-exports.json");

let originalInvoiceDraftData: string | null = null;
let originalExportData: string | null = null;
let authRepository: ReturnType<typeof installSignedUserAndApiKeyTestAuth>;

const canonicalInvoice: CanonicalInvoice = {
  profile: "EN16931",
  document: {
    type: "invoice",
    number: "INV-CII-ROUTE-001",
    issueDate: "2026-05-15",
    dueDate: "2026-06-14",
    taxPointDate: "",
    currency: "EUR",
    profile: "EN16931",
    buyerReference: "",
    contractReference: "",
    orderReference: "",
    projectReference: "",
    accountingCost: ""
  },
  seller: {
    name: "Invoice Lantern Seller GmbH",
    legalName: "Invoice Lantern Seller GmbH",
    country: "DE",
    vatId: "DE123456789",
    taxRegistrationNumber: "",
    electronicAddress: "seller@example.test",
    electronicAddressScheme: "EM",
    email: "seller@example.test",
    phone: "",
    city: "Berlin",
    postalCode: "10115",
    street: "Seller Street 1",
    additionalStreet: "",
    region: "",
    address: {
      street: "Seller Street 1",
      additionalStreet: "",
      city: "Berlin",
      postalCode: "10115",
      region: "",
      country: "DE"
    }
  },
  buyer: {
    name: "Invoice Lantern Buyer GmbH",
    legalName: "Invoice Lantern Buyer GmbH",
    country: "DE",
    vatId: "DE987654321",
    taxRegistrationNumber: "",
    electronicAddress: "buyer@example.test",
    electronicAddressScheme: "EM",
    email: "buyer@example.test",
    phone: "",
    city: "Munich",
    postalCode: "80331",
    street: "Buyer Street 2",
    additionalStreet: "",
    region: "",
    address: {
      street: "Buyer Street 2",
      additionalStreet: "",
      city: "Munich",
      postalCode: "80331",
      region: "",
      country: "DE"
    }
  },
  payment: {
    paymentMeansCode: "",
    paymentReference: "INV-CII-ROUTE-001",
    terms: "Due within 30 days.",
    dueDate: "2026-06-14",
    accountLabel: "",
    accountLast4: ""
  },
  lines: [
    {
      id: "1",
      description: "Technical CII route test service",
      itemName: "Technical CII route test service",
      quantity: "2.00",
      unitCode: "EA",
      unitPrice: "100.00",
      discountAmount: "",
      chargeAmount: "",
      netAmount: "200.00",
      taxAmount: "38.00",
      vatCategory: "S",
      vatRate: "19",
      accountingCost: "",
      orderLineReference: ""
    }
  ],
  allowances: [],
  charges: [],
  taxBreakdown: [
    {
      taxCategory: "S",
      taxScheme: "VAT",
      vatCategory: "S",
      vatRate: "19",
      taxableAmount: "200.00",
      taxAmount: "38.00",
      exemptionReason: "",
      exemptionReasonCode: ""
    }
  ],
  taxSubtotals: [
    {
      taxCategory: "S",
      taxScheme: "VAT",
      vatCategory: "S",
      vatRate: "19",
      taxableAmount: "200.00",
      taxAmount: "38.00",
      exemptionReason: "",
      exemptionReasonCode: ""
    }
  ],
  totals: {
    lineExtensionAmount: "200.00",
    allowanceTotalAmount: "",
    chargeTotalAmount: "",
    taxExclusiveAmount: "200.00",
    taxAmount: "38.00",
    taxTotalAmount: "38.00",
    taxInclusiveAmount: "238.00",
    prepaidAmount: "",
    payableRoundingAmount: "",
    payableAmount: "238.00"
  },
  metadata: {},
  legal: {
    legalConfidence: "technical",
    disclaimer:
      "Invoice Lantern technical test invoice. Professional review required."
  }
};

const importableUblInvoiceXml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:invoice-lantern:test:1</cbc:CustomizationID>
  <cbc:ProfileID>EN16931</cbc:ProfileID>
  <cbc:ID>INV-UBL-IMPORT-SECURITY-001</cbc:ID>
  <cbc:IssueDate>2026-05-15</cbc:IssueDate>
  <cbc:DueDate>2026-06-14</cbc:DueDate>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>Invoice Lantern Seller GmbH</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>Seller Street 1</cbc:StreetName>
        <cbc:CityName>Berlin</cbc:CityName>
        <cbc:PostalZone>10115</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>DE</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>DE123456789</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>Invoice Lantern Buyer GmbH</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>Buyer Street 2</cbc:StreetName>
        <cbc:CityName>Munich</cbc:CityName>
        <cbc:PostalZone>80331</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>DE</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>DE987654321</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="EUR">38.00</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="EUR">200.00</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="EUR">38.00</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>19</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="EUR">200.00</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="EUR">200.00</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="EUR">238.00</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="EUR">238.00</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  <cac:InvoiceLine>
    <cbc:ID>1</cbc:ID>
    <cbc:InvoicedQuantity unitCode="EA">2.00</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="EUR">200.00</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Description>Technical UBL import route test service</cbc:Description>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>19</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="EUR">100.00</cbc:PriceAmount></cac:Price>
  </cac:InvoiceLine>
</Invoice>`;

before(async () => {
  authRepository = installSignedUserAndApiKeyTestAuth();
  originalInvoiceDraftData = await readOptionalFile(invoiceDraftDataPath);
  originalExportData = await readOptionalFile(exportDataPath);

  await rm(invoiceDraftDataPath, { force: true });
  await rm(exportDataPath, { force: true });
});

after(async () => {
  resetSignedUserAndApiKeyTestAuth();
  await restoreFile(invoiceDraftDataPath, originalInvoiceDraftData);
  await restoreFile(exportDataPath, originalExportData);
});

async function readOptionalFile(path: string) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return null;
    }

    throw error;
  }
}

async function restoreFile(path: string, content: string | null) {
  if (content === null) {
    await rm(path, { force: true });
    return;
  }

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
}

async function readStoredRecords(path: string) {
  const content = await readOptionalFile(path);

  if (!content) {
    return [];
  }

  const parsed = JSON.parse(content) as Record<string, unknown>;

  return Array.isArray(parsed.records)
    ? (parsed.records as Record<string, unknown>[])
    : [];
}

function getFindings(body: Record<string, unknown>) {
  assert.equal(Array.isArray(body.findings), true);

  return body.findings as Record<string, unknown>[];
}

async function withApp<T>(callback: (app: Awaited<ReturnType<typeof buildApp>>) => Promise<T>) {
  const app = await buildApp();

  try {
    return await callback(app);
  } finally {
    await app.close();
  }
}

test("CII import rejects organization API keys", async () => {
  const created = await createTestOrganizationApiKey(["invoices:import_cii"]);

  await withApp(async (app) => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/invoices/import/cii",
      headers: {
        "x-api-key": created.secret,
        "content-type": "application/xml"
      },
      payload: canonicalToCiiInvoiceXml(canonicalInvoice)
    });

    assert.equal(response.statusCode, 401);
    assert.match(response.body, /API key authentication is not allowed/);
  });
});

test("CII import rejects development API keys", async () => {
  await withApp(async (app) => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/invoices/import/cii",
      headers: {
        "x-api-key": env.DEV_API_KEY,
        "content-type": "application/xml"
      },
      payload: canonicalToCiiInvoiceXml(canonicalInvoice)
    });

    assert.equal(response.statusCode, 401);
    assert.match(response.body, /API key authentication is not allowed/);
  });
});

test("CII import requires signed-user auth", async () => {
  await withApp(async (app) => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/invoices/import/cii",
      headers: {
        "content-type": "application/xml"
      },
      payload: canonicalToCiiInvoiceXml(canonicalInvoice)
    });

    assert.equal(response.statusCode, 401);
    assert.match(response.body, /AUTH_TOKEN_REQUIRED/);
  });
});

test("signed-user CII import creates an editable draft", async () => {
  await withApp(async (app) => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/invoices/import/cii",
      headers: {
        authorization: `Bearer ${testBearerToken}`,
        "content-type": "application/xml"
      },
      payload: canonicalToCiiInvoiceXml(canonicalInvoice)
    });

    assert.equal(response.statusCode, 201);

    const body = response.json() as Record<string, unknown>;

    assert.equal(body.created, true);
    assert.equal(body.source, "cii_import");
    assert.match(String(body.disclaimer), /not official CII certification/i);

    const draftRecords = await readStoredRecords(invoiceDraftDataPath);
    const createdDraft = draftRecords.find(
      (record) => record.id === body.invoiceDraftId
    );

    assert.ok(createdDraft);
    assert.equal(
      ((createdDraft.document as Record<string, unknown>) ?? {}).number,
      "INV-CII-ROUTE-001"
    );
    assert.equal(JSON.stringify(draftRecords).includes("<rsm:CrossIndustryInvoice"), false);
  });
});

test("UBL import rejects organization and development API keys", async () => {
  const created = await createTestOrganizationApiKey(["invoices:import_ubl"]);

  await withApp(async (app) => {
    const organizationResponse = await app.inject({
      method: "POST",
      url: "/api/v1/invoices/import/ubl",
      headers: {
        "x-api-key": created.secret,
        "content-type": "application/xml"
      },
      payload: importableUblInvoiceXml
    });
    const developmentResponse = await app.inject({
      method: "POST",
      url: "/api/v1/invoices/import/ubl",
      headers: {
        "x-api-key": env.DEV_API_KEY,
        "content-type": "application/xml"
      },
      payload: importableUblInvoiceXml
    });

    assert.equal(organizationResponse.statusCode, 401);
    assert.equal(developmentResponse.statusCode, 401);
  });
});

test("UBL import requires signed-user auth and signed users can create drafts", async () => {
  await withApp(async (app) => {
    const unsignedResponse = await app.inject({
      method: "POST",
      url: "/api/v1/invoices/import/ubl",
      headers: {
        "content-type": "application/xml"
      },
      payload: importableUblInvoiceXml
    });
    const signedResponse = await app.inject({
      method: "POST",
      url: "/api/v1/invoices/import/ubl",
      headers: {
        authorization: `Bearer ${testBearerToken}`,
        "content-type": "application/xml"
      },
      payload: importableUblInvoiceXml
    });

    assert.equal(unsignedResponse.statusCode, 401);
    assert.equal(signedResponse.statusCode, 201);
    assert.equal(signedResponse.json().created, true);
  });
});

test("CII export returns technical XML and persists cii_invoice metadata", async () => {
  const created = await createTestOrganizationApiKey(["invoices:export_cii"]);

  await withApp(async (app) => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/invoices/export/cii",
      headers: {
        "x-api-key": created.secret
      },
      payload: canonicalInvoice
    });

    assert.equal(response.statusCode, 200);

    const body = response.json() as Record<string, unknown>;
    const xml = String(body.xml);

    assert.match(xml, /<rsm:CrossIndustryInvoice/);
    assert.equal(body.contentType, "application/xml; charset=utf-8");
    assert.equal(body.xmlSha256, createHash("sha256").update(xml).digest("hex"));
    assert.match(String(body.disclaimer), /not official CII certification/i);

    const exportRecords = await readStoredRecords(exportDataPath);
    const exportRecord = exportRecords.find((record) => record.id === body.exportId);

    assert.ok(exportRecord);
    assert.equal(exportRecord.exportType, "cii_invoice");
    assert.equal("xml" in exportRecord, false);
  });
});

test("CII export rejects invalid canonical invoice", async () => {
  const created = await createTestOrganizationApiKey(["invoices:export_cii"]);

  await withApp(async (app) => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/invoices/export/cii",
      headers: {
        "x-api-key": created.secret
      },
      payload: {
        document: {
          number: "BROKEN"
        }
      }
    });

    assert.equal(response.statusCode, 400);
    assert.match(response.body, /VALIDATION_ERROR/);
  });
});

test("CII parse parses generated XML and rejects unsafe XML", async () => {
  const created = await createTestOrganizationApiKey(["invoices:parse_cii"]);

  await withApp(async (app) => {
    const parsedResponse = await app.inject({
      method: "POST",
      url: "/api/v1/invoices/parse/cii",
      headers: {
        "x-api-key": created.secret,
        "content-type": "application/xml"
      },
      payload: canonicalToCiiInvoiceXml(canonicalInvoice)
    });
    const unsafeResponse = await app.inject({
      method: "POST",
      url: "/api/v1/invoices/parse/cii",
      headers: {
        "x-api-key": created.secret,
        "content-type": "application/xml"
      },
      payload: `<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100">&xxe;</rsm:CrossIndustryInvoice>`
    });

    assert.equal(parsedResponse.statusCode, 200);
    assert.equal(parsedResponse.json().parsed, true);
    assert.equal(unsafeResponse.statusCode, 400);

    const unsafeBody = unsafeResponse.json() as Record<string, unknown>;

    assert.equal(unsafeBody.parsed, false);
    assert.equal(
      getFindings(unsafeBody).some(
        (finding) => finding.code === "XML_DOCTYPE_BLOCKED"
      ),
      true
    );
  });
});

test("CII API scopes are enforced for export and parse", async () => {
  const validationKey = await createTestOrganizationApiKey(["invoices:validate"]);

  await withApp(async (app) => {
    const exportResponse = await app.inject({
      method: "POST",
      url: "/api/v1/invoices/export/cii",
      headers: {
        "x-api-key": validationKey.secret
      },
      payload: canonicalInvoice
    });
    const parseResponse = await app.inject({
      method: "POST",
      url: "/api/v1/invoices/parse/cii",
      headers: {
        "x-api-key": validationKey.secret,
        "content-type": "application/xml"
      },
      payload: canonicalToCiiInvoiceXml(canonicalInvoice)
    });

    assert.equal(exportResponse.statusCode, 403);
    assert.equal(parseResponse.statusCode, 403);
    assert.match(exportResponse.body, /API_KEY_SCOPE_INSUFFICIENT/);
    assert.match(parseResponse.body, /API_KEY_SCOPE_INSUFFICIENT/);
  });
});

test("CII rate-limit policy is registered", () => {
  assert.equal(
    API_RATE_LIMIT_POLICIES.invoices_export_cii.requestPathPrefix,
    "/api/v1/invoices/export/cii"
  );
  assert.equal(
    API_RATE_LIMIT_POLICIES.invoices_parse_cii.requestPathPrefix,
    "/api/v1/invoices/parse/cii"
  );
});

test("production invoice CII export requires signed-user workspace role", async () => {
  authRepository.membershipRole = "viewer";

  await withApp(async (app) => {
    const apiKeyResponse = await app.inject({
      method: "POST",
      url: "/api/v1/invoices/00000000-0000-4000-8000-000000000999/export/cii",
      headers: {
        "x-api-key": env.DEV_API_KEY
      }
    });
    const viewerResponse = await app.inject({
      method: "POST",
      url: "/api/v1/invoices/00000000-0000-4000-8000-000000000999/export/cii",
      headers: {
        authorization: `Bearer ${testBearerToken}`
      }
    });

    assert.equal(apiKeyResponse.statusCode, 401);
    assert.equal(viewerResponse.statusCode, 403);
    assert.match(viewerResponse.body, /PRODUCTION_INVOICE_EXPORT_ROLE_REQUIRED/);
  });

  authRepository.membershipRole = "admin";
});
