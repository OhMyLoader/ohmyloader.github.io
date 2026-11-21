# OhMyLoader Website

The official OhMyLoader website, built with [VitePress](https://vitepress.dev).

## Development

```bash
bun install --frozen-lockfile
bun dev          # site preview
bun run dev:editor  # editor preview (http://localhost:3000)
bun run build    # production build (site + editor into one Pages artifact)
bun run test     # editor tests
```

The browser-based content pack editor lives in `editor/` (SolidJS + Vite, built with the same
bun toolchain) and deploys with the site at /editor/.

## Content maintenance

- English is the source of truth at the site root; the Chinese translation lives under `zh/`. Update both
  sides together.
- API signatures in the documentation follow the [OhMyLoader](https://github.com/OhMyLoader/OhMyLoader) source.
