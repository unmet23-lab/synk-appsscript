'use strict';
// 2단계 후보 원천에서 「아직 공개하지 않은 다른 일」(C · 옛 C) 커밋을 되돌린다 — 내보낸 사본(git 밖, LF)에만 쓴다. 작업본 · master는 건드리지 않는다.
//   node revert.cjs <내보낸 사본> [--check]   (--check: 쓰지 않고 되돌릴 수 있는지만 본다)
// 되돌리는 것(step2-commits.md §2 · 설계 주인 규칙):
//   a3c193891a  play-common/account-host.mjs — 바탕 뒤에 C · C′ · noop · D만 건드린 파일이라 바탕 판(cef7c745e3)을 쓴다
//   a556b16bd0  synk-account/src/core.mjs(PATH 제품 이름표) — 깨끗한 되돌림
//   5bc81e898f  synk-account/src/generated/account-client.cjs(웹 · PC 공통 진입) — 깨끗한 되돌림
//   9e3f7045df  account-client.cjs(마을 기록 카드) — 깨끗한 되돌림
//   e3b0fdd375  synk-account/src/desktop-account.mjs(PC 앱 내 계정) — 깨끗한 되돌림
//   32ec228cc6  core.mjs(은퇴한 회원 혜택) 깨끗한 되돌림 + platform-entry.mjs의 PUBLIC 한 줄(뒤 커밋과 겹쳐 줄 단위로)
//   af22476303  existing-verdicts.json의 인사 레슨 판정 9항목(뒤 커밋과 겹쳐 항목 단위로 — 그 항목이 아직 그 커밋의 값일 때만)
//   391b465181  synk-world-app/world-learning-map.mjs의 코치 지도 생활 층 한 줄(설계 주인 11-21 — 꺼진 길은 라이브처럼 말하기 층만 · 생활 층은 켜기 전 공개에 싣는다)
const { execFileSync } = require('node:child_process');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const WT = 'D:/SYNK-worktrees/SYNK-appsscript/goofy-rosalind-2b88f5';
const [EXP, flag] = process.argv.slice(2);
const CHECK = flag === '--check';
if (!EXP || !fs.existsSync(path.join(EXP, 'EXPORT_COMMIT'))) throw Error('내보낸 사본이 아니다: ' + EXP);
const git = (...args) => execFileSync('git', ['-C', WT, '-c', 'core.autocrlf=false', ...args], { maxBuffer: 1 << 28 }).toString();
const gitBuf = (...args) => execFileSync('git', ['-C', WT, '-c', 'core.autocrlf=false', ...args], { maxBuffer: 1 << 28 });
const read = rel => fs.readFileSync(path.join(EXP, rel));
const write = (rel, buf) => { if (!CHECK) fs.writeFileSync(path.join(EXP, rel), buf); };
const log = [];
const staged = new Map(); // --check에서 앞 되돌림의 결과를 다음 되돌림의 바탕으로 쓴다

// 1) 바탕 판으로 되돌리는 파일
for (const [commit, rel] of [['a3c193891a', 'experiences/play-common/account-host.mjs']]) {
  const base = gitBuf('show', `cef7c745e3:${rel}`);
  // 바탕 뒤 이 파일을 건드린 커밋이 C · C′ · noop · D뿐인지 다시 본다(그 밖의 커밋이 있으면 멈춘다)
  const touched = git('log', '--format=%h', 'cef7c745e3..HEAD', '--', rel).trim().split('\n').filter(Boolean);
  log.push(`${commit} ${rel}: 바탕 판(cef7c745e3)으로 · 바탕 뒤 이 파일을 건드린 커밋 ${touched.join(' ')}`);
  write(rel, base);
}

// 2) 되돌림 — 커밋마다 파일을 3방향으로 합친다(git merge-file: 지금 사본 · 그 커밋 판 · 그 커밋 앞 판). 새 커밋부터 차례로(step2-commits.md §2-3 모의와 같은 차례).
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "step2-revert-"));
for (const [commit, rels] of [
  ["5bc81e898f", ["experiences/synk-account/src/generated/account-client.cjs"]],
  ["a556b16bd0", ["experiences/synk-account/src/core.mjs"]],
  ["9e3f7045df", ["experiences/synk-account/src/generated/account-client.cjs"]],
  ["e3b0fdd375", ["experiences/synk-account/src/desktop-account.mjs"]],
  ["32ec228cc6", ["experiences/synk-account/src/core.mjs"]],
]) {
  for (const rel of rels) {
    const cur = path.join(tmp, "cur"), base = path.join(tmp, "base"), other = path.join(tmp, "other");
    fs.writeFileSync(cur, CHECK && staged.has(rel) ? staged.get(rel) : read(rel));
    fs.writeFileSync(base, gitBuf("show", `${commit}:${rel}`));
    fs.writeFileSync(other, gitBuf("show", `${commit}^:${rel}`));
    let out, conflicts = 0;
    try { out = execFileSync("git", ["merge-file", "-p", cur, base, other], { maxBuffer: 1 << 28 }); }
    catch (e) { conflicts = e.status; out = e.stdout; }
    if (conflicts) throw Error(`${commit} ${rel}: 겹침 ${conflicts}곳 — 손으로 본다`);
    if (Buffer.compare(out, fs.readFileSync(cur)) === 0) throw Error(`${commit} ${rel}: 되돌려도 바뀌는 것이 없다 — 이미 빠졌는지 본다`);
    staged.set(rel, out);
    write(rel, out);
    log.push(`${commit} ${rel}: 되돌림(겹침 0)${CHECK ? " · 확인만" : ""}`);
  }
}

