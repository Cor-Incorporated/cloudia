import { AppMode, Message } from '../types';

export type ChatPlaceholderKey = 'typeYourMessage' | 'typeYourMessageIntake';

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
 * Placeholder (and aria-label) for the chat input. The input is enabled from
 * the first paint in both modes, so it only says which mode it is, short and
 * clear, without explaining what to do first.
 */
export function chatPlaceholderKey(appMode: AppMode): ChatPlaceholderKey {
  return appMode === 'intake' ? 'typeYourMessageIntake' : 'typeYourMessage';
}

/**
 * The thread as the visitor sees it. The stored opening message is the payload
 * the Worker already receives; for an industry entry the screen shows the
 * dedicated first-display copy instead:
 * - before the conversation starts: the opening bubble's text becomes the one
 *   industry question (`openingText`),
 * - once the conversation has started: the opening bubble is dropped, because
 *   the Worker's first reply is the reception contract text and a second copy
 *   of the greeting or the question would sit beside it.
 * `messages` itself, and everything sent to the API, stays unchanged.
 */
export function displayThread(
  messages: Message[],
  input: { openingText: string | null; dropOpening: boolean },
): Message[] {
  if (!input.openingText || messages.length === 0) return messages;
  const [opening, ...rest] = messages;
  if (opening.sender !== 'ai') return messages;
  if (input.dropOpening) return rest;
  return [{ ...opening, text: input.openingText }, ...rest];
}

/**
 * 「新しい相談」を出すか。意図を選んだ・会話が進んだ・送信済みのどれか。
 * 3 辺はそれぞれ単独で真になる。
 */
export function showNewConversation(input: {
  selectedIntent: unknown;
  messageCount: number;
  submitted: boolean;
}): boolean {
  return Boolean(input.selectedIntent) || input.messageCount > 1 || input.submitted;
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
