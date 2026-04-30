import PDFDocument from "pdfkit";
import type {
  Finding,
  ValidationRunRecord
} from "../repositories/validation-run-repository.js";
import {
  VALIDATION_REPORT_DISCLAIMER,
  buildValidationReportSummary,
  type ValidationReportFindingCounts,
  type ValidationReportSummary
} from "./validation-report-summary.js";

type PdfDocumentInstance = InstanceType<typeof PDFDocument>;

type ValidationReportPdfInput = {
  run: ValidationRunRecord;
  reportSummary?: ValidationReportSummary;
  generatedAt?: Date;
};

const PAGE_MARGIN = 50;
const FOOTER_HEIGHT = 34;

function formatDateTime(date: Date) {
  return date.toISOString();
}

function formatStatus(value: string) {
  return value.replaceAll("_", " ");
}

function hasText(value: string | undefined | null): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeText(value: string | undefined | null) {
  return hasText(value) ? value.trim() : "";
}

function addFooter(
  doc: PdfDocumentInstance,
  generatedAt: string,
  pageNumber: number
) {
  const previousX = doc.x;
  const previousY = doc.y;

  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor("#6b7280")
    .text(
      `Invoice Lantern - independent sandbox - generated ${generatedAt}`,
      PAGE_MARGIN,
      doc.page.height - PAGE_MARGIN - 10,
      {
        width: doc.page.width - PAGE_MARGIN * 2,
        align: "left",
        lineBreak: false
      }
    )
    .text(`Page ${pageNumber}`, PAGE_MARGIN, doc.page.height - PAGE_MARGIN - 10, {
      width: doc.page.width - PAGE_MARGIN * 2,
      align: "right",
      lineBreak: false
    });

  doc.x = previousX;
  doc.y = previousY;
}

function ensureSpace(doc: PdfDocumentInstance, neededHeight: number) {
  if (doc.y + neededHeight > doc.page.height - PAGE_MARGIN - FOOTER_HEIGHT) {
    doc.addPage();
  }
}

function addSectionTitle(doc: PdfDocumentInstance, title: string) {
  ensureSpace(doc, 44);
  doc.moveDown(1.1);
  doc
    .font("Helvetica-Bold")
    .fontSize(13)
    .fillColor("#111827")
    .text(title);
  doc.moveDown(0.45);
  doc
    .moveTo(PAGE_MARGIN, doc.y)
    .lineTo(doc.page.width - PAGE_MARGIN, doc.y)
    .strokeColor("#d1d5db")
    .lineWidth(0.75)
    .stroke();
  doc.moveDown(0.55);
}

function addKeyValueRow(doc: PdfDocumentInstance, label: string, value: string) {
  if (!hasText(value)) {
    return;
  }

  ensureSpace(doc, 30);
  const startY = doc.y;
  const labelWidth = 145;
  const valueWidth = doc.page.width - PAGE_MARGIN * 2 - labelWidth;

  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor("#374151")
    .text(label, PAGE_MARGIN, startY, {
      width: labelWidth
    });
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#111827")
    .text(value, PAGE_MARGIN + labelWidth, startY, {
      width: valueWidth
    });
  doc.moveDown(0.45);
}

function addParagraph(doc: PdfDocumentInstance, value: string) {
  if (!hasText(value)) {
    return;
  }

  ensureSpace(doc, 42);
  doc
    .font("Helvetica")
    .fontSize(9.5)
    .fillColor("#111827")
    .text(value, {
      width: doc.page.width - PAGE_MARGIN * 2,
      lineGap: 2
    });
  doc.moveDown(0.6);
}

function addList(doc: PdfDocumentInstance, values: string[]) {
  for (const value of values) {
    if (!hasText(value)) {
      continue;
    }

    ensureSpace(doc, 34);
    doc
      .font("Helvetica")
      .fontSize(9.5)
      .fillColor("#111827")
      .text(`- ${value}`, {
        width: doc.page.width - PAGE_MARGIN * 2,
        lineGap: 2
      });
    doc.moveDown(0.25);
  }

  doc.moveDown(0.25);
}

function formatFindingCounts(counts: ValidationReportFindingCounts) {
  return `Info: ${counts.info} | Warning: ${counts.warning} | Fatal: ${counts.fatal} | Blocked: ${counts.blocked}`;
}

function formatRuleSets(summary: ValidationReportSummary) {
  if (summary.ruleSetsUsed.length === 0) {
    return ["No finding-level rule set metadata returned."];
  }

  return summary.ruleSetsUsed.map((ruleSet) => {
    const sources =
      ruleSet.sourceLabels.length > 0
        ? ` Sources: ${ruleSet.sourceLabels.join(", ")}.`
        : "";

    return `${ruleSet.code} version ${ruleSet.version}.${sources}`;
  });
}

function formatParty(name: string, country?: string) {
  const safeName = normalizeText(name);
  const safeCountry = normalizeText(country);

  if (safeName && safeCountry) {
    return `${safeName} (${safeCountry})`;
  }

  return safeName || safeCountry;
}

