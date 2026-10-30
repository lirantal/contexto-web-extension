import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { Client, OAuth2, generateCodeVerifier, generateCodeChallenge } from '@xdevplatform/xdk';

export const REDIRECT_URI = 'http://127.0.0.1:8787/callback';
export const SCOPES = ['list.read', 'users.read', 'tweet.read', 'offline.access'];
export function oauthConfig(env = process.env) {
  if (!env.X_CLIENT_ID?.trim()) throw new Error('Set X_CLIENT_ID in .env or .env.x-export (OAuth 2.0 Client ID, not API key)');
  return { clientId: env.X_CLIENT_ID.trim(), clientSecret: env.X_CLIENT_SECRET || undefined,
    redirectUri: REDIRECT_URI, scope: SCOPES };
}
export function callbackCode(url, expectedState) {
  if (url.origin !== new URL(REDIRECT_URI).origin || url.username || url.password) throw new Error('Unexpected callback origin');
  if (url.pathname !== '/callback') throw new Error('Unexpected callback path');
  const state = Buffer.from(url.searchParams.get('state') ?? '');
  const expected = Buffer.from(expectedState);
  if (state.length !== expected.length || !timingSafeEqual(state, expected)) throw new Error('OAuth state did not match');
  if (url.searchParams.has('error')) throw new Error('X authorization was denied; run auth again');
  const code = url.searchParams.get('code');
  if (!code) throw new Error('X returned no authorization code');
  return code;
}
export async function promptManualCallback({ signal, input = process.stdin, output = process.stdout } = {}) {
  output.write('Paste the full redirected URL here (hidden), then press Enter: ');
  // readline must own the terminal to disable native echo; discard its rendering so
  // short-lived authorization codes never appear in terminal scrollback.
  const muted = new Writable({ write(_chunk, _encoding, done) { done(); } });
  const reader = createInterface({ input, output: muted, terminal: Boolean(input.isTTY && output.isTTY) });
  const closed = new Promise((_, reject) => reader.once('close', () => reject(new Error('Callback input cancelled'))));
  try { return await Promise.race([reader.question('', { signal }), closed]); }
  finally { reader.close(); output.write('\n'); }
}

export async function authorize(save, log = console.log, { manual = false, readCallback = promptManualCallback } = {}) {
  const config = oauthConfig();
  const oauth = new OAuth2(config);
  const verifier = generateCodeVerifier();
  await oauth.setPkceParameters(verifier, await generateCodeChallenge(verifier));
  const state = randomBytes(32).toString('hex');
  const authUrl = await oauth.getAuthorizationUrl(state);
  let server;
  let timer;
  const abort = new AbortController();
  try {
    let code;
    if (manual) {
      log('Open this URL in your normal browser and authorize your X account:'); log(authUrl);
      log('The redirect may show a connection error. Copy its FULL URL from the address bar back into this terminal, not chat.');
      timer = setTimeout(() => abort.abort(), 300_000);
      let callback;
      try { callback = await readCallback({ signal: abort.signal }); }
      catch { throw new Error(abort.signal.aborted ? 'Authorization timed out after five minutes; run auth --manual again' : 'Callback input cancelled; run auth --manual again'); }
      try { code = callbackCode(new URL(callback.trim()), state); }
      catch { throw new Error('Invalid callback URL, state, or authorization result; run auth --manual again'); }
    } else code = await new Promise((resolve, reject) => {
      server = createServer((req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        const url = new URL(req.url, REDIRECT_URI);
        if (url.pathname !== '/callback') { res.writeHead(404).end(); return; }
        try {
          const code = callbackCode(url, state);
          res.end('Authorization received. Return to your terminal.'); resolve(code);
        } catch {
          res.writeHead(400).end('Authorization failed. Return to your terminal and retry.');
          reject(new Error('OAuth callback failed state/code validation; run auth again'));
        }
      });
      server.on('error', () => reject(new Error('Cannot listen on 127.0.0.1:8787; free the port and retry')));
      server.listen(8787, '127.0.0.1', () => {
        log('Open this URL in a browser on THIS computer and authorize your X account:'); log(authUrl);
      });
      timer = setTimeout(() => reject(new Error('Authorization timed out after five minutes')), 300_000);
    });
    let tokens;
    try { tokens = await oauth.exchangeCode(code, verifier); }
    catch { throw new Error('OAuth token exchange failed; check Client ID, app type, secret, and exact callback URL'); }
    if (!tokens.access_token || !tokens.refresh_token) throw new Error('X did not grant offline access; authorize again');
    if (tokens.scope && SCOPES.some((scope) => !tokens.scope.split(' ').includes(scope))) throw new Error('X did not grant the required read scopes');
    await save({ version: 1, clientId: config.clientId, redirectUri: config.redirectUri,
      tokens, expiresAt: Date.now() + tokens.expires_in * 1000 });
    log('Authorization saved locally. No token was printed. Next: run discover.');
  } finally {
    clearTimeout(timer);
    if (server) await new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); });
  }
}

