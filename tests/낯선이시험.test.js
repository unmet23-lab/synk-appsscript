'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { srtToLines, buildPrompt, buildWorthPrompt, parseCuts, cutShots, shotTimes, pickPrevious, episodeOf, 시청자 } = require('../tools/낯선이시험.js');

test('볼 이유 질문 — 무엇으로 이기나 · 볼 이유 점수 · 슬롭 · 약한 자리를 묻고, 광고(pulse)만 맡기겠나를 묻는다(10-29)', () => {
  const sns = buildWorthPrompt({ brand: 'lab-en', sheets: ['C:/a/정지컷_01.jpg'], speech: 'C:/a/말.txt' });
  assert.match(sns, /까다로운 시청자/);
  assert.match(sns, /C:\/a\/정지컷_01\.jpg/);
  assert.match(sns, /C:\/a\/말\.txt/);
  assert.match(sns, /^1\. 이 영상이 무엇으로 이기려 하나/m);
  assert.match(sns, /^2\. 볼 이유 점수 1~5/m);
  assert.match(sns, /^3\. AI 슬롭처럼 보이나/m);
  assert.match(sns, /^4\. 가장 약한 자리/m);
  assert.match(sns, /^5\. \(광고가 아님/m);
  // 10-29 시범: 유호님이 만족하신 「아니」 최종본을 펠트 질감 때문에 「슬롭 같음」으로 셌다 — 그 계정 고정 그림체는 그것만으로 세지 않는다
  assert.match(sns, /펠트 인형 마스코트.*그것만으로 슬롭으로 치지 않는다/);
  const ad = buildWorthPrompt({ brand: 'pulse', sheets: ['C:/a/정지컷_01.jpg'], speech: 'C:/a/말.txt', cuts: true });
  assert.doesNotMatch(ad, /그것만으로 슬롭으로 치지 않는다/);
  assert.match(ad, /회사 담당자의 눈/);
  assert.match(ad, /컷이 바뀔 때마다 한 장/);
  assert.match(ad, /^5\. 이 영상을 만든 팀에 돈 내고 광고를 맡기겠나/m);
  assert.throws(() => buildWorthPrompt({ brand: '없는곳', sheets: [], speech: 'x' }), /브랜드는/);
});

test('srt를 「초s  말」 줄로 바꾸고 빈 블록은 건너뛴다', () => {
  const srt = '1\r\n00:00:00,100 --> 00:00:04,000\r\n제가 나눠 드린 도구가,\r\n디스크를 썼어요.\r\n\r\n2\r\n00:01:04,500 --> 00:01:06,000\r\n둘째 줄\r\n\r\n3\r\n00:01:07,000 --> 00:01:08,000\r\n';
  assert.deepEqual(srtToLines(srt), ['0.1s  제가 나눠 드린 도구가, 디스크를 썼어요.', '64.5s  둘째 줄']);
});

test('질문에 장면 그림 전부 · 말 · 시청자 · 아홉 물음이 들어간다(10-28 재미 · 3초 · 저장/공유 · 같아 보이나)', () => {
  const prompt = buildPrompt({ brand: 'synkbrief', sheets: ['C:/a/정지컷_01.jpg', 'C:/a/정지컷_02.jpg'], speech: 'C:/a/말.txt' });
  assert.match(prompt, /AI 도구를 가끔 쓰는 30대 한국인 직장인/);
  assert.match(prompt, /그림 2장.*C:\/a\/정지컷_01\.jpg · C:\/a\/정지컷_02\.jpg/);
  assert.match(prompt, /C:\/a\/말\.txt/);
  assert.match(prompt, /휴대폰에서 보는 크기/);
  assert.match(prompt, /0~3초는 0\.5초마다/);
  for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9]) assert.match(prompt, new RegExp(`^${n}\\. `, 'm'));
  assert.match(prompt, /^6\. 재미 점수 1~5/m);
  assert.match(prompt, /^7\. 처음 3초.*「넘김」 또는 「계속 봄」/m);
  assert.match(prompt, /^8\. 저장하거나.*「안 함」/m);
  assert.match(prompt, /^9\. \(비교용 묶음 없음/m, '지난 편이 없으면 9번은 비교 못 함');
  assert.match(prompt, /다른 파일·폴더·인터넷은 보지 마라/);
  // 옛 꼴(그림 하나 sheet)도 받는다
  assert.match(buildPrompt({ brand: 'lab-en', sheet: 'C:/a/x.jpg', speech: 'b' }), /그림 1장.*C:\/a\/x\.jpg/);
});

