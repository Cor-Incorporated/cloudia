import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contactCopyLocale } from '../utils/contactLocale';
import { INDUSTRY_ENTRY_SOURCES, OTHER_ENTRY_SOURCES } from './entrySources';
import { industryReceptionMarker } from './industryGuidance';

/**
 * The fixture is the same file that corsweb's contact Worker checks
 * (workers/contact-chat/src/__tests__/fixtures/industry-reception-contract.v1.json).
 * Both repositories compare their own lists against it, so a change on one
 * side fails here or there until the fixture is updated on both.
 */
interface ReceptionContract {
  contract: string;
  copyStatus: string;
  sources: string[];
  genericSources: string[];
  localeFallback: Record<string, string>;
  markers: { source: string; locale: string; marker: string }[];
}

const contract = JSON.parse(
  readFileSync(resolve(__dirname, 'fixtures/industry-reception-contract.v1.json'), 'utf8'),
) as ReceptionContract;

describe('industry reception contract fixture', () => {
  it('names the contract this client follows', () => {
    expect(contract.contract).toBe('industry-reception-v1');
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
