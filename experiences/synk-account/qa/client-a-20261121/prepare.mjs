// WORLD 앱 창(account/client.html) 공개 후보 — 공개본 client.html의 머리 스크립트 · 끝 스크립트 바이트는 그대로 두고
// ① 옛 스타일 셋(scrapbook · style · world-classroom) 링크를 client.css 하나로 ② <body>~끝 스크립트 앞의 마크업을 원천 판으로 바꾼다.
// 원천의 상대 경로는 공개본이 쓰는 주소로 옮긴다(../learning-hub/ → /try/learning-hub/, ./index.html → https://synk.im/id/).
// 공개 · 원천 수정 없음. node experiences/synk-account/qa/client-a-20261121/prepare.mjs <나갈 폴더>
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const out = path.resolve(process.argv[2] || path.join(root, '.tmp/client-a-20261121'));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const count = (text, needle) => text.split(needle).length - 1;
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8').replaceAll('\r\n', '\n');
const source = read('experiences/synk-account/client.html');
const css = Buffer.from(read('experiences/synk-account/client.css'), 'utf8');

const head = await fetch('https://api.github.com/repos/unmet23-lab/synk-policy/commits/main', { headers: { Accept: 'application/vnd.github+json' } });
assert.equal(head.status, 200, 'public origin head must be readable');
const originHead = (await head.json()).sha;assert.match(originHead, /^[a-f0-9]{40}$/);
const raw = await fetch(`https://raw.githubusercontent.com/unmet23-lab/synk-policy/${originHead}/account/client.html`);
assert.equal(raw.status, 200, 'origin client.html must be readable');
const base = Buffer.from(await raw.arrayBuffer());
const cdn = await fetch('https://synk.im/account/client.html', { headers: { 'Cache-Control': 'no-cache' } });
assert.deepEqual(Buffer.from(await cdn.arrayBuffer()), base, 'CDN and origin client.html differ; wait for convergence');
for (const name of ['client.css']) {
  const probe = await fetch(`https://raw.githubusercontent.com/unmet23-lab/synk-policy/${originHead}/account/${name}`);
  assert.equal(probe.status, 404, `account/${name} already exists in the public tree`);
}
const live = base.toString('utf8');

// ① 스타일 링크
const oldLinks = live.match(/<link rel="stylesheet" href="\.\/assets\/scrapbook\.css"><link rel="stylesheet" href="\.\/style\.css\?v=[a-f0-9]{12}"><link rel="stylesheet" href="\.\/world-classroom\.css">/);
assert.ok(oldLinks && count(live, oldLinks[0]) === 1, 'public client.html stylesheet links changed; review first');
const token = hash(css).slice(0, 12);
const newLink = `<link id="world-wardrobe-style" rel="stylesheet" href="./client.css?v=${token}">`;
assert.equal(count(source, '<link id="world-wardrobe-style" rel="stylesheet" href="./client.css?v=client-a-20261121">'), 1, 'source link');

// ② 몸 마크업(원천의 <body …>부터 첫 <script src="../learning-hub/ 앞까지)
const bodyStart = source.indexOf('<body'), bodyEnd = source.indexOf('<script src="../learning-hub/atlas-learning.js');
assert.ok(bodyStart > 0 && bodyEnd > bodyStart, 'source body');
let body = source.slice(bodyStart, bodyEnd);
assert.equal(count(body, 'href="../learning-hub/"'), 2);assert.equal(count(body, 'href="./index.html"'), 1);
body = body.replaceAll('href="../learning-hub/"', 'href="/try/learning-hub/"').replace('href="./index.html"', 'href="https://synk.im/id/"');
assert.ok(!/\.\.\//.test(body), 'no relative parent paths left');
const liveStart = live.indexOf('<body'), liveEnd = live.indexOf('<script src="/try/learning-hub/atlas-learning.js');
assert.ok(liveStart > 0 && liveEnd > liveStart && count(live, '<body') === 1, 'public body bounds');
// 공개본 몸의 id · 링크가 원천 몸에도 그대로 있는지(빠뜨린 요소 없음)
for (const id of [...live.slice(liveStart, liveEnd).matchAll(/ id="([^"]+)"/g)].map(m => m[1])) assert.equal(count(body, ` id="${id}"`), 1, `id ${id}`);
for (const href of [...live.slice(liveStart, liveEnd).matchAll(/ href="([^"]+)"/g)].map(m => m[1])) assert.ok(body.includes(` href="${href}"`), `href ${href}`);

const candidateText = live.slice(0, liveStart).replace(oldLinks[0], newLink) + body + live.slice(liveEnd);
const candidate = Buffer.from(candidateText, 'utf8');
// 머리 스크립트 · 끝 스크립트는 공개본 바이트 그대로
assert.equal(candidateText.slice(candidateText.indexOf('<script>'), candidateText.indexOf('</script>')), live.slice(live.indexOf('<script>'), live.indexOf('</script>')));
assert.equal(candidateText.slice(candidateText.indexOf('<script src="/try/learning-hub/')), live.slice(liveEnd));

const dir = path.join(out, 'src/account');fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'client.html'), candidate);
fs.writeFileSync(path.join(dir, 'client.css'), css);
fs.writeFileSync(path.join(out, 'account__client.before.html'), base);
const manifest = { checkedAt: new Date().toISOString(), originHead, base: { sha256: hash(base), bytes: base.length }, candidate: { sha256: hash(candidate), bytes: candidate.length }, css: { sha256: hash(css), bytes: css.length, token }, scope: ['account/client.html', 'account/client.css (new)'], output: path.relative(root, out).replaceAll('\\', '/') };
fs.writeFileSync(path.join(out, 'candidate.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify(manifest));
