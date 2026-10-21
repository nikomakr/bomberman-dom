// element → { ref, onMount, onUnmount } for elements that declared any of them.
const hooks = new WeakMap();

// Elements created during the current render, waiting to be told they are on the page.
const pending = [];

/**
 * Stores the lifecycle hooks of a newly created element and queues its mount call.
 *
 * @param {HTMLElement} el - The element just created.
 * @param {Object} attrs - The virtual node's attributes.
 */
export function registerHooks(el, attrs) {
  const { ref, onMount, onUnmount } = attrs;
  if (!ref && !onMount && !onUnmount) return;
  hooks.set(el, { ref, onMount, onUnmount });
  pending.push(el);
}

/**
 * Keeps the stored hooks of an existing element up to date after a re-render.
 * If the ref function changed, the old one is told the element is gone and
 * the new one receives it.
 *
 * @param {HTMLElement} el - The element being updated.
 * @param {Object} attrs - The new virtual node's attributes.
 */
export function updateHooks(el, attrs) {
  const previous = hooks.get(el);
  const { ref, onMount, onUnmount } = attrs;

  if (previous?.ref && previous.ref !== ref) previous.ref(null);
  if (ref && (!previous || previous.ref !== ref)) ref(el);

  if (ref || onMount || onUnmount) {
    hooks.set(el, { ref, onMount, onUnmount });
  } else {
    hooks.delete(el);
  }
}

/**
 * Runs `ref(el)` and `onMount(el)` for every element created since the last
 * call. Called once the new elements are in the page.
 */
export function flushMounts() {
  const elements = pending.splice(0);
  elements.forEach((el) => {
    const entry = hooks.get(el);
    if (!entry) return;
    if (entry.ref) entry.ref(el);
    if (entry.onMount) entry.onMount(el);
  });
}

/**
 * Runs `onUnmount(el)` and `ref(null)` for a node and everything inside it,
 * just before it is removed from the page.
 *
 * @param {Node} node - The node about to be removed.
 */
export function unmount(node) {
  if (node.childNodes) {
    Array.from(node.childNodes).forEach(unmount);
  }
  const entry = hooks.get(node);
  if (!entry) return;
  if (entry.onUnmount) entry.onUnmount(node);
  if (entry.ref) entry.ref(null);
  hooks.delete(node);
}
