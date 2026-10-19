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

  it('gives the feed panel readable grouped spacing and obvious X links', () => {
    const panel = ruleBody('.contexto-feed-panel');
    expect(panel).toContain('width:320px;');
    expect(panel).toContain('gap:0;');

    const section = ruleBody('.contexto-feed-section');
    expect(section).toContain('padding:12px 14px;');

    const xLink = ruleBody('.contexto-feed-x-link');
    expect(xLink).toContain('text-decoration:underline;');
    expect(xLink).toContain('min-height:44px;');
  });

  it('keeps feed supporting content at least 12 pixels tall', () => {
    const label = ruleBody('.contexto-feed-section-label');
    expect(label).toContain('font-size:12px;');

    const checkpoint = ruleBody('.contexto-feed-checkpoint time,.contexto-feed-checkpoint span');
    expect(checkpoint).toContain('font-size:12px;');
  });

  it('gives compact feed controls a 36 pixel minimum target height', () => {
    const marker = ruleBody('.contexto-feed-marker');
    expect(marker).toContain('min-height:36px;');

    const localActions = ruleBody('.contexto-feed-local-actions button');
    expect(localActions).toContain('min-height:36px;');

    const checkpoint = ruleBody('.contexto-feed-checkpoint button');
    expect(checkpoint).toContain('min-height:36px;');
  });
});
