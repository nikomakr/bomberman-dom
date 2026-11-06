const pools = {
  players: [],
  bombs: [],
  flames: [],
  powerUps: [],
};

const activeEntities = new Set();

let entitiesContainer = null;

function createPooledElement(type) {
  const element = document.createElement("div");

  element.classList.add("tile", "entity");

  if (type === "players") {
    element.classList.add("tile-player-1");
  } else if (type === "bombs") {
    element.classList.add("tile-bomb");
  } else if (type === "flames") {
    element.classList.add("tile-flame");
  } else if (type === "powerUps") {
    element.classList.add("tile-power-bomb");
  }

  element.style.display = "none";
  entitiesContainer.appendChild(element);

  return element;
}

export function initEntityPools(container) {
  if (!container) return;
  entitiesContainer = container;
}

export function acquireEntity(type, options = {}) {
  const pool = pools[type];

  if (!pool || !entitiesContainer) return null;

  const element = pool.pop() || createPooledElement(type);

  if (type === "players") {
    const playerNumber = options.playerNumber || 1;
    element.className = `tile entity tile-player-${playerNumber}`;
    element.style.willChange = "transform";
  } else if (type === "bombs") {
    element.className = "tile entity tile-bomb";
    element.style.willChange = "";
  } else if (type === "flames") {
    element.className = "tile entity tile-flame";
    element.style.willChange = "";
  } else if (type === "powerUps") {
    const kind = options.kind || "bomb";
    element.className = `tile entity tile-power-${kind}`;
    element.style.willChange = "";
  }

  element.style.display = "block";

  const entity = {
    element,
    type,
    x: options.x || 0,
    y: options.y || 0,
  };

  activeEntities.add(entity);

  return entity;
}

export function releaseEntity(entity) {
  if (!entity || !activeEntities.has(entity)) return;

  activeEntities.delete(entity);

  entity.element.style.display = "none";
  entity.element.style.transform = "";

  pools[entity.type].push(entity.element);
}

export function setEntityPosition(entity, x, y) {
  if (!entity || !activeEntities.has(entity)) return;

  entity.x = x;
  entity.y = y;
}

export function updateEntities(delta) {
  for (const entity of activeEntities) {
    entity.element.style.transform = `translate3d(${entity.x}px, ${entity.y}px, 0)`;
  }
}