test('지난 편 묶음이 있으면 9번에만 열게 하고, 같아 보이면 어디가 같은지 묻는다', () => {
  const prompt = buildPrompt({ brand: 'lab-en', sheets: ['s1.jpg'], speech: 'm.txt', previous: [{ file: 'C:/a/지난1_E4.jpg' }, { file: 'C:/a/지난2_E1.jpg' }] });
  assert.match(prompt, /비교용\(9번에만\).*2편.*C:\/a\/지난1_E4\.jpg · C:\/a\/지난2_E1\.jpg.*1~8번은 이 영상만 보고/);
  assert.match(prompt, /^9\. 비교용 묶음과 견주어 .*「같아 보임」 또는 「달라 보임」.*끝 카드/m);
  // 10-29 조정 — 그 계정에 늘 나오는 캐릭터 · 장소는 같은 틀로 치지 않는다(LAB 몽글 · 펠트 카페), 고정이 없는 계정은 그 말이 없다
  assert.match(prompt, /^9\. .*몽글.*같은 틀로 치지 않는다.*무엇으로 끝나는지로만 판단한다/m);
  const pulse = buildPrompt({ brand: 'pulse', sheets: ['s1.jpg'], speech: 'm.txt', previous: [{ file: 'p.jpg' }] });
  assert.doesNotMatch(pulse, /같은 틀로 치지 않는다/);
  assert.match(buildPrompt({ brand: 'synkbrief', sheets: ['s1.jpg'], speech: 'm.txt', previous: [{ file: 'p.jpg' }] }), /「SYNK 브리핑」 이름표/);
});

test('사람이 나오는 브랜드만 10번 — 같은 사람이 장면마다 다른 사람처럼 보인 자리(11-16 흠 장부 인물튐), LAB은 묻지 않는다', () => {
  for (const brand of ['synkbrief', 'yuhobuilds', 'pulse']) {
    const p = buildPrompt({ brand, sheets: ['s1.jpg'], speech: 'm.txt' });
    assert.match(p, /^10\. 같은 사람인데 장면마다 다른 사람처럼 보인 자리 — 누가, 몇 초와 몇 초 사이에서.*없으면 「없음」/m, brand);
    assert.ok(p.indexOf('\n9. ') < p.indexOf('\n10. '), '10번은 9번 뒤');
  }
  for (const brand of ['lab-en', 'lab-mn', 'lab-cn', 'lab-mm']) assert.doesNotMatch(buildPrompt({ brand, sheets: ['s1.jpg'], speech: 'm.txt' }), /^10\. /m, brand);
  // 지난 편 묶음이 있으면 10번도 이 영상만 보고 답한다
  assert.match(buildPrompt({ brand: 'synkbrief', sheets: ['s1.jpg'], speech: 'm.txt', previous: [{ file: 'p.jpg' }] }), /1~8번과 10 · 11번은 이 영상만 보고/);
  assert.match(buildPrompt({ brand: 'lab-en', sheets: ['s1.jpg'], speech: 'm.txt', previous: [{ file: 'p.jpg' }] }), /1~8번은 이 영상만 보고/);
});

test('같은 셋에 11번 — 끝 3초를 보고 힘 있게 끝났나 흐지부지 끝났나(11-16 흠 장부 끝약함), LAB은 묻지 않는다', () => {
  for (const brand of ['synkbrief', 'yuhobuilds', 'pulse']) {
    const p = buildPrompt({ brand, sheets: ['s1.jpg'], speech: 'm.txt' });
    assert.match(p, /^11\. 끝 3초\(마지막 칸과 마지막 말\)를 보고 영상이 힘 있게 끝났나, 앞보다 맥이 빠져 흐지부지 끝났나 — 「힘 있게」 또는 「흐지부지」/m, brand);
    assert.ok(p.indexOf('\n10. ') < p.indexOf('\n11. '), '11번은 10번 뒤');
  }
  for (const brand of ['lab-en', 'lab-mn', 'lab-cn', 'lab-mm']) assert.doesNotMatch(buildPrompt({ brand, sheets: ['s1.jpg'], speech: 'm.txt' }), /^11\. /m, brand);
});

