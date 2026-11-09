'use strict';
// WORLD 화면 마감 넷(2026-11-09 — synk.im 「쓸수록 달라지는 것」 조각에 실린 자리, docs/디자인/synk.im_개인화면_20261108/README.md 7절)의
// synk.im/world 공개 재료. 공개본(synk-policy-publish origin/main) 위에 이번 고침만 얹은 두 폴더를 만든다.
// 방식은 docs/_ops/qa/atlas-world-engine-20261108/프론트후속_공개묶음.cjs의 ①과 같다 — 원천 모듈마다 공개본 + (바탕 → 내 판) 3방향을 git merge-file로
// (충돌이면 멈춤), base에 공개본 · new에 결과. 계정 묶음 · atlas-learning.js는 이번 고침이 닿지 않아 싣지 않는다. 생활 묶음(life-standalone.mjs)은 저장소에서는 다시 짓지만
// 공개하지 않는다 — 앱 셸이 없을 때만 읽는 예비 길이고(home.mjs가 host가 있으면 callHost로 간다), synk.im/world는 앱 셸로 뜬다. 앞 공개들과 같다.
//   node experiences/synk-world-app/qa/site-learner-finish-20261109/공개묶음.cjs <바탕 커밋> [내 판=작업본] [--후보=candidate]
//   → 공용 작업본 .tmp/world-finish-pub-20261109/{base,new}/…, 목록 · 미리 보기 명령을 찍는다
const path = require('node:path'), fs = require('node:fs'), os = require('node:os');
const { execFileSync, spawnSync } = require('node:child_process');
const { 공용작업본 } = require('../../../../tools/lib/공용작업본.js');
const ROOT = path.resolve(__dirname, '../../../..');
const [BASE, NEW = '작업본'] = process.argv.slice(2).filter(x => !x.startsWith('--'));
if (!BASE) throw Error('바탕 커밋을 준다(이번 고침 바로 앞 커밋)');
const TMP = path.join(공용작업본(ROOT), '.tmp'), OUT = path.join(TMP, 'world-finish-pub-20261109');
if (path.dirname(path.resolve(OUT)) !== path.resolve(TMP)) throw Error(`지울 폴더가 .tmp 바로 아래가 아니다: ${OUT}`);
const LIVE = path.join(process.env.USERPROFILE || process.env.HOME, 'Documents', 'synk-vendor', 'synk-policy-publish.git');
const show = (rev, file) => { try { return execFileSync('git', ['-C', ROOT, '-c', 'core.autocrlf=false', 'show', `${rev}:${file}`], { maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return null; } };
const read = (rev, file) => rev === '작업본' ? (fs.existsSync(path.join(ROOT, file)) ? fs.readFileSync(path.join(ROOT, file)) : null) : show(rev, file);
// 공개본은 이 사본의 origin/main으로 읽는다 — 먼저 받는다(낡은 공개본으로 재료를 만들지 않는다).
{ const r = spawnSync('git', ['-C', LIVE, 'fetch', '-q', 'origin', 'main'], { stdio: ['ignore', 'ignore', 'pipe'], timeout: 120000 });
  if (r.status !== 0) throw Error(`공개 저장소 사본을 받지 못했다: ${String(r.stderr || r.error || '').trim().slice(0, 200)}`); }
const live = pub => { try { return execFileSync('git', ['-C', LIVE, 'cat-file', '-p', `origin/main:${pub}`], { maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return null; } };
const head = execFileSync('git', ['-C', LIVE, 'rev-parse', 'origin/main'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString('utf8').trim();
const config = JSON.parse(live('world/world-config.json')?.toString('utf8') || 'null');
if (!config?.account?.learningUrl || config.basePath !== '/world/') throw Error('공개본 world-config.json을 못 읽었다');
// tools/build-world-app-public.mjs rewrite()와 같은 글. relative는 공개 묶음 안 경로(world/ 뒤).
function rewrite(text, relative) {
  text = text.replaceAll('../synk-world-home/', relative.startsWith('brand-opening/') ? '../' : './').replaceAll('href="../learning-hub/"', `href="${config.account.learningUrl}"`);
  if (!relative.includes('/')) text = text.replaceAll('../brand-opening/', './brand-opening/');
  return text.replace(/(["'`])\/(scene-assets|[a-zA-Z0-9_-]+\.mjs|engine|korean-runner|korean-rhythm|hangul-stage|brand-opening|world-town-client\.mjs)(?=[/"'`])/g, (_, quote, folder) => quote + config.basePath + folder);
}
const lf = buffer => buffer.toString('utf8').replace(/\r\n/g, '\n');

// 다시 만들 때 base · new만 비운다 — candidate* 폴더는 검수 사슬이 묶은 공개 후보(증거)라 지우지 않는다. 고친 판은 새 이름으로.
for (const dir of ['base', 'new']) fs.rmSync(path.join(OUT, dir), { recursive: true, force: true });
const CANDIDATE = process.argv.find(x => x.startsWith('--후보='))?.slice('--후보='.length) || 'candidate';
const write = (dir, pub, text) => { const target = path.join(OUT, dir, pub); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, text); };
const RAW = [
  ['experiences/brand-opening/world-lang.mjs', 'brand-opening/world-lang.mjs'],   // ① 이유 문장의 항목 이름을 한국어도 낫표로
  ['experiences/brand-opening/home.mjs', 'brand-opening/home.mjs'],               // ② 스크립트 초점의 고리는 키보드를 쓸 때만
  ['experiences/brand-opening/home.css', 'brand-opening/home.css'],
  ['experiences/synk-world-app/life-ui.css', 'life-ui.css'],                      // ③ 다시 확인 1 · 7 · 30일은 1px 선으로 나눈 글 세 칸
  ['experiences/synk-world-app/life-ui.mjs', 'life-ui.mjs'],                      // ④ 돌아올 · 돌아온 표현 머리를 화면 언어로(한국어는 모노 라벨을 벗는다)
];
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'world-finish-pub-'));
const items = [], merges = [];
try {
  for (const [src, relative] of RAW) {
    const pub = `world/${relative}`, now = live(pub), base = show(BASE, src), mine = read(NEW, src);
    if (!now || !base || !mine) throw Error(`파일이 없다: ${pub}`);
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
} finally { fs.rmSync(scratch, { recursive: true, force: true }); }

// 결과에 이번 고침이 들어 있는지 본다(3방향이 조용히 버리지 않았는지).
const got = pub => fs.readFileSync(path.join(OUT, 'new', pub), 'utf8');
const checks = [
  ['world/brand-opening/world-lang.mjs', "filled.push(`「${value}」${after}`)"],
  ['world/brand-opening/home.mjs', "document.documentElement.dataset.input='keyboard'"],
  ['world/brand-opening/home.css', 'html:not([data-input=keyboard]) :is(#home-tutor .home-tutor-action'],
  ['world/life-ui.css', '.wfol-steps>li:first-child{padding-left:0;border-left:0}'],
  ['world/life-ui.mjs', "<p class=\"life-section-label${listHead()}\">${t('life.comingBack')}</p>"],
  ['world/life-ui.css', '.life-section-label.is-text{font-family:var(--w-sans);font-size:13px'],
];
for (const [pub, needle] of checks) if (!got(pub).includes(needle)) throw Error(`3방향 결과에 이번 고침이 없다: ${pub}`);
for (const [pub, gone] of [['world/life-ui.mjs', '>COMING BACK<'], ['world/life-ui.mjs', '>BACK AGAIN<'], ['world/life-ui.css', 'box-shadow:inset 0 0 0 1.5px var(--w-led-check)']]) if (got(pub).includes(gone)) throw Error(`3방향 결과에 옛 줄이 남았다: ${pub} ${gone}`);
fs.writeFileSync(path.join(OUT, '목록.json'), JSON.stringify({ base: BASE, new: NEW, live: head, items, merges }, null, 1) + '\n');
console.log(JSON.stringify({ out: OUT, live: head, items, merges }, null, 1));
console.log(`미리 보기: node tools/공개.js 올리기 --원본 "${path.join(OUT, 'new')}" --기준폴더 "${path.join(OUT, 'base')}" ${items.join(' ')} --후보폴더 "${path.join(OUT, CANDIDATE)}"`);
