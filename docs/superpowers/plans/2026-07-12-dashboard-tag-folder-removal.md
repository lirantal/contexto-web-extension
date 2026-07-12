# Dashboard Tag And Folder Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add immediate, accessible removal controls for account tag and folder assignments in the Contexto dashboard.

**Architecture:** Add focused repository functions that delete only the matching many-to-many join record and return the refreshed account summary. Wire compact `×` buttons in the dashboard chips directly to those functions and rely on Dexie's live query to refresh the view.

**Tech Stack:** TypeScript, React 19, Dexie, Testing Library, Vitest, CSS

## Global Constraints

- Removal persists immediately without a separate Save action.
- Removing an assignment must not delete or mutate the underlying tag or folder entity.
- Tag and folder Add controls remain unchanged.
- No confirmation dialog is shown.
- Removal controls use the accessible names `Remove <name> from Tags` and `Remove <name> from Folders`.
- Global deletion, renaming, and broader metadata-editor redesign are out of scope.

---

### Task 1: Repository Assignment Removal

**Files:**
- Modify: `tests/repositories.test.ts`
- Modify: `src/data/repositories.ts`

**Interfaces:**
- Consumes: existing `getAccountSummary(accountId, database)` and `recordChange(database, 'account', accountId, 'update')` repository helpers.
- Produces: `removeTag(accountId: string, tagId: string, database?: ContextoDatabase): Promise<AccountSummary>` and `removeFolder(accountId: string, folderId: string, database?: ContextoDatabase): Promise<AccountSummary>`.

- [ ] **Step 1: Write the failing repository test**

Add `getLookups`, `removeFolder`, and `removeTag` to the repository imports, then add this test after the dashboard search test:

```ts
it('removes account tag and folder assignments without deleting shared lookups', async () => {
  const first = await ensureAccountFromProfile(
    { platform: 'x', handle: 'First', displayName: 'First', profileUrl: 'https://x.com/first' },
    database,
  );
  const second = await ensureAccountFromProfile(
    { platform: 'x', handle: 'Second', displayName: 'Second', profileUrl: 'https://x.com/second' },
    database,
  );
  const assignedFirst = await assignFolder(first.id, 'Friends', database);
  const withBoth = await assignTag(first.id, 'founder', database);
  await assignFolder(second.id, 'Friends', database);
  await assignTag(second.id, 'founder', database);

  const withoutTag = await removeTag(first.id, withBoth.tags[0].id, database);
  const withoutFolder = await removeFolder(first.id, assignedFirst.folders[0].id, database);

  expect(withoutTag.tags).toEqual([]);
  expect(withoutFolder.folders).toEqual([]);
  const secondSummary = await getAccountByHandle('x', 'second', database);
  expect(secondSummary?.tags.map(({ name }) => name)).toEqual(['founder']);
  expect(secondSummary?.folders.map(({ name }) => name)).toEqual(['Friends']);
  const lookups = await getLookups(database);
  expect(lookups.tags.map(({ name }) => name)).toContain('founder');
  expect(lookups.folders.map(({ name }) => name)).toContain('Friends');
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npx vitest run tests/repositories.test.ts
```

Expected: FAIL during module loading because `removeTag` and `removeFolder` are not exported by `src/data/repositories.ts`.

- [ ] **Step 3: Implement the minimal removal operations**

Add the functions immediately after `assignFolder` in `src/data/repositories.ts`:

```ts
export async function removeTag(accountId: string, tagId: string, database = db): Promise<AccountSummary> {
  const assignment = await database.accountTags
    .where('[accountId+tagId]')
    .equals([accountId, tagId])
    .first();

  if (assignment) {
    await database.accountTags.delete(assignment.id);
    await recordChange(database, 'account', accountId, 'update');
  }

  return getAccountSummary(accountId, database) as Promise<AccountSummary>;
}

export async function removeFolder(accountId: string, folderId: string, database = db): Promise<AccountSummary> {
  const assignment = await database.folderAccounts
    .where('[folderId+accountId]')
    .equals([folderId, accountId])
    .first();

  if (assignment) {
    await database.folderAccounts.delete(assignment.id);
    await recordChange(database, 'account', accountId, 'update');
  }

  return getAccountSummary(accountId, database) as Promise<AccountSummary>;
}
```

- [ ] **Step 4: Run the focused repository test and verify GREEN**

Run:

```bash
npx vitest run tests/repositories.test.ts
```

Expected: PASS, including the new removal test.

- [ ] **Step 5: Commit the repository behavior**

```bash
git add tests/repositories.test.ts src/data/repositories.ts
git commit -m "feat: remove account tag and folder assignments"
```

---

### Task 2: Dashboard Removal Controls

**Files:**
- Modify: `tests/dashboard-settings.test.tsx`
- Modify: `src/ui/Dashboard.tsx`
- Modify: `entrypoints/options/style.css`

**Interfaces:**
- Consumes: `removeTag(accountId, tagId)` and `removeFolder(accountId, folderId)` from Task 1.
- Produces: one `type="button"` chip control per assigned tag/folder with the agreed accessible labels.

