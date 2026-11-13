import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contactCopyLocale } from '../utils/contactLocale';
import { INDUSTRY_ENTRY_SOURCES, OTHER_ENTRY_SOURCES } from './entrySources';
import { INDUSTRY_COPY_STATUS, industryContextLine, industryReceptionMarker } from './industryGuidance';

/**
 * The fixture is the same file that corsweb's contact Worker checks
 * (workers/contact-chat/src/__tests__/fixtures/industry-reception-contract.v1.json).
 * Both repositories compare their own lists against it, so a change on one
 * side fails here or there until the fixture is updated on both.
 */
interface ReceptionContract {
  contract: string;
  copyStatus: Record<string, string>;
  sources: string[];
  genericSources: string[];
  localeFallback: Record<string, string>;
  markers: { source: string; locale: string; marker: string }[];
  firstReplies: { source: string; locale: string; reply: string }[];
}

/**
 * The same value as FIXTURE_SHA256 in corsweb's
 * workers/contact-chat/src/__tests__/industry-reception-contract.test.ts.
 * Editing the fixture here alone (even its formatting) fails this test; editing
 * it in corsweb alone fails the test there.
 */
const FIXTURE_SHA256 = 'feb97ff829cea79b018dbe9e258d3c4f5f031b81f49849b29de365f4f5208d2e';
const FIXTURE_PATH = resolve(__dirname, 'fixtures/industry-reception-contract.v1.json');

const contract = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as ReceptionContract;

describe('industry reception contract fixture', () => {
  it('keeps the same bytes as the fixture in corsweb (sha256)', () => {
    const observed = createHash('sha256').update(readFileSync(FIXTURE_PATH)).digest('hex');
    expect(observed, `fixture sha256 expected=${FIXTURE_SHA256} observed=${observed}`).toBe(FIXTURE_SHA256);
  });

  it('shows the same opening and first question as the Worker, word for word (5 industries x ja, en)', () => {
    expect(contract.firstReplies).toHaveLength(INDUSTRY_ENTRY_SOURCES.length * 2);
    for (const { source, locale, reply } of contract.firstReplies) {
      expect(industryContextLine(source, locale), `${source}/${locale}`).toBe(reply);
    }
  });

  it('names the contract this client follows', () => {
    expect(contract.contract).toBe('industry-reception-v1');
  });

  it('shares the copy status with this client', () => {
    expect(contract.copyStatus).toEqual(INDUSTRY_COPY_STATUS);
  });

  it('lists the same five industry sources and the same generic tags as this client', () => {
    expect(contract.sources).toEqual([...INDUSTRY_ENTRY_SOURCES]);
    expect(contract.genericSources).toEqual([...OTHER_ENTRY_SOURCES]);
  });

  it('falls back to the same reception language for every site language', () => {
    for (const [siteLocale, receptionLocale] of Object.entries(contract.localeFallback)) {
      expect(contactCopyLocale(siteLocale)).toBe(receptionLocale);
    }
  });

  it('uses the same first sentence that the Worker puts at the start of its first reply', () => {
    expect(contract.markers).toHaveLength(INDUSTRY_ENTRY_SOURCES.length * 2);
    for (const { source, locale, marker } of contract.markers) {
      expect(industryReceptionMarker(source, locale)).toBe(marker);
    }
  });
});
