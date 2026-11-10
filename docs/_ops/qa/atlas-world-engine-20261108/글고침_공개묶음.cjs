'use strict';
// 개인화 화면 글 고침 · 복습 세는 단위(2026-11-09, README §12)의 synk.im/world 공개 재료 — 공개본 위에 이번 고침만 얹은 base · new · check를 만든다.
// 방식은 프론트후속_공개묶음.cjs와 같다: 원천 모듈은 공개본 + (바탕 → 내 판) 3방향, 계정 묶음은 master로 다시 짓지 않고 앵커로만 고친다.
//   node docs/_ops/qa/atlas-world-engine-20261108/글고침_공개묶음.cjs <바탕 커밋> [<내 판 커밋>] [--후보=candidate-b]
// 내 판 커밋을 주면 원천을 그 커밋에서 읽는다(그 뒤 남의 커밋이 섞이지 않는다). 없으면 작업본.
const path = require('node:path'), fs = require('node:fs'), os = require('node:os');
const { execFileSync, spawnSync } = require('node:child_process');
const { 공용작업본 } = require('../../../../tools/lib/공용작업본.js');
const ROOT = path.resolve(__dirname, '../../../..');
const [BASE, MINE] = process.argv.slice(2).filter(x => !x.startsWith('--'));
if (!BASE) throw Error('바탕 커밋을 준다(이번 고침 바로 앞 커밋)');
const opt = name => process.argv.find(x => x.startsWith(`--${name}=`))?.slice(name.length + 3);
const OUT = path.join(공용작업본(ROOT), '.tmp', 'world-copy-pub-20261109');
const LIVE = path.join(process.env.USERPROFILE || process.env.HOME, 'Documents', 'synk-vendor', 'synk-policy-publish.git');
const show = (rev, file) => execFileSync('git', ['-C', ROOT, '-c', 'core.autocrlf=false', 'show', `${rev}:${file}`], { maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] });
{ const r = spawnSync('git', ['-C', LIVE, 'fetch', '-q', 'origin', 'main'], { stdio: ['ignore', 'ignore', 'pipe'], timeout: 120000 });
  if (r.status !== 0) throw Error(`공개 저장소 사본을 받지 못했다(낡은 공개본으로 재료를 만들지 않는다): ${String(r.stderr || r.error || '').trim().slice(0, 200)}`); }
