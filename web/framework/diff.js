import { createElement, setAttribute } from './render.js';
import { setEvents } from './events.js';
import { updateHooks, flushMounts, unmount } from './lifecycle.js';
import { isMemo, resolveMemo, sameDeps } from './vnode.js';

// Live properties: compared with the element itself, as the user may have changed them.
const PROPERTIES = new Set(['value', 'checked', 'selected']);

/**
 * Whether a virtual node is plain text.
 *
 * @param {*} vnode
 * @returns {boolean}
 */
function isText(vnode) {
  return typeof vnode === 'string' || typeof vnode === 'number';
}

/**
 * The key of a virtual node, or undefined if it has none.
 *
 * @param {*} vnode
 * @returns {*}
 */
function keyOf(vnode) {
  if (isText(vnode)) return undefined;
  return isMemo(vnode) ? vnode.key : vnode.attrs.key;
}

/**
 * Updates the style of an element, removing properties that are no longer wanted.
 *
 * @param {HTMLElement} el
 * @param {Object|string|undefined} oldStyle
 * @param {Object|string|undefined} newStyle
 */
function updateStyle(el, oldStyle, newStyle) {
  if (newStyle === undefined || newStyle === null) {
    el.removeAttribute('style');
    return;
  }

  if (typeof oldStyle !== 'object' || typeof newStyle !== 'object' || oldStyle === null) {
    if (oldStyle !== newStyle) {
      el.removeAttribute('style');
      setAttribute(el, 'style', newStyle);
    }
    return;
  }

  Object.keys(oldStyle).forEach((name) => {
    if (name in newStyle) return;
    if (name.includes('-')) {
      el.style.removeProperty(name);
    } else {
      el.style[name] = '';
    }
  });

  const changed = {};
  Object.entries(newStyle).forEach(([name, value]) => {
    if (oldStyle[name] !== value) changed[name] = value;
  });
  if (Object.keys(changed).length > 0) setAttribute(el, 'style', changed);
}

/**
 * Updates the attributes, properties, styles and events of an element.
 *
 * @param {HTMLElement} el
 * @param {Object} oldAttrs
 * @param {Object} newAttrs
 */
function updateAttributes(el, oldAttrs, newAttrs) {
  Object.keys(oldAttrs).forEach((name) => {
    if (name in newAttrs) return;
    if (name === 'on') {
      setEvents(el, {});
    } else if (name === 'style') {
      el.removeAttribute('style');
    } else {
      setAttribute(el, name, null);
    }
  });

  Object.entries(newAttrs).forEach(([name, value]) => {
    if (name === 'style') {
      updateStyle(el, oldAttrs.style, value);
    } else if (name === 'on') {
      // Handlers are usually new functions on every render, so always refresh them.
      setEvents(el, value);
    } else if (PROPERTIES.has(name)) {
      // Only touch the property if it differs, so the cursor in an input does not jump.
      if (el[name] !== value) setAttribute(el, name, value);
    } else if (oldAttrs[name] !== value) {
      setAttribute(el, name, value);
    }
  });
}

/**
 * Updates the children of an element. Children with a key are matched by key
 * and moved; children without a key are matched in order.
 *
 * @param {HTMLElement} parent
 * @param {Array} oldChildren
 * @param {Array} newChildren
 */
function updateChildren(parent, oldChildren, newChildren) {
  const oldNodes = Array.from(parent.childNodes);
  const keyed = new Map();
  const unkeyed = [];

  oldChildren.forEach((vnode, i) => {
    const entry = { vnode, node: oldNodes[i] };
    const key = keyOf(vnode);
    if (key !== undefined) {
      keyed.set(key, entry);
    } else {
      unkeyed.push(entry);
    }
  });

  const used = new Set();

  newChildren.forEach((vnode, i) => {
    const key = keyOf(vnode);
    let match;
    if (key !== undefined) {
      match = keyed.get(key);
      keyed.delete(key);
    } else {
      match = unkeyed.shift();
    }

    const node = match ? patchNode(match.node, match.vnode, vnode) : createElement(vnode);
    used.add(node);

    const current = parent.childNodes[i];
    if (current !== node) parent.insertBefore(node, current || null);
  });

  oldNodes.forEach((node) => {
    if (!used.has(node) && node.parentNode === parent) {
      unmount(node);
      parent.removeChild(node);
    }
  });
}

