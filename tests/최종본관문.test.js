'use strict';
// ⑳ 최종본 관문(tools/lib/최종본관문.js) — 최종본검사.py가 낸 걸림을 고칠 것 · 확인할 것으로 매기는지, 「최종본판단」 까닭이 고칠 것을 내리는지,
// 같은 영상이면 다시 재지 않는지, 관문 밖 편(LAB · 슬롯이 11-14 전)은 묻지 않는지, 새 항목 조용구간이 어디서나 확인할 것인지(11-15 흠 장부 3단계).
// 파이썬 도구는 가짜로 바꿔 끼운다(실제 잼은 tests/최종본검사.test.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { finalCutFindings, applies, FINAL_FROM } = require('../tools/lib/최종본관문.js');
const { FIX, LOOK } = require('../tools/lib/게시글규칙.js');

const 걸림 = [
  { 항목: '굳음', 초: 21.42, 끝초: 23.42, 글: '21.42~23.42초 컷의 사람이 굳어 있다' },
  { 항목: '같은판', 초: 5.5, 글: '5.5초 컷 경계가 앞 컷과 같은 그림이다' },
  { 항목: '되풀이', 초: 21.42, 앞초: 4.42, 글: '같은 그림의 컷이 3번 나온다' },
  { 항목: '끝소리', 초: 57.2, 글: '끝 2.5초가 방 소리뿐이다' },
];

function fixture(t, prep) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), '최종본관문-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, '게시'));
  const video = path.join(dir, '게시', 'a_master.mp4');
  fs.writeFileSync(video, 'video');
  return { bundle: { dir, name: 'synkbrief_시험_20261113', repo: dir, prep: { 브랜드: 'synkbrief', 슬롯: FINAL_FROM, ...prep } }, video };
}

test('굳음 · 같은판은 고칠 것, 나머지는 확인할 것 — 「최종본판단」 까닭이 있으면 고칠 것이 확인할 것으로', (t) => {
  const { bundle, video } = fixture(t);
  let runs = 0;
  const run = () => { runs++; return { 걸림 }; };
  const out = finalCutFindings(bundle, [video], { run });
  assert.deepEqual(out.map((f) => [f.code, f.level]), [
    ['final-cut-굳음', FIX], ['final-cut-같은판', FIX], ['final-cut-되풀이', LOOK], ['final-cut-끝소리', LOOK]]);
  assert.match(out[1].message, /「최종본판단」 \{"같은판@5\.5": "까닭"\}/);
  // 같은 영상이면 기록(게시/최종본검사.json)에서 읽고 다시 재지 않는다
  finalCutFindings(bundle, [video], { run });
  assert.equal(runs, 1);
  // 까닭: 자리 하나(항목@초) · 항목 전체
  bundle.prep.최종본판단 = { '같은판@5.5': '말 박자에 맞춘 펀치인 — 진행자 편', 굳음: '숨 고르는 멈춤' };
  const eased = finalCutFindings(bundle, [video], { run });
  assert.deepEqual(eased.map((f) => f.level), [LOOK, LOOK, LOOK, LOOK]);
  assert.match(eased[1].message, /「최종본판단」: 말 박자에 맞춘 펀치인/);
  // 영상이 바뀌면 다시 잰다
  fs.appendFileSync(video, 'x');
  finalCutFindings(bundle, [video], { run });
  assert.equal(runs, 2);
});

test('yuhobuilds는 캡처 · 캐릭터를 일부러 멈추는 편이 많아 모두 확인할 것 — 「사람편」: true면 실사로 보고 고칠 것', (t) => {
  const { bundle, video } = fixture(t, { 브랜드: 'yuhobuilds' });
  const run = () => ({ 걸림 });
  assert.deepEqual(finalCutFindings(bundle, [video], { run, save: false }).map((f) => f.level), [LOOK, LOOK, LOOK, LOOK]);
  bundle.prep.사람편 = true;
  assert.deepEqual(finalCutFindings(bundle, [video], { run, save: false }).map((f) => f.level), [FIX, FIX, LOOK, LOOK]);
});

