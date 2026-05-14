import {
  getCountryPack,
  listCountryPacks,
  normalizeCountryCode,
  type CountryPack
} from "@invoice-lantern/country-packs";
import {
  getSupabaseServiceRoleClient,
  hasSupabaseServerConfig
} from "../lib/supabase/server-client.js";

export type CountryPackRegistryRow = {
  country_code: string;
  country_name: string;
  pack_version: string;
  lifecycle_status:
    | "draft"
    | "internal_review"
    | "published"
    | "deprecated"
    | "archived";
  legal_confidence:
    | "technical"
    | "standard_based"
    | "official_source_derived"
    | "educational_simulation"
    | "professional_review_required";
  source_count: number;
  rule_count: number;
  supports_vat_rules: boolean;
  supports_invoice_rules: boolean;
  supports_peppol_rules: boolean;
  supports_vi_da_readiness: boolean;
  summary: string;
  disclaimer: string;
  published_at: string | null;
  deprecated_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CountryPackRegistryMetadata = {
  registrySource: "database" | "bundled";
  packVersion: string;
  lifecycleStatus: CountryPackRegistryRow["lifecycle_status"];
  legalConfidence: CountryPackRegistryRow["legal_confidence"];
  sourceCount: number;
  ruleCount: number;
  capabilities: {
    vatRules: boolean;
    invoiceRules: boolean;
    peppolRules: boolean;
    vidaReadiness: boolean;
  };
  summary: string;
  disclaimer: string;
  publishedAt: string | null;
  deprecatedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type CountryPackCatalogItem = CountryPack & {
  registry: CountryPackRegistryMetadata;
};

export type CountryPackCatalog = {
  countryPacks: CountryPackCatalogItem[];
  count: number;
  disclaimer: string;
  registrySource: "database" | "bundled";
};

const COUNTRY_PACK_CATALOG_DISCLAIMER =
  "Country rule packs are educational simulations and do not provide legal, tax, accounting, filing, or compliance advice.";

function toBundledRegistryMetadata(pack: CountryPack): CountryPackRegistryMetadata {
  return {
    registrySource: "bundled",
    packVersion: pack.version,
    lifecycleStatus: "published",
    legalConfidence: pack.legalConfidence,
    sourceCount: pack.sourceReferences.length,
    ruleCount: pack.rules.length,
    capabilities: {
      vatRules: pack.vatNumber.localFormatCheck,
      invoiceRules: pack.rules.some((rule) => rule.category === "E_INVOICING"),
      peppolRules: pack.rules.some((rule) => rule.category === "COUNTRY_PACK"),
      vidaReadiness: pack.rules.some(
        (rule) => rule.category === "VIDA_SIMULATION"
      )
    },
    summary:
      "Bundled country-pack metadata is being used because the database registry is not configured or unavailable.",
    disclaimer: pack.disclaimer,
    publishedAt: null,
    deprecatedAt: null,
    createdAt: null,
    updatedAt: null
  };
}

function toCatalogItemFromBundledPack(pack: CountryPack): CountryPackCatalogItem {
  return {
    ...pack,
    registry: toBundledRegistryMetadata(pack)
  };
}

function toRegistryMetadata(row: CountryPackRegistryRow): CountryPackRegistryMetadata {
  return {
    registrySource: "database",
    packVersion: row.pack_version,
    lifecycleStatus: row.lifecycle_status,
    legalConfidence: row.legal_confidence,
    sourceCount: row.source_count,
    ruleCount: row.rule_count,
    capabilities: {
      vatRules: row.supports_vat_rules,
      invoiceRules: row.supports_invoice_rules,
      peppolRules: row.supports_peppol_rules,
      vidaReadiness: row.supports_vi_da_readiness
    },
    summary: row.summary,
    disclaimer: row.disclaimer,
    publishedAt: row.published_at,
    deprecatedAt: row.deprecated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mergeRegistryRowsWithBundledPacks(
  rows: CountryPackRegistryRow[]
): CountryPackCatalogItem[] {
  const rowsByCountryCode = new Map(
    rows.map((row) => [row.country_code, row])
  );

  return listCountryPacks().map((pack) => {
    const row = rowsByCountryCode.get(pack.countryCode);

    if (!row) {
      return toCatalogItemFromBundledPack(pack);
    }

    return {
      ...pack,
      status:
        row.lifecycle_status === "published"
          ? pack.status
          : "professional_review_required",
      version: row.pack_version,
      legalConfidence: row.legal_confidence,
      disclaimer: row.disclaimer || pack.disclaimer,
      registry: toRegistryMetadata(row)
    };
  });
}

async function listPublishedCountryPackRegistryRows() {
  const supabase = getSupabaseServiceRoleClient();

  const { data, error } = await supabase
    .from("country_pack_registry")
    .select(
      "country_code, country_name, pack_version, lifecycle_status, legal_confidence, source_count, rule_count, supports_vat_rules, supports_invoice_rules, supports_peppol_rules, supports_vi_da_readiness, summary, disclaimer, published_at, deprecated_at, created_at, updated_at"
    )
    .eq("lifecycle_status", "published")
    .order("country_code", {
      ascending: true
    });

  if (error) {
    throw new Error(`Could not list country pack registry: ${error.message}`);
  }

  return (data ?? []) as CountryPackRegistryRow[];
}

function toBundledCountryPackCatalog(): CountryPackCatalog {
  const countryPacks = listCountryPacks().map(toCatalogItemFromBundledPack);

  return {
    countryPacks,
    count: countryPacks.length,
    disclaimer: COUNTRY_PACK_CATALOG_DISCLAIMER,
    registrySource: "bundled"
  };
}

export async function listCountryPackCatalog(): Promise<CountryPackCatalog> {
  if (!hasSupabaseServerConfig()) {
    return toBundledCountryPackCatalog();
  }

  try {
    const registryRows = await listPublishedCountryPackRegistryRows();
    const countryPacks = mergeRegistryRowsWithBundledPacks(registryRows);

    return {
      countryPacks,
      count: countryPacks.length,
      disclaimer: COUNTRY_PACK_CATALOG_DISCLAIMER,
      registrySource: "database"
    };
  } catch (error) {
    console.warn(
      "Database country pack registry was unavailable; using bundled country packs.",
      error
    );

    return toBundledCountryPackCatalog();
  }
}

export async function getCountryPackCatalogItem(
  countryCode: string
): Promise<CountryPackCatalogItem | null> {
  const normalizedCountryCode = normalizeCountryCode(countryCode);
  const catalog = await listCountryPackCatalog();
  const catalogItem = catalog.countryPacks.find(
    (pack) => pack.countryCode === normalizedCountryCode
  );

  if (catalogItem) {
    return catalogItem;
  }

  const bundledPack = getCountryPack(normalizedCountryCode);

  return bundledPack ? toCatalogItemFromBundledPack(bundledPack) : null;
}