test('「다음:」 줄 아래 답 처리(11-16 흠 장부) — 사람편 브랜드는 흠갈래 「올린곳」 가운데 검수 질문 · 이 도구 자리의 「할것」을 한 줄씩(답 10 · 11), LAB은 없음, 흠갈래를 못 읽으면 「다음:」 줄만', (t) => {
  const { 답처리줄, 다음글 } = require('../tools/낯선이시험.js');
  for (const brand of ['synkbrief', 'yuhobuilds', 'pulse']) {
    const 줄 = 다음글(brand);
    assert.match(줄[0], /^다음: 질문\.md를 /, brand);
    assert.equal(줄.length, 3, `${brand}: ${JSON.stringify(줄)}`);
    assert.match(줄[1], /^ {2}→ 할 것: 이해 시험 답 10이 /);
    assert.match(줄[2], /^ {2}→ 할 것: 이해 시험 답 11이 /);
  }
  for (const brand of ['lab-en', 'lab-mn', 'lab-cn', 'lab-mm', '없는브랜드', 'constructor']) assert.deepEqual(다음글(brand).slice(1), [], brand);
  // 문장은 흠갈래에서 읽는다 — 가짜 표의 할것이 자리 번호 순으로 뜨고, 다른 단계 · 다른 도구 · 할것 없는 줄은 뜨지 않는다
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nangseon-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const 쓰기 = (이름, 글) => { const p = path.join(dir, 이름); fs.writeFileSync(p, 글); return p; };
  const 가짜 = 쓰기('흠갈래.json', JSON.stringify({
    줄: [{ 번호: 1, 올린곳: [{ 단계: '검수 질문', 자리: 'tools/낯선이시험.js 12번 — 끝', 할것: '가짜 할것 B' }, { 단계: '기본값', 자리: 'tools/낯선이시험.js 3번', 할것: '기본값은 안 뜸' }] }],
    항목: { 가: { 올린곳: [{ 단계: '검수 질문', 자리: 'tools/낯선이시험.js 4번 — 사람', 할것: '가짜 할것 A' }, { 단계: '검수 질문', 자리: 'tools/낯선이시험.jsx 1번', 할것: '다른 도구는 안 뜸' },
      { 단계: '검수 질문', 자리: 'tools/다른도구.js 1번', 할것: '안 뜸' }, { 단계: '검수 질문', 자리: 'tools/낯선이시험.js 5번' }] } },
  }));
  assert.deepEqual(답처리줄('synkbrief', 가짜), ['가짜 할것 A', '가짜 할것 B']);
  assert.deepEqual(답처리줄('lab-en', 가짜), []);
  // 못 읽음 — 없는 파일 · 깨진 JSON · 다른 꼴이면 던지지 않고 빈 목록, 「다음:」 줄은 그대로다(끝 코드와 만드는 파일은 이 줄들과 무관)
  for (const p of [path.join(dir, '없음.json'), 쓰기('깨짐.json', '{깨짐'), 쓰기('목록.json', '[]'), 쓰기('널.json', 'null'), 쓰기('꼴.json', '{"줄": "x", "항목": 3}'), 쓰기('곳꼴.json', '{"줄": [{"올린곳": "x"}, null], "항목": {"가": null}}')]) {
    assert.deepEqual(답처리줄('synkbrief', p), [], p);
    assert.deepEqual(다음글('synkbrief', p), [다음글('lab-en')[0]], p);
  }
});

