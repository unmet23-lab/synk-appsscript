'use strict';
// Atlas × WORLD 1단계 A(재확인 짝 temper-followup-2 · Core current, 2026-11-08)를 공개본의 덧댄 묶음 둘에 끼운다(2단계 D 공개 뒤).
// 공개본 계정 묶음(world/world-account.bundle.mjs)과 혼자 여는 홈의 생활 묶음(world/brand-opening/content/life-standalone.mjs)은 master로 다시 짓지 않는
// 덧댄 판이다(현장 노트 배포 · 공개 「master에 미공개 게임이 있는데 계정 · 생활 묶음을 고쳐야 하면」). 그래서 1단계 공개 때 「다음 계정 묶음 공개 때
// 저절로 실린다」던 엔진 판이 D 공개(덧댄 판)에도 실리지 않았고, 두 묶음의 Temper는 아직 temper-followup-1이다. 그대로면 WORLD 지도가 자라는
// 공개(D 과제 마디 층 · E 말하기 마디 · 카페 · TOPIK II 단원 · 드라마 2화)마다 그 전에 잡힌 1 · 7 · 30일 재확인이 짝을 잃는다(1단계가 고친 결함).
// 1단계 원천 diff(fe44c61f73의 atlas/temper.js · atlas/game-learning.js)와 같은 네 곳을 공백 압축 판의 글 그대로 앵커로 고친다 — 앵커는 파일마다 하나만 맞아야 한다.
//   ① Temper 판 이름 temper-followup-1 → 2      ② Temper 짝 열쇠에서 지도판(taskVersion) 빼기
//   ③ Core followups()가 줄마다 current(그 능력이 이 지도에서 같은 영역의 능력인가)를 단다   ④ Core 「고친 뒤 다른 문항」 대조에서 지도판 비교 빼기
//   ⑤ 생활 묶음만: 혼자 여는 홈은 공개본 world-learning-followups.mjs를 부르지 않고 옛 followupRows를 묶음 안에 품는다 — 그 공급 줄도
//      원천(world-learning-followups.mjs 9행)처럼 row.current ?? 옛 비교로(끝 판 검수 Fable F1: ①~④만으로는 홈이 지도가 자라면 「공급 없음」).
// 기록 꼴은 그대로다(기록의 지도판 taskVersion은 남고 재현에 쓴다). 계정 길의 소비 쪽(world/world-learning-followups.mjs · D의 life-followups.mjs)은
// 따로 공개된 모듈이라 이미 row.current ?? 옛 비교이고, WORLD 게임 묶음(world/*/atlas-learning.js)은 1단계 공개로 이미 temper-followup-2다. LAB try/
// 게임 묶음은 지도와 엔진을 한 빌드로 함께 싣는 길이라(지도만 자라는 일이 없다) 여기서 고치지 않는다. 고친 뒤 두 묶음 어디에도 지도판을 바로 견주는
// 줄(사건의 taskVersion === / !== 지금 지도판)이 남지 않는지 본다.
// 끼운 줄을 실제로 돌린다: check/ 폴더(고친 묶음 · 공개본 묶음 + 공개본 재확인 투영)에서 A_공개검사.mjs가 지도가 자라는 경우를 돌린다.
//   node docs/_ops/qa/atlas-world-engine-20261108/A_공개묶음.cjs [--판 <이름>]
//   → 공용 작업본 .tmp/atlas-world-temper2-pub-20261108[-<판>]/{base,new,check}/…, 목록 · 검사 · 미리 보기 명령을 찍는다
//   검수에 묶인 앞 후보 폴더를 지우지 않으려면 고친 판은 새 --판으로 짓는다.
const path = require('node:path'), fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { 공용작업본 } = require('../../../../tools/lib/공용작업본.js');
const ROOT = path.resolve(__dirname, '../../../..');
const argv = process.argv.slice(2), 판at = argv.indexOf('--판'), 판 = 판at >= 0 ? argv[판at + 1] : '';
if (판at >= 0 && !/^[A-Za-z0-9_-]{1,40}$/.test(판 || '')) throw Error(`--판은 영문 · 숫자 · - · _ 1~40자다: ${판}`);
const TMP = path.join(공용작업본(ROOT), '.tmp'), OUT = path.join(TMP, `atlas-world-temper2-pub-20261108${판 ? `-${판}` : ''}`);
if (path.dirname(path.resolve(OUT)) !== path.resolve(TMP)) throw Error(`지울 폴더가 .tmp 바로 아래가 아니다: ${OUT}`);
const LIVE = path.join(process.env.USERPROFILE || process.env.HOME, 'Documents', 'synk-vendor', 'synk-policy-publish.git');
const git = args => execFileSync('git', ['-C', LIVE, ...args], { maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] });
const live = pub => { try { return git(['cat-file', '-p', `origin/main:${pub}`]); } catch { return null; } };
const lf = buffer => buffer.toString('utf8').replace(/\r\n/g, '\n');