const live = pub => { try { return execFileSync('git', ['-C', LIVE, 'cat-file', '-p', `origin/main:${pub}`], { maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return null; } };
const head = execFileSync('git', ['-C', LIVE, 'rev-parse', 'origin/main'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString('utf8').trim();
const config = JSON.parse(live('world/world-config.json')?.toString('utf8') || 'null');
if (!config?.account?.learningUrl || config.basePath !== '/world/') throw Error('공개본 world-config.json을 못 읽었다');
function rewrite(text, relative) {
  text = text.replaceAll('../synk-world-home/', relative.startsWith('brand-opening/') ? '../' : './').replaceAll('href="../learning-hub/"', `href="${config.account.learningUrl}"`);
  if (!relative.includes('/')) text = text.replaceAll('../brand-opening/', './brand-opening/');
  return text.replace(/(["'`])\/(scene-assets|[a-zA-Z0-9_-]+\.mjs|engine|korean-runner|korean-rhythm|hangul-stage|brand-opening|world-town-client\.mjs)(?=[/"'`])/g, (_, quote, folder) => quote + config.basePath + folder);
}
const lf = buffer => buffer.toString('utf8').replace(/\r\n/g, '\n');
for (const dir of ['base', 'new', 'check']) fs.rmSync(path.join(OUT, dir), { recursive: true, force: true });
const CANDIDATE = opt('후보') || 'candidate';
const write = (dir, pub, text) => { const target = path.join(OUT, dir, pub); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, text); };
const items = [], merges = [];
const RAW = [
  ['experiences/brand-opening/world-strings.mjs', 'brand-opening/world-strings.mjs'],
  ['experiences/brand-opening/home.mjs', 'brand-opening/home.mjs'],
  ['experiences/brand-opening/home.css', 'brand-opening/home.css'],
  ['experiences/brand-opening/home-tutor.mjs', 'brand-opening/home-tutor.mjs'],
  ['experiences/brand-opening/home-tutor-lines.mjs', 'brand-opening/home-tutor-lines.mjs'],
  ['experiences/synk-world-app/life-progress.mjs', 'life-progress.mjs'],
  ['experiences/synk-world-app/life-ui.mjs', 'life-ui.mjs'],
  ['experiences/synk-world-app/life-ui.css', 'life-ui.css'],
];
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'copy-pub-'));
for (const [src, relative] of RAW) {
  const pub = `world/${relative}`, now = live(pub);
  const base = show(BASE, src), mine = MINE ? show(MINE, src) : fs.readFileSync(path.join(ROOT, src));
  if (!now) throw Error(`공개본에 없다: ${pub}`);
  const [l, b, m] = [lf(now), rewrite(lf(base), relative), rewrite(lf(mine), relative)];
  if (b === m) throw Error(`이 파일에 고침이 없다: ${src}`);
  const files = ['live', 'base', 'mine'].map(name => path.join(scratch, name));
  [l, b, m].forEach((text, i) => fs.writeFileSync(files[i], text));
  const r = spawnSync('git', ['merge-file', '-p', '-L', '공개본', '-L', '바탕', '-L', '내 판', ...files], { encoding: 'utf8', maxBuffer: 1 << 28 });
  if (r.status !== 0) throw Error(`3방향 충돌 ${r.status}곳: ${pub} — 공개본에서 내 줄을 손으로 다시 맞춘다`);
  write('base', pub, l); write('new', pub, r.stdout);
  merges.push({ pub, liveEqualsBase: l === b });
  items.push(pub);
}
// 공개본 계정 묶음(덧댄 판): 이번 주 계획 머리 두 줄만 고친다.
const BUNDLE = 'world/world-account.bundle.mjs', liveBundle = lf(live(BUNDLE));
const EDITS = [
  ['이번 주 계획: 큰 제목을 위 막대에서 되풀이하지 않는다', 'poster(t("plan.week.title"),head,{print:"plan",label:"MY PLAN"})', () => 'poster(plan2.sessions?.total>0?t("plan.week.word",{n:plan2.sessions.total}):t("plan.week.title"),head,{print:"plan",label:"MY PLAN"})'],
  ['이번 주 계획: 계획 밖에 한 줄을 가른다', '<ul class="wplan-areas">${(plan2.areas||[]).map(area).join("")}</ul>', () => '<ul class="wplan-areas">${(plan2.areas||[]).filter(row=>row.planned>0).map(area).join("")}</ul>${(plan2.areas||[]).some(row=>!(row.planned>0))?`<p class="wplan-extra-label">${posEscape(t("plan.area.extraTitle"))}</p><ul class="wplan-areas" data-extra>${(plan2.areas||[]).filter(row=>!(row.planned>0)).map(area).join("")}</ul>`:""}'],
  ['이번 주 계획: 이번 주 칸 머리는 한 번 길이만', '<h3>${posEscape(t("plan.week.sessions",{n:plan2.sessions?.total||0,minutes:plan2.sessions?.minutes||0}))}</h3>', () => '${plan2.sessions?.minutes>0?`<h3>${posEscape(t("plan.week.length",{minutes:plan2.sessions.minutes}))}</h3>`:""}'],
];
// 함수 인자 이름은 묶을 때 붙는 번호라 판마다 다르다 — 공개본의 그 줄에서 읽어 맞춘다.
const planName = (liveBundle.match(/t\("plan\.week\.sessions",\{n:(\w+)\.sessions\?\.total\|\|0/) || [])[1];
if (!planName) throw Error('공개본 묶음에서 이번 주 계획 줄을 못 찾았다');
let patched = liveBundle;
for (const [name, from, to] of EDITS) {
  const a = from.replaceAll('plan2.', `${planName}.`), b = to().replaceAll('plan2.', `${planName}.`);
  const count = patched.split(a).length - 1;
  if (count !== 1) throw Error(`앵커가 하나가 아니다(${count}): ${name}`);
  patched = patched.replace(a, () => b);
}
write('base', BUNDLE, liveBundle); write('new', BUNDLE, patched);
items.push(BUNDLE);
// 끼운 줄을 돌릴 폴더: 새 묶음 + 묶음이 부르는 공개본 원천.
write('check', 'world-account.bundle.mjs', patched);
write('check', 'live-account.bundle.mjs', liveBundle);
const bundleImports = [...new Set([...liveBundle.matchAll(/from\s*["']\.\/([\w.-]+\.mjs)["']/g)].map(m => m[1]))];
for (const name of [...new Set([...bundleImports, 'life-content.mjs', 'life-progress.mjs', 'cafe-activity.mjs', 'world-learning-profile.mjs', 'world-learning-profile-core.mjs', 'seoul-record.mjs'])]) {
  const bytes = live(`world/${name}`); if (!bytes) throw Error(`공개본에 없다: world/${name}`); write('check', name, lf(bytes));
}
fs.rmSync(scratch, { recursive: true, force: true });
// 새 글 키가 3방향 결과에 있는지 본다. 공개본 묶음이 아직 부르는 옛 키는 지우지 않았는지도(캐시된 옛 판이 10분 안에 부를 수 있다).
const strings = fs.readFileSync(path.join(OUT, 'new', 'world/brand-opening/world-strings.mjs'), 'utf8');
for (const key of ['plan.week.word', 'plan.week.length', 'plan.area.extraTitle', 'life.reviewedList', 'life.reviewFirstList', 'life.reviewSubFirst', 'life.reviewSpacing']) if (!strings.includes(`'${key}'`)) throw Error(`문자열 3방향 결과에 ${key}가 없다`);
fs.writeFileSync(path.join(OUT, '목록.json'), JSON.stringify({ base: BASE, new: MINE || '작업본', live: head, items, merges, bundleBytes: Buffer.byteLength(patched) }, null, 1) + '\n');
console.log(JSON.stringify({ out: OUT, live: head, items, merges }, null, 1));
console.log(`미리 보기: node tools/공개.js 올리기 --원본 "${path.join(OUT, 'new')}" --기준폴더 "${path.join(OUT, 'base')}" ${items.join(' ')} --후보폴더 "${path.join(OUT, CANDIDATE)}"`);
