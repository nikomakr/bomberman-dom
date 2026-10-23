import { h } from '/framework/index.js';
import { startLoop, stopLoop } from '../game/loop.js';

// The engine-owned layer for moving elements. The view never adds children to it.
let entitiesLayer = null;

/**
 * Keeps the entities layer element, or null when it is removed.
 *
 * @param {HTMLElement|null} el
 */
function setEntitiesLayer(el) {
  entitiesLayer = el;
}

/**
 * Returns the entities layer, for the engine to fill.
 *
 * @returns {HTMLElement|null}
 */
export function getEntitiesLayer() {
  return entitiesLayer;
}

/**
 * The game board, shown only on the game page. Starts the loop when it
 * appears and stops it when it is removed.
 *
 * @param {{ page: string }} state
 * @returns {Array<Object>} Virtual nodes.
 */
export function Board(state) {
  if (state.page !== 'game') return [];

  return [
    h('div', { class: 'board', onMount: startLoop, onUnmount: stopLoop }, [
      h('div', { class: 'tiles' }),
      h('div', { class: 'entities', ref: setEntitiesLayer }),
    ]),
  ];
}