// 1단계 원천 diff와 같은 네 곳(공백 압축 판의 글). 이름은 두 묶음 모두 원천 이름을 그대로 쓴다(map · current · readFollowups …) — A_공개검사.mjs가 돌려 본다.
const EDITS = Object.freeze([
  ['① Temper 판 이름', 'version:"temper-followup-1"', 'version:"temper-followup-2"'],
  ['② Temper 짝 열쇠 — 지도판 뺌',
    'const tuple=a=>JSON.stringify([game(a),a.taskVersion,a.measure?.skillId,',
    'const tuple=a=>JSON.stringify([game(a),a.measure?.skillId,'],
  ['③ Core followups current',
    'followups(){const saved=current();return readFollowups(saved.log,{scope,asOf:monotonicClock(),prior:saved.ledger,complete:saved.durable,retain:followups})}',
    'followups(){const saved=current(),out=readFollowups(saved.log,{scope,asOf:monotonicClock(),prior:saved.ledger,complete:saved.durable,retain:followups});for(const row of out.items){const node=map.getNode(row.measure.skillId);row.current=node?.kind==="skill"&&node.domain===row.measure.modality}return out}'],
  ['④ Core 다른 문항 대조 — 지도판 뺌',
    '||sourcePresentation.taskVersion!==targetPresentation.taskVersion)return unavailable("different-measurement")',
    ')return unavailable("different-measurement")'],
]);
// ⑤ 혼자 여는 홈의 생활 묶음 안 재확인 공급(옛 followupRows, 공백 압축 아님) — 원천 world-learning-followups.mjs 9행과 같은 뜻.
const LIFE_EDITS = Object.freeze([
  ['⑤ 생활 묶음 안 재확인 공급 — current 먼저',
    'const candidates = !limited && row.status === "due" && m.taskVersion === taskVersion && (!m.audioRequired || audioAvailable) ?',
    'const candidates = !limited && row.status === "due" && (row.current ?? m.taskVersion === taskVersion) && (!m.audioRequired || audioAvailable) ?'],
]);
// ③의 map이 Core createGame의 지도 인자인지 — 끼우기 전에 그 이름이 그대로인지 본다(공백 압축이라 이름은 원천 그대로다).
const CORE_SIGNATURE = 'function createGame({gameId,map,storage=null';
const ACCOUNT = 'world/world-account.bundle.mjs', LIFE = 'world/brand-opening/content/life-standalone.mjs';
const TARGETS = Object.freeze([ACCOUNT, LIFE]);
const editsFor = pub => pub === LIFE ? [...EDITS, ...LIFE_EDITS] : [...EDITS];
// 지도판을 바로 견주는 줄: Temper 짝 열쇠 · Core recheck · 공급 줄의 「사건 지도판 === 지금 지도판」(current 없이). 기록 · 투영의 taskVersion 칸은 남는다.
const EDITION_COMPARE = [/sourcePresentation\.taskVersion\s*!==/, /JSON\.stringify\(\[game\(a\),a\.taskVersion/, /&&\s*m\.taskVersion\s*===\s*taskVersion\s*&&/];

function patch(name, text, edits = editsFor(name)) {
  if (text.includes('temper-followup-2')) throw Error(`${name}: 이미 temper-followup-2가 있다 — 끼우지 않는다`);
  if (text.split(CORE_SIGNATURE).length - 1 !== 1) throw Error(`${name}: Core createGame 머리가 하나가 아니다`);
  let out = text;
  for (const [label, from, to] of edits) {
    const count = out.split(from).length - 1;
    if (count !== 1) throw Error(`${name}: 앵커가 하나가 아니다(${count}): ${label}`);
    out = out.replace(from, () => to);
  }
  const left = EDITION_COMPARE.filter(re => re.test(out));
  if (left.length) throw Error(`${name}: 지도판을 바로 견주는 줄이 남았다: ${left.map(String).join(' · ')}`);
  return out;
}

function main() {
  const head = git(['rev-parse', 'origin/main']).toString('utf8').trim();
  fs.rmSync(OUT, { recursive: true, force: true });
  const write = (dir, pub, text) => { const target = path.join(OUT, dir, pub); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, text); };
  const items = [], sizes = {};
  for (const pub of TARGETS) {
    const bytes = live(pub);
    if (!bytes) throw Error(`공개본에 없다: ${pub} — 공개 저장소 사본을 먼저 fetch한다`);
    const before = lf(bytes), after = patch(pub, before);
    write('base', pub, before); write('new', pub, after);
    items.push(pub); sizes[pub] = { before: Buffer.byteLength(before), after: Buffer.byteLength(after) };
  }
  // 검사 폴더: 고친 계정 묶음과 고치기 전 공개본 계정 묶음 + 그 묶음이 부르는 공개본 모듈 · 공개본 재확인 투영.
  const account = 'world/world-account.bundle.mjs';
  write('check', 'world-account.bundle.mjs', fs.readFileSync(path.join(OUT, 'new', account)));
  write('check', 'live-account.bundle.mjs', fs.readFileSync(path.join(OUT, 'base', account)));
  for (const name of ['world-life-engine.mjs', 'life-content.mjs', 'world-learning-followups.mjs']) {
    const bytes = live(`world/${name}`); if (!bytes) throw Error(`공개본에 없다: world/${name}`); write('check', name, lf(bytes));
  }
  for (const pub of ['world/brand-opening/content/life-standalone.mjs']) {
    write('check', `new-${path.basename(pub)}`, fs.readFileSync(path.join(OUT, 'new', pub)));
    write('check', `live-${path.basename(pub)}`, fs.readFileSync(path.join(OUT, 'base', pub)));
  }
  fs.writeFileSync(path.join(OUT, '목록.json'), JSON.stringify({ live: head, items, sizes, edits: Object.fromEntries(TARGETS.map(pub => [pub, editsFor(pub).map(([label]) => label)])) }, null, 1) + '\n');
  console.log(JSON.stringify({ out: OUT, live: head, items, sizes }, null, 1));
  console.log(`끼운 줄 돌리기: node docs/_ops/qa/atlas-world-engine-20261108/A_공개검사.mjs "${path.join(OUT, 'check')}"`);
  console.log(`미리 보기: node tools/공개.js 올리기 --원본 "${path.join(OUT, 'new')}" --기준폴더 "${path.join(OUT, 'base')}" ${items.join(' ')} --후보폴더 "${path.join(OUT, 'candidate')}"`);
}
if (require.main === module) main();
module.exports = { EDITS, LIFE_EDITS, editsFor, patch, TARGETS };
