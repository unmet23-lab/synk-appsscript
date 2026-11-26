// 한글 만나기 새 길의 변형 실행(Atlas 재설계 4-7 — 단계4_계획 §26-8). 임시 폴더에 필요한 파일만 옮겨 한 줄씩 깨고 시험이 잡는지 본다.
//   node experiences/hangul-stage/qa/atlas-next-mutants.mjs [--만 <글자>]   (저장소의 파일은 고치지 않는다)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const PLAY = 'atlas-next-play.mjs', APP = 'app.mjs', LEARN = 'learning.mjs', AUDIO = 'audio.mjs';
// [파일, 시험(play · entry), 이름, 바꿀 글, 바꾼 글]
const MUTANTS = [
  [PLAY, 'play', '고를 때 판 옵션을 다시 넘긴다(검수 GB1)', 'const result = live.recommend([...made.keys()]);', 'const result = live.recommend([...made.keys()], { set: { length: setLength(shape.amount), newLimit: 3 * setLength(shape.amount) } });'],
  [PLAY, 'play', '판을 열지 않는다', '    call(() => set.open());\n', ''],
  [PLAY, 'play', '분량을 판 길이로 넘긴다(2회차 P2-1)', 'export const setLength = amount => amount + EXTRA_PRESENTS;', 'export const setLength = amount => amount;'],
  [PLAY, 'play', '제시 수의 위 끝이 다섯만 많다', 'export const EXTRA_PRESENTS = 6;', 'export const EXTRA_PRESENTS = 5;'],
  [PLAY, 'play', '밀린 수를 진도의 간격표로 센다(2회차 P2-4)', 'Math.min(newCount(p, due.length)', 'Math.min(newCount(p, met.filter(id => Date.parse(p.letters[id].due) <= t).length)'],
  [PLAY, 'play', '밀린 수를 복습할 수 있는 글자만 센다', 'newCount(p, due.length)', 'newCount(p, back.length)'],
  [PLAY, 'play', '돌아온 글자를 간격표로 정한다', "const back = due.filter(id => met.includes(id));", "const back = met.filter(id => Date.parse(p.letters[id].due) <= t);"],
  [PLAY, 'play', '만나지 않은 글자도 복습 자리에 센다', 'due.filter(id => met.includes(id))', 'due.slice()'],
  [PLAY, 'play', '헷갈린 짝이 돌아오지 않아도 짝 문항 꼴을 먼저 묻는다', 'weak.find(pair => pair.every(id => back.includes(id))) ?? null', 'weak[0] ?? null'],
  [PLAY, 'play', '헷갈린 짝이 한 글자만 돌아와도 짝 문항 꼴을 먼저 묻는다', 'pair.every(id => back.includes(id))', 'pair.some(id => back.includes(id))'],
  [PLAY, 'play', '복습 자리에 한도가 없다', 'fresh.length ? Math.min(3, amount - fresh.length * 2) : amount', 'amount'],
  [PLAY, 'play', '새 글자를 세우지 않는다', 'for (const id of fresh) {', 'for (const id of []) {'],
  [PLAY, 'play', '새 글자를 복습보다 먼저 센다(모든 글자를 아는 것으로)', 'const known = new Set(shape.met);', 'const known = new Set([...shape.met, ...fresh]);'],
  [PLAY, 'play', '직전 글자를 후보에 둔다', '      if (id === last()) continue;\n', ''],
  [PLAY, 'play', '제품 차례가 직전 글자를 막지 않는다', 'for (const avoid of [last(), null]) {', 'for (const avoid of [null]) {'],
  [PLAY, 'play', '놓친 글자를 단 그대로 짓는다(2회차 P2-2)', 'difficulty - (state.missed.has(letter) ? 1 : 0)', 'difficulty'],
  [PLAY, 'play', '맞혀도 단이 돌아오지 않는다', 'if (correct) run.missed.delete(letter); else', 'if (!correct)'],
  [PLAY, 'play', '늘 한 단 쉽게 짓는다', 'difficulty - (state.missed.has(letter) ? 1 : 0)', 'difficulty - 1'],
  [PLAY, 'play', '채우기(idle)를 엔진 문항으로 낸다(1회차 P3-2)', "result?.status === 'ready' && result.selected ?", "(result?.status === 'ready' || result?.status === 'idle') && result.selected ?"],
  [PLAY, 'play', '엔진에 묻지 않는다', 'const item = chosen(type) ?? productTurn(type);', 'const item = productTurn(type);'],
  [PLAY, 'play', '복습을 제품 차례로 낸다', '      item = chosen(type);\n', '      item = build(type, [...known][n]);\n'],
  [PLAY, 'play', '제품 차례가 없다', 'chosen(type) ?? productTurn(type)', 'chosen(type)'],
  [PLAY, 'play', '소리가 안 나도 꼴 규칙을 따른다(2회차 P2-3)', "const type = state.soundless ? 'see_pick' : prefer", 'const type = prefer'],
  [PLAY, 'play', '소리가 나도 풀지 않는다', 'sounded: () => { state.soundless = false; },', 'sounded: () => {},'],
  [PLAY, 'play', '전달에 성공해도 풀지 않는다', 'if (ok) sounded(); else if', 'if (ok) ; else if'],
  [PLAY, 'play', '답한 뒤에 끊긴 소리도 실패로 본다', 'else if (run && open.has(pid)) run.soundless = true;', 'else if (run) run.soundless = true;'],
  [PLAY, 'play', '소리가 안 나도 새 글자 확인을 듣기로 낸다', '(state.soundless || hardByEar(pack, target))', '(hardByEar(pack, target))'],
  [PLAY, 'play', '확인 문항의 난도가 단을 따른다', '{ difficulty: 1, check: true }', '{ check: true }'],
  [PLAY, 'play', '확인 문항을 하나만 낸다', "for (const type of ['listen_pick', 'see_pick']) {\n        if", "for (const type of ['see_pick']) {\n        if"],
  [PLAY, 'play', '이유 칩에 돌아온 글자를 보인다(검수 -d GA1)', "  const taught = line.kind === 'new' || line.kind === 'mixed' ? shape.fresh : [];", '  return line;'],
  [PLAY, 'play', '이유 칩에 섞인 줄의 돌아온 글자를 보인다(검수 -d GA1)', "line.kind === 'new' || line.kind === 'mixed' ? shape.fresh : []", "line.kind === 'new' ? shape.fresh : line.kind === 'mixed' ? [...(first?.review ? [first.item.target.letter] : []), ...shape.fresh] : []"],
  [PLAY, 'play', '이유 한 줄을 첫 걸음 없이 짓는다(검수 Fable F1)', 'plan.reason = reasonOf(shape, pack, ahead[0]);', 'plan.reason = reasonOf(shape, pack, null);'],
  [PLAY, 'play', '복습 글자 목록을 채우지 않는다(검수 Fable F1)', 'if (next?.review) plan.reviews.push(next.item.target.letter);', ''],
  [PLAY, 'play', '복습 자리가 아닌 첫 문항도 돌아온 글자로 말한다(검수 Fable F1)', 'const item = first?.review ? first.item : null;', 'const item = first?.item ?? null;'],
  [PLAY, 'play', '묻지 않는 헷갈린 짝을 말한다(검수 Fable F1)', 'const weak = asked.length === 2 ? shape.weak.find(pair => asked.every(id => pair.includes(id))) ?? null : null;', 'const weak = shape.told ?? shape.weak[0] ?? null;'],
  [PLAY, 'play', '짝 맞추기를 화면 차례로 제시한다', 'const order = [first, ...item.cards.map(c => c.letter).filter(id => id !== first)];', 'const order = item.cards.map(c => c.letter);'],
  [PLAY, 'play', '짝 맞추기를 카드마다 부를 때 다시 제시한다', 'if (!matches.has(item)) {', 'if (true) {'],
  [PLAY, 'play', '짝 맞추기의 후보 열쇠가 다르다', "made.set(itemMetadata(item, item.type === 'match' ? id : null), item)", "made.set(itemMetadata(item, item.type === 'match' ? item.cards.at(-1).letter : null), item)"],
  [PLAY, 'play', '답하지 않은 제시를 닫지 않는다', '    for (const pid of [...open.keys()]) recorder.leave(pid);\n', ''],
  [PLAY, 'play', '판을 닫지 않는다', '    quietly(() => set?.end());\n', ''],
  [PLAY, 'play', '틀을 떠날 때 닫지 않는다', "  quietly(() => win?.addEventListener?.('pagehide', close));\n", ''],
  [PLAY, 'play', '새 회차가 앞 회차를 닫지 않는다', '      close();\n      const shape', '      const shape'],
  [PLAY, 'play', '겉이 닫혀도 계속 부른다', 'if (ended(error)) live = null; return null; }\n  };', 'return null; }\n  };'],
  [PLAY, 'play', '판을 다시 정해도 retired가 아니다', 'retired = true; live = null;', 'live = null;'],
  [PLAY, 'play', '판을 다시 정한 뒤에도 적는다', 'retired = true; live = null;', 'retired = true;'],
  [PLAY, 'play', '고르기가 던지면 겉을 버린다', '          if (ended(error)) live = null;\n          return null;\n        }\n      };', '          live = null;\n          return null;\n        }\n      };'],
  [PLAY, 'play', '다시 듣기를 적지 않는다(검수 카본 B1)', "replay: pid => { if (pid) call(c => c.help(pid, 'replay')); },", 'replay: () => {},'],
  [PLAY, 'play', '천천히 다시 듣기를 다른 도움으로 적는다', "call(c => c.help(pid, 'hint'))", "call(c => c.help(pid, 'text'))"],
  [PLAY, 'play', '시범이 답을 보인 것을 적지 않는다', "shown: pid => { if (pid) call(c => c.help(pid, 'answer')); },", 'shown: () => {},'],
  [PLAY, 'play', '같은 낱말을 바로 다시 낸다', 'if (word && word.target.text !== items.at(-1)?.target.text)', 'if (word)'],
  [PLAY, 'play', '낱말을 후보로 넘긴다', 'const item = build(type, id);\n      if (item) made', "const item = id === 'v-a' ? makeWordItem('listen_pick', known, base) ?? build(type, id) : build(type, id);\n      if (item) made"],
  [PLAY, 'play', '낱말 문항이 없다', 'if (word && word.target.text', 'if (false && word.target.text'],
  [PLAY, 'play', '졸업 뒤 분량이 그대로다', 'p.graduated ? Math.min(p.amount, SETTINGS.warmup) : p.amount', 'p.amount'],
  [PLAY, 'play', '문항 번호가 없다', '    item.n = items.length + 1;\n', '    item.n = 1;\n'],
  [PLAY, 'play', '가르쳐 주기를 여러 번 낸다', 'n === teachAt && known.size >= 6 && !taught', 'known.size >= 6'],
  [PLAY, 'play', '은행이 다르다', "export const BANKS = Object.freeze(['hangul-stage']);", "export const BANKS = Object.freeze(['hangul-stage', 'world-life']);"],
  [PLAY, 'play', '셸이 지금 판이라고 해도 새 길을 연다', 'return coach ? createHangul(coach, { win }) : null;', 'return createHangul(coach ?? {}, { win });'],
  [APP, 'entry', '문이 있어도 옛 코치를 먼저 만든다', 'let coach = atlasNext ? null : createCoach();', 'let coach = createCoach();'],
  [APP, 'entry', '늦게 내는 소리가 장을 보지 않는다', 'here = () => step === stepNo && visit === screenVisit;', 'here = () => true;'],
  [APP, 'entry', '답 뒤 정답 소리가 장을 보지 않는다(보고 고르기)', '    await then.say(item.target.text);', '    await audio.say(item.target.text);'],
  [AUDIO, 'entry', '멈춰도 잡아 둔 말하기를 낸다', '      if (done) return;\n      const u = new SpeechSynthesisUtterance(text);', '      const u = new SpeechSynthesisUtterance(text);'],
  [APP, 'entry', '문이 없어도 새 길 모듈을 싣는다', 'const atlasNext = atlasGate(window);', 'const atlasNext = true;'],
  [APP, 'entry', '셸이 지금 판이라고 해도 옛 코치를 만들지 않는다', 'oldPath = true; coach = createCoach(); hosted', 'oldPath = true; hosted'],
  [APP, 'entry', '새 길을 열지 못하면 옛 코치로 간다', "catch (error) { if (error?.code !== 'RUN_ENDED') console.error(error); }", 'catch (error) { oldPath = true; coach = createCoach(); rec = createRecorder(coach); }'],
  [APP, 'entry', '열지 못한 뒤 문을 다시 열지 않는다', 'if (!nextOpening && (!next || next.retired))', 'if (!nextOpening && next?.retired)'],
  [APP, 'entry', '판을 다시 정해도 문을 다시 열지 않는다', '(!next || next.retired)', '(!next)'],
  [APP, 'entry', '새 길에서도 제품이 다시 낸다', 'if (!S.run && !correct && letter', 'if (!correct && letter'],
  [APP, 'entry', '새 길의 회차를 쓰지 않는다', 'const run = next ? next.session', 'const run = null && next ? next.session'],
  [APP, 'entry', '회차 끝에 판을 닫지 않는다', 'rec.flush(); S.run?.end();', 'rec.flush();'],
  [APP, 'entry', '그만둘 때 판을 닫지 않는다', 'rec.flush(); S?.run?.end(); S = null;', 'rec.flush(); S = null;'],
  [APP, 'entry', '새 길의 기록을 쓰지 않는다', 'if (next) rec = next.recorder; else', 'if (next) ; else'],
  [APP, 'entry', '시작 단추가 셸의 코치를 기다리지 않는다', 'void Promise.resolve(nextOpening).then(', 'void Promise.resolve().then('],
  [APP, 'entry', '기다리는 사이 다른 화면으로 가도 시작한다', 'if (screenVisit === from) beginSession();', 'beginSession();'],
  [APP, 'entry', '기다리는 사이 다른 화면에 갔다 돌아와도 시작한다(검수 GA1)', 'function show(id) { screenVisit += 1; for', "function show(id) { screenVisit = id === 'home' ? 0 : screenVisit + 1; for"],
  [APP, 'entry', '짝 맞추기 카드의 소리가 나도 소리 실패를 풀지 않는다(검수 GA2)', 'if(ok){p.delivered=true;S?.run?.sounded();}', 'if(ok){p.delivered=true;}'],
  [APP, 'entry', '듣는 문항에서 다시 들어 소리가 나도 소리 실패를 풀지 않는다(검수 Fable F2)', '  if (ok) S?.run?.sounded();\n', ''],
  [APP, 'entry', '계정도 입구를 그리기 전에 기다린다', 'if (!playHostOf(window)) await nextOpening;', 'await nextOpening;'],
  [APP, 'entry', '손님도 어느 길인지 모르고 진도를 연다', '  if (!playHostOf(window)) await nextOpening;\n', ''],
  [APP, 'entry', '다음 걸음을 받지 않는다', 'const step = S.run.step(); if (step) S.steps.push(step);', ''],
  [LEARN, 'entry', '놀이 호스트를 찾지 못한다', 'if(scope?.SYNKPlayHost){host=scope.SYNKPlayHost;break;}', 'if(scope?.SYNKPlayHost){break;}'],
];

