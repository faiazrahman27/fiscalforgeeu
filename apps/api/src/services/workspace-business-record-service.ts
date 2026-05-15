import type { SupabaseClient } from "@supabase/supabase-js";
import {
  WORKSPACE_ROLE_SETS,
  type WorkspaceAuthorizationContext,
  type WorkspaceRole
} from "../middleware/require-workspace-role.js";
import {
  ProductionDataModelRepositoryError,
  createBusinessProfile,
  createContact,
  getBusinessProfileById,
  getContactById,
  listBusinessProfiles,
  listContacts,
  updateBusinessProfileById,
  updateContactById,
  type BusinessProfileListFilters,
  type BusinessProfileRecord,
  type ContactListFilters,
  type ContactRecord
} from "../repositories/production-data-model-repository.js";
import {
  businessProfileCreateSchema,
  businessProfileUpdateSchema,
  contactCreateSchema,
  contactUpdateSchema,
  type BusinessProfileCreateData,
  type BusinessProfileCreateInput,
  type BusinessProfileUpdateInput,
  type ContactCreateData,
  type ContactCreateInput,
  type ContactUpdateInput
} from "../schemas/production-data-model.js";
import {
  getSupabaseUserClient,
  hasSupabaseServerConfig
} from "../lib/supabase/server-client.js";

type JsonObject = Record<string, unknown>;

