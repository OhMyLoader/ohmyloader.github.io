/**
 * Appearance sync with the VitePress shell. The site theme and this editor share one storage
 * key; VitePress's inline script applies the html.dark class before first paint on every page,
 * and toggling here writes the same key so the choice carries across navigation.
 */

const STORAGE_KEY = 'vitepress-theme-appearance';

export function isDark(): boolean {
  return document.documentElement.classList.contains('dark');
}

/** Flips the theme class on <html>, persists the choice, and returns the new state. */
export function toggleDark(): boolean {
  const dark = !isDark();
  document.documentElement.classList.toggle('dark', dark);
  try {
    localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light');
  } catch {
    // Storage may be unavailable (private mode); the class still applies for this visit.
  }
  return dark;
}
