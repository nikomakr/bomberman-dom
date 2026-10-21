import { patch } from './diff.js';
import { scheduleRender } from './scheduler.js';
import { unmount } from './lifecycle.js';

/**
 * Starts an app. The framework calls `view(state)` to describe the page and
 * keeps the page up to date whenever the store changes — the app itself
 * never touches the DOM.
 *
 * @example
 * const store = createStore({ count: 0 });
 * createApp({
 *   root: document.getElementById('app'),
 *   store,
 *   view: (state) => h('p', {}, [`Count: ${state.count}`]),
 * });
 *
 * // Only redraws when the chat changes, not when the game state does.
 * createApp({ root: chatRoot, store, select: (state) => state.chat, view: renderChat });
 *
 * @param {Object} options
 * @param {HTMLElement} options.root - The element the app is rendered into.
 * @param {Object} [options.store] - A store from createStore().
 * @param {Function} options.view - Receives the state, returns a virtual node from h()
 *   (or a list of them, to put several elements directly in `root`).
 * @param {Function} [options.select] - Picks the part of the state this app shows;
 *   the app then only redraws when that part changes (shallow comparison).
 *   The view still receives the whole state.
 * @returns {{ refresh: Function, unmount: Function }} Controls for the running app.
 */
export function createApp({ root, store, view, select }) {
  if (!root) throw new Error('createApp: a root element is required.');
  if (typeof view !== 'function') throw new Error('createApp: view must be a function.');
  if (select !== undefined && typeof select !== 'function') throw new Error('createApp: select must be a function.');

  let current;

  const update = () => {
    const next = view(store ? store.getState() : {});
    patch(root, current, next);
    current = next;
  };

  const requestRender = () => scheduleRender(update);

  update();
  let unsubscribe = () => {};
  if (store) unsubscribe = select ? store.subscribe(select, requestRender) : store.subscribe(requestRender);

  return {
    refresh: requestRender,
    unmount: () => {
      unsubscribe();
      Array.from(root.childNodes).forEach(unmount);
      root.replaceChildren();
      current = undefined;
    },
  };
}
