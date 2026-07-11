# Inline X Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Contexto's fixed X profile overlay with explicit-save, inline metadata editors inside X user hover cards and full profile pages.

**Architecture:** A throttled content-script observer discovers supported X surfaces, surface-scoped extractors produce profile snapshots, and isolated Shadow DOM React mounts render one shared editor/summary component. Read-only lookup and transactional compound save messages keep all persistence in the background worker and IndexedDB repositories.

**Tech Stack:** WXT 0.20, React 19, TypeScript 5.9, Dexie 4, Vitest 4, Testing Library, jsdom, Chrome/Vivaldi MV3.

## Global Constraints

- Hovering or opening an X profile performs zero persistent writes.
- Saving requires an explicit **Save to Contexto** action.
- Unsaved accounts show the complete inline editor immediately.
- Display name and X handle are prefilled from the specific X surface.
- Tags and folders are distinct multi-value fields with identical search, select, create, and remove behavior.
- Saved accounts show display name, position and company, and tags in the compact summary.
- The same shared component serves hover cards and full profile pages.
- Existing user-edited Contexto values are never silently overwritten by newly scraped X values.
- Content scripts communicate through the background worker and never access repositories directly.
- The current popup, dashboard, backup format, and existing search actions remain compatible.
- Chrome and Vivaldi are the supported browsers.

---

## File Structure

### New files

- `src/x/extract-profile.ts` — surface-scoped hover-card and full-profile snapshot extraction.
- `src/x/surface-observer.ts` — X mutation observation, candidate discovery, mount deduplication, and cleanup.
- `src/x/draft-store.ts` — in-memory drafts keyed by normalized X handle.
- `src/ui/ContextoProfileSurface.tsx` — shared saved summary and full metadata editor.
- `src/ui/MultiValueField.tsx` — shared tag/folder multi-value control.
- `src/ui/contexto-profile-surface.css` — isolated inline-surface styles and theme tokens.
- `tests/x-profile-extraction.test.ts` — extractor fixture tests.
- `tests/x-surface-observer.test.ts` — observer lifecycle tests.
- `tests/contexto-profile-surface.test.tsx` — editor and summary component tests.
- `tests/background.test.ts` — explicit lookup/save message tests.

### Modified files

- `src/shared/types.ts` — compound save and editor draft types.
- `src/shared/messages.ts` — read-only lookup and compound explicit-save contracts.
- `src/data/repositories.ts` — transactional save and complete tag/folder synchronization.
- `entrypoints/background.ts` — route lookup and save messages.
- `entrypoints/content.ts` — mount the observer instead of the fixed overlay.
- `tests/repositories.test.ts` — read-only lookup and transactional relationship tests.
- `README.md` and `docs/features/profile-metadata.md` — document inline X behavior.
- `.gitignore` — exclude `.superpowers/` visual-companion scratch state.

### Removed files

- `src/ui/ProfilePanel.tsx` — superseded by `ContextoProfileSurface`.
- `src/ui/profile-panel.css` — superseded by isolated surface styles.

---

### Task 1: Transactional Explicit-Save Persistence

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/data/repositories.ts`
- Modify: `tests/repositories.test.ts`

**Interfaces:**
- Consumes: existing `ProfileSnapshot`, `AccountUpdateInput`, `AccountSummary`, `ContextoDatabase`.
- Produces: `AccountContextSaveInput`, `saveAccountContext(input, database?)`, and existing read-only `getAccountByHandle(platform, handle, database?)`.

- [ ] **Step 1: Add failing repository tests for lookup and complete relationship synchronization**

Append imports for `saveAccountContext` and add these tests to `tests/repositories.test.ts`:

```ts
it('keeps a missing-account lookup read-only', async () => {
  expect(await getAccountByHandle('x', '@unknown', database)).toBeUndefined();
  expect(await database.accounts.count()).toBe(0);
  expect(await database.changeLog.count()).toBe(0);
});

