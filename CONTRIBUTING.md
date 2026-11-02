# Contributing to the OhMyLoader Website

This repository contains the VitePress site. English pages at the root are the source of truth; Chinese
translations live under `zh/` and must stay paired. API reference content follows the loader source.

## Before you start

- Open an issue before a navigation, URL, or content-structure change.
- Keep this repository independent. Do not add a Maven dependency, a Gradle build, or a source mount to
  another repository.
- Read the loader's `oml-api/README.md` for the stability contract when documenting API.

## Prerequisites

- Node.js 26. CI uses Node 26.
- pnpm 12.16.1 from `package.json`'s `packageManager` field.
- A sibling `OhMyLoader` checkout for `check:api`. The script probes `../OhMyLoader` and `OhMyLoader`;
  set `OML_SOURCES` to an explicit loader root when neither layout fits.

## Build and check

```bash
pnpm install --frozen-lockfile
pnpm run check:sync
pnpm run check:api
pnpm build
pnpm dev
```

`check:sync` compares every English page with its `zh/` counterpart for headings, fences, containers,
tables, and inline code tokens. `check:api` indexes declarations in the loader's `oml-api` and
`oml-api-26_3` and verifies the inline API references on the API pages. `pnpm build` also fails on dead
links. CI runs all three before deploying.

## Content rules

- Use plain technical American English. State the fact, command, or constraint; omit marketing and
  repetition.
- Keep English and Chinese pages structurally paired. Update both sides in the same change; prose may
  differ, but headings, examples, tables, and code tokens must match.
- API signatures follow the loader source. Do not document a signature that does not exist in the
  checkout used by `check:api`.
- API pages are reference material, not tutorials. Keep examples short and make the required imports
  explicit.
- A `<!-- sync-ignore -->` or an `EXEMPT` entry needs a concrete reason; do not add exemptions to silence
  a real mismatch.
- Do not add unsupported claims about platforms, versions, or compatibility. The loader README is the
  source for platform status.

## Commit and pull request

- Branch from `main`; do not commit to the upstream `main` directly.
- Use Conventional Commits, for example `docs(guide): ...` or `fix(api): ...`. One concern per commit.
  The body states the constraint and the evidence, not the investigation.
- Run `pnpm run check:sync`, `pnpm run check:api`, and `pnpm build`; include the results in the pull
  request.
- Do not commit `node_modules/`, `.vitepress/dist/`, local paths, or generated caches.
- Push your branch to your fork and open a pull request. Do not push to `main`; a push to upstream
  `main` deploys the site.

## Deployment

CI builds every pull request. A push to `main` deploys through GitHub Pages after the sync and API checks
pass. The deploy job rechecks the English/Chinese pairing; do not bypass it with a manual deploy.

## Security

Do not report a vulnerability in a public issue. Use GitHub's private vulnerability reporting for this
repository; include the affected version or commit, reproduction steps, and impact. If private reporting
is unavailable, contact the maintainer through GitHub before public disclosure.

## License

The site content is licensed under AGPL-3.0. By submitting a contribution, you confirm that you have the
right to license it under AGPL-3.0. No CLA or `Signed-off-by` is required. Do not submit content with an
incompatible license.