const only = process.argv.includes('--만') ? process.argv[process.argv.indexOf('--만') + 1] : null;
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hangul-mutants-'));
const put = (rel, text) => { const to = path.join(root, rel); fs.mkdirSync(path.dirname(to), { recursive: true }); fs.writeFileSync(to, text); };
const copy = rel => {
  const from = path.join(repo, rel);
  if (!fs.statSync(from).isDirectory()) return put(rel, fs.readFileSync(from));
  for (const name of fs.readdirSync(from)) if (name !== 'node_modules') copy(`${rel}/${name}`);
  return undefined;
};
for (const name of fs.readdirSync(path.join(repo, 'experiences/hangul-stage'))) if (name.endsWith('.mjs')) copy(`experiences/hangul-stage/${name}`);
// 앱이 폴더 밖에서 부르는 모듈(튜터 지원)은 정적 import를 따라 옮긴다.
const followed = new Set();
function follow(rel) {
  if (followed.has(rel) || !fs.existsSync(path.join(repo, rel))) return;
  followed.add(rel);
  copy(rel);
  for (const [, to] of fs.readFileSync(path.join(repo, rel), 'utf8').matchAll(/(?:from|import)\s*['"](\.{1,2}\/[^'"]+)['"]/g)) follow(path.posix.join(path.posix.dirname(rel), to));
}
follow('experiences/brand-opening/game-tutor-support.mjs');
for (const rel of ['experiences/hangul-stage/kit', 'experiences/synk-world-app/world-atlas-game.mjs', 'packages/atlas/src', 'packages/atlas/map', 'packages/atlas/package.json', 'strata/hangul.json']) copy(rel);
// 엔진이 쓰는 ts-fsrs를 임시 폴더에 옮긴다.
const fsrs = path.resolve(path.dirname(createRequire(path.join(repo, 'packages/atlas/src/index.mjs')).resolve('ts-fsrs')), '..');
fs.cpSync(fsrs, path.join(root, 'node_modules/ts-fsrs'), { recursive: true });
const read = rel => fs.readFileSync(path.join(repo, 'experiences/hangul-stage', rel), 'utf8').replace(/\r\n/g, '\n');
// 파일을 바로 부른다(--test에 윈도 경로를 주면 글롭으로 읽혀 시험 0개로 통과한다). 통과한 시험이 하나도 없으면 떨어진 것으로 본다.
// 잡힘은 시험이 실제로 돌아 실패를 낸 것만이다 — 시간 넘김 · 실행 오류 · 시험이 돌지 않음은 따로 센다(검수 GB3).
const run = kind => spawnSync(process.execPath, [path.join(root, `experiences/hangul-stage/atlas-next-${kind}.test.mjs`)], { cwd: root, encoding: 'utf8', timeout: 180_000 });
const count = (out, name) => Number(new RegExp(`^(?:# |ℹ )${name} (\\d+)`, 'm').exec(out.stdout ?? '')?.[1] ?? 0);
const passed = out => out.status === 0 && count(out, 'pass') > 0;
const caught = out => !out.error && out.status !== 0 && count(out, 'fail') > 0;

