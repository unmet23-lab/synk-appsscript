'use strict';
// 개인화 화면 프론트 후속 다섯(2026-11-08, README §9 「후속」 · §11)의 synk.im/world 공개 재료 — 공개본(synk-policy-publish origin/main) 위에 이번 고침만 얹은 두 폴더를 만든다.
// 방식은 프론트_공개묶음.cjs와 같다(현장 노트 배포_공개 「master에 미공개 게임이 있는데 계정 · 생활 묶음을 고쳐야 하면」):
//  · 원천 모듈 열둘(생활 화면과 그 CSS · 배우기 화면 · 문자열 · 홈 튜터 · 생활 튜터 대사 · 게임 튜터 · 동네 · 홈): 공개본 + (바탕 → 내 판) 3방향을 git merge-file로(충돌이면 멈춤), base에 공개본 · new에 결과.
//  · 계정 묶음(world-account.bundle.mjs): 공개본은 덧댄 판이라 master로 다시 짓지 않고 앵커로만 고친다 — 내 위치의 세지 않은 답(world-position.mjs · world-position-ui.mjs)과 이번 주 계획의 시험일 안내 자리.
//    끼우는 함수 글은 이 작업본의 묶음에서 그대로 꺼낸다(손으로 옮기지 않는다). 앵커는 하나만 맞아야 한다.
//  · 생활 묶음(brand-opening/content/life-standalone.mjs)은 싣지 않는다(앱 셸이 없을 때만 읽는 예비 길 — D · 프론트와 같다, 옛 키 position.evidence.unassessed를 그대로 둔다).
//  · 끼운 줄을 실제로 돌린다: check/ 폴더에서 프론트후속_공개검사.mjs가 고친 묶음을 import해 내 판 원천과 결과를 견준다.
//   node docs/_ops/qa/atlas-world-engine-20261108/프론트후속_공개묶음.cjs <바탕 커밋> [내 판=작업본] [--후보=candidate-b](검수 뒤 고친 판의 새 후보 폴더 이름)
//   → 공용 작업본 .tmp/world-front-follow-pub-20261108/{base,new,check}/…, 목록 · 미리 보기 명령을 찍는다
const path = require('node:path'), fs = require('node:fs'), os = require('node:os');
const { execFileSync, spawnSync } = require('node:child_process');
const { 공용작업본 } = require('../../../../tools/lib/공용작업본.js');
const ROOT = path.resolve(__dirname, '../../../..');
const [BASE, NEW = '작업본'] = process.argv.slice(2).filter(x => !x.startsWith('--'));
if (!BASE) throw Error('바탕 커밋을 준다(이번 고침 바로 앞 커밋)');
const TMP = path.join(공용작업본(ROOT), '.tmp'), OUT = path.join(TMP, 'world-front-follow-pub-20261108');
if (path.dirname(path.resolve(OUT)) !== path.resolve(TMP)) throw Error(`지울 폴더가 .tmp 바로 아래가 아니다: ${OUT}`);
const LIVE = path.join(process.env.USERPROFILE || process.env.HOME, 'Documents', 'synk-vendor', 'synk-policy-publish.git');
const show = (rev, file) => { try { return execFileSync('git', ['-C', ROOT, '-c', 'core.autocrlf=false', 'show', `${rev}:${file}`], { maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return null; } };
const read = (rev, file) => rev === '작업본' ? (fs.existsSync(path.join(ROOT, file)) ? fs.readFileSync(path.join(ROOT, file)) : null) : show(rev, file);
// 공개본은 이 사본의 origin/main으로 읽는다 — 받아 오지 않으면 그사이 남이 올린 공개를 모른 채 낡은 바탕으로 재료를 만든다. 먼저 받는다.
{ const r = spawnSync('git', ['-C', LIVE, 'fetch', '-q', 'origin', 'main'], { stdio: ['ignore', 'ignore', 'pipe'], timeout: 120000 });
  if (r.status !== 0) throw Error(`공개 저장소 사본을 받지 못했다(낡은 공개본으로 재료를 만들지 않는다): ${String(r.stderr || r.error || '').trim().slice(0, 200)}`); }
const live = pub => { try { return execFileSync('git', ['-C', LIVE, 'cat-file', '-p', `origin/main:${pub}`], { maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return null; } };
const head = execFileSync('git', ['-C', LIVE, 'rev-parse', 'origin/main'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString('utf8').trim();
const config = JSON.parse(live('world/world-config.json')?.toString('utf8') || 'null');
if (!config?.account?.learningUrl || config.basePath !== '/world/') throw Error('공개본 world-config.json을 못 읽었다 — 공개 저장소 사본을 먼저 fetch한다');
// build-world-app-public.mjs rewrite()와 같은 글(D_공개묶음.cjs와 같다). relative는 공개 묶음 안 경로(world/ 뒤).
function rewrite(text, relative) {
  text = text.replaceAll('../synk-world-home/', relative.startsWith('brand-opening/') ? '../' : './').replaceAll('href="../learning-hub/"', `href="${config.account.learningUrl}"`);
  if (!relative.includes('/')) text = text.replaceAll('../brand-opening/', './brand-opening/');
  return text.replace(/(["'`])\/(scene-assets|[a-zA-Z0-9_-]+\.mjs|engine|korean-runner|korean-rhythm|hangul-stage|brand-opening|world-town-client\.mjs)(?=[/"'`])/g, (_, quote, folder) => quote + config.basePath + folder);
}
const lf = buffer => buffer.toString('utf8').replace(/\r\n/g, '\n');

// 다시 만들 때 base · new · check만 비운다 — candidate* 폴더는 검수 사슬이 묶은 공개 후보(증거)라 지우지 않는다. 고친 판은 새 이름(candidate-b …)으로.
for (const dir of ['base', 'new', 'check']) fs.rmSync(path.join(OUT, dir), { recursive: true, force: true });
const CANDIDATE = process.argv.find(x => x.startsWith('--후보='))?.slice('--후보='.length) || 'candidate';
const write = (dir, pub, text) => { const target = path.join(OUT, dir, pub); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, text); };
const items = [];

// ① 원천 모듈: 공개본 + (바탕 → 내 판).
const RAW = [
  ['experiences/synk-world-app/life-ui.mjs', 'life-ui.mjs'],
  ['experiences/synk-world-app/life-ui.css', 'life-ui.css'],
  ['experiences/synk-world-app/world-learning-ui.mjs', 'world-learning-ui.mjs'],
  ['experiences/brand-opening/world-strings.mjs', 'brand-opening/world-strings.mjs'],
  ['experiences/brand-opening/home-tutor-lines.mjs', 'brand-opening/home-tutor-lines.mjs'],
  ['experiences/brand-opening/life-tutor-lines.mjs', 'brand-opening/life-tutor-lines.mjs'],
  ['experiences/brand-opening/game-tutor.mjs', 'brand-opening/game-tutor.mjs'],
  ['experiences/brand-opening/game-tutor.css', 'brand-opening/game-tutor.css'],
  ['experiences/brand-opening/home-town.mjs', 'brand-opening/home-town.mjs'],
  ['experiences/brand-opening/home-town.css', 'brand-opening/home-town.css'],
  ['experiences/brand-opening/home.mjs', 'brand-opening/home.mjs'],
  ['experiences/brand-opening/home.css', 'brand-opening/home.css'],
  ['experiences/brand-opening/life-tutor.css', 'brand-opening/life-tutor.css'],
];
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'front-follow-pub-'));
const merges = [];
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

// ② 공개본 계정 묶음에 세지 않은 답을 끼운다. 함수 글은 이 작업본의 묶음에서 그대로 꺼낸다.
const BUNDLE = 'world/world-account.bundle.mjs', liveBundle = lf(live(BUNDLE));
if (liveBundle.includes('posUncountedTries')) throw Error('공개본 계정 묶음에 이미 이번 고침이 있다 — 끼우지 않는다');
const mineBundle = lf(fs.readFileSync(path.join(ROOT, 'experiences/synk-world-app/world-account.bundle.mjs')));
const between = (from, to) => { const a = mineBundle.indexOf(from), b = mineBundle.indexOf(to, a); if (a < 0 || b < 0) throw Error(`작업본 묶음에서 못 찾았다: ${from}`); return mineBundle.slice(a, b); };
const TRIES = between('function posUncountedTries(', 'var POSITION_CORE_POLICY=');
// 날짜 함수 이름은 묶을 때 붙는 번호라 판마다 다르다(공개본은 옛 esbuild로 지은 덧댄 판) — 공개본의 같은 함수(helpedRows)가 쓰는 이름으로 바꾼다. 공개 검사가 돌려서 본다.
const dayOf = text => { const names = [...new Set([...text.matchAll(/<time datetime="\$\{posEscape\(row\.at\)\}">\$\{posEscape\((\w+)\(row\.at\)\)\}<\/time>/g)].map(m => m[1]))]; if (names.length !== 1) throw Error(`날짜 함수 이름이 하나가 아니다: ${names}`); return names[0]; };
const ROWS = between('let UNCOUNTED_REASONS=', 'let practiceButton=').replaceAll(`${dayOf(mineBundle)}(row.at)`, `${dayOf(liveBundle)}(row.at)`);
const NO_DATE_OLD = '${notes.has("no-date")?`<p class="wpos-note">${posEscape(t("plan.week.noDate"))}</p>`:""}</section>`';
const PLAN_END_OLD = '<button class="quiet-button" type="button" data-view="study">${posEscape(t("plan.week.change"))}</button></div>`}return Object.freeze({skillName,';
const OLD_NOTE = '${skill2.unassessed?`<p class="wpos-note">${posEscape(t("position.evidence.unassessed",{n:skill2.unassessed}))}</p>`:""}';
const EDITS = [
  ['내 위치: 로그에서 세지 않은 답 읽기', 'function posHelpedTries(events,{asOf,days=30}={}){', () => TRIES + 'function posHelpedTries(events,{asOf,days=30}={}){'],
  ['내 위치: 판을 지을 때 한 번 읽는다', 'helped=posHelpedTries(events,{asOf:profile.asOf}),skills=posTopikSkills(', () => 'helped=posHelpedTries(events,{asOf:profile.asOf}),uncounted=posUncountedTries(events),skills=posTopikSkills('],
  ['내 위치: 세지 않은 답 전체 수', 'unassessed:skill2.unassessed||0', () => 'unassessed:posUnassessedTotal(skill2)'],
  ['내 위치: 줄을 항목에 싣는다', 'helped:tries};return row.note=posNote(', () => 'helped:tries,uncounted:uncounted.get(skill2.id)||[]};return row.note=posNote('],
  ['판 그림: 줄 그리는 함수', 'const practiceButton=(skillId,practice)=>', () => ROWS + 'const practiceButton=(skillId,practice)=>'],
  ['판 그림: skillRow 인자', 'function skillRow(skill2,catalog,practice){', () => 'function skillRow(skill2,catalog,practice,assessable){'],
  ['판 그림: 수 한 줄 → 줄', OLD_NOTE, () => '${uncountedRows(skill2,catalog,assessable)}'],
  ['판 그림: renderPositionBoard 인자', 'bridged=[]}={}){', () => 'bridged=[],assessable=null}={}){'],
  ['판 그림: 항목마다 넘긴다', 'skills.map(skill2=>skillRow(skill2,catalog,practice)).join("")', () => 'skills.map(skill2=>skillRow(skill2,catalog,practice,assessable)).join("")'],
  ['이번 주 계획: 계획 밖 영역의 수는 단 · 복수를 고르게(n)', 't(row.area==="life"?"plan.area.extraDays":"plan.area.extra",{done:row.done}))', () => 't(row.area==="life"?"plan.area.extraDays":"plan.area.extra",{done:row.done,n:row.done}))'],
  ['이번 주 계획: 시험일 안내를 THIS WEEK 칸에서 뺀다', NO_DATE_OLD, () => '</section>`'],
  ['이번 주 계획: 시험일 안내를 그 단추 위로', PLAN_END_OLD, () => '${notes.has("no-date")?`<p class="wpos-note wplan-date-note">${posEscape(t("plan.week.noDate"))}</p>`:""}' + PLAN_END_OLD],
];
let patched = liveBundle;
for (const [name, from, to] of EDITS) {
  const count = patched.split(from).length - 1;
  if (count !== 1) throw Error(`앵커가 하나가 아니다(${count}): ${name}`);
  patched = patched.replace(from, to);
}
write('base', BUNDLE, liveBundle); write('new', BUNDLE, patched);
items.push(BUNDLE);

// ③ 끼운 줄을 돌릴 폴더: 새 묶음 · 끼우기 전 공개본 묶음 + 묶음이 부르는 공개본 원천(D 엔진 판 · 생활 원고 · 진도와 진도가 부르는 모듈).
write('check', 'world-account.bundle.mjs', patched);
write('check', 'live-account.bundle.mjs', liveBundle);
// 공개본 묶음이 이름으로 부르는 옆 모듈(11-09 말하기 고리 공개 뒤 world-speaking-engine.mjs가 생겼다)도 함께 — 묶음에서 읽어 빠뜨리지 않는다.
const bundleImports = [...new Set([...liveBundle.matchAll(/from\s*["']\.\/([\w.-]+\.mjs)["']/g)].map(m => m[1]))];
for (const name of [...new Set([...bundleImports, 'world-life-engine.mjs', 'life-content.mjs', 'life-progress.mjs', 'cafe-activity.mjs', 'world-learning-profile.mjs', 'world-learning-profile-core.mjs', 'seoul-record.mjs'])]) {
  const bytes = live(`world/${name}`); if (!bytes) throw Error(`공개본에 없다: world/${name}`); write('check', name, lf(bytes));
}
fs.rmSync(scratch, { recursive: true, force: true });

// 이번 공개의 글 키가 3방향 결과에 있고, 이름 묶음 없이 부르는 새 모듈 이름은 공개본 원천에 있는지 본다.
const strings = fs.readFileSync(path.join(OUT, 'new', 'world/brand-opening/world-strings.mjs'), 'utf8');
for (const [key, ko] of [['plan.week.rest', '못 한 것은 쌓지 않고'], ['plan.week.start', '지금 시작하기'], ['plan.area.extra', '번 했어요'], ['plan.area.extraDays', '일 했어요']]) if (!strings.split('\n').some(line => line.includes(`'${key}'`) && line.includes(ko))) throw Error(`문자열 3방향 결과에 새 ${key}가 없다`);
for (const key of ['title', 'tag', 'noAnswer', 'more', 'why.draft', 'why.met', 'why.visual', 'why.audio', 'why.unanswered', 'why.motor', 'why.storage', 'why.other']) if (!strings.includes(`'position.uncounted.${key}'`)) throw Error(`문자열 3방향 결과에 ${key}가 없다`);
if (!strings.includes("'position.evidence.unassessed'")) throw Error('옛 키가 사라졌다 — 생활 묶음(예비 길)이 그대로 부른다');
for (const [pub, name] of [['world/life-content.mjs', 'lessonById'], ['world/brand-opening/life-tutor-lines.mjs', 'lifeTutorExpression']]) if (!new RegExp(`export (function|const) ${name}\\b`).test(lf(live(pub)))) throw Error(`${pub}에 ${name} 내보내기가 없다`);
fs.writeFileSync(path.join(OUT, '목록.json'), JSON.stringify({ base: BASE, new: NEW, live: head, items, merges, bundleBytes: Buffer.byteLength(patched) }, null, 1) + '\n');
console.log(JSON.stringify({ out: OUT, live: head, items, merges }, null, 1));
console.log(`끼운 줄 돌리기: node docs/_ops/qa/atlas-world-engine-20261108/프론트후속_공개검사.mjs "${path.join(OUT, 'check')}"`);
console.log(`미리 보기: node tools/공개.js 올리기 --원본 "${path.join(OUT, 'new')}" --기준폴더 "${path.join(OUT, 'base')}" ${items.join(' ')} --후보폴더 "${path.join(OUT, CANDIDATE)}"`);
