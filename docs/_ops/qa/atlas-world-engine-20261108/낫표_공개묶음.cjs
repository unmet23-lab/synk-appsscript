'use strict';
// Vellum 이유 문장의 항목 이름 낫표(2026-11-10 — 표시 층 → 엔진)의 synk.im 공개 재료. 엔진 고침은 공개본에 저절로 안 실린다(현장 노트 배포 · 공개).
// 공개본 스크립트를 모두 훑어(목록을 손으로 적지 않는다) learningReason을 품은 사본을 찾고,
//   ① 공개본이 생성기 그대로인 사본(바탕 생성물 = 공개본)은 지금 작업본 생성물로,
//   ② 그 밖(덧댄 계정 · 생활 묶음, LAB try/ · id · synk-town의 옛 판, WORLD 리듬 · 달리기 · 한글)은 learningReason의 선언 하나만 원천과 같은 꼴
//      (`const named = 「label」, topic = …, object = …`)로 바꿔 끼운다 — 이름(topic · object3 · label · particle)과 글자 꼴(그대로 · \uXXXX)은 그 묶음 것을 따른다.
//   ③ WORLD 계획의 숙제 문장(world-learning-plan.mjs hostReason)이 든 계정 · 생활 묶음은 그 문장 둘의 이름 자리를 낫표로,
//   ④ world-strings.mjs는 공개본(master와 다른 판)에 msg 틀 여덟 줄의 한국어만 바꿔 끼우고, world-lang.mjs는 바탕 = 공개본이라 작업본 판으로.
// 빼는 것: account/dist/platform.js(learningReason을 품지만 부르지 않는다 — 포털은 회원 활동 문장만 쓰고, 「내 학습 요약」 문장은 Talk 서버가 만든다),
//   .github/ 아래 PC 미리 보기 사본(공개 쪽이 아니다).
// 바탕(base)은 지금 공개본 바이트 그대로라 공개.js 3방향이 곧 새 판이다.
//   node docs/_ops/qa/atlas-world-engine-20261108/낫표_공개묶음.cjs [--바탕 <커밋>] [--판 <이름>]
//   → 공용 작업본 .tmp/vellum-brackets-pub-20261110[-판]/{base,new}/…, 목록.json · 검사 · 미리 보기 명령을 찍는다.
const path = require('node:path'), fs = require('node:fs'), crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { 공용작업본 } = require('../../../../tools/lib/공용작업본.js');
const ROOT = path.resolve(__dirname, '../../../..'), COMMON = 공용작업본(ROOT);
const argv = process.argv.slice(2), opt = name => { const at = argv.indexOf(name); return at >= 0 ? argv[at + 1] : null; };
const 판 = opt('--판') || '', BASE = opt('--바탕') || 'origin/master';
if (판 && !/^[A-Za-z0-9_-]{1,40}$/.test(판)) throw Error(`--판은 영문 · 숫자 · - · _ 1~40자다: ${판}`);
const TMP = path.join(COMMON, '.tmp'), OUT = path.join(TMP, `vellum-brackets-pub-20261110${판 ? `-${판}` : ''}`);
if (path.dirname(path.resolve(OUT)) !== path.resolve(TMP)) throw Error(`지울 폴더가 .tmp 바로 아래가 아니다: ${OUT}`);
const LIVE = path.join(process.env.USERPROFILE || process.env.HOME, 'Documents', 'synk-vendor', 'synk-policy-publish.git');
const env = { ...process.env, GIT_NO_LAZY_FETCH: '1' };
const liveGit = (args, input) => execFileSync('git', ['-C', LIVE, ...args], { env, input, maxBuffer: 1 << 30, stdio: [input ? 'pipe' : 'ignore', 'pipe', 'pipe'] });
const show = (rev, file) => { try { return execFileSync('git', ['-C', ROOT, '-c', 'core.autocrlf=false', 'show', `${rev}:${file}`], { maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return null; } };
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 12);
const MARK = 'Vellum: invalid learning reason';
const SKIP = Object.freeze({ 'account/dist/platform.js': '부르지 않는 사본(포털은 회원 활동 문장만 쓴다)' });
// 공개 경로 → 생성기 원천(바탕 생성물 = 공개본이면 ① 길).
const GENERATED = Object.freeze({
  'world/blank-slice/atlas-learning.js': 'experiences/blank-slice/atlas-learning.js', 'world/entry-check/atlas-learning.js': 'experiences/entry-check/atlas-learning.js',
  'world/order-rush/atlas-learning.js': 'experiences/order-rush/atlas-learning.js', 'world/snap-words/atlas-learning.js': 'experiences/snap-words/atlas-learning.js',
  'world/subway-rush/atlas-learning.js': 'experiences/subway-rush/atlas-learning.js', 'world/drama/atlas-learning.js': 'experiences/drama/pilot/atlas-learning.js',
  'world/korean-rhythm/atlas-learning.js': 'experiences/korean-rhythm/atlas-learning.js', 'world/korean-runner/atlas-learning.js': 'experiences/korean-runner/atlas-learning.js',
  'world/hangul-stage/atlas-learning.js': 'experiences/hangul-stage/atlas-learning.js', 'world/brand-opening/world-lang.mjs': 'experiences/brand-opening/world-lang.mjs',
});
const WORLD_BUNDLES = Object.freeze(['world/world-account.bundle.mjs', 'world/brand-opening/content/life-standalone.mjs']);
const STRINGS = 'world/brand-opening/world-strings.mjs', STRINGS_SOURCE = 'experiences/brand-opening/world-strings.mjs';
const MSG_KEYS = Object.freeze(['msg.planHomework', 'msg.planHomeworkReview', 'msg.vellum.unseen', 'msg.vellum.checking', 'msg.vellum.practice',
  'msg.vellum.supported', 'msg.vellum.recent-independent', 'msg.vellum.review']);

// ② learningReason의 선언: const topic = `${label}${particle(label, "은", "는")}`, object = `${label}${particle(label, "을", "를")}`
// (공백을 줄인 묶음은 = · , 둘레 공백이 없고, 바로 뒤에 다른 선언이 이어질 수 있다 — 끝은 object 줄까지만 잡는다.)
const P1 = '"(?:은|\\\\uC740)"', P2 = '"(?:는|\\\\uB294)"', P3 = '"(?:을|\\\\uC744)"', P4 = '"(?:를|\\\\uB97C)"';
const DECL = new RegExp('(const|let|var)(\\s+)([\\w$]+)(\\s*=\\s*)`\\$\\{([\\w$]+)\\}\\$\\{([\\w$]+)\\(\\5,(\\s*)(' + P1 + '),(\\s*)(' + P2 + ')\\)\\}`'
  + '(,\\s*)([\\w$]+)(\\s*=\\s*)`\\$\\{\\5\\}\\$\\{\\6\\(\\5,(\\s*)(' + P3 + '),(\\s*)(' + P4 + ')\\)\\}`', 'g');
function bracketDeclaration(text, label) {
  const found = [...text.matchAll(DECL)];
  if (found.length !== 1) throw Error(`${label}: learningReason 선언이 하나가 아니다(${found.length})`);
  const [all, kw, sp, topic, eq, name, fn, s1, a, s2, b, comma, object, eq2, s3, c, s4, d] = found[0], at = found[0].index;
  const escaped = a.startsWith('"\\u'), open = escaped ? '\\u300C' : '「', close = escaped ? '\\u300D' : '」';
  if (new RegExp(`\\bnamed\\b`).test(text.slice(Math.max(0, at - 400), at))) throw Error(`${label}: 선언 앞에 이미 named가 있다`);
  const next = `${kw}${sp}named${eq}\`${open}\${${name}}${close}\`${comma}${topic}${eq}\`\${named}\${${fn}(${name},${s1}${a},${s2}${b})}\``
    + `${comma}${object}${eq2}\`\${named}\${${fn}(${name},${s3}${c},${s4}${d})}\``;
  return text.slice(0, at) + next + text.slice(at + all.length);
}
// ③ 숙제 문장 둘: `이번 주 숙제예요. ${label} 기록이 …` · `이번 주 숙제예요. ${label}에서 놓친 …`(그대로 · \uXXXX 꼴).
const HOMEWORK = /((?:이번 주 숙제예요|\\uC774\\uBC88 \\uC8FC \\uC219\\uC81C\\uC608\\uC694)\. )\$\{([\w$]+)\}( (?:기록이|\\uAE30\\uB85D\\uC774)|(?:에서|\\uC5D0\\uC11C))/g;
function bracketHomework(text, label) {
  const found = [...text.matchAll(HOMEWORK)];
  const kinds = found.map(m => /기록이|uAE30/.test(m[3]) ? 'review' : 'missed').sort().join(',');
  if (kinds !== 'missed,review') throw Error(`${label}: 숙제 문장 둘이 아니다(${kinds || '없음'})`);
  return text.replace(HOMEWORK, (all, head, name, tail) => {
    const escaped = head.startsWith('\\u');
    return `${head}${escaped ? '\\u300C' : '「'}\${${name}}${escaped ? '\\u300D' : '」'}${tail}`;
  });
}
// ④ 문자열 표: 키마다 ko 한 칸만.
const koOf = (text, key) => {
  const found = [...text.matchAll(new RegExp(`'${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}':\\{ko:'([^']*)'`, 'g'))];
  if (found.length !== 1) throw Error(`${key}: 줄이 하나가 아니다(${found.length})`);
  return { at: found[0].index, all: found[0][0], ko: found[0][1] };
};
function strings(live) {
  const base = show(BASE, STRINGS_SOURCE).toString('utf8'), mine = fs.readFileSync(path.join(ROOT, STRINGS_SOURCE), 'utf8');
  let out = live.toString('utf8');
  for (const key of MSG_KEYS) {
    const was = koOf(base, key).ko, now = koOf(mine, key).ko, there = koOf(out, key);
    if (there.ko !== was) throw Error(`${STRINGS} ${key}: 공개본 한국어가 바탕과 다르다 — 「${there.ko}」`);
    if (now === was || !now.includes('「{skill}」')) throw Error(`${key}: 작업본 판이 낫표 틀이 아니다`);
    out = out.slice(0, there.at) + there.all.replace(`ko:'${was}'`, () => `ko:'${now}'`) + out.slice(there.at + there.all.length);
  }
  return Buffer.from(out);
}
function main() {
  const head = liveGit(['rev-parse', 'origin/main']).toString('utf8').trim();
  const rows = liveGit(['ls-tree', '-r', '-l', 'origin/main']).toString('utf8').split('\n')
    .map(line => line.match(/^\d+ blob ([0-9a-f]+)\s+\d+\t(.+)$/)).filter(Boolean).filter(m => /\.(?:m?js|cjs)$/.test(m[2]) && !m[2].startsWith('.github/'));
  const live = pub => liveGit(['cat-file', 'blob', rows.find(m => m[2] === pub)[1]]);
  // 공개본 전 경로에서 엔진 사본을 찾는다 — 목록을 손으로 적지 않는다.
  const found = rows.filter(m => liveGit(['cat-file', 'blob', m[1]]).toString('utf8').includes(MARK)).map(m => m[2]);
  const engine = found.filter(pub => !SKIP[pub]), skipped = found.filter(pub => SKIP[pub]);
  fs.rmSync(OUT, { recursive: true, force: true });
  const write = (dir, pub, bytes) => { const target = path.join(OUT, dir, pub); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, bytes); };
  const items = [], ways = {}, blobs = {};
  for (const pub of [...engine, 'world/brand-opening/world-lang.mjs', STRINGS]) {
    const before = live(pub), source = GENERATED[pub], baseGenerated = source && show(BASE, source);
    let after, way;
    if (pub === STRINGS) { after = strings(before); way = '틀 여덟'; }
    else if (baseGenerated && baseGenerated.equals(before)) { after = fs.readFileSync(path.join(ROOT, source)); way = '생성기'; if (after.equals(before)) throw Error(`${pub}: 생성물이 그대로다`); }
    else {
      if (pub === 'world/brand-opening/world-lang.mjs') throw Error(`${pub}: 공개본이 바탕과 다르다 — 표시 층을 3방향으로 다시 잡는다`);
      let text = bracketDeclaration(before.toString('utf8'), pub); way = '선언 하나';
      if (WORLD_BUNDLES.includes(pub)) { text = bracketHomework(text, pub); way += '+숙제 둘'; }
      after = Buffer.from(text);
    }
    const textAfter = after.toString('utf8');
    if (engine.includes(pub) && !/named\s*=\s*`(?:「|\\u300C)\$\{[\w$]+\}(?:」|\\u300D)`/.test(textAfter)) throw Error(`${pub}: 새 꼴이 없다`);
    if (engine.includes(pub) && DECL.test(textAfter)) throw Error(`${pub}: 옛 선언이 남았다`);
    DECL.lastIndex = 0;
    write('base', pub, before); write('new', pub, after);
    items.push(pub); ways[pub] = way; (blobs[sha(before)] ||= []).push(pub);
  }
  const sizes = Object.fromEntries(items.map(pub => [pub, [fs.statSync(path.join(OUT, 'base', pub)).size, fs.statSync(path.join(OUT, 'new', pub)).size]]));
  fs.writeFileSync(path.join(OUT, '목록.json'), JSON.stringify({ live: head, base: BASE, items, ways, skipped: Object.fromEntries(skipped.map(p => [p, SKIP[p]])), sizes, 바이트종류: Object.values(blobs) }, null, 1) + '\n');
  console.log(JSON.stringify({ out: OUT, live: head, 파일: items.length, 엔진사본: engine.length, 뺀것: skipped, 종류: Object.keys(blobs).length, ways }, null, 1));
  console.log(`끼운 판 돌리기: node docs/_ops/qa/atlas-world-engine-20261108/낫표_공개검사.mjs "${OUT}"`);
  console.log(`미리 보기(공용 작업본에서): node tools/공개.js 올리기 --원본 "${path.join(OUT, 'new')}" --기준폴더 "${path.join(OUT, 'base')}" ${items.join(' ')} --후보폴더 "${path.join(OUT, 'candidate')}"`);
}
if (require.main === module) main();
module.exports = { DECL, HOMEWORK, MSG_KEYS, bracketDeclaration, bracketHomework };
