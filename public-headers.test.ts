import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const headersPath = fileURLToPath(new URL('./public/_headers', import.meta.url));

function readDirectiveLines() {
  return readFileSync(headersPath, 'utf-8')
    .split('\n')
    .filter((line) => line.trim() !== '' && !line.trim().startsWith('#'))
    .map((line) => line.replace(/\r$/, ''));
}

describe('public/_headers', () => {
  it('removes Access-Control-Allow-Origin for every path with the Pages ! syntax', () => {
    const lines = readDirectiveLines();
    const startIndexes = lines.flatMap((line, index) => (line === '/*' ? [index] : []));
    const observed = JSON.stringify(lines);

    expect(startIndexes.length, `行頭に空白の無い /* がありません。観測値: ${observed}`).toBeGreaterThan(0);

    const hasRemoval = startIndexes.some((start) => {
      const block: string[] = [];
      for (let index = start + 1; index < lines.length; index += 1) {
        if (!/^\s/.test(lines[index])) break;
        block.push(lines[index]);
      }
      return block.some((line) => line.trim() === '! Access-Control-Allow-Origin');
    });

    expect(hasRemoval, `/* の block に ! Access-Control-Allow-Origin がありません。観測値: ${observed}`).toBe(true);
  });

  it('never gives Access-Control-Allow-Origin a value', () => {
    const offenders = readDirectiveLines().filter((line) =>
      /^\s*Access-Control-Allow-Origin\s*:/i.test(line)
    );

    expect(
      offenders,
      `Access-Control-Allow-Origin に値を付けた行があります。観測値: ${JSON.stringify(offenders)}`
    ).toEqual([]);
  });
});
