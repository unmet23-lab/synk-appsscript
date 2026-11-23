'use strict';
// 선택 공개 2단계(5-2) GC1 사본 재료. 라이브의 옛 엔진 사본 가운데 WORLD 게임 사본 여덟에만 GC1(learning-sync의 unsent() — 막힌 옛 대기열을
// 기록부에서 다시 센다, master 9af367c29b)을 끼운다. 계정 묶음 · 생활 묶음은 원천에서 다시 지어 GC1이 실린다. 드라마 사본은 12-01 master 전체
// 공개 때 올리고(시범 학생은 목록 밖), LAB try/ · id/ · id-rehearsal/ · synk-town/ 사본은 라이브 그대로다(설계 주인 11-20 · 단계4_계획 §6 5-2).
// 공개본 전체에서 learning-sync가 든 사본을 표식으로 찾고(목록을 손으로 적지 않는다), 사본마다 `status,` 다음 `invalidate(` 앞 한 자리에만 끼운다.
// 묶음 꼴은 둘(띄어 쓴 꼴 · 공백 줄인 꼴)이고 사본마다 꼭 한 자리여야 한다. 띄어 쓴 꼴은 master 생성물(order-rush)의 GC1 토막 그대로이고,
// 공백 줄인 꼴은 그 토막과 주석 밖 토큰이 같다(acorn으로 본다). 묶음 안 나머지 바이트는 그대로다.
//   node gc1-copies.cjs <출력 폴더>   → <출력>/{base,new}/<공개 경로>, 목록.json
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const acorn = require('C:/Users/q1212/Documents/SYNK-appsscript/node_modules/acorn');
const worktree = 'D:/SYNK-worktrees/SYNK-appsscript/goofy-rosalind-2b88f5';
const cache = 'C:/Users/q1212/AppData/Local/Temp/claude/357faf1081559b8e/d582e432-081a-4b0f-9469-c1e332c883ac/scratchpad/probe45/live-blobs';
const OUT = path.resolve(process.argv[2] || '');
if (!process.argv[2]) throw Error('사용법: node gc1-copies.cjs <출력 폴더>');
const env = { ...process.env, MSYS_NO_PATHCONV: '1' };
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const MARK = 'Atlas sync: local learning could not be saved';
const GC1 = '9af367c29b';
const TARGETS = ['blank-slice', 'entry-check', 'order-rush', 'snap-words', 'subway-rush', 'hangul-stage', 'korean-rhythm', 'korean-runner'].map(g => `world/${g}/atlas-learning.js`);
// 원천에서 다시 짓는 두 묶음 · 12-01로 미루는 드라마 사본 — 이 재료에 넣지 않는다.
const REBUILT = ['world/world-account.bundle.mjs', 'world/brand-opening/content/life-standalone.mjs'];
const LATER = ['world/drama/atlas-learning.js'];

// 띄어 쓴 토막: master 생성물(order-rush)에 GC1이 더한 줄 그대로(들여쓰기는 자리마다 맞춘다).
const patch = execFileSync('git', ['-C', worktree, '-c', 'core.autocrlf=false', 'show', '--format=', GC1, '--', 'experiences/order-rush/atlas-learning.js'], { maxBuffer: 1 << 28, env }).toString('utf8');
const added = patch.split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++')).map(l => l.slice(1));
if (added.length !== 13 || !added[4].trim().startsWith('unsent() {')) throw Error(`GC1 토막이 예상과 다르다(${added.length}줄)`);
const baseIndent = added[0].match(/^ */)[0].length;
const spaced = indent => added.map(l => indent + l.slice(baseIndent)).join('\n') + '\n';
const COMPACT = 'unsent(){if(stopped||!canPersist())return null;const acknowledged=new Set(state.acknowledged);try{return port.events().filter((event)=>!acknowledged.has(event.id)).length;}catch{return null;}},';
// 두 꼴이 주석 밖 토큰으로 같은지(객체 멤버로 싸서 본다)
const toks = s => { const o = []; for (const t of acorn.tokenizer(`({${s}})`, { ecmaVersion: 'latest' })) o.push(`${t.type.label}:${t.value ?? ''}`); return o.join('\u0001'); };
if (toks(spaced('')) !== toks(COMPACT)) throw Error('공백 줄인 토막이 띄어 쓴 토막과 토큰이 다르다');

