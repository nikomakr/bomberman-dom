// Jobs waiting for the next frame. A Set means the same job only runs once per frame.
const queue = new Set();
let frameId = null;
let flushing = false;

/**
 * Runs every queued job, once each.
 */
function flush() {
  frameId = null;
  const jobs = [...queue];
  queue.clear();
  flushing = true;
  try {
    jobs.forEach((job) => job());
  } finally {
    flushing = false;
  }
}

/**
 * Runs the queued jobs now instead of waiting for the next frame. Used after
 * a key press or click, so the page is up to date before the next one
 * arrives. Does nothing while jobs are already running (e.g. a blur fired by
 * a render): those jobs stay queued for the next frame.
 */
export function flushRenders() {
  if (frameId === null || flushing) return;
  cancelAnimationFrame(frameId);
  flush();
}

/**
 * Queues a job to run on the next animation frame. Queuing the same job
 * several times before that frame still runs it only once.
 *
 * @example
 * scheduleRender(update); // many calls in one frame → one update
 *
 * @param {Function} job - The work to run, e.g. a render.
 */
export function scheduleRender(job) {
  queue.add(job);
  if (frameId !== null) return;
  frameId = requestAnimationFrame(flush);
}

/**
 * Creates a game loop that calls `update` once per animation frame with the
 * time since the previous frame, so movement speed does not depend on the
 * frame rate. While the browser tab is hidden, `update` is not called, and
 * the first frame after the tab comes back reports a delta of 0.
 *
 * @example
 * const loop = createLoop((delta) => {
 *   x += speed * (delta / 1000);
 * });
 * loop.start();
 * loop.stop();
 *
 * @param {(delta: number, time: number) => void} update - Called every frame;
 *   `delta` is the milliseconds since the last frame (0 on the first frame).
 * @returns {{ start: Function, stop: Function, isRunning: () => boolean }}
 */
export function createLoop(update) {
  let running = false;
  let frameId = null;
  let lastTime = 0;

  const tick = (time) => {
    frameId = null;
    if (!running) return;

    if (document.hidden) {
      lastTime = 0; // paused: forget the old time so there is no jump on return
    } else {
      const delta = lastTime ? time - lastTime : 0;
      lastTime = time;
      update(delta, time);
    }

    frameId = requestAnimationFrame(tick);
  };

  return {
    start() {
      if (running) return;
      running = true;
      lastTime = 0;
      frameId = requestAnimationFrame(tick);
    },
    stop() {
      running = false;
      if (frameId !== null) cancelAnimationFrame(frameId);
      frameId = null;
    },
    isRunning: () => running,
  };
}
