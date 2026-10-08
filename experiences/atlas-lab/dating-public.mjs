// Reviewed browser files for the standalone dating host. A new browser import
// must be added explicitly; server modules, QA, databases and configs stay private.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
export const DATING_PUBLIC_FILES = Object.freeze([
  '/atlas-lab/dating.html', '/atlas-lab/dating.css', '/atlas-lab/dating-ui.mjs',
  '/atlas-lab/dating-account.mjs', '/atlas-lab/discovery-guidance.mjs',
  '/atlas-lab/dating-insights.mjs', '/atlas-lab/dating-journey.mjs',
  '/atlas-lab/dating-delivery.mjs', '/atlas-lab/dating-checkpoint.mjs',
  '/atlas-lab/dating-live.mjs', '/atlas-lab/meeting-regions.mjs',
  '/atlas-lab/preference-deadline.mjs', '/atlas-lab/discovery.mjs',
  '/atlas-lab/candidate-highlights.mjs', '/atlas-lab/public-profile-preview.mjs',
  '/atlas-lab/profile-editing-drafts.mjs', '/atlas-lab/onboarding-drafts.mjs',
  '/synk-account/src/core.mjs', '/synk-account/assets/sticker-person.webp',
  '/learning-hub/assets/SUIT-Variable.woff2',
  '/learning-hub/assets/slab-cream-long.webp', '/learning-hub/assets/slab-blush-long.webp',
]);
const publicFiles = new Set(DATING_PUBLIC_FILES);

// Parse the raw request path before URL normalization can erase dot segments.
// All reviewed paths are ASCII, so encoded separators/names are unnecessary.
export function datingRequestPath(url) {
  if (typeof url !== 'string' || !url.startsWith('/') || url.startsWith('//') || /[\\\u0000-\u0020\u007f]/.test(url)) return null;
  const pathname = url.split(/[?#]/, 1)[0];
  if (pathname.includes('%') || pathname.includes('//') || pathname.split('/').some(part => part === '.' || part === '..')) return null;
  return pathname;
}
export function datingPublicTarget(url, publicRoot = root) {
  const pathname = datingRequestPath(url);
  return publicFiles.has(pathname) ? path.resolve(publicRoot, '.' + pathname) : null;
}
export async function resolveDatingPublicTarget(url, publicRoot = root) {
  const target = datingPublicTarget(url, publicRoot);
  if (!target) return null;
  try {
    const real = await fs.realpath(target);
    // Neither a file link nor a linked ancestor may turn a reviewed path into
    // a route to another file, even another path inside the repository.
    return path.relative(target, real) === '' && (await fs.stat(real)).isFile() ? real : null;
  } catch { return null; }
}
