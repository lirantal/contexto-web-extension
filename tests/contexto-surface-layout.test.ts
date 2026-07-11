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
  it('renders the hover launcher as a full-width in-flow row', () => {
    const host = ruleBody(':host([data-contexto-surface="hover-card"])');
    expect(host).toContain('display:block;');
    expect(host).toContain('margin:8px 0;');
    expect(host).not.toContain('position:absolute;');
    expect(host).not.toContain('bottom:');
    expect(host).not.toContain('right:');
    expect(host).not.toContain('z-index:');

    const launcher = ruleBody('.contexto-hover-launcher');
    expect(launcher).toContain('width:100%;');
  });
});