export type WorkspaceBusinessProfileResponse = BusinessProfileCreateData & {
  id: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceContactResponse = ContactCreateData & {
  id: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
};

type BusinessProfilePatchData = Partial<BusinessProfileCreateData>;
type ContactPatchData = Partial<ContactCreateData>;

type SupabaseBusinessProfileRow = {
  id: string;
  organization_id: string;
  profile_type: "seller" | "buyer" | "both";
  display_name: string;
  legal_name: string | null;
  trading_name: string | null;
  country_code: string;
  vat_id: string | null;
  tax_registration_number: string | null;
  electronic_address: string | null;
  electronic_address_scheme: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country_subdivision: string | null;
  default_currency: string | null;
  payment_terms: string | null;
  bank_account_label: string | null;
  bank_account_last4: string | null;
  metadata: unknown;
  status: "active" | "archived";
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

type SupabaseContactRow = {
  id: string;
  organization_id: string;
  business_profile_id: string | null;
  contact_type: "business" | "person" | "department" | "other";
  display_name: string;
  legal_name: string | null;
  email: string | null;
  phone: string | null;
  country_code: string | null;
  vat_id: string | null;
  tax_registration_number: string | null;
  electronic_address: string | null;
  electronic_address_scheme: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country_subdivision: string | null;
  notes: string | null;
  metadata: unknown;
  status: "active" | "archived";
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

const BUSINESS_PROFILE_SELECT_FIELDS =
  "id, organization_id, profile_type, display_name, legal_name, trading_name, country_code, vat_id, tax_registration_number, electronic_address, electronic_address_scheme, email, phone, website, address_line1, address_line2, city, region, postal_code, country_subdivision, default_currency, payment_terms, bank_account_label, bank_account_last4, metadata, status, created_by, updated_by, created_at, updated_at";

const CONTACT_SELECT_FIELDS =
  "id, organization_id, business_profile_id, contact_type, display_name, legal_name, email, phone, country_code, vat_id, tax_registration_number, electronic_address, electronic_address_scheme, address_line1, address_line2, city, region, postal_code, country_subdivision, notes, metadata, status, created_by, updated_by, created_at, updated_at";

const BUSINESS_RECORD_READER_ROLES = new Set<WorkspaceRole>(
  WORKSPACE_ROLE_SETS.invoiceDraftReaders
);
const BUSINESS_RECORD_MUTATOR_ROLES = new Set<WorkspaceRole>(
  WORKSPACE_ROLE_SETS.invoiceDraftEditors
);

export class WorkspaceBusinessRecordServiceError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(code: string, message: string, statusCode = 400) {
    super(message);
    this.name = "WorkspaceBusinessRecordServiceError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeMetadata(value: unknown): JsonObject {
  return isPlainObject(value) ? value : {};
}

function withoutUndefined<T extends Record<string, unknown>>(input: T) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
}

function keepProvidedFields<
  TInput extends Record<string, unknown>,
  TParsed extends Record<string, unknown>
>(input: TInput, parsed: TParsed): Partial<TParsed> {
  return Object.fromEntries(
    Object.entries(parsed).filter(([key, value]) => {
      return (
        Object.prototype.hasOwnProperty.call(input, key) &&
        value !== undefined
      );
    })
  ) as Partial<TParsed>;
}

function assertCanRead(context: WorkspaceAuthorizationContext) {
  if (BUSINESS_RECORD_READER_ROLES.has(context.membershipRole)) {
    return;
  }

  throw new WorkspaceBusinessRecordServiceError(
    "WORKSPACE_BUSINESS_RECORD_READ_ROLE_REQUIRED",
    "Workspace profile and contact reading requires workspace membership with an allowed read role.",
    403
  );
}

function assertCanMutate(context: WorkspaceAuthorizationContext) {
  if (BUSINESS_RECORD_MUTATOR_ROLES.has(context.membershipRole)) {
    return;
  }

  throw new WorkspaceBusinessRecordServiceError(
    "WORKSPACE_BUSINESS_RECORD_MUTATION_ROLE_REQUIRED",
    "Workspace profile and contact changes require an organization owner, admin, accountant, or reviewer role.",
    403
  );
}

function normalizeJsonBusinessProfile(
  record: BusinessProfileRecord
): WorkspaceBusinessProfileResponse {
  return record;
}

function normalizeJsonContact(record: ContactRecord): WorkspaceContactResponse {
  return record;
}

function normalizeSupabaseBusinessProfile(
  row: SupabaseBusinessProfileRow
): WorkspaceBusinessProfileResponse {
  return {
    id: row.id,
    organizationId: row.organization_id,
    profileType: row.profile_type,
    displayName: row.display_name,
    legalName: row.legal_name,
    tradingName: row.trading_name,
    countryCode: row.country_code.trim(),
    vatId: row.vat_id,
    taxRegistrationNumber: row.tax_registration_number,
    electronicAddress: row.electronic_address,
    electronicAddressScheme: row.electronic_address_scheme,
    email: row.email,
    phone: row.phone,
    website: row.website,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    city: row.city,
    region: row.region,
    postalCode: row.postal_code,
    countrySubdivision: row.country_subdivision,
    defaultCurrency: row.default_currency?.trim() ?? null,
    paymentTerms: row.payment_terms,
    bankAccountLabel: row.bank_account_label,
    bankAccountLast4: row.bank_account_last4,
    metadata: normalizeMetadata(row.metadata),
    status: row.status,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function normalizeSupabaseContact(row: SupabaseContactRow): WorkspaceContactResponse {
  return {
    id: row.id,
    organizationId: row.organization_id,
    businessProfileId: row.business_profile_id,
    contactType: row.contact_type,
    displayName: row.display_name,
    legalName: row.legal_name,
    email: row.email,
    phone: row.phone,
    countryCode: row.country_code?.trim() ?? null,
    vatId: row.vat_id,
    taxRegistrationNumber: row.tax_registration_number,
    electronicAddress: row.electronic_address,
    electronicAddressScheme: row.electronic_address_scheme,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    city: row.city,
    region: row.region,
    postalCode: row.postal_code,
    countrySubdivision: row.country_subdivision,
    notes: row.notes,
    metadata: normalizeMetadata(row.metadata),
    status: row.status,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapBusinessProfileValues(
  context: WorkspaceAuthorizationContext,
  data: BusinessProfileCreateData | BusinessProfilePatchData,
  options: {
    includeOrganization: boolean;
    includeCreatedBy: boolean;
  }
) {
  const values: Record<string, unknown> = {
    profile_type: data.profileType,
    display_name: data.displayName,
    legal_name: data.legalName,
    trading_name: data.tradingName,
    country_code: data.countryCode,
    vat_id: data.vatId,
    tax_registration_number: data.taxRegistrationNumber,
    electronic_address: data.electronicAddress,
    electronic_address_scheme: data.electronicAddressScheme,
    email: data.email,
    phone: data.phone,
    website: data.website,
    address_line1: data.addressLine1,
    address_line2: data.addressLine2,
    city: data.city,
    region: data.region,
    postal_code: data.postalCode,
    country_subdivision: data.countrySubdivision,
    default_currency: data.defaultCurrency,
    payment_terms: data.paymentTerms,
    bank_account_label: data.bankAccountLabel,
    bank_account_last4: data.bankAccountLast4,
    metadata: data.metadata,
    status: data.status,
    updated_by: context.userId
  };

  if (options.includeOrganization) {
    values.organization_id = context.organizationId;
  }

  if (options.includeCreatedBy) {
    values.created_by = context.userId;
  }

  return withoutUndefined(values);
}

function mapContactValues(
  context: WorkspaceAuthorizationContext,
  data: ContactCreateData | ContactPatchData,
  options: {
    includeOrganization: boolean;
    includeCreatedBy: boolean;
  }
) {
  const values: Record<string, unknown> = {
    business_profile_id: data.businessProfileId,
    contact_type: data.contactType,
    display_name: data.displayName,
    legal_name: data.legalName,
    email: data.email,
    phone: data.phone,
    country_code: data.countryCode,
    vat_id: data.vatId,
    tax_registration_number: data.taxRegistrationNumber,
    electronic_address: data.electronicAddress,
    electronic_address_scheme: data.electronicAddressScheme,
    address_line1: data.addressLine1,
    address_line2: data.addressLine2,
    city: data.city,
    region: data.region,
    postal_code: data.postalCode,
    country_subdivision: data.countrySubdivision,
    notes: data.notes,
    metadata: data.metadata,
    status: data.status,
    updated_by: context.userId
  };

  if (options.includeOrganization) {
    values.organization_id = context.organizationId;
  }

  if (options.includeCreatedBy) {
    values.created_by = context.userId;
  }

  return withoutUndefined(values);
}

async function assertSupabaseBusinessProfileInWorkspace(input: {
  supabase: SupabaseClient;
  context: WorkspaceAuthorizationContext;
  businessProfileId?: string | null | undefined;
}) {
  if (!input.businessProfileId) {
    return;
  }

  const { data, error } = await input.supabase
    .from("business_profiles")
    .select("id")
    .eq("id", input.businessProfileId)
    .eq("organization_id", input.context.organizationId)
    .maybeSingle();

  if (error) {
    throw new WorkspaceBusinessRecordServiceError(
      "WORKSPACE_BUSINESS_PROFILE_READ_FAILED",
      "Could not verify the referenced business profile.",
      500
    );
  }

  if (!data) {
    throw new WorkspaceBusinessRecordServiceError(
      "WORKSPACE_BUSINESS_PROFILE_NOT_FOUND",
      "Referenced business profile was not found in this workspace.",
      404
    );
  }
}

function mapRepositoryError(error: unknown) {
  if (error instanceof WorkspaceBusinessRecordServiceError) {
    return error;
  }

  if (error instanceof ProductionDataModelRepositoryError) {
    const statusCode =
      error.code === "BUSINESS_PROFILE_NOT_FOUND" ||
      error.code === "CONTACT_NOT_FOUND"
        ? 404
        : 400;

    return new WorkspaceBusinessRecordServiceError(
      error.code,
      error.message,
      statusCode
    );
  }

  return error;
}

export async function listWorkspaceBusinessProfiles(input: {
  context: WorkspaceAuthorizationContext;
  filters?: BusinessProfileListFilters;
}) {
  assertCanRead(input.context);

  if (!hasSupabaseServerConfig()) {
    const records = await listBusinessProfiles(
      input.context.organizationId,
      input.filters
    );

    return records.map(normalizeJsonBusinessProfile);
  }

  const supabase = getSupabaseUserClient(input.context.accessToken);
  let query = supabase
    .from("business_profiles")
    .select(BUSINESS_PROFILE_SELECT_FIELDS)
    .eq("organization_id", input.context.organizationId)
    .order("updated_at", {
      ascending: false
    });

  if (input.filters?.profileType) {
    query = query.eq("profile_type", input.filters.profileType);
  }

  if (input.filters?.status) {
    query = query.eq("status", input.filters.status);
  }

  const { data, error } = await query.limit(200);

  if (error) {
    throw new WorkspaceBusinessRecordServiceError(
      "WORKSPACE_BUSINESS_PROFILE_LIST_FAILED",
      "Could not list workspace business profiles.",
      500
    );
  }

  return ((data ?? []) as SupabaseBusinessProfileRow[]).map(
    normalizeSupabaseBusinessProfile
  );
}

export async function getWorkspaceBusinessProfile(input: {
  context: WorkspaceAuthorizationContext;
  id: string;
}) {
  assertCanRead(input.context);

  if (!hasSupabaseServerConfig()) {
    const record = await getBusinessProfileById(
      input.context.organizationId,
      input.id
    );

    return record ? normalizeJsonBusinessProfile(record) : null;
  }

  const supabase = getSupabaseUserClient(input.context.accessToken);
  const { data, error } = await supabase
    .from("business_profiles")
    .select(BUSINESS_PROFILE_SELECT_FIELDS)
    .eq("id", input.id)
    .eq("organization_id", input.context.organizationId)
    .maybeSingle();

  if (error) {
    throw new WorkspaceBusinessRecordServiceError(
      "WORKSPACE_BUSINESS_PROFILE_READ_FAILED",
      "Could not read the workspace business profile.",
      500
    );
  }

  return data
    ? normalizeSupabaseBusinessProfile(data as SupabaseBusinessProfileRow)
    : null;
}

export async function createWorkspaceBusinessProfile(input: {
  context: WorkspaceAuthorizationContext;
  data: BusinessProfileCreateInput;
}) {
  assertCanMutate(input.context);

  const parsed = businessProfileCreateSchema.parse({
    ...input.data,
    createdBy: input.context.userId,
    updatedBy: input.context.userId
  });

  if (!hasSupabaseServerConfig()) {
    const record = await createBusinessProfile(
      input.context.organizationId,
      parsed
    );

    return normalizeJsonBusinessProfile(record);
  }

  const supabase = getSupabaseUserClient(input.context.accessToken);
  const { data, error } = await supabase
    .from("business_profiles")
    .insert(
      mapBusinessProfileValues(input.context, parsed, {
        includeOrganization: true,
        includeCreatedBy: true
      })
    )
    .select(BUSINESS_PROFILE_SELECT_FIELDS)
    .single();

  if (error) {
    throw new WorkspaceBusinessRecordServiceError(
      "WORKSPACE_BUSINESS_PROFILE_CREATE_FAILED",
      "Could not create the workspace business profile.",
      500
    );
  }

  return normalizeSupabaseBusinessProfile(data as SupabaseBusinessProfileRow);
}

export async function updateWorkspaceBusinessProfile(input: {
  context: WorkspaceAuthorizationContext;
  id: string;
  data: BusinessProfileUpdateInput;
}) {
  assertCanMutate(input.context);

  const parsed = businessProfileUpdateSchema.parse(input.data);
  const parsedUpdates = keepProvidedFields(
    input.data as Record<string, unknown>,
    parsed as Record<string, unknown>
  ) as BusinessProfilePatchData;

  if (!hasSupabaseServerConfig()) {
    const record = await updateBusinessProfileById(
      input.context.organizationId,
      input.id,
      {
        ...parsedUpdates,
        updatedBy: input.context.userId
      }
    );

    return record ? normalizeJsonBusinessProfile(record) : null;
  }

  const supabase = getSupabaseUserClient(input.context.accessToken);
  const { data, error } = await supabase
    .from("business_profiles")
    .update(
      mapBusinessProfileValues(input.context, parsedUpdates, {
        includeOrganization: false,
        includeCreatedBy: false
      })
    )
    .eq("id", input.id)
    .eq("organization_id", input.context.organizationId)
    .select(BUSINESS_PROFILE_SELECT_FIELDS)
    .maybeSingle();

  if (error) {
    throw new WorkspaceBusinessRecordServiceError(
      "WORKSPACE_BUSINESS_PROFILE_UPDATE_FAILED",
      "Could not update the workspace business profile.",
      500
    );
  }

  return data
    ? normalizeSupabaseBusinessProfile(data as SupabaseBusinessProfileRow)
    : null;
}

export async function archiveWorkspaceBusinessProfile(input: {
  context: WorkspaceAuthorizationContext;
  id: string;
}) {
  return updateWorkspaceBusinessProfile({
    context: input.context,
    id: input.id,
    data: {
      status: "archived"
    }
  });
}

export async function listWorkspaceContacts(input: {
  context: WorkspaceAuthorizationContext;
  filters?: ContactListFilters;
}) {
  assertCanRead(input.context);

  if (!hasSupabaseServerConfig()) {
    const records = await listContacts(input.context.organizationId, input.filters);

    return records.map(normalizeJsonContact);
  }

  const supabase = getSupabaseUserClient(input.context.accessToken);
  let query = supabase
    .from("contacts")
    .select(CONTACT_SELECT_FIELDS)
    .eq("organization_id", input.context.organizationId)
    .order("updated_at", {
      ascending: false
    });

  if (input.filters?.status) {
    query = query.eq("status", input.filters.status);
  }

  if (input.filters?.businessProfileId) {
    query = query.eq("business_profile_id", input.filters.businessProfileId);
  }

  const { data, error } = await query.limit(200);

  if (error) {
    throw new WorkspaceBusinessRecordServiceError(
      "WORKSPACE_CONTACT_LIST_FAILED",
      "Could not list workspace contacts.",
      500
    );
  }

  return ((data ?? []) as SupabaseContactRow[]).map(normalizeSupabaseContact);
}

export async function getWorkspaceContact(input: {
  context: WorkspaceAuthorizationContext;
  id: string;
}) {
  assertCanRead(input.context);

  if (!hasSupabaseServerConfig()) {
    const record = await getContactById(input.context.organizationId, input.id);

    return record ? normalizeJsonContact(record) : null;
  }

  const supabase = getSupabaseUserClient(input.context.accessToken);
  const { data, error } = await supabase
    .from("contacts")
    .select(CONTACT_SELECT_FIELDS)
    .eq("id", input.id)
    .eq("organization_id", input.context.organizationId)
    .maybeSingle();

  if (error) {
    throw new WorkspaceBusinessRecordServiceError(
      "WORKSPACE_CONTACT_READ_FAILED",
      "Could not read the workspace contact.",
      500
    );
  }

  return data ? normalizeSupabaseContact(data as SupabaseContactRow) : null;
}

export async function createWorkspaceContact(input: {
  context: WorkspaceAuthorizationContext;
  data: ContactCreateInput;
}) {
  assertCanMutate(input.context);

  const parsed = contactCreateSchema.parse({
    ...input.data,
    createdBy: input.context.userId,
    updatedBy: input.context.userId
  });

  if (!hasSupabaseServerConfig()) {
    const record = await createContact(input.context.organizationId, parsed);

    return normalizeJsonContact(record);
  }

  const supabase = getSupabaseUserClient(input.context.accessToken);
  await assertSupabaseBusinessProfileInWorkspace({
    supabase,
    context: input.context,
    businessProfileId: parsed.businessProfileId
  });

  const { data, error } = await supabase
    .from("contacts")
    .insert(
      mapContactValues(input.context, parsed, {
        includeOrganization: true,
        includeCreatedBy: true
      })
    )
    .select(CONTACT_SELECT_FIELDS)
    .single();

  if (error) {
    throw new WorkspaceBusinessRecordServiceError(
      "WORKSPACE_CONTACT_CREATE_FAILED",
      "Could not create the workspace contact.",
      500
    );
  }

  return normalizeSupabaseContact(data as SupabaseContactRow);
}

export async function updateWorkspaceContact(input: {
  context: WorkspaceAuthorizationContext;
  id: string;
  data: ContactUpdateInput;
}) {
  assertCanMutate(input.context);

  const parsed = contactUpdateSchema.parse(input.data);
  const parsedUpdates = keepProvidedFields(
    input.data as Record<string, unknown>,
    parsed as Record<string, unknown>
  ) as ContactPatchData;

  if (!hasSupabaseServerConfig()) {
    const record = await updateContactById(
      input.context.organizationId,
      input.id,
      {
        ...parsedUpdates,
        updatedBy: input.context.userId
      }
    );

    return record ? normalizeJsonContact(record) : null;
  }

  const supabase = getSupabaseUserClient(input.context.accessToken);
  await assertSupabaseBusinessProfileInWorkspace({
    supabase,
    context: input.context,
    businessProfileId: parsedUpdates.businessProfileId
  });

  const { data, error } = await supabase
    .from("contacts")
    .update(
      mapContactValues(input.context, parsedUpdates, {
        includeOrganization: false,
        includeCreatedBy: false
      })
    )
    .eq("id", input.id)
    .eq("organization_id", input.context.organizationId)
    .select(CONTACT_SELECT_FIELDS)
    .maybeSingle();

  if (error) {
    throw new WorkspaceBusinessRecordServiceError(
      "WORKSPACE_CONTACT_UPDATE_FAILED",
      "Could not update the workspace contact.",
      500
    );
  }

  return data ? normalizeSupabaseContact(data as SupabaseContactRow) : null;
}

export async function archiveWorkspaceContact(input: {
  context: WorkspaceAuthorizationContext;
  id: string;
}) {
  return updateWorkspaceContact({
    context: input.context,
    id: input.id,
    data: {
      status: "archived"
    }
  });
}

export function normalizeWorkspaceBusinessRecordError(error: unknown) {
  return mapRepositoryError(error);
}
