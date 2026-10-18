import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve('src/ui/contexto-profile-surface.css'), 'utf8');

function ruleBody(selector: string) {
  const start = css.indexOf(`${selector} {`);
  expect(start, `Missing CSS rule: ${selector}`).toBeGreaterThanOrEqual(0);
  const bodyStart = css.indexOf('{', start) + 1;
  const bodyEnd = css.indexOf('}', bodyStart);
  return css.slice(bodyStart, bodyEnd);
}

describe('Contexto X surface layout contract', () => {
  it('keeps the docked editor visible as a fixed Contexto-owned right panel', () => {
    const panel = ruleBody(':host([data-contexto-page-editor][data-placement="docked"])');
    expect(panel).toContain('position:fixed;');
    expect(panel).toContain('z-index:2147483645;');
    expect(panel).toContain('top:12px;');
    expect(panel).toContain('right:16px;');
    expect(panel).toContain('width:min(380px,calc(100vw - 32px));');
    expect(panel).not.toContain('position:sticky;');
  });

  it('renders the hover launcher as a full-width in-flow row', () => {
    const host = ruleBody(':host([data-contexto-surface="hover-card"])');
    expect(host).toContain('display:block;');
    expect(host).toContain('flex:0 0 100%;');
    expect(host).toContain('width:100%;');
    expect(host).toContain('margin:8px 0;');
    expect(host).not.toContain('position:absolute;');
    expect(host).not.toContain('bottom:');
    expect(host).not.toContain('right:');
    expect(host).not.toContain('z-index:');

    const launcher = ruleBody('.contexto-hover-launcher');
    expect(launcher).toContain('width:100%;');
  });

  it('defines a complete light and dark palette for the isolated sidebar search host', () => {
    const lightHost = ruleBody(':host([data-contexto-surface="sidebar-search"])');
    expect(lightHost).toContain('--ctx-bg:#fff;');
    expect(lightHost).toContain('--ctx-text:#0f1419;');
    expect(lightHost).toContain('--ctx-muted:#536471;');
    expect(lightHost).toContain('--ctx-border:#eff3f4;');
    expect(lightHost).toContain('--ctx-accent:#5b3fd6;');
    expect(lightHost).toContain('--ctx-link:#1d9bf0;');

    const darkHost = ruleBody(':host([data-contexto-surface="sidebar-search"][data-theme="dark"])');
    expect(darkHost).toContain('--ctx-bg:#000;');
    expect(darkHost).toContain('--ctx-text:#e7e9ea;');
    expect(darkHost).toContain('--ctx-muted:#71767b;');
    expect(darkHost).toContain('--ctx-border:#2f3336;');
    expect(darkHost).toContain('--ctx-accent:#9b8afb;');
    expect(darkHost).toContain('--ctx-link:#71c9ff;');
  });

  it('keeps the sidebar search clear of the viewport edge and native X search', () => {
    const host = ruleBody(':host([data-contexto-surface="sidebar-search"])');
    expect(host).toContain('margin:12px 0 16px;');
  });

  it('keeps compact metadata labels visible and associated when values wrap', () => {
    const field = ruleBody('.contexto-metadata-field');
    expect(field).toContain('display:flex;');
    expect(field).toContain('flex-wrap:wrap;');

    const label = ruleBody('.contexto-metadata-label');
    expect(label).toContain('font-weight:650;');

    const value = ruleBody('.contexto-metadata-value');
    expect(value).toContain('overflow-wrap:anywhere;');
  });
});
