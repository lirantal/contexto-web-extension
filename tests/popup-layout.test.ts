import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const appCss = readFileSync(resolve('entrypoints/popup/App.css'), 'utf8');
const comboboxCss = readFileSync(resolve('entrypoints/popup/TargetHandleCombobox.css'), 'utf8');
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
    expect(shell).toContain('width: 400px;');
    expect(shell).toContain('padding: 16px;');

    const section = ruleBody(appCss, '.popup-section');
    expect(section).toContain('gap: 10px;');
    expect(section).toContain('margin-bottom: 16px;');
  });

  it('keeps every interactive target at least 36 pixels high', () => {
    const sharedTargets = ruleBody(appCss, `.popup-shell button,
.popup-shell a`);
    expect(sharedTargets).toContain('min-height: 36px;');

    const clearTarget = ruleBody(appCss, '.popup-shell .clear-input');
    expect(clearTarget).toContain('min-height: 36px;');
    expect(clearTarget).toContain('width: 36px;');
  });

  it('keeps popup supporting text at least 12 pixels', () => {
    const helpers = ruleBody(appCss, '.search-fields label > small');
    expect(helpers).toContain('font-size: 12px;');

    const optionalLabel = ruleBody(appCss, '.optional-label');
    expect(optionalLabel).toContain('font-size: 12px;');

    const actionGuidance = ruleBody(appCss, '.action-heading p');
    expect(actionGuidance).toContain('font-size: 12px;');

    const actionPreview = ruleBody(appCss, '.search-action small');
    expect(actionPreview).toContain('font-size: 12px;');

    const suggestionDetails = ruleBody(
      comboboxCss,
      `.target-handle-option-main small,
.target-handle-option-meta small`,
    );
    expect(suggestionDetails).toContain('font-size: 12px;');
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
});
