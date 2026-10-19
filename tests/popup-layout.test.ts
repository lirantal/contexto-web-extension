import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const appCss = readFileSync(resolve('entrypoints/popup/App.css'), 'utf8');
const globalCss = readFileSync(resolve('entrypoints/popup/style.css'), 'utf8');
const comboboxCss = readFileSync(resolve('entrypoints/popup/TargetHandleCombobox.css'), 'utf8');

function ruleBody(css: string, selector: string) {
  const selectorStart = css.indexOf(`${selector} {`);
  expect(selectorStart, `Missing CSS rule: ${selector}`).toBeGreaterThanOrEqual(0);
  const bodyStart = css.indexOf('{', selectorStart) + 1;
  const bodyEnd = css.indexOf('}', bodyStart);
  return css.slice(bodyStart, bodyEnd);
}

describe('popup layout contract', () => {
  it('includes popup padding in its width and reserves a larger right gutter', () => {
    const shell = ruleBody(appCss, '.popup-shell');

    expect(shell).toContain('box-sizing: border-box;');
    expect(shell).toContain('width: 400px;');
    expect(shell).toContain('padding: 10px 20px 10px 12px;');
  });

  it('keeps long query previews on one ellipsized line', () => {
    const preview = ruleBody(appCss, '.search-action small');

    expect(preview).toContain('overflow: hidden;');
    expect(preview).toContain('text-overflow: ellipsis;');
    expect(preview).toContain('white-space: nowrap;');
  });

  it('keeps body scrolling available when the popup exceeds the browser limit', () => {
    const body = ruleBody(globalCss, 'body');

    expect(body).toContain('max-height: 600px;');
    expect(body).toContain('overflow-y: auto;');
  });

  it('allows long company values to shrink and wrap within popup suggestions', () => {
    const company = ruleBody(comboboxCss, '.target-handle-company');
    expect(company).toContain('min-width: 0;');
    expect(company).toContain('white-space: normal;');

    const value = ruleBody(comboboxCss, '.target-handle-company-value');
    expect(value).toContain('min-width: 0;');
    expect(value).toContain('overflow-wrap: anywhere;');
  });
});
