// An explicit sentinel distinguishes an unmatched route from a streaming handler
// which intentionally returns undefined after taking ownership of the response.
export const NOT_HANDLED = Symbol('not handled');
export function dispatchRequest(context, routes) {
  const next = start => {
    for (let index = start; index < routes.length; index++) {
      const result = routes[index](context);
      if (result && typeof result.then === 'function') {
        return Promise.resolve(result).then(value => {
          if (value !== NOT_HANDLED) return true;
          // Only an actual asynchronous miss yields before the next feature.
          if (context.p?.startsWith('/api/')) context.revalidate?.();
          return next(index + 1);
        });
      }
      if (result !== NOT_HANDLED) return true;
    }
    return false;
  };
  return next(0);
}
