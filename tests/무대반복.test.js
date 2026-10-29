'use strict';
// 지난 편 되풀이(10-30, tools/무대반복.js · 올리기 전 검사 ⑯)의 판단 부분 — 끝 줄 견주기, 끝 장면 줄 고르기, 무대 판정, 지난 편 고르기,
// 나레이션 마지막 줄, 계정을 모은 결과. 영상 · 글자 인식은 부르지 않는다(바꿔 넣는다). 임시 폴더의 가짜 편 폴더만 쓴다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const 반복 = require('../tools/무대반복.js');

const codes = (list) => list.map((f) => `${f.level}:${f.code}`);
const KST = (s) => Date.parse(`${s}+09:00`);

test('끝 줄 견주기 — 플랫폼 낱말 하나 · 글자 인식 오타는 같은 줄, 이름표 · 짧은 조각은 세지 않는다', () => {
  const caption = '그대로 붙여 쓸 요청문은 캡션에 있어요';
  assert.ok(반복.similar(caption, '그대로 붙여 쓸 요청문은 고정 댓글에 있어요') >= 반복.LINE_SAME, '10-28 B8 판마다 끝 낱말만 다른 줄');
  assert.ok(반복.similar(caption, '그대로 붙여 쓸 요정문은 캡션에 있어요') >= 반복.LINE_SAME, '글자 인식 「요정문」');
  assert.equal(반복.similar('synk SHIFT', 'synk SHIFT'), 0, '끝 이름표는 끝 줄이 아니다');
  assert.equal(반복.similar('• SYNK 브리핑', '@synkbrief'), 0);
  assert.equal(반복.similar('글 티 나면,', '글 티 나면,'), 0, '일곱 글자 아래 조각');
  assert.ok(반복.similar('여러분 방엔 뭐가 들어왔나요?', '여러분은 어느 포스터가 좋아요?') < 반복.LINE_NEAR, '다른 물음');
  assert.equal(반복.similar('Comment below', 'Comment below'), 1);
});

test('끝 장면 줄 — 24px 넘는 새 줄만, 출처 줄 · 끝 7초 앞에도 있던 줄 · 짧은 줄은 뺀다', () => {
  const end = [
    { text: '여러분 방엔', h: 60 },
    { text: '뭐가 들어왔나요?', h: 60 },
    { text: '그대로 붙여 쓸 요청문은 캡션에 있어요', h: 35 },
    { text: 'synk SHIFT', h: 32 },
    { text: '실제 ChatGPT 결과 • 2026.1027 • 같은 요청도 사람마다 • 매번 달라요', h: 22 },
    { text: 'synkbrief 활용 노트', h: 27 },
  ];
  const pre = [{ text: 'synkbrief 활용 노트', h: 27 }, { text: '빈 방사진에', h: 60 }];
  assert.deepEqual(반복.screenEnding(end, pre), ['뭐가 들어왔나요?', '그대로 붙여 쓸 요청문은 캡션에 있어요']);
});

test('글자 인식 그림 하나 → 줄마다 1080×1920 기준 높이', () => {
  const lines = 반복.linesOfImage({ width: 540, height: 960, lines: [{ text: '끝 줄', words: [{ x: 1, y: 2, w: 10, h: 12 }, { x: 12, y: 2, w: 10, h: 15 }] }, { text: ' ', words: [] }] });
  assert.deepEqual(lines, [{ text: '끝 줄', h: 30 }]);
});

test('무대 — 첫 · 끝 장면이 둘 다 닮으면 고칠 것, 하나만이면 확인할 것(펠트 카페처럼 늘 같은 장소의 첫 장면)', () => {
  const frame = (v) => Buffer.alloc(9 * 16 * 3, v);
  const near = Math.round(255 * 0.05), far = Math.round(255 * 0.3);
  const ours = { first: frame(100), last: frame(100) };
  assert.equal(반복.stageVerdict(ours, { first: frame(100 + near), last: frame(100 - near) }).level, '고칠 것');
  const one = 반복.stageVerdict(ours, { first: frame(100 + near), last: frame(100 + far) });
  assert.equal(one.level, '확인할 것');
  assert.ok(Math.abs(one.first - near / 255) < 1e-9);
  assert.equal(반복.stageVerdict(ours, { first: frame(100 + far), last: frame(100 + far) }).level, null);
  assert.equal(반복.stageVerdict(ours, { first: Buffer.alloc(3), last: frame(100) }).level, '확인할 것', '크기가 다른 장면은 견주지 않는다');
});

