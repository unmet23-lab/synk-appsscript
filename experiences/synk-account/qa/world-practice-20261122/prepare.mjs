// WORLD 앱 창 연습 보기 공개 후보(2026-11-22) — 공개본 account/dist/client.js는 master 빌드와 앞부분이 다르다(아직 공개하지 않은 Atlas 단계 4 몫).
// 그래서 통째로 덮지 않고, 공개본과 바탕 빌드가 바이트까지 같은 뒷부분(account-view 앞 모듈부터 끝까지)만 새 빌드의 같은 자리로 바꾼다.
//   ① 바탕 빌드(<바탕 커밋>의 dist/client.js)와 공개본의 공통 끝을 잰다 → 그 앞은 공개본 그대로 둔다.
//   ② 새 빌드(작업본 dist/client.js)가 그 경계 앞에서는 바탕 빌드와 바이트까지 같아야 한다(내 변경이 경계 뒤에만 있다).
//   ③ 후보 = 공개본[경계 앞] + 새 빌드[경계 뒤]. 후보에 새 연습 보기 표식이 있고 경계 앞의 공개본 고유 줄(쓰기 막음 문구가 없음)이 그대로인지 단언한다.
// client.css는 원천을 통째로 싣는다(공개본 = 11-21 판, 원천 = 그 판 + 11-21 Fable P2 둘 + 이번 판). 그림 하나는 새 파일이다.
// 공개 · 원천 수정 없음. node experiences/synk-account/qa/world-practice-20261122/prepare.mjs <바탕 커밋> <나갈 폴더>
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const [baseCommit, outArg] = process.argv.slice(2);
if (!baseCommit || !outArg) { console.error('usage: prepare.mjs <바탕 커밋> <나갈 폴더>');process.exit(2); }
const out = path.resolve(outArg);
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const lf = text => text.replaceAll('\r\n', '\n');
const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 64 << 20 });

const fetchBytes = async url => { const r = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });assert.equal(r.status, 200, url);return Buffer.from(await r.arrayBuffer()); };
const head = await fetch('https://api.github.com/repos/unmet23-lab/synk-policy/commits/main', { headers: { Accept: 'application/vnd.github+json' } });
assert.equal(head.status, 200, 'public origin head');
const originHead = (await head.json()).sha;assert.match(originHead, /^[a-f0-9]{40}$/);
const raw = rel => fetchBytes(`https://raw.githubusercontent.com/unmet23-lab/synk-policy/${originHead}/${rel}`);
const liveJsBytes = await raw('account/dist/client.js'), liveCss = await raw('account/client.css');
assert.deepEqual(await fetchBytes('https://synk.im/account/dist/client.js'), liveJsBytes, 'CDN and origin client.js differ; wait for convergence');
const probe = await fetch(`https://raw.githubusercontent.com/unmet23-lab/synk-policy/${originHead}/account/assets/world/practice-room.webp`);
assert.equal(probe.status, 404, 'practice-room.webp already public');

const live = lf(liveJsBytes.toString('utf8'));
const base = lf(git('show', `${baseCommit}:experiences/synk-account/dist/client.js`));
const next = lf(fs.readFileSync(path.join(root, 'experiences/synk-account/dist/client.js'), 'utf8'));
let tail = 0;while (tail < live.length && tail < base.length && live[live.length - 1 - tail] === base[base.length - 1 - tail]) tail++;
const liveCut = live.length - tail, baseCut = base.length - tail;
// [baseCut, same)은 공개본 · 바탕 · 새 빌드가 모두 같은 바이트라 그 안 어디서 잘라도 후보는 같다. 공통 끝이 시작하는 자리에서 자른다.
const cutB = baseCut, cutL = liveCut;
assert.equal(live.slice(cutL), base.slice(cutB), 'live and base share the tail from the cut');
let same = 0;while (same < base.length && base[same] === next[same]) same++;
assert.ok(same >= cutB, `new build changes bytes before the cut (${same} < ${cutB}) — the change is not confined to the shared tail`);
assert.ok(base.slice(cutB).includes('function createAccountView') || base.slice(cutB).includes('WORLD 게임'), 'the shared tail carries the account view');
const candidate = live.slice(0, cutL) + next.slice(cutB);
for (const mark of ['wp-hero', '오늘은 놓친 곳부터', 'korean-runner', '내 SYNK ID']) assert.ok(candidate.includes(mark), `candidate lacks ${mark}`);
assert.ok(!candidate.includes('WRITES_DISABLED'), 'unpublished Atlas stage-4 text leaked into the candidate');
assert.equal(candidate.slice(0, cutL), live.slice(0, cutL));

const css = Buffer.from(lf(fs.readFileSync(path.join(root, 'experiences/synk-account/client.css'), 'utf8')), 'utf8');
const art = fs.readFileSync(path.join(root, 'experiences/synk-account/assets/world/practice-room.webp'));
const dir = path.join(out, 'src/account');fs.mkdirSync(path.join(dir, 'dist'), { recursive: true });fs.mkdirSync(path.join(dir, 'assets/world'), { recursive: true });
fs.writeFileSync(path.join(dir, 'dist/client.js'), candidate);
fs.writeFileSync(path.join(dir, 'client.css'), css);
fs.writeFileSync(path.join(dir, 'assets/world/practice-room.webp'), art);
fs.writeFileSync(path.join(out, 'account__client.before.js'), liveJsBytes);
fs.writeFileSync(path.join(out, 'account__client.before.css'), liveCss);
const manifest = { checkedAt: new Date().toISOString(), originHead, baseCommit, cut: { live: cutL, base: cutB, sharedTail: tail, buildPrefixSame: same },
  live: { sha256: hash(liveJsBytes), bytes: liveJsBytes.length }, candidate: { sha256: hash(Buffer.from(candidate)), bytes: Buffer.byteLength(candidate) },
  css: { before: hash(liveCss), after: hash(css), bytes: css.length }, art: { sha256: hash(art), bytes: art.length },
  scope: ['account/dist/client.js (tail from the account view)', 'account/client.css', 'account/assets/world/practice-room.webp (new)'] };
fs.writeFileSync(path.join(out, 'candidate.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify(manifest, null, 1));
