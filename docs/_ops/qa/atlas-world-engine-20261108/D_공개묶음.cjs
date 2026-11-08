'use strict';
// Atlas × WORLD 2단계 D(2026-11-08)의 synk.im/world 공개 재료 — 공개본(synk-policy-publish origin/main) 위에 D 변경만 얹은 두 폴더를 만든다.
// 현장 노트 docs/현장노트/배포_공개.md 「master에 미공개 게임이 있는데 계정 · 생활 묶음을 고쳐야 하면」을 따른다:
//  · 계정 묶음(world-account.bundle.mjs): 공개본은 덧댄 판이라(11-04 환승 러시 계획 도움 함수 등) master로 다시 짓지 않는다. D 엔진 판 한 파일
//    world-life-engine.mjs(life-trail · life-items · life-plan · Strata 생활 측정 · 생활 판정 줄만)를 내 판 원천으로 짓고, 공개본 묶음 머리에 import 한 줄과
//    앵커 여덟 곳(거울 부품 · 레슨 · 복습 · 하던 복습 targets · 계획 targets · 이유 한 줄 · 출처 이름 · 이번 주 활동)을 고친다. 앵커는 하나만 맞아야 한다.
//    WORLD 코치 지도에 생활 과제 마디를 더하는 줄(withLifeLayer)은 공개본에 끼우지 않는다: 공개본 계정 묶음의 Temper는 아직 1단계 전 판(temper-followup-1)이라
//    지도판이 바뀌면 이미 잡힌 1 · 7 · 30일 재확인이 짝을 잃는다(1단계가 고친 결함). 과제 마디는 조회용이라 지금 화면에서 쓰는 곳이 없고, 문항 측정은
//    엔진 판의 Strata 대응표가 그대로 정한다 — 지도 층은 1단계 엔진과 함께 다음 계정 묶음 공개 때 실린다. D_공개검사.mjs가 지도판이 그대로인지 본다.
//  · 원천 모듈 넷(앱 셸 · 생활 화면 · 배우기 화면 · 문자열): 공개본 + (바탕 → 내 판) 3방향을 여기서 git merge-file로 하고(충돌이면 멈춤),
//    base에 공개본, new에 그 결과를 둔다 — tools/공개.js는 그대로 얹는다(남의 미공개 줄은 바탕 · 내 판에 같이 있어 실리지 않는다).
//  · 생활 묶음(brand-opening/content/life-standalone.mjs)은 싣지 않는다: 앱 셸이 없을 때만 읽는 예비 길이고 옛 생활 화면 · 계정 모듈 사본을 통째로 품어
//    거울 없이 지금처럼 돈다(다음 생활 묶음 공개 때 저절로 실린다).
//  · 끼운 줄을 실제로 돌린다: check/ 폴더(후보 + 공개본의 원천 둘)에서 D_공개검사.mjs가 고친 묶음을 import해 내 판 원천과 결과를 견준다.
//   node docs/_ops/qa/atlas-world-engine-20261108/D_공개묶음.cjs [바탕=HEAD] [내 판=작업본]
//   내 판의 기본은 커밋 전 작업본이다(바로올리기는 작업본을 올리고 로컬 커밋은 「꼬리」로 보아 올리지 않는다 — 그래서 공개 후보도 작업본에서 짓는다).
//   올린 뒤 다시 지으려면 바탕 · 내 판에 커밋을 준다(예: <내 커밋>^ <내 커밋>).
//   → 공용 작업본 .tmp/atlas-world-life-pub-20261108/{base,new,check}/…, 목록 · 미리 보기 명령을 찍는다
const path = require('node:path'), fs = require('node:fs'), os = require('node:os');
const { execFileSync, spawnSync } = require('node:child_process');
const { 공용작업본 } = require('../../../../tools/lib/공용작업본.js');
const ROOT = path.resolve(__dirname, '../../../..');
const [BASE = 'HEAD', NEW = '작업본'] = process.argv.slice(2).filter(x => !x.startsWith('--'));
const TMP = path.join(공용작업본(ROOT), '.tmp'), OUT = path.join(TMP, 'atlas-world-life-pub-20261108');
if (path.dirname(path.resolve(OUT)) !== path.resolve(TMP)) throw Error(`지울 폴더가 .tmp 바로 아래가 아니다: ${OUT}`);
const LIVE = path.join(process.env.USERPROFILE || process.env.HOME, 'Documents', 'synk-vendor', 'synk-policy-publish.git');
const show = (rev, file) => { try { return execFileSync('git', ['-C', ROOT, '-c', 'core.autocrlf=false', 'show', `${rev}:${file}`], { maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return null; } };
const read = (rev, file) => rev === '작업본' ? (fs.existsSync(path.join(ROOT, file)) ? fs.readFileSync(path.join(ROOT, file)) : null) : show(rev, file);
const live = pub => { try { return execFileSync('git', ['-C', LIVE, 'cat-file', '-p', `origin/main:${pub}`], { maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return null; } };
const config = JSON.parse(live('world/world-config.json')?.toString('utf8') || 'null');
if (!config?.account?.learningUrl || config.basePath !== '/world/') throw Error('공개본 world-config.json을 못 읽었다 — 공개 저장소 사본을 먼저 fetch한다');
// build-world-app-public.mjs rewrite()와 같은 글(1단계 공개묶음.cjs와 같다). relative는 공개 묶음 안 경로(world/ 뒤).
function rewrite(text, relative) {
  text = text.replaceAll('../synk-world-home/', relative.startsWith('brand-opening/') ? '../' : './').replaceAll('href="../learning-hub/"', `href="${config.account.learningUrl}"`);
  if (!relative.includes('/')) text = text.replaceAll('../brand-opening/', './brand-opening/');
  return text.replace(/(["'`])\/(scene-assets|[a-zA-Z0-9_-]+\.mjs|engine|korean-runner|korean-rhythm|hangul-stage|brand-opening|world-town-client\.mjs)(?=[/"'`])/g, (_, quote, folder) => quote + config.basePath + folder);
}
const lf = buffer => buffer.toString('utf8').replace(/\r\n/g, '\n');

async function main() {
fs.rmSync(OUT, { recursive: true, force: true });
const write =(dir, pub, text) => { const target = path.join(OUT, dir, pub); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, text); };
const items = [];

// ① 원천 모듈 넷: 공개본 + (바탕 → 내 판). 새 모듈 life-followups.mjs(생활 재확인 투영)는 new에만.
const RAW = [
  ['experiences/synk-world-app/app-shell.mjs', 'app-shell.mjs'],
  ['experiences/synk-world-app/life-ui.mjs', 'life-ui.mjs'],
  ['experiences/synk-world-app/world-learning-ui.mjs', 'world-learning-ui.mjs'],
  ['experiences/brand-opening/world-strings.mjs', 'brand-opening/world-strings.mjs'],
];
// 새 원천 모듈: 생활 재확인 투영. 바뀐 모듈의 새 이름을 부르면 옛 판이 캐시에 남은 사람이 깨지므로 새 파일로 둔다(공개.js import ①이 0짝).
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'd-pub-'));
const merges = [];
for (const [src, relative] of RAW) {
  const pub = `world/${relative}`, now = live(pub), base = show(BASE, src), mine = read(NEW, src);
  if (!now || !base || !mine) throw Error(`파일이 없다: ${pub}`);
  const [l, b, m] = [lf(now), rewrite(lf(base), relative), rewrite(lf(mine), relative)];
  if (b === m) continue;
  const files = ['live', 'base', 'mine'].map(name => path.join(scratch, name));
  [l, b, m].forEach((text, i) => fs.writeFileSync(files[i], text));
  const r = spawnSync('git', ['merge-file', '-p', '-L', '공개본', '-L', '바탕', '-L', '내 판', ...files], { encoding: 'utf8', maxBuffer: 1 << 28 });
  if (r.status !== 0) throw Error(`3방향 충돌 ${r.status}곳: ${pub} — 공개본에서 내 줄을 손으로 다시 맞춘다`);
  write('base', pub, l); write('new', pub, r.stdout);
  merges.push({ pub, liveEqualsBase: l === b });
  items.push(pub);
}

{
  const relative = 'life-followups.mjs', pub = `world/${relative}`, mine = read(NEW, 'experiences/synk-world-app/life-followups.mjs');
  if (!mine) throw Error('내 판에 없다: life-followups.mjs');
  if (live(pub)) throw Error(`공개본에 이미 있다: ${pub}`);
  write('new', pub, rewrite(lf(mine), relative)); items.push(pub);
}

// ② D 엔진 판: 내 판 원천으로 짓는다(생활 원고는 공개본 /world/life-content.mjs를 그대로 부른다 · 판정 목록은 생활 줄만).
const engineSources = ['experiences/synk-world-app/life-trail.mjs', 'experiences/synk-world-app/life-items.mjs', 'experiences/synk-world-app/life-plan.mjs',
  'strata/world-life.js', 'strata/maps/world-life.json', 'experiences/topik-items/review/existing-verdicts.json'];
const tree = path.join(scratch, 'src');
for (const file of engineSources) { const bytes = read(NEW, file); if (!bytes) throw Error(`내 판에 없다: ${file}`); fs.mkdirSync(path.dirname(path.join(tree, file)), { recursive: true }); fs.writeFileSync(path.join(tree, file), bytes); }
const esbuild = require(path.join(공용작업본(ROOT), 'node_modules', 'esbuild'));
// 생활 판정 줄은 판정 자격에 쓰는 칸만(계열은 검수 칸이 아니다 — 끝 판 검수 Fable F3).
const VERDICT_FIELDS = ['itemKey', 'verdict', 'skillId', 'difficulty', 'responseFormat'];
const engine = await esbuild.build({
  absWorkingDir: tree, write: false, bundle: true, format: 'esm', platform: 'browser', target: 'es2022', legalComments: 'none', minify: true,
  stdin: { resolveDir: path.join(tree, 'experiences/synk-world-app'), sourcefile: 'world-life-engine.mjs', loader: 'js', contents: [
    "export {lifeEngine} from './life-trail.mjs';",
    "export {lifeTargets,planTargets} from './life-plan.mjs';"].join('\n') },
  plugins: [{ name: 'd-life', setup(build) {
    build.onResolve({ filter: /life-content\.mjs$/ }, () => ({ path: './life-content.mjs', external: true }));
    build.onLoad({ filter: /existing-verdicts\.json$/ }, args => {
      const data = JSON.parse(fs.readFileSync(args.path, 'utf8'));
      const rows = (data.items || []).filter(row => typeof row?.itemKey === 'string' && row.itemKey.startsWith('life.'))
        .map(row => Object.fromEntries(VERDICT_FIELDS.filter(key => Object.hasOwn(row, key)).map(key => [key, row[key]])));
      return { contents: JSON.stringify({ version: data.version, items: rows }), loader: 'json' };
    });
  } }],
});
const engineText = `// SYNK WORLD 생활 한국어 엔진 판(Atlas × WORLD D, 2026-11-08) — 계정 묶음이 부른다.\n${engine.outputFiles[0].text}`;
write('new', 'world/world-life-engine.mjs', engineText);
items.push('world/world-life-engine.mjs');

// ③ 공개본 계정 묶음에 D를 끼운다.
const BUNDLE = 'world/world-account.bundle.mjs', liveBundle = lf(live(BUNDLE));
if (liveBundle.includes('world-life-engine.mjs')) throw Error('공개본 계정 묶음에 이미 D가 있다 — 끼우지 않는다');
const EDITS = [
  ['거울 부품(지도판은 그대로)',
    'var worldMap=import_strata.default.createMap(worldMapData()),worldLearning=Object.freeze({...import_game_browser2.default,SKILLS:worldMap.allNodes(),engine:Object.freeze({...import_game_browser2.default.engine,createGame:config=>import_game_learning.default.createGame({...config,map:worldMap})})})',
    'var worldMap=import_strata.default.createMap(worldMapData()),worldLearning=Object.freeze({...import_game_browser2.default,SKILLS:worldMap.allNodes(),engine:Object.freeze({...import_game_browser2.default.engine,createGame:config=>import_game_learning.default.createGame({...config,map:worldMap})}),life:__lifeD.lifeEngine})'],
  ['레슨 후보 targets',
    'minutes:lessonMinutes(lesson2),minutesEstimated:!0,targets:[],goals:[...PACK_GOALS[lesson2.packId]]',
    'minutes:lessonMinutes(lesson2),minutesEstimated:!0,targets:__lifeD.lifeTargets(lesson2,lesson2.questions),goals:[...PACK_GOALS[lesson2.packId]]'],
  ['돌아온 복습 targets',
    'minutes:Math.max(1,Math.ceil(rows2.length/3)),minutesEstimated:!0,targets:[],goals:[...PACK_GOALS[rows2[0].packId]]',
    'minutes:Math.max(1,Math.ceil(rows2.length/3)),minutesEstimated:!0,targets:rows2.flatMap(review=>__lifeD.lifeTargets(review.lesson,[review.question],!0)),goals:[...PACK_GOALS[rows2[0].packId]]'],
  ['하던 복습 targets',
    'minutes:Math.max(1,Math.ceil(pending.length/3)),minutesEstimated:!0,targets:[],goals:[...PACK_GOALS[first.packId]]',
    'minutes:Math.max(1,Math.ceil(pending.length/3)),minutesEstimated:!0,targets:reviews.filter(review=>pending.includes(review.id)).flatMap(review=>__lifeD.lifeTargets(review.lesson,[review.question],!0)),goals:[...PACK_GOALS[first.packId]]'],
  ['계획 targets(놓친 칸 · 복습 먼저)',
    '...added].map(candidate=>{const targets=candidate.targets.filter(target=>target.skillIds.every(id=>skills.has(id))),goals=',
    '...added].map((candidate,_lifeIndex,_lifeAll)=>{const targets=__lifeD.planTargets({candidate,known:candidate.targets.filter(target=>target.skillIds.every(id=>skills.has(id))),profile,reviewWaiting:_lifeAll.some(other=>other.route==="review")}),goals='],
  ['이유 한 줄',
    '||!history2||(selected.targets||[]).length?null:selected.route==="lesson"?',
    '||!history2?null:selected.route==="lesson"?'],
  ['출처 이름',
    'if(experienceId==="world-mock")return t("position.source.mock");',
    'if(experienceId==="world-mock")return t("position.source.mock");if(experienceId==="world-life")return t("position.source.life");'],
  ['이번 주 활동',
    'area=experience==="world-home"?"recheck":',
    'area=experience==="world-life"?null:experience==="world-home"?"recheck":'],
];
let patched = liveBundle;
for (const [name, from, to] of EDITS) {
  const count = patched.split(from).length - 1;
  if (count !== 1) throw Error(`앵커가 하나가 아니다(${count}): ${name}`);
  patched = patched.replace(from, () => to);
}
patched = `import*as __lifeD from"./world-life-engine.mjs";\n${patched}`;
write('base', BUNDLE, liveBundle); write('new', BUNDLE, patched);
items.push(BUNDLE);

// ④ 끼운 줄을 돌릴 폴더: 새 판 + 공개본의 원천(생활 원고 · 진도와 진도가 부르는 모듈).
for (const pub of ['world/world-account.bundle.mjs', 'world/world-life-engine.mjs']) write('check', path.basename(pub), fs.readFileSync(path.join(OUT, 'new', pub)));
write('check', 'live-account.bundle.mjs', liveBundle); // 끼우기 전 공개본(지도판 대조용)
for (const name of ['life-content.mjs', 'life-progress.mjs', 'cafe-activity.mjs', 'world-learning-profile.mjs', 'world-learning-profile-core.mjs', 'seoul-record.mjs']) {
  const bytes = live(`world/${name}`); if (!bytes) throw Error(`공개본에 없다: world/${name}`); write('check', name, lf(bytes));
}
fs.rmSync(scratch, { recursive: true, force: true });

const strings = fs.readFileSync(path.join(OUT, 'new', 'world/brand-opening/world-strings.mjs'), 'utf8');
if (!strings.includes("'position.source.life'")) throw Error('문자열 3방향 결과에 position.source.life가 없다');
fs.writeFileSync(path.join(OUT, '목록.json'), JSON.stringify({ base: BASE, new: NEW, items, merges, engineBytes: Buffer.byteLength(engineText), bundleBytes: Buffer.byteLength(patched) }, null, 1) + '\n');
console.log(JSON.stringify({ out: OUT, items, merges, engineBytes: Buffer.byteLength(engineText) }, null, 1));
console.log(`끼운 줄 돌리기: node docs/_ops/qa/atlas-world-engine-20261108/D_공개검사.mjs "${path.join(OUT, 'check')}"`);
console.log(`미리 보기: node tools/공개.js 올리기 --원본 "${path.join(OUT, 'new')}" --기준폴더 "${path.join(OUT, 'base')}" ${items.join(' ')} --후보폴더 "${path.join(OUT, 'candidate')}"`);
}
main().catch(error => { console.error(error); process.exit(1); });