it('saves profile metadata, tags, and folders as complete sets', async () => {
  const first = await saveAccountContext({
    profile: {
      platform: 'x',
      handle: 'ExampleDev',
      displayName: 'X Display Name',
      profileUrl: 'https://x.com/exampledev',
      avatarUrl: 'https://example.com/avatar.png',
    },
    metadata: {
      displayName: 'Saved Name',
      profession: 'Developer',
      position: 'CTO',
      companyName: 'Example Corp',
      location: 'Berlin',
      relationshipSource: 'Conference',
    },
    tagNames: ['Security', 'Founder'],
    folderNames: ['Friends', 'Speakers'],
  }, database);

  expect(first).toMatchObject({ displayName: 'Saved Name', position: 'CTO' });
  expect(first.tags.map(({ name }) => name).sort()).toEqual(['Founder', 'Security']);
  expect(first.folders.map(({ name }) => name).sort()).toEqual(['Friends', 'Speakers']);

  const second = await saveAccountContext({
    profile: {
      platform: 'x',
      handle: 'ExampleDev',
      displayName: 'Changed on X',
      profileUrl: 'https://x.com/exampledev',
    },
    metadata: {
      displayName: 'Saved Name',
      profession: 'Developer',
      position: 'CTO',
      companyName: 'Example Corp',
      location: 'Berlin',
      relationshipSource: 'Conference',
    },
    tagNames: ['Founder'],
    folderNames: ['Speakers'],
  }, database);

  expect(second.displayName).toBe('Saved Name');
  expect(second.tags.map(({ name }) => name)).toEqual(['Founder']);
  expect(second.folders.map(({ name }) => name)).toEqual(['Speakers']);
});
```

- [ ] **Step 2: Run the repository tests and verify the new API is missing**

Run: `npm test -- tests/repositories.test.ts`

Expected: FAIL because `saveAccountContext` is not exported.

- [ ] **Step 3: Define the save input and implement one Dexie transaction**

Add to `src/shared/types.ts`:

```ts
export interface AccountContextSaveInput {
  profile: ProfileSnapshot;
  metadata: AccountUpdateInput;
  tagNames: string[];
  folderNames: string[];
}
```

In `src/data/repositories.ts`, import `AccountContextSaveInput` and add:

```ts
async function syncAccountTags(accountId: string, names: string[], database: ContextoDatabase): Promise<void> {
  const normalizedNames = [...new Set(names.map((name) => normalizeName(name)).filter(Boolean))];
  const tags = await Promise.all(normalizedNames.map(async (normalized) => {
    const original = names.find((name) => normalizeName(name) === normalized) as string;
    return upsertTagByName(original, database);
  }));
  const selectedIds = new Set(tags.map(({ id }) => id));
  const current = await database.accountTags.where('accountId').equals(accountId).toArray();
  await database.accountTags.bulkDelete(current.filter(({ tagId }) => !selectedIds.has(tagId)).map(({ id }) => id));
  for (const tag of tags) {
    if (!current.some(({ tagId }) => tagId === tag.id)) {
      await database.accountTags.add({
        id: createId('account_tag'), accountId, tagId: tag.id, createdAt: nowIso(),
      });
    }
  }
}

async function syncAccountFolders(accountId: string, names: string[], database: ContextoDatabase): Promise<void> {
  const normalizedNames = [...new Set(names.map((name) => normalizeName(name)).filter(Boolean))];
  const folders = await Promise.all(normalizedNames.map(async (normalized) => {
    const original = names.find((name) => normalizeName(name) === normalized) as string;
    return upsertFolderByName(original, database);
  }));
  const selectedIds = new Set(folders.map(({ id }) => id));
  const current = await database.folderAccounts.where('accountId').equals(accountId).toArray();
  await database.folderAccounts.bulkDelete(current.filter(({ folderId }) => !selectedIds.has(folderId)).map(({ id }) => id));
  for (const folder of folders) {
    if (!current.some(({ folderId }) => folderId === folder.id)) {
      await database.folderAccounts.add({
        id: createId('folder_account'), folderId: folder.id, accountId, createdAt: nowIso(),
      });
    }
  }
}

export async function saveAccountContext(
  input: AccountContextSaveInput,
  database = db,
): Promise<AccountSummary> {
  return database.transaction(
    'rw',
    database.accounts,
    database.companies,
    database.tags,
    database.accountTags,
    database.folders,
    database.folderAccounts,
    database.changeLog,
    async () => {
      const account = await ensureAccountFromProfile(input.profile, database);
      const updated = await updateAccount(account.id, input.metadata, database);
      await syncAccountTags(updated.id, input.tagNames, database);
      await syncAccountFolders(updated.id, input.folderNames, database);
      return getAccountSummary(updated.id, database) as Promise<AccountSummary>;
    },
  );
}
```

- [ ] **Step 4: Run repository tests and compile**

Run: `npm test -- tests/repositories.test.ts && npm run compile`

Expected: repository tests PASS and TypeScript reports no errors.

- [ ] **Step 5: Commit the persistence slice**

```bash
git add src/shared/types.ts src/data/repositories.ts tests/repositories.test.ts
git commit -m "feat: add explicit transactional account save"
```

---

### Task 2: Background Lookup and Save Contracts

**Files:**
- Modify: `src/shared/messages.ts`
- Modify: `entrypoints/background.ts`
- Create: `tests/background.test.ts`

**Interfaces:**
- Consumes: `AccountContextSaveInput`, `saveAccountContext`, `getAccountByHandle` from Task 1.
- Produces: `contexto:account:lookup`, `contexto:account:saveContext`, exported `handleRequest(message)`.

- [ ] **Step 1: Write failing handler tests**

Create `tests/background.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const repositories = vi.hoisted(() => ({
  getAccountByHandle: vi.fn(),
  saveAccountContext: vi.fn(),
}));