const tree = JSON.parse(execFileSync('gh', ['api', 'repos/unmet23-lab/synk-policy/git/trees/main?recursive=1'], { maxBuffer: 1 << 28, env }).toString('utf8'));
const liveHead = JSON.parse(execFileSync('gh', ['api', 'repos/unmet23-lab/synk-policy/commits/main'], { maxBuffer: 1 << 26, env }).toString('utf8')).sha;
const blob = t => {
  const f = path.join(cache, t.sha);
  if (!fs.existsSync(f)) fs.writeFileSync(f, Buffer.from(JSON.parse(execFileSync('gh', ['api', 'repos/unmet23-lab/synk-policy/git/blobs/' + t.sha], { maxBuffer: 1 << 28, env }).toString('utf8')).content, 'base64'));
  return fs.readFileSync(f);
};
const copies = tree.tree.filter(t => t.type === 'blob' && /\.(m?js)$/.test(t.path) && t.size > 20000 && /(atlas|learning|bundle|standalone)/.test(t.path))
  .map(t => ({ t, bytes: blob(t) })).filter(x => x.bytes.toString('utf8').includes(MARK));
fs.rmSync(OUT, { recursive: true, force: true });
const list = { 라이브: liveHead, GC1, 끼움: [], 다시지음: [], 나중: [], 그대로: [] };
const SPACED = /\n( *)status,\n( *)invalidate\(code2? = "STORAGE_ERROR"\) \{/g;
const SQUEEZED = /status,invalidate\(code2?="STORAGE_ERROR"\)/g;
let stop = 0;
for (const { t, bytes } of copies) {
  if (REBUILT.includes(t.path)) { list.다시지음.push(t.path); continue; }
  if (LATER.includes(t.path)) { list.나중.push(t.path); continue; }
  if (!TARGETS.includes(t.path)) { list.그대로.push({ 경로: t.path, sha: t.sha }); continue; }
  const text = bytes.toString('utf8');
  if (text.includes('unsent(')) { console.log(`${t.path}: 이미 unsent가 있다`); stop++; continue; }
  const a = [...text.matchAll(SPACED)], b = [...text.matchAll(SQUEEZED)];
  if (a.length + b.length !== 1) { console.log(`${t.path}: 자리 ${a.length} + ${b.length} — 꼭 하나여야 한다`); stop++; continue; }
  let next, form;
  if (a.length) {
    const m = a[0], indent = m[1];
    if (m[2] !== indent) { console.log(`${t.path}: status와 invalidate의 들여쓰기가 다르다`); stop++; continue; }
    const at = m.index + 1 + indent.length + 'status,\n'.length;
    next = text.slice(0, at) + spaced(indent) + text.slice(at);
    form = '띄어 씀';
  } else {
    const m = b[0], at = m.index + 'status,'.length;
    next = text.slice(0, at) + COMPACT + text.slice(at);
    form = '공백 줄임';
  }
  for (const [dir, body] of [['base', bytes], ['new', Buffer.from(next, 'utf8')]]) {
    const f = path.join(OUT, dir, t.path);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, body);
  }
  list.끼움.push({ 경로: t.path, 꼴: form, 라이브: t.sha, 새판sha256: sha(Buffer.from(next, 'utf8')), 더한줄: next.split('\n').length - text.split('\n').length });
}
const missing = TARGETS.filter(p => !list.끼움.some(x => x.경로 === p));
if (missing.length) { console.log('끼우지 못한 대상', missing.join(' ')); stop++; }
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, '목록.json'), JSON.stringify(list, null, 1));
console.log(`라이브 ${liveHead.slice(0, 9)} · 표식 든 사본 ${copies.length} · 끼움 ${list.끼움.length}(${list.끼움.map(x => `${x.경로.split('/')[1]} ${x.꼴}`).join(' · ')}) · 다시 지음 ${list.다시지음.length} · 나중 ${list.나중.length} · 그대로 ${list.그대로.length}`);
if (stop) { console.log(`멈춤 ${stop}`); process.exit(1); }
