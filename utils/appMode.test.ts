import { describe, expect, it } from 'vitest';
import { resolveAppMode } from './appMode';

describe('resolveAppMode', () => {
  it('supports the explicit ambassador route', () => {
    expect(resolveAppMode('', '/contact/chat/ambassador/')).toBe('ambassador');
  });

  it('keeps the inquiry route in intake mode', () => {
    expect(resolveAppMode('?mode=ambassador', '/contact/chat/')).toBe('ambassador');
    expect(resolveAppMode('', '/contact/chat/')).toBe('intake');
  });
});
