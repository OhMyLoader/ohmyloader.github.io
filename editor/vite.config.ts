import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import devtools from 'solid-devtools/vite';
import UnocssPlugin from '@unocss/vite';

export default defineConfig({
  // Project pages deploy under https://ohmyloader.github.io/OhMyLoaderEditor/ — every asset URL
  // must carry the repository subpath or the deployed site 404s on its own index.
  base: '/editor/',
  plugins: [
    UnocssPlugin({
      // your config or in uno.config.ts
    }),
    solidPlugin(),
  ],
  server: {
    port: 3000,
  },
  build: {
    target: 'esnext',
  },
});
