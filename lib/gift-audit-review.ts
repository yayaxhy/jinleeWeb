export type GiftReviewNote = {
  id: string; requestId: string; actorDiscordId: string; outcome: 'NEEDS_EVIDENCE' | 'EVIDENCE_ADDED';
  note: string; evidenceReferences: string[]; snapshotHash: string; createdAt: string; sourceSnapshot: GiftReviewSources;
};
export type GiftReviewSources = {
  audit: Record<string, unknown>; payment: Record<string, unknown> | null;
  individual: Record<string, unknown> | null; revert: Record<string, unknown> | null;
  referralReceipts?: Record<string, unknown>; // Older saved snapshots predate receipt capture.
};
export type GiftReviewState = {
  ok: true; transactionId: string; sources: GiftReviewSources; snapshotHash: string; concerns: string[];
  notes: GiftReviewNote[]; nextBeforeNoteId: string | null; automaticReversalAuthorized: false;
};
export type GiftReviewCommand = {
  transactionId: string; requestId: string; expectedSnapshotHash: string;
  outcome: 'NEEDS_EVIDENCE' | 'EVIDENCE_ADDED'; note: string; evidenceReferences: string[];
};
export const validGiftReviewId = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value);
export function parseGiftReviewCommand(value: unknown): GiftReviewCommand | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some((key) => !['transactionId', 'requestId', 'expectedSnapshotHash', 'outcome', 'note', 'evidenceReferences', 'actorDiscordId'].includes(key))) return null;
  if (!validGiftReviewId(body.transactionId) || typeof body.requestId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.requestId) ||
    typeof body.expectedSnapshotHash !== 'string' || !/^[0-9a-f]{64}$/.test(body.expectedSnapshotHash) ||
    !['NEEDS_EVIDENCE', 'EVIDENCE_ADDED'].includes(String(body.outcome)) || typeof body.note !== 'string' ||
    body.note.trim().length < 10 || body.note.trim().length > 2000 || !Array.isArray(body.evidenceReferences) ||
    body.evidenceReferences.length > 8 || body.evidenceReferences.some((ref) => typeof ref !== 'string' || !ref.trim() || ref.trim().length > 300)) return null;
  const references = (body.evidenceReferences as string[]).map((ref) => ref.trim());
  if (new Set(references).size !== references.length || (body.outcome === 'EVIDENCE_ADDED' && !references.length)) return null;
  return { transactionId: body.transactionId, requestId: body.requestId.toLowerCase(), expectedSnapshotHash: body.expectedSnapshotHash,
    outcome: body.outcome as GiftReviewCommand['outcome'], note: body.note.trim(), evidenceReferences: references };
}