vi.mock('@/src/data/repositories', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/src/data/repositories')>()),
  getAccountByHandle: repositories.getAccountByHandle,
  saveAccountContext: repositories.saveAccountContext,
}));

import { handleRequest } from '@/entrypoints/background';

describe('background account context messages', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns a successful empty read-only lookup', async () => {
    repositories.getAccountByHandle.mockResolvedValue(undefined);
    await expect(handleRequest({
      type: 'contexto:account:lookup', platform: 'x', handle: '@missing',
    })).resolves.toEqual({ ok: true, lookup: true, account: undefined });
    expect(repositories.saveAccountContext).not.toHaveBeenCalled();
  });

  it('routes explicit context saves', async () => {
    const input = {
      profile: { platform: 'x' as const, handle: 'dev', profileUrl: 'https://x.com/dev' },
      metadata: { displayName: 'Dev' }, tagNames: ['Security'], folderNames: ['Friends'],
    };
    repositories.saveAccountContext.mockResolvedValue({ id: 'account_1', tags: [], folders: [] });
    await handleRequest({ type: 'contexto:account:saveContext', input });
    expect(repositories.saveAccountContext).toHaveBeenCalledWith(input);
  });
});
```

- [ ] **Step 2: Run the handler test and verify the message types fail**

Run: `npm test -- tests/background.test.ts`

Expected: FAIL because the new message variants and exported handler do not exist.

- [ ] **Step 3: Add the typed contracts and routes**

In `src/shared/messages.ts`, import `AccountContextSaveInput` and add request variants:

```ts
| { type: 'contexto:account:lookup'; platform: 'x'; handle: string }
| { type: 'contexto:account:saveContext'; input: AccountContextSaveInput }
```

Add this response variant:

```ts
| { ok: true; lookup: true; account: AccountSummary | undefined }
```

In `entrypoints/background.ts`, import `saveAccountContext`, export `handleRequest`, and add routes before the existing update route:

```ts
case 'contexto:account:lookup':
  return {
    ok: true,
    lookup: true,
    account: await getAccountByHandle(message.platform, message.handle),
  };
case 'contexto:account:saveContext':
  return { ok: true, account: await saveAccountContext(message.input) };
```

- [ ] **Step 4: Run handler and repository tests**

Run: `npm test -- tests/background.test.ts tests/repositories.test.ts && npm run compile`

Expected: all selected tests PASS and TypeScript reports no errors.

- [ ] **Step 5: Commit the message slice**

```bash
git add src/shared/messages.ts entrypoints/background.ts tests/background.test.ts
git commit -m "feat: add account context message contracts"
```

---

### Task 3: Surface-Scoped X Profile Extraction

**Files:**
- Create: `src/x/extract-profile.ts`
- Create: `tests/x-profile-extraction.test.ts`

**Interfaces:**
- Consumes: `ProfileSnapshot`, `parseXProfileUrl(url)`.
- Produces: `XSurfaceKind`, `extractHoverCardProfile(surface)`, `extractFullProfile(surface, currentUrl)`.

- [ ] **Step 1: Write representative extraction fixture tests**

Create `tests/x-profile-extraction.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { extractFullProfile, extractHoverCardProfile } from '@/src/x/extract-profile';

describe('X surface profile extraction', () => {
  it('extracts only the hovered account from its dialog', () => {
    document.body.innerHTML = `
      <a href="/wrong"><span>Wrong</span><span>@wrong</span></a>
      <div role="dialog" data-testid="HoverCard">
        <a href="/theo"><img src="https://pbs.twimg.com/profile_images/theo.jpg"></a>
        <a href="/theo"><span>Theo – t3.gg</span><span>@theo</span></a>
        <div data-testid="UserDescription">Developer and CEO</div>
      </div>`;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(extractHoverCardProfile(dialog)).toMatchObject({
      platform: 'x', handle: 'theo', displayName: 'Theo – t3.gg',
      profileUrl: 'https://x.com/theo', bioSnapshot: 'Developer and CEO',
    });
  });

  it('extracts a full profile from the provided profile root', () => {
    document.body.innerHTML = `
      <main data-testid="primaryColumn">
        <div data-testid="UserName"><span>Example Dev</span><span>@exampledev</span></div>
        <div data-testid="UserDescription">Security engineer</div>
        <span data-testid="UserLocation">Berlin</span>
        <img src="https://pbs.twimg.com/profile_images/example.jpg">
      </main>`;
    expect(extractFullProfile(
      document.querySelector<HTMLElement>('main')!,
      'https://x.com/exampledev',
    )).toMatchObject({ handle: 'exampledev', displayName: 'Example Dev', location: 'Berlin' });
  });

  it('returns null for reserved routes and malformed cards', () => {
    const empty = document.createElement('div');
    expect(extractHoverCardProfile(empty)).toBeNull();
    expect(extractFullProfile(empty, 'https://x.com/home')).toBeNull();
  });
});
```

- [ ] **Step 2: Run extraction tests and verify the module is missing**

Run: `npm test -- tests/x-profile-extraction.test.ts`

Expected: FAIL because `src/x/extract-profile.ts` does not exist.

- [ ] **Step 3: Implement conservative surface-scoped extraction**

Create `src/x/extract-profile.ts`:

```ts
import { parseXProfileUrl } from '@/src/shared/platforms/x';
import type { ProfileSnapshot } from '@/src/shared/types';

