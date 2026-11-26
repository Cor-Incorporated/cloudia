import { describe, expect, it } from 'vitest';
import { contactSessionKey } from './contactEntryRoute';

describe('contactSessionKey', () => {
  const base = 'cloudia:contact-session:contact:ja:local-llm-poc';

  it('keeps the established key for the direct entry', () => {
    expect(contactSessionKey(base, 'corJpDirect')).toBe(base);
  });

  it('separates the Grift entry so a tab switching entries does not resume the other conversation', () => {
    expect(contactSessionKey(base, 'griftaiLink')).toBe(`${base}:grift`);
    expect(contactSessionKey(base, 'griftaiLink')).not.toBe(contactSessionKey(base, 'corJpDirect'));
  });
});