/** Explain known API problems without exposing raw response data. */
export function apiFailureMessage(error, endpoint = 'X API request') {
  const status = Number.isInteger(error.status) ? ` (HTTP ${error.status})` : '';
  const body = error.data && typeof error.data === 'object' ? error.data : {};
  // Only recognize documented problem identifiers and render our own fixed text.
  // Never print API detail/message, headers, client IDs, tokens, or private payloads.
  const known = new Set(['client-forbidden', 'not-authorized-for-resource', 'unsupported-authentication',
    'usage-capped', 'credits-depleted', 'rate-limit-exceeded', 'invalid-request']);
  const type = typeof body.type === 'string' ? body.type.match(/^https:\/\/(?:api\.)?(?:x|twitter)\.com\/2\/problems\/([a-z-]+)$/)?.[1] : undefined;
  const problem = known.has(type) ? type : undefined;
  const reason = body.reason === 'client-not-enrolled' ? 'client-not-enrolled' : undefined;
  const code = [problem, reason].filter(Boolean).join('; ');
  let hint = 'Check scopes, credits, or connectivity before retrying.';
  if (problem === 'client-forbidden' || reason) {
    hint = 'X denied developer-app access. In the X Developer Console, check that this OAuth app belongs to the correct Project and has active X API access/enrollment and funded credits. OAuth authorization alone does not enable API access.';
    if (typeof body.detail === 'string' && /attach(?:ed)?.{0,40}project/i.test(body.detail)) {
      hint += ' X specifically requires an app attached to a Project.';
    }
  } else if (problem === 'not-authorized-for-resource' || problem === 'unsupported-authentication') {
    hint = 'Check the authorized account, read scopes, and endpoint authentication requirements.';
  } else if (problem === 'usage-capped' || problem === 'credits-depleted') {
    hint = 'Check the X Console credit balance, billing activation, and spending/usage limits.';
  }
  return `X request failed${status} for ${endpoint}${code ? ` [${code}]` : ''}. ${hint} Saved authorization and any existing checkpoints were retained.`;
}

/** Refresh and persist rotated refresh tokens before making any further API requests. */
export function authenticatedRequester(session, save, { sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), log = console.log } = {}) {
  const config = oauthConfig();
  if (session.version !== 1 || session.clientId !== config.clientId || !session.tokens?.access_token
    || !Number.isFinite(session.expiresAt)) throw new Error('Missing or mismatched authorization; run auth');
  let attempts = 0;
  async function refresh() {
    if (!session.tokens.refresh_token) throw new Error('Authorization expired; run auth');
    let tokens;
    try { tokens = await new OAuth2(config).refreshToken(session.tokens.refresh_token); }
    catch { throw new Error('Token refresh failed; run auth again'); }
    session = { ...session, tokens: { ...tokens, refresh_token: tokens.refresh_token ?? session.tokens.refresh_token },
      expiresAt: Date.now() + tokens.expires_in * 1000 };
    await save(session);
  }
  return async (operation, endpoint = 'X API request') => {
    if (session.expiresAt <= Date.now() + 60_000) await refresh();
    let refreshed = false;
    for (let retry = 0; ; retry++) {
      attempts++;
      try {
        const client = new Client({ accessToken: session.tokens.access_token, retry: false, timeout: 30_000 });
        return await operation(client);
      } catch (error) {
        if (error.status === 401 && !refreshed) { await refresh(); refreshed = true; continue; }
        if ((error.status === 429 || error.status >= 500) && retry < 3) {
          const reset = Number(error.headers?.get('x-rate-limit-reset')) * 1000;
          const after = Number(error.headers?.get('retry-after')) * 1000;
          const wait = Math.max(1000, after || 0, reset > Date.now() ? reset - Date.now() : 1000 * 2 ** retry);
          if (wait > 60_000) throw new Error('Rate limited for over a minute. Checkpoint retained; retry this command later');
          log(`Retrying HTTP ${error.status} in ${Math.ceil(wait / 1000)} seconds (attempt ${attempts}).`);
          await sleep(wait); continue;
        }
        // SDK error bodies may contain private payloads; keep console diagnostics bounded.
        throw new Error(apiFailureMessage(error, endpoint));
      }
    }
  };
}
