'use strict';
// WORLD 선택 공개 (2-2) 생성물 명세의 되돌림 대본 — 원천(③ 원천 가지 + origin master 합침)에서 「아직 라이브가 아닌 변경」을 걷어
// 「묶는 원천 파일 = 지금 라이브의 원천 + ③」(설계 주인 11-24)으로 맞춘다. 내보낸 사본(git 밖, LF)에만 쓴다. 저장소 · master는 건드리지 않는다.
//   node revert-2-2.cjs <내보낸 사본> [--check]   (--check: 쓰지 않고 되돌릴 수 있는지만 본다)
// 차례:
//  ㄷ. 묶음에만 실리는 판정 목록과 생활 층 지도는 3f1fc5c667 판으로 둔다(그 뒤 바꾼 커밋은 카페 팩 11ba15b632와 인사 팩 560faed480뿐이어야 한다 —
//      인사 팩은 라이브에 모듈만 올랐고 이 둘은 라이브 묶음에 없다).
//  ㄴ. 3f1fc5c667 뒤 커밋 가운데 줄이 라이브 사본에도 ③ 후보에도 없는 것 — 커밋마다 적은 묶음 입력만 3방향으로 되돌린다(새 커밋부터).
//      카페 팩 d87e1538b7 · a6c10caf78 · a13be5a30c · ffd91f4b8f · 11ba15b632, 첫날 끝 · 맞춤 앞면 동아리 bb8b9c9174, Atlas 4-6e 5bccbe8ad6(③이 싣지 않은 길).
//  ㄱ. 앞 명세(spec-2-2k)의 되돌림 여덟(계정 묶음에만 실리는 파일 — 그 뒤 이 파일들을 바꾼 커밋이 없어야 한다).
//  ㄹ. 라이브 사본이 있는데 앞 단계 뒤에도 라이브(③ 파일은 ③ 후보)와 다른 파일 가운데, 원천 쪽 줄이 라이브 묶음에 없는 여섯 — 원천 커밋에 둔
//      「라이브 꼴」로 덮는다(설계 주인 11-24 둘째 잣대: 묶음 입력은 「라이브 묶음 + ③」이라 라이브 묶음에 지금 있는 줄은 빼지 않는다). 덮기 전 바이트가
//      분석한 판과 같을 때만 덮는다. cafe-activity · life-story는 덮지 않는다(eca1f95a75 줄이 라이브 생활 묶음에 있다). world-learning-ui는
//      1f6d6bb42d readHangulProgress 세 자리만 덮은 판이다.
// 확인: 이 대본 뒤 공개 빌드가 낸 모듈 가운데 라이브 사본이 있는 묶음 입력은 cafe-activity · life-story · world-learning-ui 셋(라이브 묶음에 있는 줄만큼)을 빼고 라이브 main(③ 파일은 ③ 후보)과 바이트가 같다.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');
const REPO = 'C:/Users/q1212/Documents/SYNK-appsscript';
const [EXP, flag] = process.argv.slice(2);
const CHECK = flag === '--check';
if (!EXP || !fs.existsSync(path.join(EXP, 'EXPORT_COMMIT'))) throw Error('내보낸 사본이 아니다: ' + EXP);
const SRC = fs.readFileSync(path.join(EXP, 'EXPORT_COMMIT'), 'utf8').trim();
const git = (...args) => execFileSync('git', ['-C', REPO, '-c', 'core.autocrlf=false', ...args], { maxBuffer: 1 << 28 }).toString();
const gitBuf = (...args) => execFileSync('git', ['-C', REPO, '-c', 'core.autocrlf=false', ...args], { maxBuffer: 1 << 28 });
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const staged = new Map(); // --check에서 앞 되돌림의 결과를 다음 되돌림의 바탕으로 쓴다
const read = rel => staged.has(rel) ? staged.get(rel) : fs.readFileSync(path.join(EXP, rel));
const write = (rel, buf) => { staged.set(rel, buf); if (!CHECK) fs.writeFileSync(path.join(EXP, rel), buf); };
const log = [];
const OLD = '3f1fc5c6677f8d7289c3a2c13c95d686af3d7348';
// 원천 커밋 뒤에 덧붙인 커밋(라이브 꼴 파일을 둔 커밋)은 묶음 입력을 바꾸지 않는다 — 아래 합침 확인에서 본다. 합침 커밋 자체도 뺀다.
const touched = (from, rel) => git('log', '--format=%h', '--abbrev=10', `${from}..${SRC}`, '--', rel).trim().split('\n').filter(Boolean).filter(h => !MERGES.has(h));
// 묶음 입력(계정 · 생활 묶음 머리의 입력 목록과 생활 css를 합친 120개 — 3f1fc5c667 뒤 커밋을 가를 때의 범위)
const INPUTS = new Set(["atlas/ask.js","atlas/education.js","atlas/engine.js","atlas/flow.js","atlas/game-browser.js","atlas/game-flow.js","atlas/game-learning.js","atlas/learning-ledger.js","atlas/learning-pages.js","atlas/learning-sync.js","atlas/learning.js","atlas/memory-sync.js","atlas/temper-flow.js","atlas/temper.js","atlas/trail.js","atlas/vellum-flow.js","atlas/vellum.js","experiences/blank-slice/content.mjs","experiences/blank-slice/kit/return-practice.mjs","experiences/blank-slice/learning.mjs","experiences/brand-opening/life-tutor-lines.mjs","experiences/brand-opening/play-unlocks.mjs","experiences/brand-opening/story-signs.mjs","experiences/brand-opening/tutor-photos-data.mjs","experiences/brand-opening/tutor-photos.mjs","experiences/entry-check/content.mjs","experiences/entry-check/core.mjs","experiences/entry-check/kit/return-practice.mjs","experiences/entry-check/learning.mjs","experiences/hangul-stage/learning.mjs","experiences/hangul-stage/progress-data.mjs","experiences/korean-racing/beginner-catalog.js","experiences/korean-racing/garage-core.js","experiences/korean-racing/play-catalog.js","experiences/korean-rhythm/core.mjs","experiences/korean-rhythm/kit/josa.mjs","experiences/korean-rhythm/kit/return-practice.mjs","experiences/korean-rhythm/listening.mjs","experiences/korean-rhythm/narration.mjs","experiences/korean-rhythm/personalization.mjs","experiences/korean-rhythm/suno-tracks.mjs","experiences/korean-rhythm/supplemental.json","experiences/korean-rhythm/supplemental.mjs","experiences/korean-runner/kit/return-practice.mjs","experiences/korean-runner/learning.mjs","experiences/korean-runner/listening-check.mjs","experiences/play-common/account-host.mjs","experiences/play-common/play-data.mjs","experiences/subway-rush/journeys.mjs","experiences/subway-rush/kit/return-practice.mjs","experiences/subway-rush/learning.mjs","experiences/subway-rush/lines.mjs","experiences/subway-rush/plan-items.mjs","experiences/synk-account/src/classroom-client.mjs","experiences/synk-account/src/core.mjs","experiences/synk-account/src/desktop-account.mjs","experiences/synk-account/src/generated/account-client.cjs","experiences/synk-account/src/generated/world-learning-host.cjs","experiences/synk-account/src/platform-entry.mjs","experiences/synk-town/understanding.mjs","experiences/synk-world-app/cafe-activity.mjs","experiences/synk-world-app/cafe-ui.mjs","experiences/synk-world-app/classroom-client.mjs","experiences/synk-world-app/course-writing-entry.mjs","experiences/synk-world-app/device-records.mjs","experiences/synk-world-app/guest-trial.mjs","experiences/synk-world-app/hangul-progress-port.mjs","experiences/synk-world-app/homework-client.mjs","experiences/synk-world-app/life-content-lang.mjs","experiences/synk-world-app/life-content.mjs","experiences/synk-world-app/life-followups.mjs","experiences/synk-world-app/life-items.mjs","experiences/synk-world-app/life-plan.mjs","experiences/synk-world-app/life-progress-port.mjs","experiences/synk-world-app/life-progress.mjs","experiences/synk-world-app/life-standalone-entry.mjs","experiences/synk-world-app/life-story.mjs","experiences/synk-world-app/life-trail.mjs","experiences/synk-world-app/life-ui.css","experiences/synk-world-app/life-ui.mjs","experiences/synk-world-app/operating-mode.mjs","experiences/synk-world-app/seoul-record.mjs","experiences/synk-world-app/world-account.mjs","experiences/synk-world-app/world-diagnostic-items.mjs","experiences/synk-world-app/world-diagnostic-racing.mjs","experiences/synk-world-app/world-exam-form.mjs","experiences/synk-world-app/world-exam-plan.mjs","experiences/synk-world-app/world-game-host.mjs","experiences/synk-world-app/world-learning-followups.mjs","experiences/synk-world-app/world-learning-map.mjs","experiences/synk-world-app/world-learning-plan.mjs","experiences/synk-world-app/world-learning-profile-core.mjs","experiences/synk-world-app/world-learning-profile.mjs","experiences/synk-world-app/world-learning-ui.mjs","experiences/synk-world-app/world-life-next.mjs","experiences/synk-world-app/world-missed-spot.mjs","experiences/synk-world-app/world-month-answer.mjs","experiences/synk-world-app/world-position-kit.mjs","experiences/synk-world-app/world-position-page.mjs","experiences/synk-world-app/world-position-ui.mjs","experiences/synk-world-app/world-position.mjs","experiences/synk-world-app/world-reading-practice.mjs","experiences/synk-world-app/world-topik-items.mjs","experiences/synk-world-app/world-town-check.mjs","experiences/teacher-world/course-writing-ui.mjs","experiences/topik-items/holdout.mjs","experiences/topik-items/review/existing-verdicts.json","experiences/topik-items/review/holdout-20261028.json","strata/hangul.json","strata/index.js","strata/maps/topik-i.json","strata/maps/topik-ii.json","strata/maps/topik-speaking.json","strata/maps/world-life.json","strata/topik-i.js","strata/topik-i.words.json","strata/topik-speaking.js","strata/world-coach.js","strata/world-life.js","strata/world-map.js"]);

