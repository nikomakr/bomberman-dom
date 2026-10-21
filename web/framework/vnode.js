/**
 * Creates a virtual node: a plain object describing an element.
 *
 * @example
 * h('div', { class: 'nameSubm' }, [
 *   h('input', { type: 'text', placeholder: 'Insert Name' }),
 * ]);
 * // → { tag: 'div', attrs: { class: 'nameSubm' }, children: [ { tag: 'input', ... } ] }
 *
 * @param {string} tag - HTML tag name, e.g. 'div'.
 * @param {Object} [attrs={}] - Attributes, properties and styles for the element.
 * @param {Array|string|number|Object} [children=[]] - Child nodes or text.
 * @returns {{ tag: string, attrs: Object, children: Array }} The virtual node.
 */
export function h(tag, attrs = {}, children = []) {
  // Allow h('p', 'Hello') or h('ul', [ ... ]) when there are no attributes.
  if (Array.isArray(attrs) || typeof attrs !== 'object' || attrs === null) {
    children = attrs ?? [];
    attrs = {};
  }

  const list = Array.isArray(children) ? children : [children];

  return {
    tag,
    attrs,
    children: list
      .flat(Infinity)
      .filter((child) => child !== null && child !== undefined && child !== false && child !== true),
  };
}

// Marks the placeholder nodes created by memo().
const MEMO = Symbol('memo');

/**
 * Marks a subtree that only needs rebuilding when its dependencies change.
 * While every value in `deps` is the same as on the previous render
 * (compared with Object.is), `render` is not called and the subtree is not
 * compared at all, so a large part of the page that rarely changes costs
 * almost nothing to re-render.
 *
 * @example
 * // The map is only rebuilt when mapVersion changes.
 * h('div', { class: 'game' }, [
 *   memo(() => renderMap(state.map), [state.mapVersion]),
 *   renderPlayers(state.players),
 * ]);
 *
 * @param {() => Object|string|number} render - Returns the subtree (one virtual node or text).
 * @param {Array} deps - The values the subtree depends on.
 * @param {*} [key] - A key, when the memoised node is one item of a keyed list.
 * @returns {Object} A placeholder node, used like any node from h().
 */
export function memo(render, deps, key) {
  if (typeof render !== 'function') throw new TypeError('memo: render must be a function.');
  if (!Array.isArray(deps)) throw new TypeError('memo: deps must be an array.');
  return { [MEMO]: true, render, deps, key, resolved: undefined };
}

/**
 * Whether a virtual node is a placeholder from memo().
 *
 * @param {*} vnode
 * @returns {boolean}
 */
export function isMemo(vnode) {
  return Boolean(vnode && vnode[MEMO]);
}

/**
 * The subtree a memo() placeholder stands for, building it on first use.
 *
 * @param {Object} vnode - A placeholder from memo().
 * @returns {Object|string|number} The subtree.
 */
export function resolveMemo(vnode) {
  if (vnode.resolved === undefined) vnode.resolved = vnode.render();
  return vnode.resolved;
}

/**
 * Whether two memo() placeholders have the same dependencies.
 *
 * @param {Object} a
 * @param {Object} b
 * @returns {boolean}
 */
export function sameDeps(a, b) {
  return a.deps.length === b.deps.length && a.deps.every((dep, i) => Object.is(dep, b.deps[i]));
}