test('--틀 퀴즈: 9번은 지난 퀴즈끼리 무대 · 주제 · 표정 · 색 · 구도로만 견주고 퀴즈 칸의 늘 있는 짜임은 세지 않는다(제작절차 LAB 하루 두 편 7)', () => {
  const prompt = buildPrompt({ brand: 'lab-mn', sheets: ['s1.jpg'], speech: 'm.txt', previous: [{ file: 'C:/a/지난1_Q5.jpg' }, { file: 'C:/a/지난2_Q4.jpg' }], 틀: '퀴즈' });
  assert.match(prompt, /^9\. 비교용 묶음\(같은 계정의 지난 퀴즈 편\)과 견주어 .*「같아 보임」 또는 「달라 보임」.*무대 · 주제 · 마스코트 표정 · 색 · 구도 가운데/m);
  assert.match(prompt, /^9\. .*퀴즈 꼴.*머리 띠.*점수 칸.*몽글.*같은 퀴즈로 치지 않는다/m);
  assert.doesNotMatch(prompt, /^9\. .*끝 카드 가운데/m);
  // 지난 편이 없으면 퀴즈 틀이어도 비교 못 함
  assert.match(buildPrompt({ brand: 'lab-mn', sheets: ['s1.jpg'], speech: 'm.txt', 틀: '퀴즈' }), /^9\. \(비교용 묶음 없음/m);
});

test('브랜드마다 시청자가 있고, 모르는 브랜드는 멈춘다 · 본 계정으로 지난 편을 찾는다', () => {
  for (const brand of ['lab-en', 'lab-mn', 'lab-cn', 'lab-mm', 'synkbrief', 'yuhobuilds', 'pulse']) assert.ok(시청자[brand]);
  assert.equal(시청자['lab-en'].계정, 'lab-youtube');
  assert.equal(시청자.yuhobuilds.계정, 'yuhobuilds-instagram');
  assert.throws(() => buildPrompt({ brand: 'shift', sheets: ['a'], speech: 'b' }), /브랜드는/);
});

test('장면 — 0~3초는 0.5초마다, 그 뒤는 2초마다, 끝 장면 하나(끝 카드)', () => {
  const at = shotTimes(24.2).map((s) => s.at);
  assert.deepEqual(at.slice(0, 7), [0, 0.5, 1, 1.5, 2, 2.5, 3]);
  assert.deepEqual(at.slice(7, 10), [4, 6, 8]);
  assert.equal(at[at.length - 2], 22);
  assert.equal(at[at.length - 1], 23.9, '끝에서 0.3초 앞');
  assert.equal(shotTimes(24.2)[1].label, '0.5s');
  assert.equal(shotTimes(4.1).map((s) => s.at).join(','), '0,0.5,1,1.5,2,2.5,3,3.8');
  assert.equal(shotTimes(3.4).map((s) => s.at).join(','), '0,0.5,1,1.5,2,2.5,3', '끝 장면이 마지막 칸과 0.5초 안이면 더하지 않는다');
});

test('컷마다 찍을 때는 질문이 컷이 시작하는 초라고 말하고, 컷 초는 커지는 순서여야 한다', () => {
  const prompt = buildPrompt({ brand: 'pulse', sheets: ['C:/a/정지컷_01.jpg'], speech: 'C:/a/말.txt', cuts: true });
  assert.match(prompt, /컷이 바뀔 때마다 한 장/);
  assert.match(prompt, /시작-끝/);
  assert.doesNotMatch(prompt, /2초마다/);
  assert.deepEqual(parseCuts('0, 3.56,4.52', 60), [0, 3.56, 4.52]);
  assert.throws(() => parseCuts('0,4.52,3.56', 60), /커지는 초/);
  assert.throws(() => parseCuts('0,61', 60), /커지는 초/);
  assert.deepEqual(cutShots([0, 4], 6), [{ at: 2, label: '0.0-4.0s' }, { at: 5, label: '4.0-6.0s' }]);
});

test('지난 편 — 같은 계정 판에 영상이 있는 편 가운데 이 편 말고 시각이 가장 늦은 두 편', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), '낯선이시험-'));
  try {
    fs.mkdirSync(path.join(root, 'docs', '마케팅'), { recursive: true });
    fs.mkdirSync(path.join(root, 'tools'));
    fs.writeFileSync(path.join(root, 'docs', '마케팅', 'sns-계정.json'), JSON.stringify({ accounts: {
      'lab-youtube': { platform: 'youtube' }, 'lab-instagram': { platform: 'instagram' } } }));
    const 편 = (name, account, time, withVideo = true) => {
      const dir = path.join(root, 'docs', '마케팅', name, '게시');
      fs.mkdirSync(dir, { recursive: true });
      if (withVideo) fs.writeFileSync(path.join(dir, 'video.mp4'), 'x');
      fs.writeFileSync(path.join(dir, '준비.json'), JSON.stringify({ 브랜드: 'LAB', 슬롯: time.slice(0, 10), 판: [{ 계정: account, 파일: `docs/마케팅/${name}/게시/video.mp4`, 시각: time }] }));
    };
    편('LAB_가_20261024', 'lab-youtube', '2026-10-24T21:00:00+09:00');
    편('LAB_나_20261026', 'lab-youtube', '2026-10-26T21:00:00+09:00');
    편('LAB_다_20261027', 'lab-youtube', '2026-10-27T21:00:00+09:00');
    편('LAB_몽골_20261028', 'lab-instagram', '2026-10-28T21:00:00+09:00');
    편('LAB_영상없음_20261029', 'lab-youtube', '2026-10-29T21:00:00+09:00', false);
    const got = pickPrevious('lab-youtube', { exclude: 'LAB_다_20261027', roots: [root] });
    assert.deepEqual(got.map((p) => p.name), ['LAB_나_20261026', 'LAB_가_20261024']);
    assert.ok(got[0].video.endsWith('video.mp4'));
    assert.deepEqual(pickPrevious(null, { roots: [root] }), [], 'PULSE처럼 계정이 없으면 비교하지 않는다');
    assert.equal(episodeOf(path.join(root, 'docs', '마케팅', 'LAB_다_20261027', '게시', 'video.mp4')), 'LAB_다_20261027');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