test('지난 편 — 이 판보다 이른 그 계정 두 편, 보류 · 취소됨 · 지움 판과 버린 편 · 이 편은 뺀다', () => {
  const ep = (name, time, state = '', prep = {}) => ({ name, dir: `/x/${name}`, prep, 판: [{ account: 'synkbrief-instagram', video: `/v/${name}.mp4`, time: KST(time), state }] });
  const list = [
    ep('B14', '2026-10-29T21:00'), ep('B8', '2026-10-28T21:00'), ep('B2', '2026-10-30T21:00', '보류'), ep('B1', '2026-10-24T23:00'),
    ep('옛버림', '2026-10-29T22:00', '', { 상태: '버림 · 닫힘' }), ep('나중', '2026-11-02T21:00'), ep('이편', '2026-10-30T20:00'),
    { name: 'LAB', dir: '/x/LAB', prep: {}, 판: [{ account: 'lab-instagram', video: '/v/LAB.mp4', time: KST('2026-10-29T23:00'), state: '' }] },
  ];
  assert.deepEqual(반복.previousOf(list, 'synkbrief-instagram', KST('2026-10-30T21:00'), { exclude: '이편' }).map((p) => p.name), ['B14', 'B8']);
  assert.deepEqual(반복.previousOf(list, 'synkbrief-instagram', KST('2026-10-29T21:00')).map((p) => p.name), ['B8', 'B1'], '같은 시각은 지난 편이 아니다');
  assert.deepEqual(반복.previousOf(list, 'lab-instagram', KST('2026-10-25T21:00')), []);
});

test('나레이션 마지막 줄 — place.json 판마다 가장 늦게 놓인 줄의 show(없으면 text)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), '무대반복-'));
  try {
    const vo = path.join(dir, 'remotion', 'public', 'vo');
    fs.mkdirSync(vo, { recursive: true });
    fs.writeFileSync(path.join(vo, 'place.json'), JSON.stringify({ A: [{ id: 'v01', start: 0.1 }, { id: 'v06', start: 17.7 }, { id: 'v03', start: 9 }], B: [{ id: 'v01', start: 0.1 }, { id: 'v07', start: 18 }] }));
    fs.writeFileSync(path.join(vo, 'v06.json'), JSON.stringify({ text: '여러분 방엔 뭐가 들어왔나요', show: '여러분 방엔, 뭐가 들어왔나요?' }));
    fs.writeFileSync(path.join(vo, 'v07.json'), JSON.stringify({ text: '댓글로 알려 주세요.' }));
    assert.deepEqual(반복.narrationEnding(dir), ['여러분 방엔, 뭐가 들어왔나요?', '댓글로 알려 주세요.']);
    assert.deepEqual(반복.narrationEnding(path.join(dir, '없음')), []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('⑯ 결과 — 같은 영상 · 같은 지난 편은 계정을 모아 한 줄, 무대 · 끝 줄 고칠 것, 장면을 못 읽으면 확인할 것', () => {
  const frame = (v) => Buffer.alloc(9 * 16 * 3, v);
  const bundle = { name: '이편', dir: '/x/이편', repo: '/x', prep: { 끝줄: ['저장해 두고 다음 공지에 써 보세요'] } };
  const at = '2026-11-01T21:00:00+09:00';
  const plates = ['synkbrief-instagram', 'synkbrief-youtube'].map((account) => ({ account, time: at, video: { path: '/v/이편.mp4', exists: true } }))
    .concat([{ account: 'shift-naverblog', time: at, video: null }]);
  const ep = (name, time, video) => ({ name, dir: `/x/${name}`, prep: {}, 판: ['synkbrief-instagram', 'synkbrief-youtube'].map((account) => ({ account, video, time: KST(time), state: '' })) });
  const list = [ep('B16', '2026-10-31T21:00', '/v/B16.mp4'), ep('B15', '2026-10-30T21:00', '/v/B15.mp4'), ep('B14', '2026-10-29T21:00', '/v/B14.mp4')];
  const stages = { '/v/이편.mp4': { first: frame(100), last: frame(100) }, '/v/B16.mp4': { first: frame(103), last: frame(98) }, '/v/B15.mp4': { first: frame(200), last: frame(200) } };
  const stage = (f) => { if (!stages[f]) throw new Error('못 읽음'); return stages[f]; };
  const screen = () => new Map([['/v/이편.mp4', ['라벨 셋 붙인 사진']], ['/v/B15.mp4', ['저장해 두고 다음 공지에 써 보세요!']]]);
  const r = 반복.repeatFindings(bundle, plates, { list, stage, screen, narration: () => [] });
  assert.deepEqual(codes(r.findings), ['고칠 것:stage-repeat', '고칠 것:ending-repeat']);
  assert.equal(r.findings[0].where, 'synkbrief-instagram · synkbrief-youtube');
  assert.match(r.findings[0].message, /B16\(10-31\)/);
  assert.match(r.findings[1].message, /B15\(10-30\)/);
  assert.deepEqual(r.summary.지난편.map((s) => s.편), ['B16', 'B15'], 'B14는 지난 두 편 밖');

  const blind = 반복.repeatFindings(bundle, plates, { list, stage: () => { throw new Error('ffmpeg 없음'); }, screen, narration: () => [] });
  assert.deepEqual(codes(blind.findings), ['확인할 것:stage-unknown', '확인할 것:stage-unknown', '고칠 것:ending-repeat'], '끝 줄은 장면과 따로 본다');

  const noOcr = 반복.repeatFindings({ ...bundle, prep: {} }, plates, { list, stage, skipOcr: true, screen: () => { throw new Error('부르면 안 됨'); }, narration: () => [] });
  assert.deepEqual(codes(noOcr.findings), ['고칠 것:stage-repeat']);

  const first = 반복.repeatFindings(bundle, plates, { list: [], stage, screen, narration: () => [] });
  assert.deepEqual(first, { findings: [], summary: { 지난편: [] } }, '지난 편이 없는 새 계정');
});
