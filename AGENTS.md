# AGENTS.md — ohmyloader.github.io

Read [CONTRIBUTING.md](CONTRIBUTING.md) first. It defines the checks, content rules, commit and
pull-request rules, deployment, security, and licensing. This file adds only agent-specific constraints.

- Work only in this repository. Do not add Maven, Gradle, or sibling source dependencies.
- Run `bun install --frozen-lockfile`, then for content changes `bun run check:sync`,
  `bun run check:api`, and `bun run build`; for editor changes `bun run typecheck`, `bun run test`,
  and `bun run build` (the editor lives in `editor/`, a bun workspace — its gates run through the
  same composed scripts).
- English at the site root is the source of truth; update the corresponding `zh/` page in the same change.
  Do not use `sync-ignore` or an exemption without a concrete reason.
- API signatures follow the loader source. Do not invent a signature or a platform/version claim.
- Keep content plain technical American English; no marketing copy or filler.
- Do not commit `node_modules/`, `.vitepress/dist/`, caches, or local paths.
- Commit in this repository. Do not push to `main` or deploy; the CI deploy is a release action and needs
  an explicit request.
