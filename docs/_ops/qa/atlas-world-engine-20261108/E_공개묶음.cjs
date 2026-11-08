'use strict';
// Atlas × WORLD 2단계 E(2026-11-08)의 synk.im/world 공개 재료 — 공개본(synk-policy-publish origin/main) 위에 E 변경만 얹은 폴더들을 만든다.
// 현장 노트 docs/현장노트/배포_공개.md 「master에 미공개 게임이 있는데 계정 · 생활 묶음을 고쳐야 하면」 · 「덧댄 공개 묶음에는 엔진 고침도 저절로 실리지 않는다」를 따른다:
//  · 계정 묶음(world-account.bundle.mjs): 공개본은 덧댄 판이라 master로 다시 짓지 않는다. E 엔진 판 한 파일 world-speaking-engine.mjs(Strata 말하기 층 · 측정 조회 ·
//    코치 지도판 지문만)를 내 판 원천으로 짓고, 공개본 묶음 머리에 import 한 줄과 앵커 둘(코치 지도 · worldLearning.speaking)을 고친다. 앵커는 하나만 맞아야 한다.
//    공개본 코치 지도는 기본 지도 + 말하기 층이다 — 생활 과제 층은 D가 공개 때 일부러 뺀 그대로(D의 남은 일). 지도판은 기본판 + 층 지문(strata/world-coach.js)이라
//    나중에 층이 늘어도 Trail 식별자 120자 안이다. 끼우기 전에 공개본 두 묶음이 temper-followup-2인지 본다(지도판이 바뀌어도 재확인이 이어지는 판).
//  · 원천 모듈 셋(앱 셸 · 배우기 화면 · 말하기 연습): 공개본 + (바탕 → 내 판) 3방향을 git merge-file로 하고(충돌이면 멈춤), base에 공개본, new에 그 결과를 둔다.
//    바뀐 모듈의 새 이름을 정적으로 부르는 줄은 없다(말하기 모듈의 새 함수는 앱 셸이 모듈 이름 공간에서 ?.로 부른다) — 옛 판이 캐시에 남은 10분 동안 깨지지 않는다.
//  · 생활 묶음(혼자 여는 홈): 말하기 연습을 붙이지 않아 지도는 그대로지만, 그 묶음의 Trail · Core는 10월 판이라 응답 꼴 spoken을 모른다 — 말하기 시도가 같은 기기 기록에
//    들어가면 그 기록 전체를 「읽지 못해 기본 연습으로」가 되고 새 답도 못 남긴다(지우지는 않는다, 실측). 11-02 핫픽스(03375fa34c — 게임 · 계정 묶음)와 같은 두 줄(연습 기록의
//    Trail 칸 · Core RESPONSE_FORMATS)을 앵커로 고친다. 프로필 사본의 Trail(require_trail)은 연습 기록을 읽지 않아 그대로 둔다.
//  · 끼운 줄을 실제로 돌린다: check/ 폴더(후보 + 공개본의 원천 · 묶음)에서 E_공개검사.mjs.
//   node docs/_ops/qa/atlas-world-engine-20261108/E_공개묶음.cjs [바탕=HEAD] [내 판=작업본] [--판 <이름>]
//   → 공용 작업본 .tmp/atlas-world-speaking-pub-20261108[-<판>]/{base,new,check}/…, 목록 · 검사 · 미리 보기 명령을 찍는다.
//   검수에 묶인 앞 후보 폴더를 지우지 않으려면 고친 판은 새 --판으로 짓는다.
const path = require('node:path'), fs = require('node:fs'), os = require('node:os');
const { execFileSync, spawnSync } = require('node:child_process');
const { 공용작업본 } = require('../../../../tools/lib/공용작업본.js');
const ROOT = path.resolve(__dirname, '../../../..');
const argv = process.argv.slice(2), 판at = argv.indexOf('--판'), 판 = 판at >= 0 ? argv[판at + 1] : '';
if (판at >= 0 && !/^[A-Za-z0-9_-]{1,40}$/.test(판 || '')) throw Error(`--판은 영문 · 숫자 · - · _ 1~40자다: ${판}`);
const [BASE = 'HEAD', NEW = '작업본'] = argv.filter((x, i) => !x.startsWith('--') && !(판at >= 0 && i === 판at + 1));
const TMP = path.join(공용작업본(ROOT), '.tmp'), OUT = path.join(TMP, `atlas-world-speaking-pub-20261108${판 ? `-${판}` : ''}`);
if (path.dirname(path.resolve(OUT)) !== path.resolve(TMP)) throw Error(`지울 폴더가 .tmp 바로 아래가 아니다: ${OUT}`);
const LIVE = path.join(process.env.USERPROFILE || process.env.HOME, 'Documents', 'synk-vendor', 'synk-policy-publish.git');
const show = (rev, file) => { try { return execFileSync('git', ['-C', ROOT, '-c', 'core.autocrlf=false', 'show', `${rev}:${file}`], { maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return null; } };
const read = (rev, file) => rev === '작업본' ? (fs.existsSync(path.join(ROOT, file)) ? fs.readFileSync(path.join(ROOT, file)) : null) : show(rev, file);
const live = pub => { try { return execFileSync('git', ['-C', LIVE, 'cat-file', '-p', `origin/main:${pub}`], { maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return null; } };
const head = () => execFileSync('git', ['-C', LIVE, 'rev-parse', 'origin/main'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString('utf8').trim();
const config = JSON.parse(live('world/world-config.json')?.toString('utf8') || 'null');
if (!config?.account?.learningUrl || config.basePath !== '/world/') throw Error('공개본 world-config.json을 못 읽었다 — 공개 저장소 사본을 먼저 fetch한다');
// build-world-app-public.mjs rewrite()와 같은 글(D_공개묶음.cjs와 같다). relative는 공개 묶음 안 경로(world/ 뒤).
function rewrite(text, relative) {
  text = text.replaceAll('../synk-world-home/', relative.startsWith('brand-opening/') ? '../' : './').replaceAll('href="../learning-hub/"', `href="${config.account.learningUrl}"`);
  if (!relative.includes('/')) text = text.replaceAll('../brand-opening/', './brand-opening/');
  return text.replace(/(["'`])\/(scene-assets|[a-zA-Z0-9_-]+\.mjs|engine|korean-runner|korean-rhythm|hangul-stage|brand-opening|world-town-client\.mjs)(?=[/"'`])/g, (_, quote, folder) => quote + config.basePath + folder);
}
const lf = buffer => buffer.toString('utf8').replace(/\r\n/g, '\n');

// 공개본 계정 묶음의 고칠 자리(공백 압축 글). 공개 저장소 origin/main에서 확인한 글이고(지은 때의 판은 목록.json live), 다르면 멈춘다.
const BUNDLE = 'world/world-account.bundle.mjs', LIFE = 'world/brand-opening/content/life-standalone.mjs';
const IMPORT = 'import*as __speakE from"./world-speaking-engine.mjs";\n';
const EDITS = Object.freeze([
  ['코치 지도 — 말하기 층(지도판은 기본판 + 층 지문)',
    'var worldMap=import_strata.default.createMap(worldMapData()),worldLearning=Object.freeze(',
    'var worldMap=import_strata.default.createMap(__speakE.coachMap(worldMapData())),worldLearning=Object.freeze('],
  ['말하기 측정 조회 부품', 'life:__lifeD.lifeEngine})', 'life:__lifeD.lifeEngine,speaking:__speakE.speakingEngine})'],
]);
// 공개본 생활 묶음의 응답 꼴 두 줄. Trail 칸은 같은 글이 프로필 사본에도 있어, 연습 기록의 Trail 모듈(require_trail2) 안에서만 고친다.
const OLD_FORMATS = '"binary-choice","single-choice","cup-compose","action","unknown"]', NEW_FORMATS = '"binary-choice","single-choice","cup-compose","action","spoken","unknown"]';
const LIFE_CORE = ['var RESPONSE_FORMATS = Object.freeze(["binary-choice", "single-choice", "cup-compose", "action", "unknown"]);', 'var RESPONSE_FORMATS = Object.freeze(["binary-choice", "single-choice", "cup-compose", "action", "spoken", "unknown"]);'];
function patchLife(text) {
  const start = text.indexOf('var require_trail2 = __commonJS('), end = text.indexOf('var require_engine2 = __commonJS(');
  if (start < 0 || end < start) throw Error('생활 묶음: 연습 기록의 Trail 모듈을 못 찾았다');
  const trail = text.slice(start, end), count = trail.split(OLD_FORMATS).length - 1;
  if (count !== 1) throw Error(`생활 묶음: Trail 응답 꼴 앵커가 하나가 아니다(${count})`);
  let out = text.slice(0, start) + trail.replace(OLD_FORMATS, () => NEW_FORMATS) + text.slice(end);
  const core = out.split(LIFE_CORE[0]).length - 1;
  if (core !== 1) throw Error(`생활 묶음: Core 응답 꼴 앵커가 하나가 아니다(${core})`);
  return out.replace(LIFE_CORE[0], () => LIFE_CORE[1]);
}
// 검사 폴더에 그대로 옮길 공개본 파일(후보가 부르는 날것 모듈 · 재확인 공급 · 생활 진도 · 말하기 은행 · 화면 언어 · 소리).
const CHECK_LIVE = ['world-life-engine.mjs', 'life-content.mjs', 'life-followups.mjs', 'world-learning-followups.mjs', 'life-progress.mjs', 'cafe-activity.mjs', 'world-learning-profile.mjs',
  'world-learning-profile-core.mjs', 'seoul-record.mjs', 'world-speaking-items.json', 'brand-opening/world-lang.mjs', 'brand-opening/world-strings.mjs', 'brand-opening/tutor-photos.mjs',
  'brand-opening/tutor-photos-data.mjs', 'brand-opening/world-sound.mjs'];

async function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  const write = (dir, pub, text) => { const target = path.join(OUT, dir, pub); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, text); };
  const items = [];

  // ① 끼우기 전 관문: 두 공개 묶음의 재확인 짝이 지도판을 보지 않는 판이어야 한다(지도판이 바뀐다).
  const liveBundle = lf(live(BUNDLE)), liveLife = lf(live(LIFE));
  for (const [name, text] of [[BUNDLE, liveBundle], [LIFE, liveLife]]) {
    if (!text.includes('temper-followup-2') || text.includes('temper-followup-1')) throw Error(`${name}: temper-followup-2가 아니다 — 지도판을 바꾸면 재확인이 끊긴다`);
  }
  if (liveBundle.includes('world-speaking-engine.mjs')) throw Error('공개본 계정 묶음에 이미 E가 있다 — 끼우지 않는다');
  if (!liveBundle.includes(NEW_FORMATS)) throw Error('공개본 계정 묶음이 응답 꼴 spoken을 모른다 — 말하기 기록을 못 읽는다');
  if (live('world/world-speaking-engine.mjs')) throw Error('공개본에 이미 world-speaking-engine.mjs가 있다');

  // ② 원천 모듈 셋: 공개본 + (바탕 → 내 판).
  const RAW = [
    ['experiences/synk-world-app/app-shell.mjs', 'app-shell.mjs'],
    ['experiences/synk-world-app/world-learning-ui.mjs', 'world-learning-ui.mjs'],
    ['experiences/synk-world-app/world-speaking-practice.mjs', 'world-speaking-practice.mjs'],
  ];
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'e-pub-'));
  const merges = [];
  for (const [src, relative] of RAW) {
    const pub = `world/${relative}`, now = live(pub), base = show(BASE, src), mine = read(NEW, src);
    if (!now || !base || !mine) throw Error(`파일이 없다: ${pub}`);
    const [l, b, m] = [lf(now), rewrite(lf(base), relative), rewrite(lf(mine), relative)];
    if (b === m) throw Error(`바탕과 내 판이 같다: ${pub}`);
    const files = ['live', 'base', 'mine'].map(name => path.join(scratch, name));
    [l, b, m].forEach((text, i) => fs.writeFileSync(files[i], text));
    const r = spawnSync('git', ['merge-file', '-p', '-L', '공개본', '-L', '바탕', '-L', '내 판', ...files], { encoding: 'utf8', maxBuffer: 1 << 28 });
    if (r.status !== 0) throw Error(`3방향 충돌 ${r.status}곳: ${pub} — 공개본에서 내 줄을 손으로 다시 맞춘다`);
    write('base', pub, l); write('new', pub, r.stdout);
    merges.push({ pub, liveEqualsBase: l === b });
    items.push(pub);
  }

  // ③ E 엔진 판: 내 판 원천으로 짓는다(말하기 층 JSON · 조회 · 지도판 지문). 공개본 코치 지도에는 말하기 층 하나만 싣는다.
  const engineSources = ['strata/topik-speaking.js', 'strata/maps/topik-speaking.json', 'strata/world-coach.js'];
  const tree = path.join(scratch, 'src');
  for (const file of engineSources) { const bytes = read(NEW, file); if (!bytes) throw Error(`내 판에 없다: ${file}`); fs.mkdirSync(path.dirname(path.join(tree, file)), { recursive: true }); fs.writeFileSync(path.join(tree, file), bytes); }
  const esbuild = require(path.join(공용작업본(ROOT), 'node_modules', 'esbuild'));
  const engine = await esbuild.build({
    absWorkingDir: tree, write: false, bundle: true, format: 'esm', platform: 'browser', target: 'es2022', legalComments: 'none', minify: true,
    stdin: { resolveDir: tree, sourcefile: 'world-speaking-engine.mjs', loader: 'js', contents: [
      "import speaking from './strata/topik-speaking.js';",
      "import coach from './strata/world-coach.js';",
      'export const speakingEngine=speaking.speakingEngine;',
      'export const speakingMeasure=speaking.speakingMeasure;',
      'export const layerVersion=speaking.layer().layer_ver;',
      'export const coachMap=data=>coach.coachMapData(data,[[speaking.withSpeakingLayer,speaking.layer()]]);',
      'export const fingerprint=coach.fingerprint;'].join('\n') },
  });
  const engineText = `// SYNK WORLD 말하기 엔진 판(Atlas × WORLD E, 2026-11-08) — 계정 묶음이 부른다.\n${engine.outputFiles[0].text}`;
  write('new', 'world/world-speaking-engine.mjs', engineText);
  items.push('world/world-speaking-engine.mjs');

  // ④ 공개본 계정 묶음에 E를 끼운다.
  let patched = liveBundle;
  for (const [name, from, to] of EDITS) {
    const count = patched.split(from).length - 1;
    if (count !== 1) throw Error(`앵커가 하나가 아니다(${count}): ${name}`);
    patched = patched.replace(from, () => to);
  }
  patched = `${IMPORT}${patched}`;
  write('base', BUNDLE, liveBundle); write('new', BUNDLE, patched);
  items.push(BUNDLE);
  const patchedLife = patchLife(liveLife);
  write('base', LIFE, liveLife); write('new', LIFE, patchedLife);
  items.push(LIFE);

  // ⑤ 끼운 줄을 돌릴 폴더: 새 판 + 공개본의 원천 · 묶음.
  for (const pub of [BUNDLE, 'world/world-speaking-engine.mjs', 'world/world-learning-ui.mjs', 'world/world-speaking-practice.mjs']) write('check', path.basename(pub), fs.readFileSync(path.join(OUT, 'new', pub)));
  write('check', 'live-account.bundle.mjs', liveBundle);
  write('check', 'live-life-standalone.mjs', liveLife);
  write('check', 'new-life-standalone.mjs', patchedLife);
  for (const relative of CHECK_LIVE) { const bytes = live(`world/${relative}`); if (!bytes) throw Error(`공개본에 없다: world/${relative}`); write('check', relative, lf(bytes)); }
  // 단계 README §8 남은 확인(옛 판이 같은 기기 장부를 접을 때)을 재는 LAB try/ 묶음 하나. 다음 LAB 공개로 판이 올라가면 없어도 된다.
  const tryBundle = live('try/rhythm/atlas-learning.js');
  if (tryBundle) write('check', 'live-try-atlas-learning.js', lf(tryBundle));
  fs.rmSync(scratch, { recursive: true, force: true });

  fs.writeFileSync(path.join(OUT, '목록.json'), JSON.stringify({ live: head(), base: BASE, new: NEW, items, merges, engineBytes: Buffer.byteLength(engineText), bundleBytes: Buffer.byteLength(patched) }, null, 1) + '\n');
  console.log(JSON.stringify({ out: OUT, live: head(), items, merges, engineBytes: Buffer.byteLength(engineText) }, null, 1));
  console.log(`끼운 줄 돌리기: node docs/_ops/qa/atlas-world-engine-20261108/E_공개검사.mjs "${path.join(OUT, 'check')}"`);
  console.log(`미리 보기: node tools/공개.js 올리기 --원본 "${path.join(OUT, 'new')}" --기준폴더 "${path.join(OUT, 'base')}" ${items.join(' ')} --후보폴더 "${path.join(OUT, 'candidate')}"`);
}
main().catch(error => { console.error(error); process.exit(1); });
