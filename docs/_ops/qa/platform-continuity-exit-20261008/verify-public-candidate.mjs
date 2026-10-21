// Public GET only. Writes a new QA report; never authenticates, edits a profile,
// deploys, installs, calls a data API, or prints configuration/response bodies.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const args = process.argv.slice(2);
const phase = args[0];
if (!['local', 'baseline', 'post-release'].includes(phase) || args.length !== 1) {
  console.error('Usage: node docs/_ops/qa/platform-continuity-exit-20261008/verify-public-candidate.mjs local|baseline|post-release');
  process.exit(2);
}
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const base = 'https://synk.im';
const stamp = new Date().toISOString();
const web = path.join(root, '.tmp/platform-completion-web-1791469324147/platform');
const personal = path.join(root, '.tmp/platform-completion-personal-final-20261008');
const platform = await read(path.join(web, 'manifest.json'));
const targets = [{ id: 'platform', publicPath: '/account/', directory: path.join(web, 'payload/account'), manifestPath: path.join(web, 'manifest.json'), files: platform.files }];
for (const id of ['fortune', 'rehearsal']) {
  const directory = path.join(personal, id);
  const manifestPath = path.join(directory, 'build-manifest.json');
  const manifest = await read(manifestPath);
  if (manifest.targetUrl !== `${base}/${id}/`) throw Error('Unexpected candidate target');
  targets.push({ id, directory, manifestPath, publicPath: `/${id}/`, files: {
    ...Object.fromEntries(manifest.files.map(item => [item.name, item.sha256])),
    'build-manifest.json': sha(await fs.readFile(manifestPath))
  } });
}
const mime = {
  '.html': ['text/html'], '.js': ['text/javascript', 'application/javascript'], '.mjs': ['text/javascript', 'application/javascript'],
  '.css': ['text/css'], '.json': ['application/json'], '.webmanifest': ['application/manifest+json', 'application/json'],
  '.png': ['image/png'], '.webp': ['image/webp'], '.avif': ['image/avif'], '.svg': ['image/svg+xml'],
  '.woff2': ['font/woff2', 'application/font-woff2'], '.ttf': ['font/ttf', 'application/x-font-ttf', 'application/font-sfnt'], '.txt': ['text/plain']
};
function attrs(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w-]+)\s*=\s*(["'])(.*?)\2/gs)].map(match => [match[1].toLowerCase(), match[3]]));
}
function cspMeta(html) {
  return [...html.matchAll(/<meta\b[^>]*>/gi)].map(match => attrs(match[0]))
    .filter(item => item['http-equiv']?.toLowerCase() === 'content-security-policy').map(item => item.content ?? '');
}
function references(name, bytes, target) {
  const text = bytes.toString('utf8'), values = [];
  if (name.endsWith('.html')) {
    for (const match of text.matchAll(/<(?:script|link|img|source)\b[^>]*>/gi)) {
      const item = attrs(match[0]);
      if (item.src) values.push(item.src);
      if (/^<link\b/i.test(match[0]) && item.href) values.push(item.href);
    }
  } else if (name.endsWith('.css')) {
    for (const match of text.matchAll(/url\(\s*(["']?)(.*?)\1\s*\)/g)) values.push(match[2]);
  } else if (name.endsWith('.webmanifest')) {
    for (const item of JSON.parse(text).icons ?? []) if (item.src) values.push(item.src);
  }
  return [...new Set(values)].filter(value => value && !/^(?:data:|blob:|#)/.test(value)).map(value => {
    const url = new URL(value, `${base}${target.publicPath}${name}`);
    if (url.origin !== base || !url.pathname.startsWith(target.publicPath)) return { scope: 'outside-payload', path: url.pathname };
    const file = decodeURIComponent(url.pathname.slice(target.publicPath.length));
    return { scope: 'payload', file, coveredByManifest: Object.hasOwn(target.files, file) };
  });
}
const report = {
  checkedAt: stamp, phase, scope: 'Public static files of frozen candidates; no account, database, installation or real-device verification.',
  requests: 'Unauthenticated public GET; redirects rejected; no response bodies/configuration values recorded.',
  meaning: { baseline: 'Differences describe the version currently served, not a failed deployment attempt.', postRelease: 'A full match proves these static bytes are served; it does not prove OAuth, database migration, saved user data or PC installation.' },
  targets: [], localErrors: [], errors: [], warnings: []
};
// Verify the frozen bytes before requesting the public site. Shared live sources
// intentionally are not treated as the expected payload.
for (const target of targets) {
  target.local = new Map();
  target.references = [];
  for (const [name, expected] of Object.entries(target.files)) {
    if (!/^[a-zA-Z0-9/_.-]+$/.test(name) || name.split('/').some(part => part === '..' || part === '.')) throw Error('Unexpected candidate file path');
    const bytes = await fs.readFile(path.join(target.directory, name));
    if (sha(bytes) !== expected) report.localErrors.push({ product: target.id, file: name, reason: 'frozen-candidate-drift' });
    target.local.set(name, bytes);
    for (const ref of references(name, bytes, target)) {
      target.references.push({ from: name, ...ref });
      if (ref.scope === 'payload' && !ref.coveredByManifest) report.localErrors.push({ product: target.id, file: name, reference: ref.file, reason: 'unlisted-asset-reference' });
    }
  }
}
if (report.localErrors.length) throw Error(`Frozen candidate validation failed (${report.localErrors.length}); public GET not started`);
if (phase === 'local') {
  report.requests = 'None; local frozen payload validation only.';
  report.targets = await Promise.all(targets.map(async target => ({ id: target.id, publicPath: target.publicPath,
    candidateManifestSha256: sha(await fs.readFile(target.manifestPath)), fileCount: Object.keys(target.files).length,
    assetReferences: target.references, localBytesMatchManifest: true })));
  const file = path.join(here, `public-candidate-local-${stamp.replace(/[:.]/g, '-')}.json`);
  await fs.writeFile(file, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ phase, publicGetCount: 0, report: path.relative(root, file), targets: report.targets.map(({ assetReferences, ...summary }) => ({ ...summary, references: assetReferences.length })) }, null, 2));
  process.exit(0);
}
for (const target of targets) {
  const result = { id: target.id, candidateManifestSha256: sha(await fs.readFile(target.manifestPath)), expectedFileCount: Object.keys(target.files).length, assetReferences: target.references, files: [] };
  const entries = Object.entries(target.files);
  for (let offset = 0; offset < entries.length; offset += 5) {
    const rows = await Promise.all(entries.slice(offset, offset + 5).map(async ([name, expectedSha256]) => {
      const publicPath = target.publicPath + name;
      const row = { file: name, publicPath, expectedSha256 };
      try {
        const url = new URL(base + publicPath);
        url.searchParams.set('synk_candidate_check', stamp);
        const response = await fetch(url, { method: 'GET', credentials: 'omit', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(25000) });
        const bytes = Buffer.from(await response.arrayBuffer());
        row.status = response.status;
        row.bytes = bytes.length;
        row.sha256 = sha(bytes);
        row.contentType = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
        row.mimeMatches = (mime[path.extname(name)] ?? []).includes(row.contentType);
        row.matchesCandidate = response.status === 200 && row.sha256 === expectedSha256;
        if (name.endsWith('.html')) {
          const expected = cspMeta(target.local.get(name).toString('utf8'));
          const actual = cspMeta(bytes.toString('utf8'));
          const header = response.headers.get('content-security-policy');
          row.csp = { candidateMetaCount: expected.length, publicMetaCount: actual.length, metaMatches: JSON.stringify(expected) === JSON.stringify(actual), publicHeaderPresent: !!header, publicHeaderSha256: header ? sha(header) : null, publicMetaSha256: actual.map(sha) };
          if (!expected.length && !header) report.warnings.push({ product: target.id, file: name, reason: 'candidate-and-public-have-no-csp; not-a-new-candidate-difference' });
        }
        row.ok = row.matchesCandidate && row.mimeMatches && (row.csp?.metaMatches ?? true);
      } catch (error) {
        row.ok = false;
        row.error = error.name === 'TimeoutError' ? 'timeout' : 'public-get-failed';
      }
      return row;
    }));
    result.files.push(...rows);
  }
  result.files.sort((a, b) => a.file.localeCompare(b.file));
  result.matchingFiles = result.files.filter(item => item.matchesCandidate).length;
  result.ok = result.files.every(item => item.ok);
  report.targets.push(result);
}
report.matchesFrozenCandidates = report.targets.every(target => target.ok);
const file = path.join(here, `public-candidate-${phase}-${stamp.replace(/[:.]/g, '-')}.json`);
await fs.writeFile(file, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ phase, report: path.relative(root, file), matchesFrozenCandidates: report.matchesFrozenCandidates,
  targets: report.targets.map(target => ({ id: target.id, total: target.expectedFileCount, matching: target.matchingFiles, mismatches: target.files.filter(item => !item.ok).map(item => ({ file: item.file, status: item.status, bytesMatch: item.matchesCandidate, mimeMatches: item.mimeMatches, error: item.error })) })), warnings: report.warnings }, null, 2));
if (phase === 'post-release' && !report.matchesFrozenCandidates) process.exitCode = 1;
