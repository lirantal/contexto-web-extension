import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sharedCss = readFileSync(resolve('src/ui/fuzzy-text-combobox.css'), 'utf8');
const dashboardEntry = readFileSync(resolve('entrypoints/options/main.tsx'), 'utf8');
const contentEntry = readFileSync(resolve('entrypoints/content.ts'), 'utf8');

function ruleBody(selector: string) {
  const start = sharedCss.indexOf(`${selector} {`);
  expect(start, `Missing CSS rule: ${selector}`).toBeGreaterThanOrEqual(0);
  const bodyStart = sharedCss.indexOf('{', start) + 1;
  const bodyEnd = sharedCss.indexOf('}', bodyStart);
  return sharedCss.slice(bodyStart, bodyEnd);
}

describe('shared fuzzy text combobox layout and style', () => {
  it('loads the same suggestion stylesheet in the dashboard and X editors', () => {
    expect(dashboardEntry).toContain("import '@/src/ui/fuzzy-text-combobox.css';");
    expect(contentEntry).toContain("import fuzzyTextComboboxCss from '@/src/ui/fuzzy-text-combobox.css?inline';");
    expect(contentEntry).toContain('[profileSurfaceCss, fuzzyTextComboboxCss]');
  });

  it('uses the same neutral default and teal highlighted suggestion style', () => {
    const list = ruleBody('.value-options');
    const option = ruleBody('.value-options .value-option');
    const highlighted = ruleBody(`.value-options .value-option:hover,
.value-options .value-option.highlighted`);

    expect(list).toContain('border-radius: 7px;');
    expect(list).toContain('background: var(--ctx-input, #ffffff);');
    expect(option).toContain('background: var(--ctx-input, #ffffff);');
    expect(option).toContain('color: var(--ctx-text, #222822);');
    expect(option).toContain('justify-content: flex-start;');
    expect(highlighted).toContain('background: var(--ctx-hover, #e8f3f1);');
    expect(highlighted).toContain('color: var(--ctx-accent-strong, #0c5e59);');
  });

  it('overlays suggestions directly beneath the input without increasing its grid row height', () => {
    const combobox = ruleBody('.fuzzy-text-combobox');
    const options = ruleBody('.fuzzy-text-combobox .value-options');

    expect(combobox).toContain('position: relative;');
    expect(combobox).toContain('align-self: start;');
    expect(combobox).toContain('width: 100%;');
    expect(options).toContain('position: absolute;');
    expect(options).toContain('top: calc(100% + 4px);');
    expect(options).toContain('right: 0;');
    expect(options).toContain('left: 0;');
    expect(options).toContain('z-index: 10;');
  });
});
