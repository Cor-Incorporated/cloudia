import { AppMode, ContactIntent } from '../types';

export type ChatPlaceholderKey = 'typeYourMessage' | 'typeYourMessageIntake' | 'typeYourMessageChooseIntent';

/**
 * Where the message list should scroll after it changes.
 * Before the first exchange the list holds only the greeting and the purpose
 * picker. Scrolling to the bottom there cuts off the start of the greeting in
 * the launcher's short panel, so that state (including after "new inquiry" or
 * a language switch resets the list) goes to the top.
 */
export function messageListScrollTarget(messageCount: number, isLoading: boolean, showHandoff: boolean): 'top' | 'bottom' {
  return messageCount <= 1 && !isLoading && !showHandoff ? 'top' : 'bottom';
}

/**
 * Placeholder for the chat input. In intake mode the input stays disabled until
 * a purpose is chosen, so say that instead of inviting the visitor to type.
 * Once a purpose is chosen (even if starting the conversation failed), the
 * usual intake placeholder applies.
 */
export function chatPlaceholderKey(
  appMode: AppMode,
  chatReady: boolean,
  isLoading: boolean,
  selectedIntent: ContactIntent | null,
): ChatPlaceholderKey {
  if (appMode !== 'intake') return 'typeYourMessage';
  return !chatReady && !isLoading && !selectedIntent ? 'typeYourMessageChooseIntent' : 'typeYourMessageIntake';
}

/**
 * Success message after /api/contact/submit. The Worker emails a receipt with
 * the same number, so only promise that email when a receipt number came back.
 */
export function handoffSuccessMessage(receiptId: string | undefined): {
  textKey: 'handoffSuccess' | 'handoffSuccessWithReceipt';
  replacements?: Record<string, string>;
} {
  return receiptId ? { textKey: 'handoffSuccessWithReceipt', replacements: { receiptId } } : { textKey: 'handoffSuccess' };
}
