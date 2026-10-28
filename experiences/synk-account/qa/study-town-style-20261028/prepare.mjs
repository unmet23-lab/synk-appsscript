// Reproducible, append-only public CSS repair and one stylesheet version token.
// No publish or source mutation.
// node experiences/synk-account/qa/study-town-style-20261028/prepare.mjs [output directory]
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const out = path.resolve(process.argv[2] || path.join(root, '.tmp/study-town-style-20261028'));
const sourcePath = 'experiences/synk-account/style.css';
const source = fs.readFileSync(path.join(root, sourcePath), 'utf8').replaceAll('\r\n', '\n');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const count = (text, needle) => text.split(needle).length - 1;
const marker = '/* 「마을 기록」 (desktop/renderer/town-records-card.mjs):';
assert.equal(count(source, marker), 1, 'one canonical town block');
const start = source.indexOf(marker), end = source.indexOf('\n.portal-confirm', start);
assert.ok(end > start, 'canonical town block ends before portal confirmation styles');
const desktop = source.slice(start, end);
assert.equal(desktop.split('\n').length, 9, 'canonical block size changed; review it first');
const mobile = '.town-records-row{grid-template-columns:minmax(0,1fr)}.town-records-row>button{justify-self:start}';
assert.equal(count(source, mobile), 1, 'one canonical mobile rule');
const mediaStart = source.lastIndexOf('@media(max-width:700px){', source.indexOf(mobile));
assert.ok(mediaStart >= end && !source.slice(mediaStart, source.indexOf(mobile)).includes('\n}'), 'mobile breakpoint stays 700px');
const url = 'https://synk.im/account/style.css';
const response = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
assert.equal(response.status, 200, 'public CSS must be readable');
assert.match(response.headers.get('content-type') || '', /text\/css/, 'public response must be CSS');
const base = Buffer.from(await response.arrayBuffer());
assert.equal(count(base.toString('utf8'), '.town-records'), 0, 'public CSS already changed; do not patch twice');
const originHeadResponse = await fetch('https://api.github.com/repos/unmet23-lab/synk-policy/commits/main', { headers: { Accept: 'application/vnd.github+json' } });
assert.equal(originHeadResponse.status, 200, 'public origin head must be readable');
const originHead = (await originHeadResponse.json()).sha;
assert.match(originHead, /^[a-f0-9]{40}$/);
const originUrl = `https://raw.githubusercontent.com/unmet23-lab/synk-policy/${originHead}/account/style.css`;
const originResponse = await fetch(originUrl);
assert.equal(originResponse.status, 200, 'immutable origin CSS must be readable');
const originBytes = Buffer.from(await originResponse.arrayBuffer());
assert.deepEqual(originBytes, base, 'CDN CSS and current immutable origin differ; wait for convergence before preparing');
const originBlobSha = crypto.createHash('sha1').update(Buffer.from(`blob ${originBytes.length}\0`)).update(originBytes).digest('hex');
const addition = Buffer.from(`\n${desktop}\n@media(max-width:700px){\n  ${mobile}\n}\n`, 'utf8');
const candidate = Buffer.concat([base, addition]);
assert.deepEqual(candidate.subarray(0, base.length), base, 'all existing public bytes must be preserved');
assert.equal(count(candidate.toString('utf8'), marker), 1);
assert.equal(count(candidate.toString('utf8'), mobile), 1);
const htmlResponse = await fetch('https://synk.im/account/client.html', { headers: { 'Cache-Control': 'no-cache' } });
assert.equal(htmlResponse.status, 200, 'public HTML must be readable');
assert.match(htmlResponse.headers.get('content-type') || '', /text\/html/);
const htmlBase = Buffer.from(await htmlResponse.arrayBuffer());
const originHtmlResponse = await fetch(`https://raw.githubusercontent.com/unmet23-lab/synk-policy/${originHead}/account/client.html`);
assert.equal(originHtmlResponse.status, 200, 'immutable origin HTML must be readable');
assert.deepEqual(Buffer.from(await originHtmlResponse.arrayBuffer()), htmlBase, 'CDN HTML and origin must match');
const href = 'href="./style.css"';
assert.equal(count(htmlBase.toString('utf8'), href), 1, 'change exactly one unversioned account CSS link');
const htmlInsertAt = htmlBase.indexOf(Buffer.from(href)) + Buffer.byteLength(href) - 1;
const versionToken = `?v=${hash(candidate).slice(0, 12)}`;
const htmlCandidate = Buffer.concat([htmlBase.subarray(0, htmlInsertAt), Buffer.from(versionToken), htmlBase.subarray(htmlInsertAt)]);
assert.deepEqual(Buffer.concat([htmlCandidate.subarray(0, htmlInsertAt), htmlCandidate.subarray(htmlInsertAt + Buffer.byteLength(versionToken))]), htmlBase, 'all other public HTML bytes must be preserved');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'account__style.before.css'), base);
fs.writeFileSync(path.join(out, 'account__style.css'), candidate);
fs.writeFileSync(path.join(out, 'town-only.css'), addition);
fs.writeFileSync(path.join(out, 'account__client.before.html'), htmlBase);
fs.writeFileSync(path.join(out, 'account__client.html'), htmlCandidate);
const manifest = {
  checkedAt: new Date().toISOString(), source: sourcePath, sourceSha256: hash(Buffer.from(source)),
  publicUrl: url, baseSha256: hash(base), baseBytes: base.length,
  originHead, originUrl, originBlobSha, publicMatchesOrigin: true,
  candidateSha256: hash(candidate), candidateBytes: candidate.length,
  addedBytes: addition.length, insertionCount: 1, existingBytesUnchanged: true,
  scope: ['account/style.css', 'account/client.html'], canonicalDesktopLines: desktop.split('\n').length,
  canonicalMobileRules: 1, output: path.relative(root, out).replaceAll('\\', '/'),
  html: { baseSha256: hash(htmlBase), candidateSha256: hash(htmlCandidate), baseBytes: htmlBase.length, candidateBytes: htmlCandidate.length, versionToken, insertionCount: 1, otherBytesUnchanged: true },
};
fs.writeFileSync(path.join(out, 'candidate.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify(manifest));