test('조용구간(가운데 10초 넘게 조용함, 흠 장부 3단계)은 어느 브랜드 · 「사람편」에서도 확인할 것 — 있던 항목의 등급은 그대로다', (t) => {
  const 조용 = { 항목: '조용구간', 초: 28, 끝초: 40.75, 값: { 길이초: 12.75, 평균dB: -25.5, 기준dB: -11.4 }, 글: '28~40.75초 12.75초 동안 소리가 작다' };
  const run = () => ({ 걸림: [...걸림, 조용] });
  const levels = (prep) => {
    const { bundle, video } = fixture(t, prep);
    return finalCutFindings(bundle, [video], { run, save: false }).map((f) => [f.code, f.level]);
  };
  // synkbrief(실사 재연) · 「사람편」: 있던 넷은 고칠 · 고칠 · 확인 · 확인 그대로, 조용구간만 확인할 것
  const want = (hard) => [['final-cut-굳음', hard], ['final-cut-같은판', hard], ['final-cut-되풀이', LOOK], ['final-cut-끝소리', LOOK], ['final-cut-조용구간', LOOK]];
  assert.deepEqual(levels({}), want(FIX));
  assert.deepEqual(levels({ 브랜드: 'shift', 사람편: true }), want(FIX));
  assert.deepEqual(levels({ 브랜드: 'yuhobuilds' }), want(LOOK));
  assert.deepEqual(levels({ 브랜드: 'yuhobuilds', 사람편: true }), want(FIX));
  // 「최종본판단」 까닭이 없어도 확인할 것이고, 고칠 법 안내가 붙는다
  const { bundle, video } = fixture(t);
  const f = finalCutFindings(bundle, [video], { run: () => ({ 걸림: [조용] }), save: false });
  assert.deepEqual(f.map((x) => x.level), [LOOK]);
  assert.match(f[0].message, /말\(해설 · 대사\)이나 사건 소리/);
  assert.doesNotMatch(f[0].message, /「최종본판단」 \{/, '확인할 것 항목에는 「최종본판단」 안내를 붙이지 않는다');
});

test('화면멈춤(화면 전체가 2초 넘게 그대로, 11-16 흠 장부 「멈춘 화면」)도 어느 브랜드 · 「사람편」에서나 확인할 것이다', (t) => {
  const 멈춤 = { 항목: '화면멈춤', 초: 5.29, 끝초: 7.42, 값: { 길이초: 2.13, 문턱: 0.08 }, 글: '5.29~7.42초 2.13초 동안 화면 전체가 그대로다' };
  for (const prep of [{}, { 브랜드: 'yuhobuilds' }, { 브랜드: 'shift', 사람편: true }]) {
    const { bundle, video } = fixture(t, prep);
    const f = finalCutFindings(bundle, [video], { run: () => ({ 걸림: [...걸림, 멈춤] }), save: false });
    assert.deepEqual(f.slice(-1).map((x) => [x.code, x.level]), [['final-cut-화면멈춤', LOOK]], JSON.stringify(prep));
    assert.match(f[f.length - 1].message, /박마다 바뀌는 것/);
  }
});

test('「최종본」 영상과, 판이 쓰는 다른 렌더를 잰다 — 올리기판(같은 그림을 다시 누른 것) · 그림 파일은 재지 않는다', (t) => {
  const { bundle, video } = fixture(t, {});
  const upload = path.join(bundle.dir, '게시', 'a_upload.mp4');
  const tiktok = path.join(bundle.dir, '게시', 'a_tiktok_끝말.mp4');
  fs.writeFileSync(upload, 'small');
  fs.writeFileSync(tiktok, 'other render');
  fs.writeFileSync(path.join(bundle.dir, '게시', '표지.jpg'), 'jpg');
  bundle.prep.최종본 = ['게시/a_master.mp4', '게시/표지.jpg'];
  const seen = [];
  finalCutFindings(bundle, [video, upload, tiktok], { run: (f) => { seen.push(path.basename(f)); return { 걸림: [] }; }, save: false });
  assert.deepEqual(seen, ['a_master.mp4', 'a_tiktok_끝말.mp4']);
});

test('못 잰 항목은 확인할 것 줄로 보이고 기록하지 않아 다음에 다시 잰다 · 기록에는 이 PC 경로 없이 도구 판과 함께 · --저장안함은 기록하지 않는다', (t) => {
  const { bundle, video } = fixture(t);
  let runs = 0;
  const partial = () => { runs++; return { 파일: video, 걸림: [걸림[1]], 못잼: [{ 항목: '굳음', 오류: 'FileNotFoundError: 사람움직임.py' }] }; };
  const out = finalCutFindings(bundle, [video], { run: partial });
  assert.deepEqual(out.map((f) => [f.code, f.level]), [['final-cut-같은판', FIX], ['final-cut-unmeasured', LOOK]]);
  assert.match(out[1].message, /굳음을 못 쟀다.*실사 재연의 고칠 것 항목/);
  finalCutFindings(bundle, [video], { run: partial });
  assert.equal(runs, 2, '못 잰 결과는 기록하지 않는다');
  const cacheFile = path.join(bundle.dir, '게시', '최종본검사.json');
  assert.equal(fs.existsSync(cacheFile), false);
  finalCutFindings(bundle, [video], { run: () => ({ 파일: video, 걸림: [] }), save: false });
  assert.equal(fs.existsSync(cacheFile), false, '--저장안함');
  finalCutFindings(bundle, [video], { run: () => ({ 파일: video, 걸림: [] }) });
  const saved = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
  const row = Object.values(saved)[0];
  assert.equal(Object.keys(saved)[0], '게시/a_master.mp4', '열쇠는 저장소 기준 경로');
  assert.equal(row.결과.파일, undefined, '절대 경로는 남기지 않는다');
  assert.match(row.도구, /^[0-9a-f]{12}$/);
  assert.ok(Math.abs(Date.parse(row.잰때) - Date.now()) < 60000, '잰때 — 흠 장부가 판정 뒤에 잰 기록을 앞선 경고로 세지 않게(GPT 검수 GA1)');
  assert.equal(row.처음, undefined, '처음 잰 영상에는 「처음」이 없다');
  // 같은 영상을 도구 판이 바뀌어 다시 재면(여기서는 기록의 도구 칸을 옛 값으로 바꿔 흉내) 처음 잰 때와 걸린 항목 이름을 넘겨 둔다
  saved[Object.keys(saved)[0]] = { ...row, 도구: '옛도구', 잰때: undefined, 결과: { 걸림: [{ 항목: '구간굳음' }, { 항목: '같은판' }] } };
  fs.writeFileSync(cacheFile, JSON.stringify(saved));
  finalCutFindings(bundle, [video], { run: () => ({ 걸림: [{ 항목: '조용구간', 초: 28, 글: '조용' }] }) });
  const again = Object.values(JSON.parse(fs.readFileSync(cacheFile, 'utf8')))[0];
  assert.deepEqual(again.처음, { 잰때: row.수정, 걸림항목: ['구간굳음', '같은판'] }, '잰때가 없는 옛 줄은 영상 수정 시각');
  assert.deepEqual(again.결과.걸림.map((h) => h.항목), ['조용구간']);
  // 영상이 바뀌면 「처음」을 새로 시작한다
  fs.appendFileSync(video, 'x');
  finalCutFindings(bundle, [video], { run: () => ({ 걸림: [] }) });
  assert.equal(Object.values(JSON.parse(fs.readFileSync(cacheFile, 'utf8')))[0].처음, undefined);
});

test('도구가 실패하면 막지 않고 확인할 것 한 줄', (t) => {
  const { bundle, video } = fixture(t);
  const out = finalCutFindings(bundle, [video], { run: () => { throw new Error('ffprobe 실패'); }, save: false });
  assert.equal(out.length, 1);
  assert.equal(out[0].level, LOOK);
  assert.match(out[0].message, /ffprobe 실패/);
});

test('관문 밖 편은 재지 않는다 — LAB · 「사람편」 아닌 브랜드 · 슬롯이 11-14 전', () => {
  assert.equal(applies({ 브랜드: 'synkbrief', 슬롯: '2026-11-14' }), true);
  assert.equal(applies({ 브랜드: 'yuhobuilds', 슬롯: '2026-11-20' }), true);
  assert.equal(applies({ 브랜드: 'LAB', 슬롯: '2026-11-20' }), false);
  assert.equal(applies({ 브랜드: 'shift', 슬롯: '2026-11-20', 사람편: true }), true);
  assert.equal(applies({ 브랜드: 'synkbrief', 슬롯: '2026-11-13' }), false);
  assert.equal(applies({ 브랜드: 'synkbrief' }), false);
  // 슬롯은 그대로 두고 판 시각만 뒤로 옮긴 편도 관문에 든다
  assert.equal(applies({ 브랜드: 'synkbrief', 슬롯: '2026-11-13', 판: [{ 시각: '2026-11-15T21:00:00+09:00' }] }), true);
});

// ── 까닭 관문(11-23 넘김 막기 — .tmp/검수/설계검토_넘김막기_20261123.md) ──
const 관문들 = require('../tools/lib/최종본관문.js');
const 켬 = (미흡 = []) => ({ 켬: true, 미흡: new Set(미흡) });
const 끔 = { 켬: false, 미흡: new Set() };

test('까닭 관문 — 최종 확인 전 편의 되풀이 · 같은구도 · 끝소리 확인할 것은 「최종본판단」 까닭이 없으면 고칠 것, 굳음 · 화면멈춤 · 조용구간(yuhobuilds)은 그대로', (t) => {
  const { bundle, video } = fixture(t, { 브랜드: 'yuhobuilds' });
  const 더 = [...걸림, { 항목: '같은구도', 초: 7.92, 글: '7.92초 점프 컷' }, { 항목: '화면멈춤', 초: 5.3, 글: '2초 넘게 그대로' }, { 항목: '조용구간', 초: 12, 글: '조용' }];
  const run = () => ({ 걸림: 더 });
  const 등급 = (관문) => Object.fromEntries(finalCutFindings(bundle, [video], { run, save: false, 관문 }).map((f) => [f.code.replace('final-cut-', ''), f.level]));
  assert.deepEqual(등급(끔), { 굳음: LOOK, 같은판: LOOK, 되풀이: LOOK, 끝소리: LOOK, 같은구도: LOOK, 화면멈춤: LOOK, 조용구간: LOOK }, '관문이 꺼지면(열림 · 이미 걸림 · LAB) 지금과 같다');
  assert.deepEqual(등급(켬()), { 굳음: LOOK, 같은판: LOOK, 되풀이: FIX, 끝소리: FIX, 같은구도: FIX, 화면멈춤: LOOK, 조용구간: LOOK });
  const 글 = finalCutFindings(bundle, [video], { run, save: false, 관문: 켬() }).find((f) => f.code === 'final-cut-같은구도').message;
  assert.match(글, /「최종본판단」 \{"같은구도@7\.92": "까닭"\}에 적는다\(점검표 50/);
  bundle.prep.최종본판단 = { 되풀이: '교차 편집 — 듣는 사람과 화면을 번갈아', '같은구도@7.92': '숫자가 바뀌는 순간을 같은 자리에서 보인다', 끝소리: '끝 말이 마지막 한 방' };
  assert.deepEqual(등급(켬()), { 굳음: LOOK, 같은판: LOOK, 되풀이: LOOK, 끝소리: LOOK, 같은구도: LOOK, 화면멈춤: LOOK, 조용구간: LOOK });
  // 최종 확인이 그 번호로 미흡이면 까닭이 있어도 고칠 것 — 새 판정 기록이 생길 때까지
  const 미흡 = 등급(켬([50]));
  assert.deepEqual([미흡.되풀이, 미흡.같은구도, 미흡.끝소리], [FIX, FIX, LOOK]);
});

test('까닭 관문 — 글자 자리(⑤ text-* · cover-safe-area)는 「<code>@<군데 수>」 까닭이 없으면 고칠 것, 군데가 늘면 다시 고칠 것, 번호 없는 확인할 것은 그대로', () => {
  const f = (code, message) => ({ level: LOOK, code, where: '최종.mp4', message });
  const 목록 = [f('text-right', '오른쪽 단추 자리 3군데 — 0.0초 「48,000,000원」'), f('cover-safe-area', '표지 아래 앱 글자 자리 2군데'), f('time-slot', '시각이 슬롯 날이 아니다'),
    f('homage-길이', '원본과 길이가 다르다'), { level: FIX, code: 'still', where: '최종.mp4', message: '정지 30%' }];
  const 등급 = (prep, 관문) => 관문들.글자까닭올림(목록, prep, 관문).map((x) => `${x.code}:${x.level}`);
  assert.deepEqual(등급({}, 끔), ['text-right:확인할 것', 'cover-safe-area:확인할 것', 'time-slot:확인할 것', 'homage-길이:확인할 것', 'still:고칠 것'].map((x) => x.replace('확인할 것', LOOK).replace('고칠 것', FIX)));
  assert.deepEqual(등급({}, 켬()), [`text-right:${FIX}`, `cover-safe-area:${FIX}`, `time-slot:${LOOK}`, `homage-길이:${LOOK}`, `still:${FIX}`]);
  assert.match(관문들.글자까닭올림(목록, {}, 켬())[0].message, /\{"text-right@3": "까닭"\}에 적는다\(점검표 5/);
  const prep = { 최종본판단: { 'text-right@3': '화면 캡처 속 이름표 — 앱 단추가 덮어도 뜻이 남는다', 'cover-safe-area@2': '표지 아래 글은 날짜 줄이다' } };
  assert.deepEqual(등급(prep, 켬()), [`text-right:${LOOK}`, `cover-safe-area:${LOOK}`, `time-slot:${LOOK}`, `homage-길이:${LOOK}`, `still:${FIX}`]);
  assert.match(관문들.글자까닭올림(목록, prep, 켬())[0].message, /「최종본판단」: 화면 캡처 속 이름표/);
  const 늘어남 = [f('text-right', '오른쪽 단추 자리 5군데 — 다시 렌더')];
  assert.equal(관문들.글자까닭올림(늘어남, prep, 켬())[0].level, FIX, '까닭을 적은 뒤 군데가 늘면 옛 까닭이 덮지 않는다');
  assert.equal(관문들.글자까닭올림(목록, prep, 켬([5]))[0].level, FIX, '최종 확인이 글자 가림으로 미흡이면 까닭이 있어도 고칠 것');
});

test('까닭 관문의 항목은 코드 목록이다 — 흠갈래.json 「올린검사」가 그 code를 같은 점검표 번호에 잇는다(장부 표가 관문을 조용히 넓히지 않게)', () => {
  const 갈래 = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'docs', '마케팅', '제작양식', '흠갈래.json'), 'utf8'));
  const 번호of = (검사, 규칙) => 갈래.줄.find((x) => [].concat(x.올린검사 || []).some((o) => o.검사 === 검사 && [].concat(o.규칙 || []).includes(규칙)))?.번호;
  for (const [항목, n] of Object.entries(관문들.까닭항목)) assert.equal(번호of('최종본검사', 항목), n, `최종본검사:${항목}`);
  for (const [code, n] of Object.entries(관문들.까닭코드)) assert.equal(번호of('올리기전검사', code), n, `올리기전검사:${code}`);
});

