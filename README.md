# OhMyLoader Website

The OhMyLoader documentation site and the browser-based content pack editor, built with
[VitePress](https://vitepress.dev). The editor lives in `editor/` and deploys with the site at
`/editor/`.

```bash
bun install --frozen-lockfile
bun dev          # site preview
bun run build    # production build (site and editor page in one dist)
bun run test     # editor tests
```

English at the site root is the source of truth; the Chinese translation lives under `zh/`. Update
both sides together.

## License

Licensed under AGPL-3.0-or-later.