- [ ] **Step 1: Extend dashboard mocks and write the failing interaction test**

Extend the hoisted mocks:

```ts
const mocks = vi.hoisted(() => ({
  accounts: [] as Array<Record<string, unknown>>,
  clearTargetHistory: vi.fn(),
  getSettings: vi.fn(),
  removeFolder: vi.fn(),
  removeTag: vi.fn(),
}));
```

Make the live query return `mocks.accounts` for the account query:

```ts
vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: vi.fn((_query, dependencies?: unknown[]) => dependencies?.length
    ? mocks.accounts
    : { companies: [], tags: [], folders: [] }),
}));
```

Expose the two removal mocks from the repository mock:

```ts
removeFolder: mocks.removeFolder,
removeTag: mocks.removeTag,
```

Reset `mocks.accounts = []` in `beforeEach`, then add this test:

```tsx
it('immediately removes tag and folder assignments from the selected account', async () => {
  mocks.accounts = [{
    id: 'account-1',
    platform: 'x',
    handle: 'founder',
    normalizedHandle: 'founder',
    displayName: 'Founder',
    profileUrl: 'https://x.com/founder',
    syncState: 'local-only',
    createdAt: '2026-07-12T00:00:00.000Z',
    updatedAt: '2026-07-12T00:00:00.000Z',
    tags: [{
      id: 'tag-1', name: 'founder', normalizedName: 'founder',
      createdAt: '2026-07-12T00:00:00.000Z', updatedAt: '2026-07-12T00:00:00.000Z',
    }],
    folders: [{
      id: 'folder-1', name: 'Friends', normalizedName: 'friends',
      createdAt: '2026-07-12T00:00:00.000Z', updatedAt: '2026-07-12T00:00:00.000Z',
    }],
  }];
  const user = userEvent.setup();
  render(<Dashboard />);

  await user.click(await screen.findByRole('button', { name: 'Remove founder from Tags' }));
  await user.click(screen.getByRole('button', { name: 'Remove Friends from Folders' }));

  expect(mocks.removeTag).toHaveBeenCalledWith('account-1', 'tag-1');
  expect(mocks.removeFolder).toHaveBeenCalledWith('account-1', 'folder-1');
});
```

- [ ] **Step 2: Run the dashboard test and verify RED**

Run:

```bash
npx vitest run tests/dashboard-settings.test.tsx
```

Expected: FAIL because no buttons named `Remove founder from Tags` or `Remove Friends from Folders` exist.

- [ ] **Step 3: Wire the repository operations into dashboard chips**

Import `removeFolder` and `removeTag` from the repository module. Add these helpers inside `AccountDetail`:

```ts
async function removeAssignedTag(tagId: string) {
  await removeTag(account.id, tagId);
}

async function removeAssignedFolder(folderId: string) {
  await removeFolder(account.id, folderId);
}
```

Replace the tag chip row with:

```tsx
<div className="chip-row">{account.tags.map((tag) => (
  <span className="chip" key={tag.id}>
    {tag.name}
    <button type="button" aria-label={`Remove ${tag.name} from Tags`}
      onClick={() => removeAssignedTag(tag.id)}>×</button>
  </span>
))}</div>
```

Replace the folder chip row with:

```tsx
<div className="chip-row">{account.folders.map((folder) => (
  <span className="chip folder-chip" key={folder.id}>
    {folder.name}
    <button type="button" aria-label={`Remove ${folder.name} from Folders`}
      onClick={() => removeAssignedFolder(folder.id)}>×</button>
  </span>
))}</div>
```

- [ ] **Step 4: Match the existing compact chip-button styling**

Add this rule after `.chip` in `entrypoints/options/style.css`:

```css
.chip button {
  min-height: 0;
  border: 0;
  padding: 0;
  background: transparent;
  color: inherit;
}
```

- [ ] **Step 5: Run the dashboard test and verify GREEN**

Run:

```bash
npx vitest run tests/dashboard-settings.test.tsx
```

Expected: PASS, including the removal interaction test.

- [ ] **Step 6: Commit the dashboard controls**

```bash
git add tests/dashboard-settings.test.tsx src/ui/Dashboard.tsx entrypoints/options/style.css
git commit -m "feat: remove dashboard tag and folder assignments"
```

---

### Task 3: Full Verification

**Files:**
- Verify only; no source changes expected.

**Interfaces:**
- Consumes: completed repository and dashboard behavior from Tasks 1 and 2.
- Produces: verification evidence for tests, types, and production bundling.

- [ ] **Step 1: Run the full automated test suite**

Run:

```bash
npm test
```

Expected: all Vitest files and tests pass.

- [ ] **Step 2: Run TypeScript compilation**

Run:

```bash
npm run compile
```

Expected: exit code 0 with no TypeScript errors.

- [ ] **Step 3: Run the production build**

Run:

```bash
npm run build
```

Expected: exit code 0 and a successful Chrome extension bundle.

- [ ] **Step 4: Confirm the final diff is scoped**

Run:

```bash
git status --short
git diff --check HEAD~2..HEAD
```

Expected: no uncommitted feature files and no whitespace errors; unrelated pre-existing workspace files remain untouched.
