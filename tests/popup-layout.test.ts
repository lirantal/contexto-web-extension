import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const appCss = readFileSync(resolve('entrypoints/popup/App.css'), 'utf8');
const quickSearchCss = readFileSync(resolve('src/ui/quick-x-search.css'), 'utf8');
const globalCss = readFileSync(resolve('entrypoints/popup/style.css'), 'utf8');

function ruleBody(css: string, selector: string) {
  const selectorStart = css.lastIndexOf(`${selector} {`);
  expect(selectorStart, `Missing CSS rule: ${selector}`).toBeGreaterThanOrEqual(0);
  const bodyStart = css.indexOf('{', selectorStart) + 1;
  const bodyEnd = css.indexOf('}', bodyStart);
  return css.slice(bodyStart, bodyEnd);
}

describe('popup layout contract', () => {
  it('uses readable shell and group spacing without changing popup width', () => {
    const shell = ruleBody(appCss, '.popup-shell');
    expect(shell).toContain('box-sizing: border-box;');
    expect(shell).toContain('width: 400px;');
    expect(shell).toContain('padding: 16px;');

    const section = ruleBody(
      quickSearchCss,
      '.contexto-quick-search[data-surface="popup"] .quick-search-section',
    );
    expect(section).toContain('gap: 10px;');
    expect(section).toContain('margin-bottom: 16px;');
  });

  it('keeps popup interactive targets at least 36 pixels high', () => {
    const sharedTargets = ruleBody(
      quickSearchCss,
      `.contexto-quick-search[data-surface="popup"] input,
.contexto-quick-search[data-surface="popup"] button`,
    );
    expect(sharedTargets).toContain('min-height: 36px;');

    const clearTarget = ruleBody(
      quickSearchCss,
      '.contexto-quick-search[data-surface="popup"] .clear-input',
    );
    expect(clearTarget).toContain('min-height: 36px;');
    expect(clearTarget).toContain('width: 36px;');

    const footerTargets = ruleBody(
      appCss,
      `.popup-shell footer button,
.popup-shell footer a`,
    );
    expect(footerTargets).toContain('min-height: 36px;');
  });

  it('keeps popup supporting text at least 12 pixels', () => {
    const supportingText = ruleBody(
      quickSearchCss,
      `.contexto-quick-search[data-surface="popup"] .search-fields label > small,
.contexto-quick-search[data-surface="popup"] .optional-label,
.contexto-quick-search[data-surface="popup"] .action-heading p,
.contexto-quick-search[data-surface="popup"] .search-action small,
.contexto-quick-search[data-surface="popup"] .target-handle-option-main small,
.contexto-quick-search[data-surface="popup"] .target-handle-option-meta small`,
    );
    expect(supportingText).toContain('font-size: 12px;');
  });

  it('keeps shared long query previews on one ellipsized line', () => {
    const preview = ruleBody(quickSearchCss, '.contexto-quick-search .search-action small');
    expect(preview).toContain('overflow: hidden;');
    expect(preview).toContain('text-overflow: ellipsis;');
    expect(preview).toContain('white-space: nowrap;');
  });

  it('uses the shared input surface for fields, actions, and suggestions with consistent spacing', () => {
    const input = ruleBody(quickSearchCss, '.contexto-quick-search input');
    const sharedTargets = ruleBody(
      quickSearchCss,
      `.contexto-quick-search input,
.contexto-quick-search button`,
    );
    const suggestions = ruleBody(quickSearchCss, '.contexto-quick-search .target-handle-options');
    const action = ruleBody(quickSearchCss, '.contexto-quick-search .search-action');

    expect(input).toContain('background: var(--ctx-input, var(--ctx-bg));');
    expect(sharedTargets).toContain('background: var(--ctx-input, var(--ctx-bg));');
    expect(suggestions).toContain('background: var(--ctx-input, var(--ctx-bg));');
    expect(action).toContain('gap: 8px;');
  });

  it('keeps body scrolling available when the popup exceeds the browser limit', () => {
    const body = ruleBody(globalCss, 'body');
    expect(body).toContain('max-height: 600px;');
    expect(body).toContain('overflow-y: auto;');
  });

  it('allows long company values to shrink and wrap within suggestions', () => {
    const company = ruleBody(quickSearchCss, '.contexto-quick-search .target-handle-company');
    expect(company).toContain('min-width: 0;');
    expect(company).toContain('white-space: normal;');

    const value = ruleBody(quickSearchCss, '.contexto-quick-search .target-handle-company-value');
    expect(value).toContain('min-width: 0;');
    expect(value).toContain('overflow-wrap: anywhere;');
  });
});
