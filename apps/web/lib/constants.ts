export const audiences = [
  "Freelancers",
  "SMEs",
  "Accounting students",
  "Accountants",
  "Developers",
  "EU invoice testers"
];

export const workflowSteps = [
  {
    title: "Create structured invoice data",
    description:
      "Seller, buyer, line items, VAT categories, payment terms, references, and totals are entered as structured data instead of being trapped in a static image."
  },
  {
    title: "Run canonical model checks",
    description:
      "Every input normalizes into a single CanonicalInvoice shape before export, parsing, validation, reporting, or API usage."
  },
  {
    title: "Generate UBL XML",
    description:
      "The platform prepares standards-oriented XML output that can be inspected, downloaded, parsed, and validated."
  },
  {
    title: "Explain the validation result",
    description:
      "Findings show severity, source, legal-confidence level, field path, rule version, and a human fix suggestion."
  }
];

export const validationLayers = [
  {
    title: "Input schema",
    description:
      "Rejects malformed payloads, unexpected fields, invalid dates, oversized strings, and unsafe structures before business logic runs.",
    confidence: "Technical"
  },
  {
    title: "Canonical invoice model",
    description:
      "Maps form data, JSON payloads, and uploaded XML into one internal model for consistent validation and export.",
    confidence: "Technical"
  },
  {
    title: "Decimal calculation logic",
    description:
      "Checks line net amounts, VAT breakdowns, allowances, charges, totals, and payable amount using decimal-safe arithmetic.",
    confidence: "Technical"
  },
  {
    title: "VAT-number format",
    description:
      "Checks country-specific VAT ID patterns locally and separates format validity from actual VAT-number validity.",
    confidence: "Standard-based"
  },
  {
    title: "VIES evidence",
    description:
      "Stores timestamped VAT-number check evidence when VIES is available, while clearly marking unavailable or inconclusive states.",
    confidence: "Official-source-derived"
  },
  {
    title: "UBL XML mapping",
    description:
      "Checks whether canonical invoice data can be represented as UBL and parsed back without losing critical meaning.",
    confidence: "Standard-based"
  },
  {
    title: "EN 16931 / Peppol-style rules",
    description:
      "Runs selected semantic and business-rule checks with visible source labels and rule-set versions.",
    confidence: "Standard-based"
  },
  {
    title: "Country-pack simulation",
    description:
      "Applies reviewed country context without claiming national tax compliance or official acceptance.",
    confidence: "Educational simulation"
  },
  {
    title: "ViDA-readiness simulation",
    description:
      "Classifies whether a transaction appears relevant for future EU digital-reporting readiness discussions.",
    confidence: "Educational simulation"
  }
];

export const legalBoundaries = [
  {
    title: "Independent",
    description:
      "Not affiliated with, endorsed by, or operated by EU institutions, national tax authorities, OpenPeppol, or Peppol authorities."
  },
  {
    title: "Technical",
    description:
      "Focused on invoice structure, XML formats, calculations, rule-pack simulation, and developer testing — not legal conclusions."
  },
  {
    title: "Professional review required",
    description:
      "Validation output never certifies tax, legal, accounting, filing, or authority acceptance. Real decisions require qualified review."
  }
];