import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve('src/ui/contexto-profile-surface.css'), 'utf8');
const quickSearchCss = readFileSync(resolve('src/ui/quick-x-search.css'), 'utf8');

function ruleBody(stylesheet: string, selector: string) {
  const start = stylesheet.indexOf(selector + " {");
  expect(start, "Missing CSS rule: " + selector).toBeGreaterThanOrEqual(0);
  const bodyStart = stylesheet.indexOf("{", start) + 1;
  const bodyEnd = stylesheet.indexOf("}", bodyStart);
  return stylesheet.slice(bodyStart, bodyEnd);
}

describe('Contexto X surface layout contract', () => {
  it('keeps the docked editor visible as a fixed Contexto-owned right panel', () => {
    const panel = ruleBody(css, ':host([data-contexto-page-editor][data-placement="docked"])');
    expect(panel).toContain('position:fixed;');
    expect(panel).toContain('z-index:2147483645;');
    expect(panel).toContain('top:12px;');
    expect(panel).toContain('right:16px;');
    expect(panel).toContain('width:min(380px,calc(100vw - 32px));');
    expect(panel).not.toContain('position:sticky;');
  });

  it('renders the hover launcher as a full-width in-flow row', () => {
    const host = ruleBody(css, ':host([data-contexto-surface="hover-card"])');
    expect(host).toContain('display:block;');
    expect(host).toContain('flex:0 0 100%;');
    expect(host).toContain('width:100%;');
    expect(host).toContain('margin:8px 0;');
    expect(host).not.toContain('position:absolute;');
    expect(host).not.toContain('bottom:');
    expect(host).not.toContain('right:');
    expect(host).not.toContain('z-index:');

    const launcher = ruleBody(css, '.contexto-hover-launcher');
    expect(launcher).toContain('width:100%;');
  });

  it('defines a complete light and dark palette for the isolated sidebar search host', () => {
    const lightHost = ruleBody(css, ':host([data-contexto-surface="sidebar-search"])');
    expect(lightHost).toContain('--ctx-bg:#fff;');
    expect(lightHost).toContain('--ctx-text:#0f1419;');
    expect(lightHost).toContain('--ctx-muted:#536471;');
    expect(lightHost).toContain('--ctx-border:#eff3f4;');
    expect(lightHost).toContain('--ctx-accent:#5b3fd6;');
    expect(lightHost).toContain('--ctx-link:#1d9bf0;');
    expect(lightHost).toContain('--ctx-label:#536471;');
    expect(lightHost).toContain('--ctx-subtle-border:#eff3f4;');
    expect(lightHost).toContain('--ctx-hover:#f7f9f9;');
    expect(lightHost).toContain('color-scheme:light;');

    const darkHost = ruleBody(css, ':host([data-contexto-surface="sidebar-search"][data-theme="dark"])');
    expect(darkHost).toContain('--ctx-bg:#000;');
    expect(darkHost).toContain('--ctx-text:#e7e9ea;');
    expect(darkHost).toContain('--ctx-muted:#71767b;');
    expect(darkHost).toContain('--ctx-border:#2f3336;');
    expect(darkHost).toContain('--ctx-accent:#9b8afb;');
    expect(darkHost).toContain('--ctx-link:#71c9ff;');
    expect(darkHost).toContain('--ctx-label:#71767b;');
    expect(darkHost).toContain('--ctx-subtle-border:#2f3336;');
    expect(darkHost).toContain('--ctx-hover:#16181c;');
    expect(darkHost).toContain('color-scheme:dark;');
  });

  it('keeps the sidebar search clear of the viewport edge and native X search', () => {
    const host = ruleBody(css, ':host([data-contexto-surface="sidebar-search"])');
    expect(host).toContain('margin:12px 0 16px;');
  });

  it('fits the shared Quick X search into the responsive sidebar workspace', () => {
    const sidebarWorkspace = ruleBody(css, '.contexto-sidebar-workspace');
    const sidebarAccountSearch = ruleBody(css, '.contexto-sidebar-search');
    const sidebarQuickSearch = ruleBody(quickSearchCss, '.contexto-quick-search[data-surface="sidebar"]');
    const sidebarDateRow = ruleBody(quickSearchCss, '.contexto-quick-search[data-surface="sidebar"] .date-row');
    const sidebarDateLabel = ruleBody(quickSearchCss, '.contexto-quick-search[data-surface="sidebar"] .date-row > label');
    const sharedInputs = ruleBody(quickSearchCss, '.contexto-quick-search input');
    const actionPreview = ruleBody(quickSearchCss, '.contexto-quick-search .search-action small');

    expect(sidebarWorkspace).toContain('display:grid;');
    expect(sidebarWorkspace).toContain('padding:10px 12px;');
    expect(sidebarWorkspace).toContain('border:1px solid var(--ctx-border);');
    expect(sidebarWorkspace).toContain('border-radius:16px;');
    expect(sidebarWorkspace).toContain('background:var(--ctx-bg);');
    expect(sidebarAccountSearch).not.toContain('padding:');
    expect(sidebarAccountSearch).not.toContain('border:');
    expect(sidebarAccountSearch).not.toContain('border-radius:');
    expect(sidebarAccountSearch).not.toContain('background:');
    expect(sidebarQuickSearch).toContain('width: 100%;');
    expect(sidebarQuickSearch).toContain('min-width: 0;');
    expect(sidebarQuickSearch).toContain('border-top: 1px solid var(--ctx-border);');
    expect(sidebarQuickSearch).toContain('padding-top: 10px;');
    expect(sidebarQuickSearch).not.toContain('width:400px;');
    expect(sidebarQuickSearch).not.toContain('min-height:480px;');
    expect(sidebarDateRow).toContain('flex-wrap: wrap;');
    expect(sidebarDateLabel).toContain('min-width: 132px;');
    expect(sharedInputs).toContain('background: var(--ctx-input, var(--ctx-bg));');
    expect(sharedInputs).toContain('color: var(--ctx-text);');
    expect(actionPreview).toContain('text-overflow: ellipsis;');
    expect(actionPreview).toContain('white-space: nowrap;');
  });
});
