import { invoiceEditorDraft } from "../../../../lib/mock-data";
import { InvoiceEditorClient } from "./invoice-editor-client";

export default function NewInvoicePage() {
  return <InvoiceEditorClient initialDraft={invoiceEditorDraft} />;
}
