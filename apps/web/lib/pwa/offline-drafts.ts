import {
  decryptJsonPayload,
  deleteEncryptedRecord,
  encryptJsonPayload,
  getEncryptedRecord,
  isSecureLocalStoreAvailable,
  putEncryptedRecord
} from "./secure-local-store";

const OFFLINE_DRAFT_PREFIX = "invoice-draft:";

type EncryptedOfflineDraftEnvelope<TDraft> = {
  recordType: "invoice-lantern.encrypted-offline-draft.v1";
  draft: TDraft;
  savedAt: string;
  localOnly: true;
  boundaries: {
    noRawXml: true;
    noApiKeys: true;
    noWebhookSecrets: true;
    noViesSoap: true;
  };
};

export type OfflineDraftSaveInput<TDraft> = {
  id: string;
  draft: TDraft;
  passphrase: string;
};

export type OfflineDraftLoadInput = {
  id: string;
  passphrase: string;
};

function draftRecordId(id: string) {
  return `${OFFLINE_DRAFT_PREFIX}${id.trim() || "current-editor-draft"}`;
}

export function isEncryptedOfflineDraftStorageAvailable() {
  return isSecureLocalStoreAvailable();
}

export async function saveEncryptedOfflineDraft<TDraft>(
  input: OfflineDraftSaveInput<TDraft>
) {
  const envelope: EncryptedOfflineDraftEnvelope<TDraft> = {
    recordType: "invoice-lantern.encrypted-offline-draft.v1",
    draft: input.draft,
    savedAt: new Date().toISOString(),
    localOnly: true,
    boundaries: {
      noRawXml: true,
      noApiKeys: true,
      noWebhookSecrets: true,
      noViesSoap: true
    }
  };
  const encryptedPayload = await encryptJsonPayload(
    envelope,
    input.passphrase
  );

  await putEncryptedRecord(draftRecordId(input.id), encryptedPayload);

  return {
    id: draftRecordId(input.id),
    savedAt: envelope.savedAt,
    localOnly: true
  };
}

export async function loadEncryptedOfflineDraft<TDraft>(
  input: OfflineDraftLoadInput
) {
  const record = await getEncryptedRecord(draftRecordId(input.id));

  if (!record) {
    return null;
  }

  const envelope = await decryptJsonPayload<EncryptedOfflineDraftEnvelope<TDraft>>(
    record.payload,
    input.passphrase
  );

  if (envelope.recordType !== "invoice-lantern.encrypted-offline-draft.v1") {
    throw new Error("Unsupported encrypted offline draft record.");
  }

  return envelope;
}

export async function deleteEncryptedOfflineDraft(id: string) {
  await deleteEncryptedRecord(draftRecordId(id));
}
