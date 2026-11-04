// The ordinary WORLD account used by these screen tests has no photo pilot access.
export function closedPhotoStatus(request, url, body, accountId) {
  if (request.method() !== 'POST' || url.pathname !== '/functions/v1/me2-photo/api' ||
      url.search || body?.action !== 'status' || Object.keys(body).length !== 1) return null;
  return { ok: true, accountId, status: 'off' };
}
