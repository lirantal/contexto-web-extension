# Modern JSX Transform Design

## Problem

React 19 warns whenever compiled JSX calls `React.createElement` with the classic transform's `__self` development metadata. The extension forced that classic runtime globally to work around development JSX in artifacts built while `NODE_ENV=development` was inherited from the shell.

WXT preserves a pre-existing `NODE_ENV`, so `wxt build` can report a production build while Vite still selects development React and JSX behavior. This coupled the correctness of release artifacts to the caller's environment.

## Decision

Return `@vitejs/plugin-react` to its automatic (modern) JSX runtime by removing the `jsxRuntime: 'classic'` override. Make production scripts deterministic with `cross-env NODE_ENV=production` for both `build` and `zip`.

The existing bundle verifier will inspect every generated JavaScript chunk. It will reject development JSX calls (`jsxDEV(`) and classic-transform development metadata (`__self:`), covering both the popup and content-script chunks instead of only the popup entry bundle.

## Validation

Unit tests will assert that the WXT React configuration has no classic-runtime override and that the release scripts explicitly set `NODE_ENV=production`. A full build launched from an inherited development environment must pass the bundle verifier, which proves the scripts override the ambient environment.

## Scope

This changes the React build configuration and build verification only. It does not alter extension UI behavior or refactor source-level React imports; those imports are valid with either runtime.