let survived = 0, broken = 0, total = 0;
try {
  for (const kind of ['play', 'entry']) {
    const base = run(kind);
    if (!passed(base)) { console.log(`바탕이 떨어진다(${kind})\n${base.stdout.slice(-2000)}`); fs.rmSync(root, { recursive: true, force: true }); process.exit(2); }
  }
  for (const [file, kind, name, from, to] of MUTANTS) {
    if (only && !name.includes(only)) continue;
    const text = read(file);
    if (text.split(from).length !== 2) { broken += 1; console.log(`목록 오류: ${name} — 바꿀 글이 ${text.split(from).length - 1}곳`); continue; }
    total += 1;
    put(`experiences/hangul-stage/${file}`, text.replace(from, () => to));
    const out = run(kind);
    put(`experiences/hangul-stage/${file}`, text);
    if (passed(out)) { survived += 1; console.log(`살아남음: ${name}`); } else if (!caught(out)) { broken += 1; console.log(`돌지 못함: ${name} — ${out.error?.code ?? `종료 ${out.status}`}`); }
  }
} finally { fs.rmSync(root, { recursive: true, force: true }); }
console.log(`변형 ${total} · 살아남음 ${survived} · 목록 오류 · 돌지 못함 ${broken}`);
process.exit(survived || broken ? 1 : 0);