// 원천 합침 커밋과 그 두 부모(③ 원천 가지 e28f907a33 · origin master 1b9fedd5bb)
const MERGE = 'af2f513640869add32cb963640234cd9743ebca4', MERGE_P1 = 'e28f907a33d0c2fb1c8b2ed1f289ffa062095cbc', MERGE_P2 = '1b9fedd5bbd048f43f92b288fae2f85c588c09df';
const MERGES = new Set([MERGE.slice(0, 10)]);
// ㄹ의 여섯 파일: pre =앞 단계(ㄷ · ㄴ · ㄱ) 뒤 바이트의 sha256, post = 원천 커밋 LIVEFORM 폴더의 라이브 꼴 sha256
const LIVE_FORM = {
  "experiences/brand-opening/play-unlocks.mjs": {
    "pre": "3115dc3b88c9d2e31c30eebb5614c33f8d096f2692a88bf4bb3ef522c0390f09",
    "post": "39270fd972e60e954ed3dfaf82d33fbd91c71cfc99b2e15f21709c2c500ddf38",
    "why": "해금 항목 차례(게시판 해독을 말 랠리 뒤로) · 말의 리듬 주석 두 줄 · playRecord 꼴 — 라이브 모듈 꼴. 게시판 해독 규칙은 라이브 모듈에도 있다"
  },
  "experiences/hangul-stage/learning.mjs": {
    "pre": "ab096e8a50a9e44586765a551df69083e70472ce855229612c1bedc13d224612",
    "post": "e319d83b17d0dc58e44cd8b7bfce9b0b3dc3112f4d4dc9199425d3cdfd50ff68",
    "why": "계정 게임 저장 openProgressStorage(1f6d6bb42d)"
  },
  "experiences/korean-racing/garage-core.js": {
    "pre": "b983bcfdbaf08899e9bc3865df96413e78cd865e7bf429442be6567058d266a0",
    "post": "4b978e3ee01d9f689c384fc1d9ddba271a5c8268f241af0ae37966a68256f52e",
    "why": "놀이 목록의 subway-rush"
  },
  "experiences/synk-world-app/world-learning-profile-core.mjs": {
    "pre": "60a6ac948c285d0ea9f31630c10254cef85b96c76fccad516ddeaf561ddae3ac",
    "post": "5f2d86bb32e5eff3990a4607ce867adeac3f4d9310ad620304ad7275329195be",
    "why": "10-31 뒤 다시 지은 학습 프로필 생성물"
  },
  "experiences/synk-world-app/world-learning-ui.mjs": {
    "pre": "091b7e98a0f89ed124f97c662298ac4898f25580fe1b2cff3f47a12a5a153618",
    "post": "638d12b2c8765059f7c74db9638a0ce9f914c7346e675d13b1f7820079285b45",
    "why": "라이브 묶음 + ③ 꼴 — 라이브 생활 묶음에 없는 1f6d6bb42d 한글 진도 계정 읽기(readHangulProgress) 세 자리만 덮는다"
  },
  "experiences/synk-world-app/world-missed-spot.mjs": {
    "pre": "596c059338f386c9f270a689d3355aca659e470b9ab3ab7018660e280709436b",
    "post": "1fcd66db1140774a5c5752b144c30ef59198ee3acf2b9e8bc303d77cb0ce612a",
    "why": "주석 두 곳"
  }
};


