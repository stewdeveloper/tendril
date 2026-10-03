# @tendril/visual

Pixel comparison of the app against the design renders. A person reviews the side-by-side panels;
the diff percentage is only a regression guard.

Run everything from the repo root.

## Commands

- `pnpm visual:design` renders the inner 393x852 phone screen of every design frame in
  `design/claude-design/*.dc.html` to `design/screens-inner/<id>.png` (88 frames). The output is
  committed: it is the comparison baseline. The design files load React and Babel from unpkg and
  fonts from Google, so this needs network access.
- `pnpm visual:app [ids...]` exports the mobile web build with `EXPO_PUBLIC_CATALOG=1`, serves it,
  and screenshots `/catalog/<id>` at 393x852 (deviceScaleFactor 1) to `design/compare/app/<id>.png`.
  With no ids it tries every id in `design/screens-inner/` and skips the ones with no registered
  catalog frame. Pass `--no-build` to reuse the existing `apps/mobile/dist`.
- `pnpm visual:compare [ids...]` writes `design/compare/<id>.png` (design | app | red pixel diff on
  a `#ECEAE3` board) and prints `id<TAB>diff%` sorted by diff, descending. `design/compare/` is
  git-ignored.

Typical loop for one frame: `pnpm visual:app 2e && pnpm visual:compare 2e`, then open
`design/compare/2e.png`.

`pnpm --filter @tendril/visual test` runs the unit tests for `compareImages`.

## Ports

The design server uses 8765 and the app server uses 8766. If one is taken, set
`VISUAL_DESIGN_PORT` or `VISUAL_APP_PORT`.

## Chromium on this WSL box

The scripts drive Playwright's own Chromium (`pnpm --filter @tendril/visual exec playwright install
chromium`). That browser needs `libnss3`, `libnspr4` and `libasound`, which are not installed here
and cannot be added without sudo. They are extracted into `~/.cache/tendril-chromium-libs`, and
`src/chromium.ts` prepends that directory to `LD_LIBRARY_PATH` when launching. On a machine that has
the system libraries the directory is simply absent and nothing changes.