export type XSurfaceKind = 'hover-card' | 'full-profile';

function compactText(value?: string | null): string | undefined {
  return value?.replace(/\s+/g, ' ').trim() || undefined;
}

function handleFromSurface(surface: HTMLElement): string | undefined {
  const values = [...surface.querySelectorAll('span')].map((node) => compactText(node.textContent));
  return values.find((value) => /^@[A-Za-z0-9_]{1,15}$/.test(value ?? ''))?.slice(1);
}

function profileLink(surface: HTMLElement, handle: string): HTMLAnchorElement | undefined {
  return [...surface.querySelectorAll<HTMLAnchorElement>('a[href]')].find((anchor) => {
    try { return new URL(anchor.href, location.origin).pathname.toLowerCase() === `/${handle.toLowerCase()}`; }
    catch { return false; }
  });
}

function snapshotFromSurface(surface: HTMLElement, profileUrl: string): ProfileSnapshot | null {
  const parsed = parseXProfileUrl(profileUrl);
  if (!parsed) return null;
  const handle = handleFromSurface(surface) ?? parsed.handle;
  const handleNode = [...surface.querySelectorAll('span')].find((node) => compactText(node.textContent) === `@${handle}`);
  const nameContainer = handleNode?.parentElement;
  const displayName = [...(nameContainer?.querySelectorAll('span') ?? [])]
    .map((node) => compactText(node.textContent))
    .find((value) => value && value !== `@${handle}`);
  return {
    ...parsed,
    handle,
    displayName: displayName ?? handle,
    avatarUrl: surface.querySelector<HTMLImageElement>('img[src*="profile_images"]')?.src,
    bioSnapshot: compactText(surface.querySelector('[data-testid="UserDescription"]')?.textContent),
    location: compactText(surface.querySelector('[data-testid="UserLocation"]')?.textContent),
    capturedAt: new Date().toISOString(),
  };
}

export function extractHoverCardProfile(surface: HTMLElement): ProfileSnapshot | null {
  const handle = handleFromSurface(surface);
  if (!handle) return null;
  const link = profileLink(surface, handle);
  return link ? snapshotFromSurface(surface, new URL(link.href, location.origin).href) : null;
}

export function extractFullProfile(surface: HTMLElement, currentUrl = location.href): ProfileSnapshot | null {
  return snapshotFromSurface(surface, currentUrl);
}
```

- [ ] **Step 4: Run extraction tests and compile**

Run: `npm test -- tests/x-profile-extraction.test.ts && npm run compile`

Expected: extraction tests PASS and TypeScript reports no errors.

- [ ] **Step 5: Commit the extraction slice**

```bash
git add src/x/extract-profile.ts tests/x-profile-extraction.test.ts
git commit -m "feat: extract profiles from X surfaces"
```

---

### Task 4: X Surface Observer and Draft Lifecycle

**Files:**
- Create: `src/x/draft-store.ts`
- Create: `src/x/surface-observer.ts`
- Create: `tests/x-surface-observer.test.ts`

**Interfaces:**
- Consumes: Task 3 extractor functions and `XSurfaceKind`.
- Produces: `AccountDraftStore`, `createXSurfaceObserver({ root, currentUrl, mount })`, `ObservedXSurface`.

- [ ] **Step 1: Write failing observer lifecycle tests**

Create `tests/x-surface-observer.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createXSurfaceObserver } from '@/src/x/surface-observer';

