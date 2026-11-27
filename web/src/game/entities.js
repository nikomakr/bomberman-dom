// Element pools for everything that moves or appears on the board.
// Elements are created once, then hidden and reused, so no new elements
// are made mid-game. Positions are in tiles, like the server's.

// The tileset class for each kind of entity.
const CLASSES = {
  players: (options) => `tile-player-${options.playerNumber || 1}`,
  bombs: () => "tile-bomb",
  flames: () => "tile-flame",
  powerUps: (options) => `tile-power-${options.kind || "bomb"}`,
};

const pools = { players: [], bombs: [], flames: [], powerUps: [] };

// How many elements of each kind are made before the match starts, so the
// first explosions do not have to create them. More are made only if a
// match ever needs them.
const POOL_SIZES = { players: 4, bombs: 24, flames: 96, powerUps: 32 };

// The class of a hidden element: no tileset position and no animation, so a
// pooled bomb or power-up does not keep pulsing while nobody can see it.
const HIDDEN_CLASS = "tile entity";
const activeEntities = new Set();
let entitiesContainer = null;

/**
 * Connects the pools to the board's .entities layer. A new board (after a
 * restart) empties the pools, because their elements belonged to the old one.
 *
 * @param {HTMLElement} container - The .entities layer.
 */
export function initEntityPools(container) {
  if (!container || container === entitiesContainer) return;
  entitiesContainer = container;
  activeEntities.clear();
  Object.entries(pools).forEach(([type, pool]) => {
    pool.length = 0;
    for (let i = 0; i < POOL_SIZES[type]; i++) {
      pool.push(createPooledElement(type));
    }
  });
}

function createPooledElement(type) {
  const element = document.createElement("div");
  element.className = HIDDEN_CLASS;
  element.style.visibility = "hidden";
  if (type === "players") {
    // The nickname label is a child of the player, so it moves with it.
    const label = document.createElement("span");
    label.className = "entity-label";
    element.appendChild(label);
  }
  entitiesContainer.appendChild(element);
  return element;
}

/**
 * Takes an element from the pool (or makes one) and shows it.
 *
 * @param {'players'|'bombs'|'flames'|'powerUps'} type
 * @param {{ x?: number, y?: number, playerNumber?: number, kind?: string, nickname?: string }} options
 * @returns {Object|null} The entity, or null if the type or layer is missing.
 */
export function acquireEntity(type, options = {}) {
  const pool = pools[type];
  if (!pool || !entitiesContainer) return null;

  const element = pool.pop() || createPooledElement(type);
  element.className = `tile entity ${CLASSES[type](options)}`;
  element.style.visibility = "visible";

  if (type === "players") {
    // textContent, so a nickname is never read as markup. It is set on every
    // acquire, so a reused element never shows the previous player's name.
    element.firstChild.textContent = options.nickname || "";
  }

  const entity = {
    element,
    type,
    x: options.x || 0,
    y: options.y || 0,
    dirty: true,
  };
  activeEntities.add(entity);
  return entity;
}

/**
 * Hides an entity and puts its element back in the pool.
 *
 * @param {Object} entity
 */
export function releaseEntity(entity) {
  if (!entity || !activeEntities.has(entity)) return;
  activeEntities.delete(entity);
  entity.element.style.visibility = "hidden";
  entity.element.className = HIDDEN_CLASS;
  pools[entity.type].push(entity.element);
}

/**
 * Tells whether an entity is still on the board. It is not after
 * initEntityPools has been given a new layer.
 *
 * @param {Object} entity
 * @returns {boolean}
 */
export function isEntityActive(entity) {
  return activeEntities.has(entity);
}

/**
 * Sets where an entity should be, in tiles. It is drawn on the next frame.
 *
 * @param {Object} entity
 * @param {number} x
 * @param {number} y
 */
export function setEntityPosition(entity, x, y) {
  if (!entity || !activeEntities.has(entity)) return;
  if (entity.x === x && entity.y === y) return;
  entity.x = x;
  entity.y = y;
  entity.dirty = true;
}

/**
 * Runs once per frame: moves only the entities whose position changed.
 * A 2D translate, so an entity gets no layer of its own just for being
 * placed: players are promoted by `will-change: transform`, and bombs and
 * power-ups while their pulse animation runs. Flames never move, so they
 * stay in the shared layer.
 */
export function updateEntities() {
  for (const entity of activeEntities) {
    if (!entity.dirty) continue;
    entity.element.style.transform = `translate(calc(${entity.x} * var(--tile)), calc(${entity.y} * var(--tile)))`;
    entity.dirty = false;
  }
}
