import { flushRenders } from './scheduler.js';

// Events that do not bubble cannot be caught at the root, so they are set on the element itself.
const NON_BUBBLING = new Set(['focus', 'blur', 'mouseenter', 'mouseleave', 'load', 'error', 'scroll']);

// Page-wide events that only fire on the window, not on the document.
const WINDOW_EVENTS = new Set(['blur', 'focus', 'resize']);

// One-off actions in a form field. After their handlers run, the page is updated at once
// rather than on the next frame, so a key typed straight after Enter always lands in an input
// that has already been cleared. Everything else, including page-wide game keys, still
// updates at most once per frame.
const FIELD_EVENTS = new Set([
  'keydown', 'keyup', 'keypress', 'beforeinput', 'input', 'change',
  'focus', 'blur', 'focusin', 'focusout', 'cut', 'paste',
]);

// Elements where the user is typing; page-wide key handlers ignore them.
const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

// element → { eventType: handler }. A WeakMap lets removed elements be cleaned up automatically.
const handlers = new WeakMap();

// eventType → Set of { handler, options } registered with onGlobal().
const globalHandlers = new Map();

// Event types already listened to at the root (document) and on the window.
const delegatedTypes = new Set();
const windowTypes = new Set();

/**
 * Whether an event comes from somewhere the user is typing.
 *
 * @param {Event} event
 * @returns {boolean}
 */
function isTyping(event) {
  const target = event.target;
  return Boolean(target && (TYPING_TAGS.has(target.tagName) || target.isContentEditable));
}

/**
 * Brings the page up to date straight away after a one-off action in a form
 * field (input, text area, select), so nothing typed is lost.
 *
 * @param {Event} event
 */
function renderAfter(event) {
  if (FIELD_EVENTS.has(event.type) && isTyping(event)) flushRenders();
}

/**
 * Runs the page-wide handlers registered for an event's type.
 *
 * @param {Event} event
 */
function runGlobal(event) {
  const registered = globalHandlers.get(event.type);
  if (!registered) return;
  [...registered].forEach(({ handler, options }) => {
    if (event.type.startsWith('key') && !options.allowInInputs && isTyping(event)) return;
    handler(event);
  });
  renderAfter(event);
}

/**
 * Runs the handlers for an event, starting at the element that was acted on
 * and walking up through its parents, like the browser's own bubbling,
 * then runs any page-wide handlers.
 * A handler can call event.stopPropagation() to stop the walk.
 *
 * @param {Event} event - The event caught at the root.
 */
function dispatch(event) {
  let stopped = false;
  const stop = event.stopPropagation.bind(event);
  const stopImmediate = event.stopImmediatePropagation.bind(event);
  event.stopPropagation = () => {
    stopped = true;
    stop();
  };
  event.stopImmediatePropagation = () => {
    stopped = true;
    stopImmediate();
  };

  let node = event.target;
  while (node && node !== document && !stopped) {
    const handler = handlers.get(node)?.[event.type];
    if (handler) handler.call(node, event, node);
    node = node.parentNode;
  }

  if (!stopped) runGlobal(event);
  renderAfter(event);
}

/**
 * Whether an event type is handled once at the root rather than on each element.
 *
 * @param {string} type - Event type, e.g. 'click'.
 * @returns {boolean}
 */
function isDelegated(type) {
  return !NON_BUBBLING.has(type) && `on${type}` in document;
}

/**
 * Sets up a single root handler for an event type, the first time it is needed.
 *
 * @param {string} type - Event type, e.g. 'click'.
 */
function listenAtRoot(type) {
  if (delegatedTypes.has(type)) return;
  document[`on${type}`] = dispatch;
  delegatedTypes.add(type);
}

/**
 * Sets up a single window handler for a window-only event type.
 *
 * @param {string} type - Event type, e.g. 'blur'.
 */
function listenOnWindow(type) {
  if (windowTypes.has(type)) return;
  window[`on${type}`] = runGlobal;
  windowTypes.add(type);
}