async function flushMutations() {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('X surface observer', () => {
  it('mounts a hover card once and cleans it up when removed', async () => {
    const mount = vi.fn(() => vi.fn());
    const observer = createXSurfaceObserver({ root: document.body, currentUrl: () => location.href, mount });
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.dataset.testid = 'HoverCard';
    dialog.innerHTML = '<a href="/theo"><span>Theo</span><span>@theo</span></a>';
    document.body.append(dialog);
    await flushMutations();
    expect(mount).toHaveBeenCalledTimes(1);
    dialog.append(document.createElement('span'));
    await flushMutations();
    expect(mount).toHaveBeenCalledTimes(1);
    dialog.remove();
    await flushMutations();
    expect(mount.mock.results[0].value).toHaveBeenCalledTimes(1);
    observer.disconnect();
  });

  it('mounts a full profile after SPA navigation changes the URL', async () => {
    let url = 'https://x.com/home';
    const mount = vi.fn(() => vi.fn());
    const observer = createXSurfaceObserver({ root: document.body, currentUrl: () => url, mount });
    url = 'https://x.com/exampledev';
    document.body.innerHTML = '<main data-testid="primaryColumn"><div data-testid="UserName"><span>Example</span><span>@exampledev</span></div></main>';
    await flushMutations();
    expect(mount).toHaveBeenCalledWith(expect.objectContaining({ kind: 'full-profile' }));
    observer.disconnect();
  });
});
```

- [ ] **Step 2: Run observer tests and verify the module is missing**

Run: `npm test -- tests/x-surface-observer.test.ts`

Expected: FAIL because the observer module does not exist.

- [ ] **Step 3: Implement draft storage and deduplicated observation**

Create `src/x/draft-store.ts`:

```ts
import { normalizeXHandle } from '@/src/shared/platforms/x';
import type { AccountContextSaveInput } from '@/src/shared/types';

export type AccountContextDraft = Omit<AccountContextSaveInput, 'profile'>;

export class AccountDraftStore {
  private drafts = new Map<string, AccountContextDraft>();
  get(handle: string) { return this.drafts.get(normalizeXHandle(handle)); }
  set(handle: string, draft: AccountContextDraft) { this.drafts.set(normalizeXHandle(handle), draft); }
  clear(handle: string) { this.drafts.delete(normalizeXHandle(handle)); }
  clearAll() { this.drafts.clear(); }
}
```

Create `src/x/surface-observer.ts`:

```ts
import { extractFullProfile, extractHoverCardProfile, type XSurfaceKind } from './extract-profile';
import type { ProfileSnapshot } from '@/src/shared/types';

export interface ObservedXSurface { kind: XSurfaceKind; host: HTMLElement; profile: ProfileSnapshot; }
export interface XSurfaceObserverOptions {
  root: HTMLElement;
  currentUrl: () => string;
  mount: (surface: ObservedXSurface) => () => void;
}

export function createXSurfaceObserver(options: XSurfaceObserverOptions) {
  const mounted = new Map<HTMLElement, () => void>();
  let queued = false;
  const scan = () => {
    queued = false;
    for (const [host, cleanup] of mounted) {
      if (!host.isConnected) { cleanup(); mounted.delete(host); }
    }
    const hoverCards = options.root.querySelectorAll<HTMLElement>('[role="dialog"][data-testid="HoverCard"]');
    for (const host of hoverCards) {
      if (mounted.has(host)) continue;
      const profile = extractHoverCardProfile(host);
      if (profile) mounted.set(host, options.mount({ kind: 'hover-card', host, profile }));
    }
    const profileHost = options.root.querySelector<HTMLElement>('[data-testid="primaryColumn"]');
    if (profileHost && !mounted.has(profileHost)) {
      const profile = extractFullProfile(profileHost, options.currentUrl());
      if (profile) mounted.set(profileHost, options.mount({ kind: 'full-profile', host: profileHost, profile }));
    }
  };
  const queueScan = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(scan);
  };
  const observer = new MutationObserver(queueScan);
  observer.observe(options.root, { childList: true, subtree: true });
  queueScan();
  return {
    disconnect() {
      observer.disconnect();
      for (const cleanup of mounted.values()) cleanup();
      mounted.clear();
    },
  };
}
```

- [ ] **Step 4: Run observer and extractor tests**

Run: `npm test -- tests/x-surface-observer.test.ts tests/x-profile-extraction.test.ts && npm run compile`

Expected: selected tests PASS and TypeScript reports no errors.

- [ ] **Step 5: Commit the lifecycle slice**

```bash
git add src/x/draft-store.ts src/x/surface-observer.ts tests/x-surface-observer.test.ts
git commit -m "feat: observe transient X profile surfaces"
```

---

### Task 5: Shared Inline Summary and Metadata Editor

**Files:**
- Create: `src/ui/MultiValueField.tsx`
- Create: `src/ui/ContextoProfileSurface.tsx`
- Create: `src/ui/contexto-profile-surface.css`
- Create: `tests/contexto-profile-surface.test.tsx`

**Interfaces:**
- Consumes: lookup/save message contracts, `LookupData`, `AccountDraftStore`, `ProfileSnapshot`, `XSurfaceKind`.
- Produces: `ContextoProfileSurface({ profile, kind, send, drafts })` and `MultiValueField`.

- [ ] **Step 1: Write failing editor and summary tests**

Create `tests/contexto-profile-surface.test.tsx` with a typed mock sender and tests:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ContextoProfileSurface } from '@/src/ui/ContextoProfileSurface';
import { AccountDraftStore } from '@/src/x/draft-store';

const profile = {
  platform: 'x' as const, handle: 'theo', displayName: 'Theo – t3.gg',
  profileUrl: 'https://x.com/theo', location: 'San Francisco',
};

it('shows the complete prefilled editor without saving an unknown account', async () => {
  const send = vi.fn(async (message) => message.type === 'contexto:account:lookup'
    ? { ok: true as const, lookup: true as const, account: undefined }
    : { ok: true as const, lookups: { companies: [], tags: [], folders: [] } });
  render(<ContextoProfileSurface profile={profile} kind="hover-card" send={send} drafts={new AccountDraftStore()} />);
  expect(await screen.findByLabelText('Display name')).toHaveValue('Theo – t3.gg');
  expect(screen.getByLabelText('X handle')).toHaveValue('@theo');
  expect(screen.getByLabelText('Position')).toBeVisible();
  expect(screen.getByLabelText('Profession')).toBeVisible();
  expect(screen.getByLabelText('Company')).toBeVisible();
  expect(screen.getByLabelText('Location')).toHaveValue('San Francisco');
  expect(screen.getByLabelText('How you know them')).toBeVisible();
  expect(screen.getByLabelText('Tags')).toBeVisible();
  expect(screen.getByLabelText('Folders')).toBeVisible();
  expect(send).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'contexto:account:saveContext' }));
});

it('saves distinct tag and folder selections and renders the priority summary', async () => {
  const send = vi.fn()
    .mockResolvedValueOnce({ ok: true, lookup: true, account: undefined })
    .mockResolvedValueOnce({ ok: true, lookups: { companies: [], tags: [], folders: [] } })
    .mockResolvedValueOnce({
      ok: true,
      account: {
        id: 'account_1', platform: 'x', handle: 'theo', normalizedHandle: 'theo',
        displayName: 'Theo Browne', profileUrl: 'https://x.com/theo', position: 'CEO',
        company: { id: 'company_1', name: 't3dotchat' },
        tags: [{ id: 'tag_1', name: 'Founder' }], folders: [{ id: 'folder_1', name: 'Friends' }],
      },
    });
  render(<ContextoProfileSurface profile={profile} kind="hover-card" send={send} drafts={new AccountDraftStore()} />);
  fireEvent.change(await screen.findByLabelText('Display name'), { target: { value: 'Theo Browne' } });
  fireEvent.change(screen.getByLabelText('Position'), { target: { value: 'CEO' } });
  fireEvent.change(screen.getByLabelText('Company'), { target: { value: 't3dotchat' } });
  fireEvent.change(screen.getByLabelText('Tags'), { target: { value: 'Founder' } });
  fireEvent.keyDown(screen.getByLabelText('Tags'), { key: 'Enter' });
  fireEvent.change(screen.getByLabelText('Folders'), { target: { value: 'Friends' } });
  fireEvent.keyDown(screen.getByLabelText('Folders'), { key: 'Enter' });
  fireEvent.click(screen.getByRole('button', { name: 'Save to Contexto' }));
  await waitFor(() => expect(send).toHaveBeenCalledWith(expect.objectContaining({
    type: 'contexto:account:saveContext',
    input: expect.objectContaining({ tagNames: ['Founder'], folderNames: ['Friends'] }),
  })));
  expect(await screen.findByText('Theo Browne')).toBeVisible();
  expect(screen.getByText('CEO at t3dotchat')).toBeVisible();
  expect(screen.getByText('Founder')).toBeVisible();
  expect(screen.queryByText('Friends')).not.toBeInTheDocument();
});

it('retains the editor and exposes retry after a failed save', async () => {
  const send = vi.fn()
    .mockResolvedValueOnce({ ok: true, lookup: true, account: undefined })
    .mockResolvedValueOnce({ ok: true, lookups: { companies: [], tags: [], folders: [] } })
    .mockResolvedValueOnce({ ok: false, error: 'Database unavailable' });
  render(<ContextoProfileSurface profile={profile} kind="full-profile" send={send} drafts={new AccountDraftStore()} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Save to Contexto' }));
  expect(await screen.findByText('Database unavailable')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Retry save' })).toBeVisible();
  expect(screen.getByLabelText('Display name')).toHaveValue('Theo – t3.gg');
});
```

