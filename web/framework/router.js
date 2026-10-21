/**
 * Keeps the URL and the state in sync, using the part of the URL after `#`.
 * When the page loads, and whenever the URL changes (links, back and forward
 * buttons), the route matching the path is called with the store. A missing
 * or unknown path goes to `#/`, replacing the current history entry so the
 * back button does not return to it.
 *
 * @example
 * createRouter({
 *   store,
 *   routes: {
 *     '/': (store) => store.setState({ filter: 'all' }),
 *     '/active': (store) => store.setState({ filter: 'active' }),
 *   },
 * });
 *
 * @param {Object} options
 * @param {Object<string, Function>} options.routes - Path (e.g. '/active') → function called with the store.
 * @param {Object} [options.store] - The store the routes update.
 */
export function createRouter({ routes, store }) {
  const applyRoute = () => {
    const path = window.location.hash.slice(1);
    const route = routes[path];

    if (typeof route === 'function') {
      route(store);
    } else if (path !== '/') {
      // Changing the hash runs applyRoute again, through onhashchange.
      window.location.replace('#/');
    }
  };

  window.onhashchange = applyRoute;
  applyRoute();
}
