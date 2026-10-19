import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve('entrypoints/options/style.css'), 'utf8');

function ruleBody(selector: string) {
  const start = css.indexOf(`${selector} {`);
  expect(start, `Missing CSS rule: ${selector}`).toBeGreaterThanOrEqual(0);
  const bodyStart = css.indexOf('{', start) + 1;
  const bodyEnd = css.indexOf('}', bodyStart);
  return css.slice(bodyStart, bodyEnd);
}

describe('dashboard metadata layout contract', () => {
  it('allows long company and latest-note values to shrink and wrap', () => {
    const content = ruleBody('.account-row > .account-row-content');
    expect(content).toContain('min-width: 0;');
    expect(content).toContain('flex: 1;');

    const company = ruleBody('.account-row-company');
    expect(company).toContain('min-width: 0;');
    expect(company).toContain('flex-wrap: wrap;');

    const companyValue = ruleBody('.account-row-company-value');
    expect(companyValue).toContain('min-width: 0;');
    expect(companyValue).toContain('overflow-wrap: anywhere;');
    expect(companyValue).toContain('white-space: normal;');

    const noteValue = ruleBody('.latest-note-value');
    expect(noteValue).toContain('min-width: 0;');
    expect(noteValue).toContain('overflow-wrap: anywhere;');
    expect(noteValue).toContain('white-space: normal;');
  });
});
