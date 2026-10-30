# Export private X Lists to Contexto

This is a standalone local Node CLI, not extension UI. It uses X's official [`@xdevplatform/xdk`](https://docs.x.com/xdks/typescript/install), pinned in the lockfile. Use Node **22+**. Run `npm install` in this repository first. No X credentials are shipped in the extension bundle.

The scope is owned private Lists and their member profiles. It does not request Posts, DMs, followers, activity subscriptions, or downloaded avatar/media bytes. The [Activity API](https://docs.x.com/x-api/activity/introduction) is for live events and is not needed here. See the [owned Lists](https://docs.x.com/x-api/users/get-owned-lists) and [List members](https://docs.x.com/x-api/lists/get-list-members) references.

## Workflow and API costs

The workflow is **configure exclusions → authenticate → discover → review → export → edit mappings → convert → import**. Mapping edits can happen any time after discovery, including before downloading members.

All CLI commands below start with `npm run x:lists --` and run from the repository root.

| Step / command | What it does | X network requests? | Paid X data reads? |
| --- | --- | --- | --- |
| `config`, then edit `config.json` | Creates the exclusion scaffold; choose List names whose members must not be downloaded. | No | No |
| `auth --manual` (container) | Opens user authorization in your browser; validates the pasted callback and saves access/refresh tokens. | Yes, OAuth only | No resource reads; does not discover Lists or fetch profiles |
| `discover` | Verifies the authenticated account, paginates owned Lists, identifies private Lists, applies exclusion rules, scaffolds mappings, and estimates member-download cost. **Does not fetch members.** | Yes | Yes: identity and List reads |
| `report` | Recomputes the local report using current exclusion rules: selected/excluded Lists, unmatched names, member counts, completion, and estimate. Does not refresh X data. | No | No |
| `export --max-pages 1` (optional) | Downloads a sample of at most one member page for selected Lists; saves profiles and membership evidence. | Yes | Yes: identity and member reads; retries can add requests |
| `export --max-pages 100` | Continues selected Lists from saved checkpoints, up to the configured number of new member pages. Repeat until complete. | Yes | Yes: identity and member reads; completed pages are not deliberately fetched again |
| `mapping`, then edit `mapping.json` | Adds missing mapping entries without replacing edits; choose the Circles/tags each List contributes. Discovery already creates the initial file. | No | No |
| `convert` | Deduplicates people, combines mapped labels, and creates a Contexto backup-format import file from the completed local export. | No | No |
| Contexto dashboard → Settings → Import → Full restore | Imports the generated file into the fresh Contexto database after the existing preview/recovery confirmation. **Replaces the contact database.** | No | No |

Only `discover` and `export` make billable data requests. OAuth authorization/refresh uses the network but does not itself download billable List/member resources. Actual billing, deduplication, and current rates are governed by X; check the Console and the pricing discussion below. `--max-pages` is a per-run member-page limit, not a dollar cap.

Review the initial estimate before exporting. A one-page sample lets you compare returned data and actual Console charges, but is optional: you can proceed directly with `export --max-pages 100`. This command keeps processing selected Lists until all are complete or 100 new member pages have been saved; it does not pause after each page/List. If the limit is reached first, repeat the same command to resume. The report must say complete for the selected Lists before conversion. Re-editing mappings and rerunning `convert` do not download data or incur additional X data-read charges. Re-running `discover`/`export` still verifies your identity even when their saved pagination is complete.

`report.json` is generated output to review, not a configuration file to edit. Change exclusions in `config.json` and labels in `mapping.json`, then regenerate the report or import artifact with their respective commands. Mapping edits may wait until after export, but must be finished before conversion.

## Configuration files and generated artifacts

Paths below are relative to the repository root. Runtime files default to `.local/x-lists/`; use the same `--dir` for every command if selecting another directory. Env-file paths remain relative to the repository root, independent of `--dir`.

| File | Who edits or maintains it? | Role |
| --- | --- | --- |
| `.env` or `.env.x-export` | You | `X_CLIENT_ID` and, only for a confidential app, `X_CLIENT_SECRET`. Used by auth/online commands. |
| `.local/x-lists/config.json` | You; `config` scaffolds it | `skipListNames` excludes entire Lists **before member downloads** and from conversion. Configure before export. |
| `.local/x-lists/tokens.json` | CLI | OAuth session and rotated refresh tokens. Do not manually edit or share. |
| `.local/x-lists/archive.json` | CLI | Versioned raw List/member response pages, membership evidence, timestamps, and resume checkpoints. Preserve it for offline conversion and recovery; do not hand-edit checkpoints. |
| `.local/x-lists/mapping.json` | You; discovery/`mapping` scaffold it | List IDs mapped to `circles`, `tags`, and conversion-only `skip`. Configure labels before conversion. |
| `.local/x-lists/report.json` | CLI | Generated completeness, selection, count, and estimate report. Rebuild with `report` after exclusion changes. |
| `.local/x-lists/contexto-import.contexto-backup.json` | CLI | Generated backup format 2 file to select in the Contexto dashboard. Rebuild with `convert` after mapping changes. |

**Exclusions and mappings have different jobs:** `config.json` prevents member downloads; `mapping.json` controls the imported labels. Mapping `skip: true` alone does not prevent paid downloads. Both files can be edited offline. Scaffolding preserves your existing edits.

For example, mapping List **DevRels** to Circle **DevRel** and tag **community**, and List **Speakers** to Circle **Speakers**, gives a person on both Lists two Circles and one tag. Shared labels/contacts are deduplicated. Excluding DevRels through `config.json` removes that List's contribution, while the same person can still enter through Speakers.

## Container quick reference (Codex Cmd+J)

Keep the app configured as Native/public with callback `http://127.0.0.1:8787/callback`. The Website URL can identify the project, e.g. `https://github.com/lirantal/contexto-web-extension`; no ngrok tunnel is needed. Put `X_CLIENT_ID=...` in `.env` or `.env.x-export`, never in chat.

```sh
npm run x:lists -- config
# Edit .local/x-lists/config.json to set skipListNames (see below).
npm run x:lists -- auth --manual
# Approve in your normal browser. A loopback connection error is expected.
# Paste the FULL redirected address into the waiting terminal prompt, not chat.
npm run x:lists -- discover
npm run x:lists -- report
# Review the selected/excluded Lists and estimate before fetching members.
npm run x:lists -- export --max-pages 100
# Optional first-run sample instead: export --max-pages 1
```

Do not repeat auth if your saved authorization is still valid; the CLI refreshes it automatically. Continue export in bounded runs after checking the sample and Console charges. This quick reference is the container workflow; the detailed sections below explain setup, resume, mapping, and import.

## 1. Configure your X app

1. In the [X Developer Console](https://console.x.com/), create/select an app under your own X developer account. Add credits and configure a spending limit. Leave automatic recharge disabled during the sample run unless you intentionally want it.
2. Enable OAuth 2.0 user authentication. Choose **Native App / public client** if offered. This CLI uses Authorization Code with PKCE; an app-only Bearer Token cannot substitute for your user authorization to private Lists.
3. Register this exact callback URI: **`http://127.0.0.1:8787/callback`**. If X also asks for a website, use your real project website or repository URL. The website field is separate from the callback.
4. Copy the OAuth 2.0 **Client ID** (not the API key) into a file named `.env.x-export` in the repository root:

   ```dotenv
   X_CLIENT_ID=your_oauth2_client_id
   ```

   Native/public clients do not need a secret. If you already put `X_CLIENT_ID` in the root `.env` file, that also works: the CLI quietly loads `.env` first and `.env.x-export` second (the latter wins for duplicate keys; pre-existing shell environment variables take precedence over both). Missing optional files produce no notices; you do not need to create an empty `.env`. Unreadable files still report an error. If you deliberately configure a confidential web app instead, add its OAuth 2.0 `X_CLIENT_SECRET` locally too. Do not put tokens/secrets in chat, source code, mapping files, or command-line arguments. `.env*` is ignored by Git. Keep its filesystem permissions private, e.g. `chmod 600 .env.x-export` on Unix.
5. For a container or remote terminal (including Codex's Cmd+J terminal), run:

   ```sh
   npm run x:lists -- auth --manual
   ```

   Open the printed authorization URL in your normal browser and authorize the X account that owns your private Lists. The browser redirects to `http://127.0.0.1:8787/callback?...`; it will usually display a connection error because no local server is listening. This is expected. Copy the **entire URL from the address bar**, including `code` and `state`, into the CLI's waiting prompt in the container and press Enter. Paste is hidden. Do not paste it into chat or run it as a shell command. Finish promptly; the prompt expires after five minutes and X authorization codes are short-lived. If it expires, rerun the command for a fresh authorization URL. This mode starts no listener and requires no port publishing, forwarding, or ngrok tunnel. Leave the registered callback URI unchanged. The copied URL is validated for the exact callback origin/path and random state before the PKCE exchange.

   If the CLI and browser run directly on the same computer instead, the original listener mode is also available:

   ```sh
   npm run x:lists -- auth
   ```

   This default mode listens only on loopback port 8787 and receives the callback automatically. Use `--manual` for the container workflow described above.

The CLI requests `list.read`, `users.read`, `tweet.read` (an endpoint-required read scope), and `offline.access`. It makes no Post requests. X documents `list.read` as including private Lists; offline access supplies refresh tokens. See [OAuth scopes and PKCE](https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code).

The callback validates a random state and uses a PKCE verifier, then stores tokens in `.local/x-lists/tokens.json` with Unix mode 0600. The directory is private and ignored by Git. Refresh-token rotations are saved before continuing. A denied/expired authorization can be replaced by running `auth` again. No token values are logged. This is private local storage, not encryption at rest: protect your device and revoke the app's access in X when finished.

## 2. Discover and review the estimate

```sh
npm run x:lists -- discover
```

This verifies your authenticated account, paginates all owned Lists, and selects only private Lists. It saves even empty private Lists, an initial mapping, and `report.json`. It is a paid API operation, including the identity lookup. Public/followed Lists are outside the export scope.

### Exclude Lists before member downloads

Run this **offline** scaffold command at any time, including before auth/discovery:

```sh
npm run x:lists -- config
```

Edit `.local/x-lists/config.json` in your editor. For example:

```json
{
  "version": 1,
  "skipListNames": [
    "Archived contacts",
    "Personal"
  ]
}
```

Use the actual List names from X. Matching uses the entire name, ignores case, trims leading/trailing whitespace, and collapses repeated internal whitespace. There are no substrings, wildcard patterns, or regular expressions. If multiple private Lists share a matching name, all are excluded. The config scaffold starts with an empty array (skip nothing), preserves existing edits/unknown fields, and never needs credentials or API calls. A custom `--dir` stores its own `config.json` beside that run's other files.

Every export invocation reloads this file **before member requests**. Excluded Lists have no members downloaded, need no completed membership pagination, are omitted from new mapping entries, and contribute no people/Circles/tags to conversion. List metadata still appears in discovery because X must return owned List names before the program can match the rules. Identity/discovery calls may still be billed. `--list-id` cannot override an exclusion.

After discovery, run `npm run x:lists -- report` offline to check `excluded`, `selectedLists`, `excludedLists`, and `unmatchedSkipListNames`. The cost estimate counts only selected Lists. An unmatched configured name prevents member export and conversion: correct its spelling or remove it if it is not a discovered owned private List. This avoids silently fetching a List you intended to skip. Matching uses names in this archive's discovery snapshot; start a fresh snapshot if Lists have since been renamed.

Changing the config does not delete previously downloaded pages or mapping edits. Already-paid reads cannot be undone, but conversion ignores those excluded Lists' cached memberships. Removing an exclusion lets the next export resume its existing checkpoint (or begin its member downloads). If a person is also on an included List, that person is still imported through the included List and receives only its mapped labels. Exclusions are not global person blacklists.

The estimate sums selected Lists' reported membership counts at the published $0.01/user read rate, before overlap deduplication. It is an estimate, not a billing guarantee or spending cap; discovery, retries, changing memberships, UTC-day boundaries, and X's pricing/deduplication behavior can change actual charges. Missing counts produce no estimate. Confirm actual [pricing and spending limits](https://docs.x.com/x-api/getting-started/pricing) in your Console. Set the X spending limit before exporting members.

## 3. Export, optionally starting with a sample

```sh
# Optional: fetch at most one member page (up to 100 users), then inspect the files and Console charges.
npm run x:lists -- export --max-pages 1

# Optional: sample a specific discovered private List.
npm run x:lists -- export --list-id 123456789 --max-pages 1

# Export all selected Lists, or continue at saved pagination tokens, up to 100 new member pages this run.
npm run x:lists -- export --max-pages 100
npm run x:lists -- report
```

Repeat export until the report says complete for the selected Lists. Excluded Lists may remain individually incomplete; `excluded: true` explains why they need no member pages. `--max-pages` limits successful member pages per invocation, not dollars or total HTTP attempts; authentication checks and bounded retries are additional. A member page can cost approximately $1 for 100 newly billed users at the published rate. Completed pages are not fetched again. Discovery itself has a 100-page per-run guard and resumes on the next `discover` command.

The exporter requests the explicit profile field set in `scripts/x-lists/core.mjs`: identity, bio, website/entities, location, join date, avatar/banner URLs, protection/verification, metrics, and supported relationship/subscription fields. Availability depends on X and the authorized account. It does not request email or expand related Posts/affiliated users. It preserves every returned field and unknown field. This is all data returned for those requested fields, not a promise of access to private/entitlement-restricted metadata.

Each response page is saved atomically with the requested pagination token and capture timestamp before progress advances on disk. Errors with partial data are retained, stop the run, and prevent conversion until a successful retry resolves that page. HTTP 401 can refresh once; 429/5xx retries are bounded. A rate-limit wait longer than a minute stops with a checkpoint so you can retry later. Network/credit/permission failures stop without advancing the page. After a crash between receiving and saving a response, that page may need downloading again.

`report.json` shows unique users, membership counts, per-List completion, unresolved API errors, and reported-versus-returned count discrepancies. X does not supply a transactionally consistent snapshot across these requests: avoid editing Lists during export. Count discrepancies are warnings, not evidence that pagination is complete; completion requires exhausting each pagination chain without unresolved errors. Suspended/deleted/unavailable accounts may not be returned or may produce API errors. Inspect the report and X Console before calling the export complete.

An archive is one discovery/export run. Re-running completed commands resumes/retains it; it does not refresh current memberships. For a new snapshot, use a new ignored directory, e.g. `--dir .local/x-lists-next`, and run auth/discover/export there. The account identity is checked on every online command to prevent mixing two accounts. Do not run multiple commands against one directory at once. If a process was forcibly terminated, verify it is stopped before removing that directory's `.lock` file and resuming.

## 4. Edit the mapping offline

Discovery creates `mapping.json`; you can scaffold missing entries again without network calls:

```sh
npm run x:lists -- mapping
```

```json
{
  "version": 1,
  "lists": {
    "123456789": {
      "listName": "DevRels",
      "circles": ["DevRel"],
      "tags": ["community"],
      "skip": false
    }
  }
}
```

Keys are List IDs. `listName` is a readable label; changing it does not change matching. Scaffolding initially maps each selected List to a Circle named after it, preserving existing edits/unknown mapping fields when run again. Configure zero or multiple Circles/tags, or set `skip: true` to exclude that List's contribution during conversion only. Membership labels from included Lists combine per numeric user ID; case/whitespace-equivalent labels and duplicate assignments collapse. Two Lists can map to the same Circle. Empty included Lists create their configured label definitions without contacts. Every selected private List must have an explicit mapping, even if mapping-skipped; Lists excluded by `config.json` need no mapping.

Mapping `skip` controls conversion only and does not save API reads. Use `config.json` → `skipListNames` to avoid downloading members entirely. Conversion requires complete pagination for all selected Lists, even mapping-skipped ones, but not for config-excluded Lists. Keeping this distinction prevents an unfinished sample of selected Lists from looking like a full export.

## 5. Generate and import the Contexto file

```sh
npm run x:lists -- convert
```

No network or credentials are needed for mapping, report, or conversion. Conversion creates `.local/x-lists/contexto-import.contexto-backup.json` with **backup format 2**, all required tables, unique contacts, and many-to-many joins. Circles use the compatible `folders`/`folderAccounts` backup keys. IDs are deterministic, but this is not a contact-update/merge engine. Missing handles, identity collisions, unresolved API errors, and incomplete pagination stop conversion.

The contact's `createdAt`/`updatedAt` are the conversion time in Contexto, not X's account creation date. Every source profile observation—including X's original `created_at`, public metrics, unknown fields, List ID/name, and capture time—is retained under the account's `xImport.profiles` field. Standard profile fields populate the dashboard; expanded website URLs are preferred when supplied. Role/company are not inferred from bios. Unknown snapshot fields remain preserved through ordinary edits and Contexto backup round trips. Re-conversion can replace the generated import artifact; raw archive and mapping files remain intact.

Conversion also promotes `public_metrics.followers_count` / `following_count` into dashboard audience counts and `connection_status` into the follows-you observation. `followed_by` means the exported person follows the authenticated archive owner; an explicit status array without it means No, and a missing status means Unknown. The owner handle/ID and page capture time are retained as provenance. Newer observations take precedence when a person appears in multiple Lists. Set **My X handle** in the dashboard to the archive owner's handle to use the relationship filter. See [X's user field dictionary](https://docs.x.com/x-api/fundamentals/data-dictionary).

Existing archives that already contain these fields can be converted again locally without another paid download. No additional API requests are introduced for these observations.

Open **Contexto dashboard → Settings → Import**, select the generated file, review the preview, select **Full restore**, download/verify the recovery backup, and explicitly confirm replacement. This is intended for your fresh Contexto database. It replaces the contact database and does not merge existing relationship notes. See [Backup and restore](../features/backup-restore.md) for the current confirmation/recovery contract. A later dedicated contact merger remains separate work.

See [Configuration files and generated artifacts](#configuration-files-and-generated-artifacts) for every input/output file. They contain or describe private account/relationship data. Do not commit them. If using `--dir` outside `.local/`, arrange equivalent ignore/access protection. Back up the archive and mapping securely outside the browser; they let you rebuild imports without paying for another export.

## Verification

### Discover fails with HTTP 403 after successful auth

Successful OAuth means X issued a user token; it does not prove the developer app has API access. The CLI identifies which endpoint failed and recognizes known X problem codes without logging the raw response or credentials. Discovery starts with `GET /2/users/me`, before reading Lists or members.

If the error includes `client-forbidden` or `client-not-enrolled`, check the **same app used for the OAuth Client ID** in the X Developer Console: it must belong to the correct Project and have active API access/enrollment. Confirm developer onboarding and credit purchase completed, the balance is funded, and the spending limit is not exhausted. X may specifically report that the app must be attached to a Project. See [X error types](https://docs.x.com/x-api/fundamentals/response-codes-and-errors).

Keep saved authorization and files intact while resolving access in the Console, then retry `npm run x:lists -- discover`. Reauthorize only if the app/client credentials or scopes changed, X reports invalid/revoked authorization, or the CLI requests it. A 403 at the initial identity request downloads no List members. Older CLI revisions printed `.env not found. Continuing without it.` when only `.env.x-export` existed; current revisions load either optional file quietly. That older notice did not cause the 403.

`npx vitest run tests/x-lists-export.test.js` uses fixtures and an intercepted SDK transport. It covers pagination/resume, private filtering, name exclusions before member requests (including explicit List selection), unmatched/invalid rules, changing exclusions, overlap, mapping preservation, errors/retries, manual/container OAuth callback checks and hidden input, token rotation, file permissions/locking, and conversion through Contexto's real validator/full restore/export. No live X account or paid call is needed for these tests. The first user-authorized live sample is still required to verify your app's private-List access and current billing.
