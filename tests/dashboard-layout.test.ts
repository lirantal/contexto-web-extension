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
  it('uses the shared Contexto surface color and control radius', () => {
    const root = ruleBody(':root');
    const button = ruleBody(`button,
.file-button`);
    const chip = ruleBody('.chip');
    const folder = ruleBody('.folder-chip');

    expect(root).toContain('background: #f7f8f5;');
    expect(button).toContain('border-radius: 7px;');
    expect(chip).toContain('border-radius: 7px;');
    expect(chip).toContain('background: #e8f3f1;');
    expect(folder).toContain('background: #fff1d4;');
  });

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