function addReportHeader(
  doc: PdfDocumentInstance,
  run: ValidationRunRecord,
  generatedAt: string
) {
  doc
    .font("Helvetica-Bold")
    .fontSize(20)
    .fillColor("#111827")
    .text("Invoice Lantern");
  doc
    .font("Helvetica-Bold")
    .fontSize(15)
    .fillColor("#111827")
    .text("Validation report");
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#374151")
    .text("Independent technical sandbox");
  doc.moveDown(0.55);

  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor("#92400e")
    .text("Non-official technical sandbox report", {
      continued: false
    });
  doc.moveDown(0.65);

  addKeyValueRow(doc, "Report generated", generatedAt);
  addKeyValueRow(doc, "Validation run ID", run.id);
}

function addSummarySection(
  doc: PdfDocumentInstance,
  run: ValidationRunRecord,
  summary: ValidationReportSummary
) {
  addSectionTitle(doc, "Report summary");
  addKeyValueRow(doc, "Overall status", formatStatus(summary.overallStatus));
  addKeyValueRow(doc, "Technical status", formatStatus(summary.technicalStatus));
  addKeyValueRow(doc, "Created date", summary.createdAt);
  addKeyValueRow(doc, "Finding counts", formatFindingCounts(summary.findingCounts));
  addKeyValueRow(doc, "Legal confidence", summary.legalConfidenceSummary);
  addKeyValueRow(doc, "Run confidence", formatStatus(run.confidence));
  addKeyValueRow(doc, "Rule sets used", formatRuleSets(summary).join("\n"));
}

function addInvoiceSummarySection(
  doc: PdfDocumentInstance,
  run: ValidationRunRecord
) {
  addSectionTitle(doc, "Invoice summary");
  addKeyValueRow(doc, "Invoice number", run.invoiceNumber);
  addKeyValueRow(doc, "Issue date", normalizeText(run.issueDate));
  addKeyValueRow(doc, "Currency", run.currency);
  addKeyValueRow(doc, "Seller", formatParty(run.seller, run.sellerCountry));
  addKeyValueRow(doc, "Buyer", formatParty(run.buyer, run.buyerCountry));
  addKeyValueRow(doc, "Payable amount", run.totals.payableAmount);
  addKeyValueRow(doc, "Tax amount", run.totals.taxAmount);
}

function formatFindingMetadata(finding: Finding) {
  const metadata = [
    `Legal confidence: ${formatStatus(finding.legalConfidence)}`,
    finding.code ? `Rule code: ${finding.code}` : "",
    finding.ruleSetCode ? `Rule set: ${finding.ruleSetCode}` : "",
    finding.ruleVersion ? `Rule version: ${finding.ruleVersion}` : "",
    finding.sourceLabels && finding.sourceLabels.length > 0
      ? `Source labels: ${finding.sourceLabels.join(", ")}`
      : ""
  ].filter(hasText);

  return metadata.join(" | ");
}

function addFinding(doc: PdfDocumentInstance, finding: Finding, index: number) {
  ensureSpace(doc, 105);
  doc
    .font("Helvetica-Bold")
    .fontSize(10.5)
    .fillColor("#111827")
    .text(`${index + 1}. ${finding.severity.toUpperCase()} - ${finding.category}`);

  addKeyValueRow(doc, "Field path", finding.fieldPath || finding.field);
  addKeyValueRow(doc, "Message", finding.message);
  addKeyValueRow(doc, "Fix suggestion", normalizeText(finding.fixSuggestion));
  addKeyValueRow(doc, "Rule metadata", formatFindingMetadata(finding));
  doc.moveDown(0.35);
}

function addFindingsSection(doc: PdfDocumentInstance, findings: Finding[]) {
  addSectionTitle(doc, "Findings");

  if (findings.length === 0) {
    addParagraph(
      doc,
      "No selected technical findings were returned by this sandbox validation run."
    );
    return;
  }

  findings.forEach((finding, index) => addFinding(doc, finding, index));
}

function collectPdfBuffer(doc: PdfDocumentInstance) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    doc.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
    doc.on("error", reject);
  });
}

export async function generateValidationReportPdf({
  run,
  reportSummary = buildValidationReportSummary(run),
  generatedAt = new Date()
}: ValidationReportPdfInput) {
  const generatedAtIso = formatDateTime(generatedAt);
  const doc = new PDFDocument({
    size: "A4",
    margin: PAGE_MARGIN,
    bufferPages: false,
    compress: false,
    info: {
      Title: "Invoice Lantern validation report",
      Author: "Invoice Lantern",
      Subject: "Non-official technical sandbox validation report"
    }
  });
  const pdfBufferPromise = collectPdfBuffer(doc);
  let pageNumber = 1;

  addFooter(doc, generatedAtIso, pageNumber);
  doc.on("pageAdded", () => {
    pageNumber += 1;
    addFooter(doc, generatedAtIso, pageNumber);
  });

  addReportHeader(doc, run, generatedAtIso);
  addSummarySection(doc, run, reportSummary);
  addInvoiceSummarySection(doc, run);
  addFindingsSection(doc, run.findings);

  addSectionTitle(doc, "Recommended next actions");
  addList(doc, reportSummary.recommendedNextActions);

  addSectionTitle(doc, "Required disclaimer");
  addParagraph(doc, reportSummary.disclaimer || VALIDATION_REPORT_DISCLAIMER);

  doc.end();

  return pdfBufferPromise;
}