// ㄷ. 3f1fc5c667 판으로 두는 묶음 전용 파일(ㄱ의 af22476303 판정 항목 되돌림보다 먼저)
for (const rel of ['experiences/topik-items/review/existing-verdicts.json', 'strata/maps/world-life.json']) {
  const t = touched(OLD, rel);
  if (t.slice().sort().join(' ') !== '11ba15b632 560faed480') throw Error(`${rel}: 3f1fc5c667 뒤 이 파일을 바꾼 커밋이 ${t.join(' ') || '없음'}이다(바란 것 11ba15b632 560faed480) — 손으로 본다`);
  write(rel, gitBuf('show', `${OLD}:${rel}`));
  log.push(`ㄷ ${rel}: 3f1fc5c667 판으로(뒤에 바꾼 커밋 ${t.join(' ')} — 라이브 묶음에 없는 줄)`);
}

// ㄴ. 새 미공개 커밋 — 적은 묶음 입력만 3방향 되돌림(지금 사본 · 그 커밋 판 · 그 커밋 앞 판). 새 커밋부터.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'step22-revert-'));
const mergeRevert = (commit, rel, why) => {
  const cur = path.join(tmp, 'cur'), base = path.join(tmp, 'base'), other = path.join(tmp, 'other');
  fs.writeFileSync(cur, read(rel));
  fs.writeFileSync(base, gitBuf('show', `${commit}:${rel}`));
  fs.writeFileSync(other, gitBuf('show', `${commit}^:${rel}`));
  let out, conflicts = 0;
  try { out = execFileSync('git', ['merge-file', '-p', cur, base, other], { maxBuffer: 1 << 28 }); }
  catch (e) { conflicts = e.status; out = e.stdout; }
  if (conflicts) throw Error(`${commit} ${rel}: 겹침 ${conflicts}곳 — 손으로 본다`);
  if (Buffer.compare(out, fs.readFileSync(cur)) === 0) throw Error(`${commit} ${rel}: 되돌려도 바뀌는 것이 없다 — 이미 빠졌는지 본다`);
  write(rel, out);
  log.push(`ㄴ ${commit} ${rel}: 되돌림(겹침 0) — ${why}`);
};
const SKIP = new Set(['experiences/topik-items/review/existing-verdicts.json', 'strata/maps/world-life.json']);
for (const [commit, why, rels] of [
  ['d87e1538b7', '카페 팩 창가 사진', ['experiences/brand-opening/tutor-photos-data.mjs', 'experiences/synk-world-app/life-ui.css']],
  ['a6c10caf78', '카페 팩 주석', ['experiences/synk-world-app/life-ui.css']],
  ['a13be5a30c', '카페 팩 창가 사진 기준', ['experiences/synk-world-app/life-ui.css']],
  ['ffd91f4b8f', '카페 팩 카본 지적', ['experiences/synk-world-app/cafe-activity.mjs']],
  ['bb8b9c9174', '첫날 끝 · 맞춤 앞면 동아리 실력 파악', ['experiences/synk-world-app/world-learning-ui.mjs']],
  ['11ba15b632', '카페 팩 본편', ['experiences/brand-opening/tutor-photos-data.mjs', 'experiences/synk-world-app/cafe-activity.mjs', 'experiences/synk-world-app/cafe-ui.mjs', 'experiences/synk-world-app/life-content-lang.mjs', 'experiences/synk-world-app/life-content.mjs', 'experiences/synk-world-app/life-ui.mjs']],
  ['5bccbe8ad6', 'Atlas 4-6e(③에 없는 길)', ['experiences/blank-slice/learning.mjs', 'experiences/entry-check/learning.mjs', 'experiences/korean-rhythm/personalization.mjs', 'experiences/korean-runner/learning.mjs', 'experiences/synk-world-app/world-learning-ui.mjs']],
]) {
  // 그 커밋이 바꾼 묶음 입력이 적은 목록과 꼭 같아야 한다 — 빠뜨리거나 더 되돌리지 않게
  const inCommit = git('show', '--format=', '--name-only', commit).split('\n').filter(f => INPUTS.has(f) && !SKIP.has(f)).sort();
  if (inCommit.join(' ') !== rels.slice().sort().join(' ')) throw Error(`${commit}: 바꾼 묶음 입력이 ${inCommit.join(' ')}이다(적은 것 ${rels.join(' ')}) — 손으로 본다`);
  for (const rel of rels) mergeRevert(commit, rel, why);
}