- [ ] **Step 2: Run component tests and verify the components are missing**

Run: `npm test -- tests/contexto-profile-surface.test.tsx`

Expected: FAIL because the new components do not exist.

- [ ] **Step 3: Implement the reusable multi-value control and profile surface**

Implement `MultiValueField` with this public contract:

```tsx
export interface MultiValueFieldProps {
  label: 'Tags' | 'Folders';
  values: string[];
  suggestions: string[];
  onChange(values: string[]): void;
  disabled?: boolean;
}

export function MultiValueField(props: MultiValueFieldProps) {
  // Render selected removable chips, an input with the exact label, a filtered
  // listbox for existing suggestions, and Enter-to-create using trimmed,
  // case-insensitive de-duplication. Removing a chip calls onChange with the
  // complete remaining value set.
}
```

Implement `ContextoProfileSurface` with this contract and state machine:

```tsx
export interface ContextoProfileSurfaceProps {
  profile: ProfileSnapshot;
  kind: XSurfaceKind;
  send(message: ContextoRequest): Promise<ContextoResponse>;
  drafts: AccountDraftStore;
}

type SurfaceState =
  | { name: 'loading' }
  | { name: 'editing'; account?: AccountSummary; error?: string; saving: boolean }
  | { name: 'summary'; account: AccountSummary }
  | { name: 'lookup-error'; error: string };
```

