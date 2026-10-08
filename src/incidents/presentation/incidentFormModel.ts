import type { IncidentDraft } from '../domain/types.ts';

/**
 * Keeps map capture cancellation from becoming an invalid create command.
 * Field validation remains centralized in IncidentService.
 */
export async function submitIncidentDraft<T>(
  draft: IncidentDraft,
  create: (draft: IncidentDraft) => Promise<T>,
): Promise<T | undefined> {
  if (!draft.geometry) return undefined;
  return create(draft);
}