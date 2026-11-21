import { defineConfig } from '@unocss/vite';
import { presetMini } from '@unocss/preset-mini';

// The editor palette lives in src/styles.css as CSS variables with a light and a dark value.
// Mapping the utility colors onto those variables makes every chrome surface follow the
// appearance toggle (html.dark, shared with the VitePress shell). The preview pane and the
// logo tile opt out with fixed classes because their dark surface is intentional in both modes.
export default defineConfig({
  presets: [presetMini()],
  theme: {
    colors: {
      slate: {
        50: 'var(--panel-soft)',
        100: 'var(--line-faint)',
        200: 'var(--line)',
        400: 'var(--faint)',
        500: 'var(--muted)',
        600: 'var(--muted-strong)',
        800: 'var(--text)',
      },
      panel: 'var(--panel)',
      red: {
        200: 'var(--danger-line)',
        400: 'var(--danger-text)',
        500: 'var(--danger)',
        600: 'var(--danger)',
      },
      amber: {
        50: 'var(--warn-weak)',
        500: 'var(--warn)',
        700: 'var(--warn-text)',
      },
      emerald: {
        600: 'var(--ok)',
      },
    },
  },
});