On mount, send `contexto:account:lookup` and `contexto:lookups:list` concurrently. A missing account initializes a draft from `profile`; a found account renders summary. Every editor change stores the draft. Save sends `contexto:account:saveContext`; success clears the draft and renders summary. Cancel on an existing account restores summary; cancel on a new account restores the pristine prefilled editor because the approved unknown-account state remains visible.

Implement `src/ui/contexto-profile-surface.css` using Shadow DOM-safe selectors and variables:

```css
:host { all: initial; color-scheme: light dark; font-family: ui-sans-serif, system-ui, sans-serif; }
.contexto-surface { --ctx-bg:#fff; --ctx-text:#0f1419; --ctx-muted:#536471; --ctx-border:#eff3f4; --ctx-accent:#5b3fd6; border-top:1px solid var(--ctx-border); color:var(--ctx-text); padding:12px 0; }
:host([data-theme="dark"]) .contexto-surface { --ctx-bg:#000; --ctx-text:#e7e9ea; --ctx-muted:#71767b; --ctx-border:#2f3336; --ctx-accent:#9b8afb; }
button, input { font:inherit; }
button:focus-visible, input:focus-visible { outline:2px solid var(--ctx-accent); outline-offset:2px; }
@media (prefers-reduced-motion: reduce) { * { scroll-behavior:auto !important; transition:none !important; } }
```

Complete the stylesheet for labeled fields, responsive two-column rows, chips, listboxes, inline errors, disabled actions, and the compact summary. Do not use fixed positioning.

- [ ] **Step 4: Run component tests, all tests, and compile**

Run: `npm test -- tests/contexto-profile-surface.test.tsx && npm test && npm run compile`

Expected: all tests PASS and TypeScript reports no errors.

- [ ] **Step 5: Commit the shared UI slice**

```bash
git add src/ui/MultiValueField.tsx src/ui/ContextoProfileSurface.tsx src/ui/contexto-profile-surface.css tests/contexto-profile-surface.test.tsx
git commit -m "feat: add inline Contexto profile editor"
```

---

### Task 6: Content-Script Mounting, Overlay Retirement, and Release Verification

**Files:**
- Modify: `entrypoints/content.ts`
- Delete: `src/ui/ProfilePanel.tsx`
- Delete: `src/ui/profile-panel.css`
- Modify: `README.md`
- Modify: `docs/features/profile-metadata.md`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `createXSurfaceObserver`, `AccountDraftStore`, `ContextoProfileSurface`, and inline CSS from Tasks 3–5.
- Produces: final multi-mount X content script and documented browser workflow.

- [ ] **Step 1: Replace the fixed overlay with isolated per-surface mounts**

Rewrite `entrypoints/content.ts` around the observer:

