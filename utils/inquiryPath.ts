import type { AppMode } from '../types';
import type { Classification } from '../services/contactChatClient';

/**
 * A sales (or spam) classification is a hint for the team. It is not a reason
 * to hide the inquiry form or to refuse the visitor.
 */
export function handoffBlockedByClassification(_classification: Classification): boolean {
  return false;
}

export interface InquiryPathInput {
  appMode: AppMode;
  submitted: boolean;
  showHandoff: boolean;
  readyForContact: boolean;
  faqResolved: boolean;
  showFaqPrompt: boolean;
  classification: Classification;
}

/** The existing "I have enough, here are my details" step. */
export function showReadyHandoff(input: InquiryPathInput): boolean {
  if (input.submitted || input.showHandoff || input.faqResolved || input.showFaqPrompt) return false;
  if (!input.readyForContact) return false;
  return !handoffBlockedByClassification(input.classification);
}

/**
 * The existing contact form, offered before the chat has collected enough.
 * Used when the visitor would rather not chat, and when the chat request failed.
 * Ambassador mode has its own path back to intake and does not show this.
 */
export function showDirectHandoff(input: InquiryPathInput): boolean {
  if (input.appMode !== 'intake') return false;
  if (input.submitted || input.showHandoff || input.readyForContact || input.faqResolved) return false;
  return !handoffBlockedByClassification(input.classification);
}

/**
 * The panel under the chat (the industry notice, the note that materials and
 * booking are not available here, and the "send contact details without
 * chatting" button) is for visitors who came from an industry page only.
 * Other entries keep the current screen without this panel.
 */
export function showIndustryEntryPanel(
  input: Pick<InquiryPathInput, 'appMode' | 'submitted' | 'showHandoff' | 'faqResolved'> & { industryEntry: boolean },
): boolean {
  if (!input.industryEntry || input.appMode !== 'intake') return false;
  return !input.showHandoff && !input.submitted && !input.faqResolved;
}
