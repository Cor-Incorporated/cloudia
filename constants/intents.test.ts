import { describe, expect, it } from 'vitest';
import { GRIFT_HANDOFF_INTENTS, isGriftHandoffIntent } from './intents';
import type { ContactIntent } from '../types';

describe('Grift handoff intent eligibility', () => {
  it('keeps exactly the four cross-repo eligible intents', () => {
    expect([...GRIFT_HANDOFF_INTENTS]).toEqual([
      'contract-dev',
      'grift-team-beta',
      'grift-paid-trial',
      'estimate-audit',
    ]);
    for (const intent of GRIFT_HANDOFF_INTENTS) expect(isGriftHandoffIntent(intent)).toBe(true);
  });

  it.each([
    'confidential-ai-assessment',
    'local-llm-poc',
    'press-speaking-other',
    null,
  ] satisfies Array<ContactIntent | null>)('does not transfer unrelated intent %s', (intent) => {
    expect(isGriftHandoffIntent(intent)).toBe(false);
  });
});