```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import surfaceCss from '@/src/ui/contexto-profile-surface.css?inline';
import { ContextoProfileSurface } from '@/src/ui/ContextoProfileSurface';
import { AccountDraftStore } from '@/src/x/draft-store';
import { createXSurfaceObserver, type ObservedXSurface } from '@/src/x/surface-observer';
import type { ContextoRequest, ContextoResponse } from '@/src/shared/messages';

const drafts = new AccountDraftStore();
const send = (message: ContextoRequest): Promise<ContextoResponse> => browser.runtime.sendMessage(message);

function detectTheme(host: HTMLElement): 'light' | 'dark' {
  const color = getComputedStyle(host).backgroundColor.match(/\d+/g)?.map(Number);
  if (!color || color.length < 3) return 'light';
  return (color[0] * 299 + color[1] * 587 + color[2] * 114) / 1000 < 128 ? 'dark' : 'light';
}

function mountSurface(surface: ObservedXSurface): () => void {
  const mountHost = document.createElement('div');
  mountHost.dataset.contextoSurface = surface.kind;
  const shadow = mountHost.attachShadow({ mode: 'open' });
  shadow.host.setAttribute('data-theme', detectTheme(surface.host));
  const style = document.createElement('style');
  style.textContent = surfaceCss;
  const app = document.createElement('div');
  shadow.append(style, app);
  surface.host.append(mountHost);
  const root = createRoot(app);
  root.render(<ContextoProfileSurface profile={surface.profile} kind={surface.kind} send={send} drafts={drafts} />);
  return () => { root.unmount(); mountHost.remove(); };
}

export default defineContentScript({
  matches: ['https://x.com/*', 'https://twitter.com/*'],
  cssInjectionMode: 'ui',
  main(ctx) {
    const observer = createXSurfaceObserver({ root: document.body, currentUrl: () => location.href, mount: mountSurface });
    ctx.onInvalidated(() => { observer.disconnect(); drafts.clearAll(); });
  },
});
```

Before accepting this step, manually inspect actual X markup and refine each detector's insertion point so the host is appended after X's native card content and after the full profile header, not at the bottom of the entire primary column. Update the detector fixtures to match the observed stable attributes.

- [ ] **Step 2: Remove the old overlay and update durable documentation**

Delete `src/ui/ProfilePanel.tsx` and `src/ui/profile-panel.css`. Update README's current MVP bullet to:

```md
- Inline X/Twitter hover-card and full-profile integrations for viewing and explicitly saving relationship metadata without leaving X.
```

Update `docs/features/profile-metadata.md` to document the unsaved full editor, explicit save, compact saved summary, and separate equivalent tags/folders controls. Add `.superpowers/` to `.gitignore` so visual-companion session files remain local scratch data.

- [ ] **Step 3: Run the full automated verification suite**

Run: `npm run compile && npm test && npm run build`

Expected:

- TypeScript exits 0 with no diagnostics.
- Vitest reports all tests passing.
- WXT produces `.output/chrome-mv3` successfully.

- [ ] **Step 4: Perform Chrome and Vivaldi manual validation**

Load `.output/chrome-mv3` unpacked and verify this checklist in both browsers:

```text
[ ] Home-feed avatar hover card mounts one Contexto section.
[ ] Home-feed username hover card shows the same account and no duplicate section.
[ ] Search-result and notification hover cards mount correctly.
[ ] Hovering an unknown account leaves IndexedDB accounts/changeLog counts unchanged.
[ ] Unknown-account display name and handle match the hovered account.
[ ] Full editor is visible immediately for an unknown account.
[ ] Tags and folders are separate and support select, create, and remove.
[ ] Save creates the account once and collapses to display name, role/company, and tags.
[ ] Edit and Cancel restore the expected saved state.
[ ] Removing a tag does not remove a folder, and vice versa.
[ ] A transient hover-card remount restores the unsaved draft.
[ ] A full profile reached by direct load and SPA navigation mounts inline.
[ ] No fixed Contexto overlay remains.
[ ] Light theme, dark theme, and keyboard-only editing remain usable.
[ ] X navigation, follow buttons, profile links, and scrolling still work normally.
```

If a detector requires adjustment from real X markup, first add the observed sanitized structure as a failing fixture test, then make the smallest detector change and rerun the full automated suite.

- [ ] **Step 5: Commit the integrated release slice**

```bash
git add entrypoints/content.ts README.md docs/features/profile-metadata.md .gitignore src/x tests
git add -u src/ui/ProfilePanel.tsx src/ui/profile-panel.css
git commit -m "feat: integrate Contexto into X profile surfaces"
```

---

## Final Verification

- [ ] Run `git status --short` and confirm only intentionally ignored local `.superpowers/` state remains.
- [ ] Run `npm run compile && npm test && npm run build` once more from the final commit.
- [ ] Confirm `git log -7 --oneline` shows the design, plan, and focused implementation commits.
- [ ] Invoke `superpowers:verification-before-completion` before claiming the feature is complete.
- [ ] Invoke `superpowers:requesting-code-review` for an independent requirements and quality review.
- [ ] Use `superpowers:finishing-a-development-branch` to choose merge, push/PR, or cleanup.
