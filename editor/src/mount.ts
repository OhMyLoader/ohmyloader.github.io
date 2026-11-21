import { render } from 'solid-js/web';
import App from './App';
import { setLocale } from './lib/i18n';

/**
 * Mount glue shared by the two locale pages (editor/index.md and zh/editor/index.md). Both
 * pages import this module instead of touching solid-js themselves — the editor workspace is
 * the only package that resolves solid-js, and the pages live outside it. Returns a dispose
 * function so the page can clean up on navigation.
 */
export function mountEditor(el: HTMLElement): () => void {
  // The wrapper page's locale decides the app language. SPA navigation between the locale
  // twins reuses this module singleton, so the locale is set per mount, not per import.
  setLocale(document.documentElement.lang.toLowerCase().startsWith('zh') ? 'zh' : 'en');
  return render(App, el);
}