// ㄱ-1. 바탕 판으로 되돌리는 파일(앞 명세와 같다)
{
  const rel = 'experiences/play-common/account-host.mjs';
  const t = touched('cef7c745e3', rel);
  if (t.join(' ') !== 'a3c193891a') throw Error(`a3c193891a ${rel}: 바탕 뒤 이 파일을 건드린 커밋이 ${t.join(' ') || '없음'}이다(바란 것 a3c193891a) — 손으로 본다`);
  write(rel, gitBuf('show', `cef7c745e3:${rel}`));
  log.push(`ㄱ a3c193891a ${rel}: 바탕 판(cef7c745e3)으로 · 바탕 뒤 이 파일을 건드린 커밋 ${t.join(' ')}`);
}
// ㄱ-2. 계정 원천의 깨끗한 되돌림(앞 명세와 같은 차례) — 3f1fc5c667 뒤 이 파일들을 바꾼 커밋이 없어야 한다
for (const [commit, rel] of [
  ['5bc81e898f', 'experiences/synk-account/src/generated/account-client.cjs'],
  ['a556b16bd0', 'experiences/synk-account/src/core.mjs'],
  ['9e3f7045df', 'experiences/synk-account/src/generated/account-client.cjs'],
  ['e3b0fdd375', 'experiences/synk-account/src/desktop-account.mjs'],
  ['32ec228cc6', 'experiences/synk-account/src/core.mjs'],
]) {
  const t = touched(OLD, rel);
  if (t.length) throw Error(`${rel}: 3f1fc5c667 뒤에 바꾼 커밋 ${t.join(' ')} — 손으로 본다`);
  mergeRevert(commit, rel, '앞 명세의 되돌림');
}
// ㄱ-3. platform-entry.mjs의 PUBLIC 줄(32ec228cc6) — 앞 명세와 같다
{
  const rel = 'experiences/synk-account/src/platform-entry.mjs';
  const t = touched(OLD, rel);
  if (t.length) throw Error(`${rel}: 3f1fc5c667 뒤에 바꾼 커밋 ${t.join(' ')} — 손으로 본다`);
  const before = "const PUBLIC = Object.freeze({ world: 'https://synk.im/world/', care: 'https://synk.im/care/', fortune: 'https://synk.im/fortune/', rehearsal: 'https://synk.im/rehearsal/' });";
  const after = "const PUBLIC = Object.freeze({ world: 'https://synk.im/world/', care: 'https://synk.im/care/', fortune: 'https://synk.im/fortune/' });";
  const text = read(rel).toString('utf8');
  const n = text.split(after).length - 1;
  if (n !== 1) throw Error(`32ec228cc6 platform-entry: 뒤 줄이 ${n}번 있다 — 손으로 본다`);
  write(rel, Buffer.from(text.replace(after, before), 'utf8'));
  log.push(`ㄱ 32ec228cc6 ${rel}: PUBLIC 줄에 rehearsal을 되돌림`);
}
// ㄱ-4. 판정 목록의 인사 레슨 항목(af22476303) — ㄷ에서 3f1fc5c667 판으로 둔 뒤, 항목이 아직 그 커밋의 값일 때만 앞 값으로(앞 명세와 같다)
{
  const rel = 'experiences/topik-items/review/existing-verdicts.json';
  const show = r => JSON.parse(git('show', `${r}:${rel}`));
  const b = show('af22476303^'), a = show('af22476303');
  const raw = read(rel).toString('utf8');
  const cur = JSON.parse(raw);
  const B = new Map(b.items.map(x => [x.itemKey, x])), A = new Map(a.items.map(x => [x.itemKey, x]));
  const changed = [...A.keys()].filter(k => JSON.stringify(B.get(k)) !== JSON.stringify(A.get(k)));
  if ([...B.keys()].some(k => !A.has(k))) throw Error('af22476303이 지운 항목이 있다 — 손으로 본다');
  if (!changed.length) throw Error('af22476303이 바꾼 항목이 없다 — 손으로 본다');
  let reverted = 0;
  for (const k of changed) {
    const i = cur.items.findIndex(x => x.itemKey === k);
    if (i < 0) throw Error('항목 없음 ' + k);
    if (JSON.stringify(cur.items[i]) !== JSON.stringify(A.get(k))) throw Error('뒤 커밋이 바꾼 항목 ' + k + ' — 손으로 본다');
    if (!B.has(k)) { cur.items.splice(i, 1); reverted++; continue; }
    cur.items[i] = B.get(k); reverted++;
  }
  const indent = /\n( +)"/.exec(raw)?.[1]?.length || 2;
  const out = JSON.stringify(cur, null, indent) + (raw.endsWith('\n') ? '\n' : '');
  const back = JSON.parse(out); for (const k of changed) { const i = back.items.findIndex(x => x.itemKey === k); back.items[i] = A.get(k); }
  if (JSON.stringify(back, null, indent) + (raw.endsWith('\n') ? '\n' : '') !== raw) throw Error('판정 목록 다시 쓰기가 다른 자리를 바꿨다');
  write(rel, Buffer.from(out, 'utf8'));
  log.push(`ㄱ af22476303 ${rel}: 인사 레슨 ${reverted}항목을 앞 값으로`);
}
// ㄱ-5. 코치 지도의 생활 층(391b465181) — 앞 명세와 같다
{
  const rel = 'experiences/synk-world-app/world-learning-map.mjs';
  const t = touched(OLD, rel);
  if (t.length) throw Error(`${rel}: 3f1fc5c667 뒤에 바꾼 커밋 ${t.join(' ')} — 손으로 본다`);
  const now = 'export const worldMap=strata.createMap(worldCoach.coachMapData(worldMapData(),[[worldLife.withLifeLayer,worldLife.layer()],[worldSpeaking.withSpeakingLayer,worldSpeaking.layer()]]));';
  const live = 'export const worldMap=strata.createMap(worldCoach.coachMapData(worldMapData(),[[worldSpeaking.withSpeakingLayer,worldSpeaking.layer()]]));';
  const text = read(rel).toString('utf8');
  const n = text.split(now).length - 1;
  if (n !== 1) throw Error(`391b465181 world-learning-map: 생활 층 줄이 ${n}번 있다 — 손으로 본다`);
  write(rel, Buffer.from(text.replace(now, live), 'utf8'));
  log.push(`ㄱ 391b465181 ${rel}: 코치 지도에서 생활 층을 뺌`);
}