test('까닭 관문을 켜는 편 — 두 브랜드에서 최종 확인을 아직 받지 않은 차례(제작 중 · 검사 고칠 것 · 다시 볼 차례 · 고칠 차례)만, 미흡 갈래는 번호로', () => {
  const 가짜 = (차례, 기록 = null, prep = { 브랜드: 'synkbrief', 슬롯: FINAL_FROM }) => 관문들.까닭관문({ prep },
    { required: (p) => p.브랜드 === 'synkbrief', stage: () => ({ 차례 }), read: () => 기록 });
  for (const 차례 of ['제작 중', '검사 고칠 것', '다시 볼 차례', '고칠 차례']) assert.equal(가짜(차례).켬, true, 차례);
  for (const 차례 of ['열림', '이미 걸림', '이미 나감', '등록 기다림', '판정 끝']) assert.equal(가짜(차례).켬, false, 차례);
  assert.equal(가짜('제작 중', null, { 브랜드: 'LAB' }).켬, false, 'LAB은 최종 확인 관문 밖');
  assert.deepEqual([...가짜('고칠 차례', { 결과: '미흡', 갈래: ['글자표', '끝약함', '50', '점프컷'] }).미흡].sort((a, b) => a - b), [2, 50]);
  assert.equal(관문들.까닭관문({ prep: { 브랜드: 'synkbrief' } }, { required: () => true, stage: () => { throw Error('못 읽음'); } }).켬, false, '차례를 못 읽으면 켜지 않는다');
});