/**
 * Registers the handlers declared in a virtual node's `on` attribute,
 * replacing any handlers the element had before.
 *
 * @example
 * h('button', { on: { click: () => save() } }, 'Save');
 *
 * @param {HTMLElement} el - The element the handlers belong to.
 * @param {Object<string, Function>} [on={}] - Event type → handler.
 */
export function setEvents(el, on = {}) {
  const previous = handlers.get(el) || {};

  // Clear handlers set directly on the element that are no longer wanted.
  Object.keys(previous).forEach((type) => {
    if (!isDelegated(type) && !(type in on)) {
      el[`on${type}`] = null;
    }
  });

  const next = {};
  Object.entries(on).forEach(([type, handler]) => {
    if (typeof handler !== 'function') return;
    next[type] = handler;
    if (isDelegated(type)) {
      listenAtRoot(type);
    } else {
      el[`on${type}`] = (event) => {
        handler.call(el, event, el);
        renderAfter(event);
      };
    }
  });

  if (Object.keys(next).length > 0) {
    handlers.set(el, next);
  } else {
    handlers.delete(el);
  }
}

/**
 * Builds a keyboard handler that runs a function for specific keys.
 *
 * @example
 * h('input', { on: { keydown: onKey({ Enter: save, Escape: cancel }) } });
 *
 * @param {Object<string, Function>} bindings - Key name (as in event.key) → function.
 * @returns {Function} A handler to use as `keydown` or `keyup`.
 */
export function onKey(bindings) {
  return (event, el) => {
    const handler = bindings[event.key];
    if (handler) handler(event, el);
  };
}

/**
 * Listens to an event across the whole page. Key events typed inside inputs,
 * text areas and selects are ignored unless `allowInInputs` is set.
 * 'blur', 'focus' and 'resize' are listened to on the window.
 *
 * @example
 * const stop = onGlobal('keydown', (event) => movePlayer(event.key));
 * stop(); // no longer listening
 *
 * @param {string} type - Event type, e.g. 'keydown'.
 * @param {Function} handler - Called with the event.
 * @param {{ allowInInputs?: boolean }} [options={}]
 * @returns {Function} Call it to stop listening.
 */
export function onGlobal(type, handler, options = {}) {
  if (!(`on${type}` in document) && !(`on${type}` in window)) {
    throw new Error(`onGlobal: "${type}" events are not supported by this browser.`);
  }
  if (!globalHandlers.has(type)) globalHandlers.set(type, new Set());
  const entry = { handler, options };
  globalHandlers.get(type).add(entry);

  if (WINDOW_EVENTS.has(type)) {
    listenOnWindow(type);
  } else {
    listenAtRoot(type);
  }

  return () => {
    globalHandlers.get(type).delete(entry);
  };
}

/**
 * Tracks which keys are currently held down, for smooth movement in games.
 * Held keys are released when the window loses focus, when the page is
 * hidden (e.g. switching tab), and when Cmd is released on macOS.
 *
 * @example
 * const keys = createKeyState();
 * if (keys.isDown('ArrowUp')) moveUp();
 * keys.destroy(); // stop tracking
 *
 * @returns {{ isDown: (key: string) => boolean, pressed: () => string[], destroy: () => void }}
 */
export function createKeyState() {
  const down = new Set();
  const releaseAll = () => down.clear();

  const stops = [
    onGlobal('keydown', (event) => down.add(event.key)),
    // Always release keys, even inside inputs, so none stay stuck.
    onGlobal(
      'keyup',
      (event) => {
        down.delete(event.key);
        // On macOS, keys released while Cmd is held never report a keyup.
        if (event.key === 'Meta') releaseAll();
      },
      { allowInInputs: true },
    ),
    onGlobal('blur', releaseAll),
  ];

  // Safety net: browsers do not always report leaving the tab (e.g. Cmd+T on
  // macOS), so check a few times a second whether the page is hidden or unfocused.
  const focusCheck = setInterval(() => {
    if (document.hidden || !document.hasFocus()) releaseAll();
  }, 100);

  return {
    isDown: (key) => down.has(key),
    pressed: () => [...down],
    destroy: () => {
      stops.forEach((stop) => stop());
      clearInterval(focusCheck);
      releaseAll();
    },
  };
}