// ㄹ. 라이브 꼴로 덮는 여섯 파일 — 원천 커밋의 LIVEFORM 폴더에서 읽는다. 덮기 전 바이트가 분석한 판(앞 단계 뒤)과 같아야 하고, 덮은 바이트는 적은 해시다.
const LIVEFORM = 'docs/_ops/qa/atlas-redesign-20261110/공개원천-20261125/2-2-라이브꼴';
for (const [rel, { pre, post, why }] of Object.entries(LIVE_FORM)) {
  const now = read(rel);
  if (sha(now) !== pre) throw Error(`${rel}: 덮기 전 바이트가 분석한 판이 아니다(${sha(now).slice(0, 12)} · 바란 것 ${pre.slice(0, 12)}) — 손으로 본다`);
  const buf = gitBuf('show', `${SRC}:${LIVEFORM}/${rel}`);
  if (sha(buf) !== post) throw Error(`${rel}: 원천 커밋의 라이브 꼴이 적은 해시가 아니다 — 손으로 본다`);
  write(rel, buf);
  log.push(`ㄹ ${rel}: 라이브 꼴로 덮음 — ${why}`);
}

// 원천 커밋 확인: 합침 커밋(③ 원천 가지 × origin master)이 묶음 입력을 두 부모 중 바꾼 쪽 그대로 냈는지, 그 뒤 덧붙인 커밋은 묶음 입력을 바꾸지 않았는지
{
  const mb = git('merge-base', MERGE_P1, MERGE_P2).trim();
  const at = (r, rel) => { try { return git('rev-parse', `${r}:${rel}`).trim(); } catch { return null; } };
  for (const rel of INPUTS) {
    const m = at(SRC, rel), mm = at(MERGE, rel), a = at(MERGE_P1, rel), b = at(MERGE_P2, rel), base = at(mb, rel);
    if (m !== mm) throw Error(`합침 뒤 커밋이 ${rel}을 바꿨다 — 손으로 본다`);
    if (a !== base && b !== base && a !== b) throw Error(`합침 커밋에서 ${rel}을 두 부모가 모두 바꿨다 — 손으로 본다`);
    if (mm !== (a !== base ? a : b)) throw Error(`합침 커밋이 ${rel}을 바꾼 쪽과 다르게 냈다 — 손으로 본다`);
  }
  log.push(`원천 ${SRC.slice(0, 10)}: 합침 ${MERGE.slice(0, 10)}이 묶음 입력 ${INPUTS.size}개를 두 부모 중 바꾼 쪽 그대로 냈고, 그 뒤 커밋은 묶음 입력을 바꾸지 않았다`);
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(log.join('\n'));
