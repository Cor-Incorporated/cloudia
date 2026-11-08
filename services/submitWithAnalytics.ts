/**
 * Submits the handoff form and counts a completion only after the Worker has
 * answered with an accepted receipt.
 *
 * postContactSubmit throws for every non-2xx answer, a network failure, a timeout
 * and an abort, so none of those reach the tracker. A 200 without a receipt (the
 * honeypot answer, an HTML maintenance page) is not counted either.
 */
import { analytics as defaultAnalytics, isAcceptedSubmission, type Analytics } from './analytics';
import {
  postContactSubmit,
  type ContactChatRequestOptions,
  type SubmitPayload,
  type SubmitResult,
} from './contactChatClient';

export async function submitContactInquiry(
  payload: SubmitPayload,
  options: ContactChatRequestOptions = {},
  tracker: Pick<Analytics, 'trackSubmitSuccess'> = defaultAnalytics,
): Promise<SubmitResult> {
  const result = await postContactSubmit(payload, options);
  if (isAcceptedSubmission(result)) {
    try {
      tracker.trackSubmitSuccess(result.receiptId, payload.intent ?? null);
    } catch {
      // Measurement must never turn an accepted inquiry into an error for the visitor.
    }
  }
  return result;
}
