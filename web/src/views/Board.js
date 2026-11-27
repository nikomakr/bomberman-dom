// The game board view: draws the map tiles and holds the layer that the game draws moving things into.

import { h, memo } from '/framework/index.js';
import { startLoop, stopLoop } from '../game/loop.js';
import { PauseBar } from './PauseBar.js';
import { setTilesLayer } from '../game/tiles.js';

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

  const map = state.map;

  // The tiles are built once per map. Destroyed blocks are drawn by
  // game/tiles.js, so a pause or a new power-up never rebuilds them. The map
  // is also the key: a restart brings a new map, so new tile elements.
  const tiles = memo(
    () =>
      h(
        'div',
        { class: 'tiles', ref: setTilesLayer },
        map
          ? map.tiles.map((type, index) =>
              h('div', { key: index, class: `tile tile-${type === 'empty' ? 'floor' : type}` }),
            )
          : [],
      ),
    [map],
    map,
  );

  return [
    h('div', { class: 'board', onMount: () => startLoop(entitiesLayer), onUnmount: stopLoop }, [
      tiles,
      memo(() => h('div', { class: 'entities', ref: setEntitiesLayer }), []),
    ]),
    PauseBar(state),
  ];
}
