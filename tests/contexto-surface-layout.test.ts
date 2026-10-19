import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve('src/ui/contexto-profile-surface.css'), 'utf8');
const quickSearchCss = readFileSync(resolve('src/ui/quick-x-search.css'), 'utf8');

function ruleBody(stylesheet: string, selector: string) {
  const start = stylesheet.indexOf(`${selector} {`);
  expect(start, `Missing CSS rule: ${selector}`).toBeGreaterThanOrEqual(0);
  const bodyStart = stylesheet.indexOf('{', start) + 1;
  const bodyEnd = stylesheet.indexOf('}', bodyStart);
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

    const darkHost = ruleBody(css, ':host([data-contexto-surface="sidebar-search"][data-theme="dark"])');
    expect(darkHost).toContain('--ctx-bg:#000;');
    expect(darkHost).toContain('--ctx-text:#e7e9ea;');
    expect(darkHost).toContain('--ctx-muted:#71767b;');
    expect(darkHost).toContain('--ctx-border:#2f3336;');
    expect(darkHost).toContain('--ctx-accent:#9b8afb;');
    expect(darkHost).toContain('--ctx-link:#71c9ff;');
  });

  it('keeps the sidebar search clear of the viewport edge and native X search', () => {
    const host = ruleBody(css, ':host([data-contexto-surface="sidebar-search"])');
    expect(host).toContain('margin:12px 0 16px;');
  });

  it('stacks inline editor fields and pairs owned editor fields only in containers at least 380 pixels wide', () => {
    const formSection = ruleBody(css, '.contexto-form-section');
    expect(formSection).toContain('gap:10px;');

    const fieldRow = ruleBody(css, '.contexto-field-row');
    expect(fieldRow).toContain('display:grid;');
    expect(fieldRow).toContain('grid-template-columns:minmax(0,1fr);');

    const ownedEditor = ruleBody(css, '.contexto-surface[data-placement="docked"],.contexto-surface[data-placement="modal"]');
    expect(ownedEditor).toContain('container-type:inline-size;');
    expect(css).toContain('@container (min-width:380px) { .contexto-surface:not([data-placement="inline"]) .contexto-field-row { grid-template-columns:repeat(2,minmax(0,1fr)); } }');
  });

  it('makes structured sidebar results visibly keyboard focusable', () => {
    const result = ruleBody(css, '.contexto-sidebar-search-results button');
    expect(result).toContain('display:grid;');

    const focus = ruleBody(css, '.contexto-sidebar-search-results button:focus-visible');
    expect(focus).toContain('outline:2px solid var(--ctx-accent);');
    expect(focus).toContain('outline-offset:-2px;');
  });

  it('gives every embedded button a 36 pixel minimum target height', () => {
    const genericButton = css.match(/(?:^|\n)button \{([^}]*)\}/)?.[1] ?? '';
    expect(genericButton).toContain('min-height:36px;');
  });

  it('gives hover launcher actions a 36 pixel minimum target height', () => {
    const hoverAction = ruleBody(css, '.contexto-hover-launcher button');
    expect(hoverAction).toContain('min-height:36px;');
  });

  it('gives profile form actions a 36 pixel minimum target height', () => {
    const formAction = ruleBody(css, '.contexto-form > .form-actions button');
    expect(formAction).toContain('min-height:36px;');
  });

  it('gives chip remove controls a 36 pixel minimum target in both dimensions', () => {
    const chipRemove = ruleBody(css, '.chip button');
    expect(chipRemove).toContain('min-width:36px;');
    expect(chipRemove).toContain('min-height:36px;');
  });

  it('gives the feed panel readable grouped spacing and obvious X links', () => {
    const panel = ruleBody(css, '.contexto-feed-panel');
    expect(panel).toContain('width:320px;');
    expect(panel).toContain('gap:0;');

    const section = ruleBody(css, '.contexto-feed-section');
    expect(section).toContain('padding:12px 14px;');

    const xLink = ruleBody(css, '.contexto-feed-x-link');
    expect(xLink).toContain('text-decoration:underline;');
    expect(xLink).toContain('min-height:44px;');
  });

  it('keeps feed supporting content at least 12 pixels tall', () => {
    const label = ruleBody(css, '.contexto-feed-section-label');
    expect(label).toContain('font-size:12px;');

    const checkpoint = ruleBody(css, '.contexto-feed-checkpoint time,.contexto-feed-checkpoint span');
    expect(checkpoint).toContain('font-size:12px;');
  });

  it('gives compact feed controls a 36 pixel minimum target height', () => {
    const marker = ruleBody(css, '.contexto-feed-marker');
    expect(marker).toContain('min-height:36px;');

    const localActions = ruleBody(css, '.contexto-feed-local-actions button');
    expect(localActions).toContain('min-height:36px;');

    const checkpoint = ruleBody(css, '.contexto-feed-checkpoint button');
    expect(checkpoint).toContain('min-height:36px;');
  });

  it('lets a lone local feed action span the available two-column row', () => {
    const loneAction = ruleBody(css, '.contexto-feed-action-row > :only-child');
    expect(loneAction).toContain('grid-column:1 / -1;');
  });

  it('keeps compact metadata labels visible and associated when values wrap', () => {
    const field = ruleBody(css, '.contexto-metadata-field');
    expect(field).toContain('display:flex;');
    expect(field).toContain('flex-wrap:wrap;');

    const label = ruleBody(css, '.contexto-metadata-label');
    expect(label).toContain('font-weight:650;');

    const value = ruleBody(css, '.contexto-metadata-value');
    expect(value).toContain('overflow-wrap:anywhere;');
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
