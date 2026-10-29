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
  const ad = buildWorthPrompt({ brand: 'pulse', sheets: ['C:/a/정지컷_01.jpg'], speech: 'C:/a/말.txt', cuts: true });
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