/**
 * Brings one real DOM node in line with a new virtual node.
 *
 * @param {Node} node - The real node currently on the page.
 * @param {*} oldVNode - The virtual node it was built from.
 * @param {*} newVNode - The virtual node it should now match.
 * @returns {Node} The node now on the page (a new one if it had to be replaced).
 */
function patchNode(node, oldVNode, newVNode) {
  if (isMemo(newVNode)) {
    // Same dependencies: reuse the subtree as it is, without building or comparing it.
    if (isMemo(oldVNode) && sameDeps(oldVNode, newVNode)) {
      newVNode.resolved = oldVNode.resolved;
      return node;
    }
    return patchNode(node, isMemo(oldVNode) ? oldVNode.resolved : oldVNode, resolveMemo(newVNode));
  }
  if (isMemo(oldVNode)) return patchNode(node, oldVNode.resolved, newVNode);

  if (isText(oldVNode) && isText(newVNode)) {
    if (String(oldVNode) !== String(newVNode)) node.nodeValue = String(newVNode);
    return node;
  }

  if (isText(oldVNode) || isText(newVNode) || oldVNode.tag !== newVNode.tag) {
    const replacement = createElement(newVNode);
    unmount(node);
    node.parentNode.replaceChild(replacement, node);
    return replacement;
  }

  updateAttributes(node, oldVNode.attrs, newVNode.attrs);
  updateHooks(node, newVNode.attrs);
  updateChildren(node, oldVNode.children, newVNode.children);
  return node;
}

/**
 * Turns a tree, or a list of trees, into a list of the nodes to put on the page.
 *
 * @param {Object|Array} vnode
 * @returns {Array}
 */
function toList(vnode) {
  const list = Array.isArray(vnode) ? vnode.flat(Infinity) : [vnode];
  return list.filter((child) => child !== null && child !== undefined && child !== false && child !== true);
}

/**
 * Updates what is on the page so it matches a new virtual node, changing
 * only what is different from the previous one.
 *
 * A list of virtual nodes can be given instead of one, to put several
 * elements side by side directly in the container.
 *
 * @example
 * const before = h('p', {}, ['Hello']);
 * render(before, app);
 * patch(app, before, h('p', {}, ['Hello again'])); // only the text changes
 *
 * @param {HTMLElement} container - The element the tree was rendered into.
 * @param {Object|Array|undefined} oldVNode - The tree currently on the page (undefined on first render).
 * @param {Object|Array} newVNode - The tree the page should now match.
 * @returns {Node|Node[]} The root node on the page, or the list of root nodes.
 */
export function patch(container, oldVNode, newVNode) {
  const roots = () => (Array.isArray(newVNode) ? Array.from(container.childNodes) : container.firstChild);

  if (!oldVNode || !container.firstChild) {
    Array.from(container.childNodes).forEach(unmount);
    container.replaceChildren(...toList(newVNode).map(createElement));
    flushMounts();
    return roots();
  }

  // Remember focus and cursor, in case a focused input is moved.
  const active = document.activeElement;
  let selection = null;
  try {
    selection = active ? [active.selectionStart, active.selectionEnd] : null;
  } catch {
    selection = null;
  }

  updateChildren(container, toList(oldVNode), toList(newVNode));
  flushMounts();

  // Only put the focus back if moving the input lost it, not if the new page moved it on purpose.
  const lostFocus = !document.activeElement || document.activeElement === document.body;
  if (active && active !== document.activeElement && active.isConnected && lostFocus) {
    active.focus();
    if (selection && selection[0] !== null && selection[0] !== undefined) {
      try {
        active.setSelectionRange(selection[0], selection[1]);
      } catch {
        // Some inputs (e.g. checkboxes) have no cursor.
      }
    }
  }

  return roots();
}