// 3) platform-entry.mjs의 PUBLIC 줄(32ec228cc6이 rehearsal을 뺀 줄) — 지금 줄이 그 커밋 뒤의 줄과 같을 때만 앞 줄로
{
  const rel = 'experiences/synk-account/src/platform-entry.mjs';
  // 뒤 커밋 b4b28e17af(10-22, 바탕 앞 · 라이브에 있음)가 world 주소를 바꿨다. 라이브 묶음의 PUBLIC은 world · care · fortune · rehearsal이다.
  const before = "const PUBLIC = Object.freeze({ world: 'https://synk.im/world/', care: 'https://synk.im/care/', fortune: 'https://synk.im/fortune/', rehearsal: 'https://synk.im/rehearsal/' });";
  const after = "const PUBLIC = Object.freeze({ world: 'https://synk.im/world/', care: 'https://synk.im/care/', fortune: 'https://synk.im/fortune/' });";
  const text = read(rel).toString('utf8');
  const n = text.split(after).length - 1;
  if (n !== 1) throw Error(`32ec228cc6 platform-entry: 뒤 줄이 ${n}번 있다 — 손으로 본다`);
  write(rel, Buffer.from(text.replace(after, before), 'utf8'));
  log.push(`32ec228cc6 ${rel}: PUBLIC 줄에 rehearsal을 되돌림`);
}

// 4) 판정 목록의 인사 레슨 항목(af22476303) — 항목이 아직 그 커밋의 값일 때만 앞 값으로. 파일의 다른 항목 · 머리는 그대로.
{
  const rel = 'experiences/topik-items/review/existing-verdicts.json';
  const show = r => JSON.parse(git('show', `${r}:${rel}`));
  const b = show('af22476303^'), a = show('af22476303');
  const raw = read(rel).toString('utf8');
  const cur = JSON.parse(raw);
  const B = new Map(b.items.map(x => [x.itemKey, x])), A = new Map(a.items.map(x => [x.itemKey, x]));
  const changed = [...A.keys()].filter(k => JSON.stringify(B.get(k)) !== JSON.stringify(A.get(k)));
  if ([...B.keys()].some(k => !A.has(k))) throw Error('af22476303이 지운 항목이 있다 — 손으로 본다');
  let reverted = 0;
  for (const k of changed) {
    const i = cur.items.findIndex(x => x.itemKey === k);
    if (i < 0) throw Error('항목 없음 ' + k);
    if (JSON.stringify(cur.items[i]) !== JSON.stringify(A.get(k))) throw Error('뒤 커밋이 바꾼 항목 ' + k + ' — 손으로 본다');
    if (!B.has(k)) { cur.items.splice(i, 1); reverted++; continue; }
    cur.items[i] = B.get(k); reverted++;
  }
  // 파일 꼴(들여쓰기 · 끝 줄바꿈)은 지금 파일과 같게
  const indent = /\n( +)"/.exec(raw)?.[1]?.length || 2;
  const out = JSON.stringify(cur, null, indent) + (raw.endsWith('\n') ? '\n' : '');
  // 바꾼 항목 밖이 그대로인지: 되돌린 항목을 다시 지금 값으로 바꾸면 원래 파일과 같아야 한다
  const back = JSON.parse(out); for (const k of changed) { const i = back.items.findIndex(x => x.itemKey === k); back.items[i] = A.get(k); }
  if (JSON.stringify(back, null, indent) + (raw.endsWith('\n') ? '\n' : '') !== raw) throw Error('판정 목록 다시 쓰기가 다른 자리를 바꿨다');
  write(rel, Buffer.from(out, 'utf8'));
  log.push(`af22476303 ${rel}: 인사 레슨 ${reverted}항목을 앞 값으로(판정 ${changed.map(k => `${k} ${A.get(k).verdict}→${B.get(k).verdict}`).filter(s => !/(pass→pass|fix→fix)$/.test(s)).join(', ')})`);
}

// 5) 코치 지도의 생활 층(391b465181, 11-08 D) — 라이브는 말하기 층만 얹는다(4cf58c75의 __speakE.coachMap). 꺼진 길의 지도판을 라이브와 같게
//    두려고 생활 층을 뺀다(설계 주인 11-21). 줄이 지금 꼴과 꼭 같을 때만 바꾼다. 생활 층은 켜기 전 공개에 싣는다(단계4_계획 §6).
{
  const rel = 'experiences/synk-world-app/world-learning-map.mjs';
  const now = 'export const worldMap=strata.createMap(worldCoach.coachMapData(worldMapData(),[[worldLife.withLifeLayer,worldLife.layer()],[worldSpeaking.withSpeakingLayer,worldSpeaking.layer()]]));';
  const live = 'export const worldMap=strata.createMap(worldCoach.coachMapData(worldMapData(),[[worldSpeaking.withSpeakingLayer,worldSpeaking.layer()]]));';
  const text = read(rel).toString('utf8');
  const n = text.split(now).length - 1;
  if (n !== 1) throw Error(`391b465181 world-learning-map: 생활 층 줄이 ${n}번 있다 — 손으로 본다`);
  write(rel, Buffer.from(text.replace(now, live), 'utf8'));
  log.push(`391b465181 ${rel}: 코치 지도에서 생활 층을 뺌(말하기 층만 — 라이브와 같은 지도판)`);
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(log.join('\n'));
