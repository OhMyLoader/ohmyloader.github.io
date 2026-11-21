import { render } from 'solid-js/web';
import App from './App';

/**
 * Mount glue shared by the two locale pages (editor/index.md and zh/editor/index.md). Both
 * pages import this module instead of touching solid-js themselves — the editor workspace is
 * the only package that resolves solid-js, and the pages live outside it. Returns a dispose
 * function so the page can clean up on navigation.
 */
export function mountEditor(el: HTMLElement): () => void {
  return render(App, el);
}
