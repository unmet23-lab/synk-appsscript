'use strict';
// 지난 편 되풀이(10-30, tools/무대반복.js · 올리기 전 검사 ⑯)의 판단 부분 — 끝 줄 견주기, 끝 장면 줄 고르기, 무대 판정, 지난 편 고르기,
// 나레이션 마지막 줄, 계정을 모은 결과. 영상 · 글자 인식은 부르지 않는다(바꿔 넣는다). 임시 폴더의 가짜 편 폴더만 쓴다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const 반복 = require('../tools/무대반복.js');
const 묶음 = require('../tools/lib/게시묶음.js');

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

test('편 읽기 — 뿌리가 둘이면(회차 사본 + 공용 작업본) 판을 합친다: 회차가 방금 단 판도, 공용 작업본에만 있는 편 · 판도 보인다(11-11 P2-10)', () => {
  const 뿌리 = (이름) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), `무대반복-${이름}-`));
    fs.mkdirSync(path.join(root, 'tools'), { recursive: true });
    return root;
  };
  const 편쓰기 = (root, name, 판, 결과 = null) => {
    const dir = path.join(root, 'docs', '마케팅', name, '게시');
    fs.mkdirSync(dir, { recursive: true });
    for (const p of 판) fs.writeFileSync(path.join(dir, p.파일), 'v');
    fs.writeFileSync(path.join(dir, '준비.json'), JSON.stringify({ 브랜드: 'LAB', 슬롯: '2026-11-01', 판 }));
    if (결과) fs.writeFileSync(path.join(dir, '게시결과.json'), JSON.stringify({ 판: 결과 }));
  };
  const 사본 = 뿌리('사본'), 공용 = 뿌리('공용');
  try {
    const 씨앗 = { 계정: 'lab-instagram', 파일: 'seed.mp4', 시각: '2026-11-01T21:00:00+09:00' };
    const 새판 = { 계정: 'lab-th-youtube', 파일: 'th.mp4', 시각: '2026-11-20T13:00:00+07:00', 돌림: true };
    const 공용판 = { 계정: 'lab-jp-youtube', 파일: 'jp.mp4', 시각: '2026-11-20T13:00:00+09:00', 돌림: true };
    // 가 편: 회차 사본에는 방금 단 태국 판이, 공용 작업본에는 다른 세션이 단 일본 판이 있다
    편쓰기(사본, 'LAB_가', [씨앗, 새판]);
    편쓰기(공용, 'LAB_가', [씨앗, 공용판], [{ 계정: 'lab-instagram', 상태: '게시됨' }]);
    // 나 편: 공용 작업본에만 있다
    편쓰기(공용, 'LAB_나', [{ 계정: 'lab-instagram', 파일: 'n.mp4', 시각: '2026-11-02T21:00:00+09:00' }]);
    const list = 반복.episodes([사본, 공용]);
    const 가 = list.find((e) => e.name === 'LAB_가');
    assert.deepEqual(가.판.map((p) => p.account).sort(), ['lab-instagram', 'lab-jp-youtube', 'lab-th-youtube']);
    assert.equal(가.판.find((p) => p.account === 'lab-instagram').state, '게시됨', '앞 뿌리가 상태를 모르면 뒤 뿌리의 상태');
    assert.ok(가.dir.startsWith(사본), '편의 머리는 앞 뿌리(회차 사본)');
    assert.ok(list.some((e) => e.name === 'LAB_나'));
    // 회차가 방금 단 판이 그 계정의 「지난 편」으로 잡힌다
    assert.deepEqual(반복.previousOf(list, 'lab-th-youtube', Date.parse('2026-11-21T13:00:00+07:00')).map((p) => p.name), ['LAB_가']);
    assert.deepEqual(반복.episodes([공용]).find((e) => e.name === 'LAB_가').판.map((p) => p.account).sort(), ['lab-instagram', 'lab-jp-youtube'], '공용 작업본만 읽으면 회차의 새 판은 없다');
  } finally { for (const r of [사본, 공용]) fs.rmSync(r, { recursive: true, force: true }); }
});

test('편 읽기 — 한 계정에 줄이 여럿이면 게시 장부와 같은 읽기(rowOf): 거둔 예약 · 같은 작업의 취소는 지난 편에서 빠지고, 다른 작업의 취소 줄은 걸린 판을 덮지 않는다(11-11 P1-2 · P3-7)', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), '무대반복-줄-'));
  fs.mkdirSync(path.join(root, 'tools'), { recursive: true });
  const 편쓰기 = (name, time, 결과) => {
    const dir = path.join(root, 'docs', '마케팅', name, '게시');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'v.mp4'), 'v');
    fs.writeFileSync(path.join(dir, '준비.json'), JSON.stringify({ 브랜드: 'LAB', 슬롯: time.slice(0, 10), 판: [{ 계정: 'lab-instagram', 파일: 'v.mp4', 시각: time }] }));
    fs.writeFileSync(path.join(dir, '게시결과.json'), JSON.stringify({ 판: 결과.map((r) => ({ 계정: 'lab-instagram', ...r })) }));
  };
  try {
    편쓰기('LAB_거둠', '2026-11-01T21:00:00+09:00', [{ 상태: '예약됨', 작업: 'a' }, { 상태: '보류', 보류: '예약을 거뒀다' }]);
    편쓰기('LAB_걸림', '2026-11-02T21:00:00+09:00', [{ 상태: '예약됨', 작업: 'a', 방법: '작업실' }, { 상태: '취소됨', 작업: 'b' }]);
    편쓰기('LAB_취소', '2026-11-03T21:00:00+09:00', [{ 상태: '예약됨', 작업: 'a', 방법: '작업실' }, { 상태: '취소됨', 작업: 'a' }]);
    const list = 반복.episodes([root]);
    const 상태 = (name) => list.find((e) => e.name === name).판[0].state;
    assert.equal(상태('LAB_거둠'), '보류', '첫 걸린 줄(예약됨)이 아니라 거둔 줄');
    assert.equal(상태('LAB_걸림'), '예약됨', '마지막 줄(다른 작업의 취소됨)이 아니라 걸린 줄');
    assert.equal(상태('LAB_취소'), '취소됨', '같은 작업의 취소는 그 예약이 취소된 것');
    assert.deepEqual(반복.previousOf(list, 'lab-instagram', Date.parse('2026-11-05T21:00:00+09:00')).map((p) => p.name), ['LAB_걸림']);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
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

// 11-10 LAB 하루 두 편(설계 23) — 21:00 퀴즈는 ⑯ 셈 밖, 대신 개그 무대가 지난 두 퀴즈와 같으면 고칠 것. 이야기 편은 이야기 편끼리만.
test('⑯ 돌림 — 퀴즈는 개그 무대만 견주고, 이야기 편은 그 사이 퀴즈를 건너뛰고 지난 이야기 편과 견준다', () => {
  const frame = (v) => Buffer.alloc(9 * 16 * 3, v);
  const ep = (name, time, video, 돌림) => ({ name, dir: `/x/${name}`, prep: 돌림 ? { 돌림 } : {}, 판: [{ account: 'lab-th-youtube', video, time: Date.parse(time), state: '' }] });
  const list = [
    ep('Q2', '2026-11-19T21:00:00+07:00', '/v/Q2.mp4', { 형식: '퀴즈', 무대: '시장 국숫집' }),
    ep('S2', '2026-11-19T13:00:00+07:00', '/v/S2.mp4', { 형식: '이야기' }),
    ep('Q1', '2026-11-18T21:00:00+07:00', '/v/Q1.mp4', { 형식: '퀴즈', 무대: '학교 운동장' }),
    ep('S1', '2026-11-18T13:00:00+07:00', '/v/S1.mp4', { 형식: '이야기' }),
  ];
  const at = '2026-11-20T21:00:00+07:00';
  const plates = [{ account: 'lab-th-youtube', time: at, video: { path: '/v/Q3.mp4', exists: true } }];
  const quiz = (무대) => ({ name: 'Q3', dir: '/x/Q3', repo: '/x', prep: { 돌림: { 형식: '퀴즈', 무대 } } });
  const stage = () => { throw new Error('퀴즈는 장면을 읽지 않는다'); };
  assert.deepEqual(codes(반복.repeatFindings(quiz('바닷가 매점'), plates, { list, stage, narration: () => [] }).findings), []);
  const same = 반복.repeatFindings(quiz('학교  운동장'), plates, { list, stage, narration: () => [] });
  assert.deepEqual(codes(same.findings), ['고칠 것:quiz-stage-repeat']);
  assert.match(same.findings[0].message, /Q1/);
  assert.deepEqual(same.summary.지난편.map((s) => s.편), ['Q2', 'Q1'], '지난 두 퀴즈(이야기 편은 건너뜀)');
  assert.deepEqual(codes(반복.repeatFindings(quiz(''), plates, { list, stage, narration: () => [] }).findings), ['확인할 것:quiz-stage-missing']);
  // 이야기 편: 지난 두 편은 S2 · S1(퀴즈 Q2 · Q1은 건너뜀)
  const stages = { '/v/S3.mp4': { first: frame(10), last: frame(10) }, '/v/S2.mp4': { first: frame(200), last: frame(200) }, '/v/S1.mp4': { first: frame(90), last: frame(240) } };
  const story = { name: 'S3', dir: '/x/S3', repo: '/x', prep: { 돌림: { 형식: '이야기' } } };
  const r = 반복.repeatFindings(story, [{ account: 'lab-th-youtube', time: '2026-11-20T13:00:00+07:00', video: { path: '/v/S3.mp4', exists: true } }], { list, stage: (f) => stages[f], skipOcr: true, narration: () => [] });
  assert.deepEqual(r.summary.지난편.map((s) => s.편), ['S2', 'S1']);
  // 11-10 밤: 21:00 노래도 ⑯ 셈 밖 — 장면을 읽지 않고, 이야기 편은 그 사이 노래도 건너뛴다
  const song = { name: 'N3', dir: '/x/N3', repo: '/x', prep: { 돌림: { 형식: '노래' } } };
  const sung = 반복.repeatFindings(song, plates, { list, stage, narration: () => [] });
  assert.deepEqual(codes(sung.findings), []);
  assert.match(sung.summary.셈밖, /노래/);
  const withSong = [ep('N2', '2026-11-19T21:30:00+07:00', '/v/N2.mp4', { 형식: '노래' }), ...list];
  const r2 = 반복.repeatFindings(story, [{ account: 'lab-th-youtube', time: '2026-11-20T13:00:00+07:00', video: { path: '/v/S3.mp4', exists: true } }], { list: withSong, stage: (f) => stages[f], skipOcr: true, narration: () => [] });
  assert.deepEqual(r2.summary.지난편.map((s) => s.편), ['S2', 'S1']);
});

test('인사 판본의 「첫 장면」은 인사 뒤 원본의 첫 장면이다 — 렌더.json 「인사초」만큼 건너 뜬다(11-12 인사 카드 검수 P1)', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), '무대반복-인사-'));
  // 가짜 영상 — 조각 [색(0~255), 초]의 차례. ffmpeg 없이 「몇 초에서 떴나」만 본다(CI의 문법 검사 작업에는 ffmpeg가 없다)
  const 영상들 = new Map();
  const 만들기 = (이름, 조각) => {
    const 폴더 = path.join(방, 이름);
    fs.mkdirSync(폴더, { recursive: true });
    const 파일 = path.join(폴더, 'video.mp4');
    fs.writeFileSync(파일, 이름);
    영상들.set(파일, 조각);
    return 파일;
  };
  const read = {
    duration: (f) => 영상들.get(f).reduce((s, [, 초]) => s + 초, 0),
    thumb: (f, t) => { let 끝 = 0; for (const [색, 초] of 영상들.get(f)) { 끝 += 초; if (t < 끝) return Buffer.alloc(9 * 16 * 3, 색); } return Buffer.alloc(9 * 16 * 3, 영상들.get(f).at(-1)[0]); },
  };
  const 장면 = (f) => 반복.stageOf(f, read);
  // 원본(인사 없음): 장면 A 2초 → 끝 장면 1초. 인사 판 둘: 인사 그림 1.2초 + 같은 원본 / 인사 그림 1.2초 + 다른 원본
  const [인사그림, A, 끝A, B, 끝B] = [10, 90, 170, 230, 250];
  const 원본 = 만들기('원본', [[A, 2], [끝A, 1]]);
  const 인사판 = 만들기('US', [[인사그림, 1.2], [A, 2], [끝A, 1]]);
  const 다른편 = 만들기('US2', [[인사그림, 1.2], [B, 2], [끝B, 1]]);
  const 기록 = (파일, 덧) => fs.writeFileSync(path.join(path.dirname(파일), '렌더.json'), JSON.stringify({ 영상: 'docs/x/video.mp4', ...덧 }));
  // 렌더 기록이 없으면(또는 인사초가 없으면) 전처럼 0.3초 — 인사 그림이 잡힌다
  assert.equal(반복.greetSec(인사판), 0);
  assert.equal(반복.stageVerdict(장면(인사판), 장면(원본)).level, '확인할 것', '고치기 전 꼴: 같은 무대인데 첫 장면이 달라 고칠 것이 못 뜬다');
  assert.equal(반복.stageVerdict(장면(인사판), 장면(다른편)).level, '확인할 것', '고치기 전 꼴: 다른 원본인데 인사 그림 때문에 첫 장면이 같다');
  기록(인사판, { 인사초: 1.2 });
  기록(다른편, { 인사초: 1.2 });
  assert.equal(반복.greetSec(인사판), 1.2);
  assert.equal(장면(인사판).greet, 1.2);
  // ⓐ 인사 판 ↔ 인사 없는 같은 무대: 첫 · 끝이 다 같아 고칠 것
  const 같은 = 반복.stageVerdict(장면(인사판), 장면(원본));
  assert.equal(같은.level, '고칠 것');
  assert.ok(같은.first < 반복.STAGE_SAME);
  // ⓑ 같은 인사 그림으로 시작하는 다른 원본 둘: 첫 장면이 다르다 — 인사 그림 때문에 묶이지 않는다
  const 다른 = 반복.stageVerdict(장면(인사판), 장면(다른편));
  assert.equal(다른.level, null);
  assert.ok(다른.first > 반복.STAGE_SAME);
  // 다른 영상의 렌더 기록 · 범위 밖 값은 믿지 않는다
  기록(인사판, { 인사초: 1.2, 영상: 'docs/x/다른.mp4' });
  assert.equal(반복.greetSec(인사판), 0);
  fs.writeFileSync(path.join(path.dirname(인사판), '렌더.json'), JSON.stringify({ 인사초: 9 }));
  assert.equal(반복.greetSec(인사판), 0);
  fs.rmSync(방, { recursive: true, force: true });
});

// 11-18 — 돌림 판(준비.json 판에 「돌림」: true)의 끝 줄은 글자 인식이 아니라 그 판본의 글.json으로 견준다. 윈도우 글자 인식은 키릴 글자를
// 라틴 글자로 엉뚱하게 읽고(「TOJ1bKO npo ce6A!」) 데바나가리는 한 줄도 못 읽는다. 그래서 러시아 미안 · 화날때가 둘 다 「только про себя!」로
// 끝나는데 0.09(다름), 네팔 · 인도는 0.00이었다(docs/현장노트/시험_화면확인.md 「올리기 전 검사 ⑯ 「끝 줄이 지난 편과 같다」…」).
// 아래 판본 글은 공용 작업본 판본(LAB_미안죄송합니다_mn_20261029 · LAB_화날때_mn_20261031 · LAB_지마_mn_20261031 · LAB_물고기_mn_20261102의 RU)에서
// 끝 무렵 줄만 옮겼다.
const 판본줄 = {
  미안: [
    { id: 'level', 칸: '진행', 글: 'Уважение {n}', 초: [0, 14.8] },
    { id: 'ko.7', 칸: '한국어', 글: '사장님이 부딪쳤잖아!', 초: [11.2, 12.5] },
    { id: 'ko.8', 칸: '한국어', 글: '시급도 당연히 올려 줘야지.', 초: [12.5, 14.8] },
    { id: 'means.8', 칸: '개그', 글: '(Вот бы ещё\nзарплату подняли…)', 초: [12.5, 14.8] },
    { id: 'tags.8', 칸: '해설', 글: 'только про себя!', 초: [12.5, 14.8] },
    { id: 'endCard', 칸: '끝', 글: 'Кофе на рубашке босса?\n→ 죄송합니다.', 초: [13, 14.8] },
    { id: 'ask', 칸: '끝질문', 글: 'Кому скажешь 죄송합니다?', 초: [13, 14.8] },
    { id: '게시글.rutube.본문.4', 칸: '게시글', 글: 'А последние две фразы? Их — только про себя 🤫' },
  ],
  화날때: [
    { id: 'gauge', 칸: '진행', 글: 'ГНЕВ' },
    { id: 'inner', 칸: '진행', 글: 'кричу внутри', 초: [23.75, 25.3] },
    { id: 'end1', 칸: '끝', 글: 'При начальстве —', 초: [25.3, 28.6] },
    { id: 'end2', 칸: '끝', 글: 'только про себя!', 초: [25.3, 28.6] },
    { id: 'ask', 칸: '끝질문', 글: 'Что тебя сегодня бесит?', 초: [25.3, 28.6] },
  ],
  지마: [
    { id: 'endCard', 칸: '끝', 글: '가지 마 = Не уходи', 초: [17.6, 20.6] },
    { id: 'ask', 칸: '끝질문', 글: 'Кому ты скажешь «не уходи»?', 초: [17.6, 20.6] },
  ],
  물고기: [
    { id: 'gasp', 칸: '개그', 글: '…?!', 초: [15.5, 17.5] },
    { id: 'endCard', 칸: '끝', 글: 'Рыба (물고기) всё съела!', 초: [15.5, 17.5] },
  ],
};

test('⑯ 돌림 판 끝 줄 — 판본 글.json에서 끝 장면에 뜬 줄을 고른다: 끝 0.3초 앞에 떠 있고 끝 7초 앞에는 없던 줄과 끝 · 끝질문 칸, 게시글 · 내내 떠 있는 줄은 뺀다', () => {
  const 글 = (줄) => ({ 꼴: '판본글/1', 언어: 'ru', 틀: '이야기', 줄 });
  const 미안 = 반복.versionEnding(글(판본줄.미안));
  assert.ok(미안.includes('только про себя!'), '해설 칸이어도 끝 장면에 떠 있으면 끝 줄이다');
  assert.ok(미안.includes('Кофе на рубашке босса? → 죄송합니다.'), '여러 줄 카드는 한 줄로 잇는다');
  assert.ok(미안.includes('Кофе на рубашке босса?'), '카드의 줄 하나하나도 넣는다(글자 인식이 줄마다 읽던 것과 같은 단위)');
  assert.ok(미안.includes('시급도 당연히 올려 줘야지.'));
  assert.ok(!미안.some((x) => /Уважение/.test(x)), '처음부터 끝까지 떠 있는 줄(존중 눈금)은 끝 줄이 아니다');
  assert.ok(!미안.some((x) => /последние/.test(x)), '게시글 칸은 화면에 안 나온다');
  assert.ok(!미안.includes('사장님이 부딪쳤잖아!'), '끝 장면 전에 사라진 줄');
  assert.deepEqual(반복.versionEnding(글(판본줄.화날때)), ['При начальстве —', 'только про себя!', 'Что тебя сегодня бесит?']);
  assert.equal(반복.versionEnding(글([{ id: 'gauge', 칸: '진행', 글: 'ГНЕВ' }])), null, '초도 끝 칸도 없으면 판본 글로 못 고른다 — 글자 인식으로');
  assert.equal(반복.versionEnding(글([{ id: '게시글.제목.1', 칸: '게시글', 글: 'Три корейских «прости»', 초: [3, 5] }])), null, '게시글 칸은 초가 붙어도 화면 밖');
  assert.equal(반복.versionEnding(null), null);
  // 끝 7초 앞 장면에 떠 있던 줄과 닮은 끝 줄은 뺀다 — 글자 인식 쪽 screenEnding과 같은 셈(GPT 검수 GA2, 배 브라질 판본에서 옮김)
  const 배 = 반복.versionEnding(글([
    { id: 'means.2', 칸: '뜻', 글: 'Dor de barriga…', 초: [10.2, 11.8] },
    { id: 'endCard', 칸: '끝', 글: '3 palavras em português,\n1 só em coreano: “배”', 초: [14.3, 17.6] },
    { id: 'end.barriga', 칸: '뜻', 글: 'barriga', 초: [14.35, 17.6] },
    { id: 'end.pera', 칸: '뜻', 글: 'pera', 초: [14.8, 17.6] },
  ]));
  assert.ok(!배.includes('barriga'), '7초 앞 「Dor de barriga…」와 0.71');
  assert.ok(배.includes('3 palavras em português, 1 só em coreano: “배”') && 배.includes('pera'));
  assert.deepEqual(반복.versionEnding(글([{ id: 'a', 칸: '진행', 글: '처음부터 떠 있는 긴 줄 하나', 초: [0, 3] }, { id: 'b', 칸: '끝', 글: '처음부터 떠 있는 긴 줄 하나', 초: [0, 12] }])), [], '끝 칸도 7초 앞에 떠 있던 줄이면 뺀다 — 고를 줄이 없어도 판본 글이 있으면 빈 목록(글자 인식으로 안 떨어진다)');
});

test('⑯ 돌림 판 끝 줄 — 데바나가리처럼 모음 기호가 붙는 글자도 그대로 견준다(모음 기호를 떼면 「मनमै राख!」가 일곱 글자 아래로 줄어 0이 된다)', () => {
  assert.equal(반복.similar('मनमै राख!', 'मनमै राख!'), 1);
  assert.ok(반복.similar('यो पनि मनमनै', 'मनमै राख!') < 반복.LINE_NEAR, '뜻이 같아도 다른 말(네팔 미안 · 화날때)은 같은 줄이 아니다');
  assert.ok(반복.similar('कसलाई “नजाऊ” भन्न मन छ?', 'कसलाई नजाऊ भन्न मन छ') >= 반복.LINE_SAME);
  // 이모지 변형 선택자(U+FE0F — 이것도 붙는 기호)는 뗀다 — 남기면 손 판 끝줄 「우리의 한국어 ❤️」가 일곱 글자로 늘어 새로 걸린다(GPT 검수 GA3)
  assert.equal(반복.similar('우리의 한국어 ❤️', '우리의 한국어 ❤️'), 0);
  assert.equal(반복.core('1️⃣ 짜증 나 ❤️'), '1짜증나');
});

test('⑯ 돌림 판 끝 줄 — 러시아 「только про себя!」 짝은 글자 인식이 엉뚱하게 읽어도 같은 끝 줄로 잡고, 글이 다른 짝은 잡지 않는다. 판본 글이 없는 판 · 손으로 단 판은 전처럼 글자 인식', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), '무대반복-판본글-'));
  fs.mkdirSync(path.join(root, 'tools'), { recursive: true });
  const 편쓰기 = (name, 시각, 줄, { 손판 = null } = {}) => {
    const dir = path.join(root, 'docs', '마케팅', name);
    const 판본 = path.join(dir, '게시', '판본', 'RU');
    fs.mkdirSync(판본, { recursive: true });
    fs.writeFileSync(path.join(판본, 'video.mp4'), name);
    fs.writeFileSync(path.join(판본, '글.json'), JSON.stringify({ 꼴: '판본글/1', 편: name, 판본: 'RU', 언어: 'ru', 틀: '이야기', 줄 }));
    const 판 = [{ 계정: 'lab-ru-vk', 파일: '게시/판본/RU/video.mp4', 시각, 언어: 'ru', 돌림: true }];
    // 손으로 단 판 — 판본 영상과 같은 파일이어도 「돌림」이 없으면 전처럼 글자 인식
    if (손판) 판.push({ 계정: 'lab-ru-rutube', 파일: '게시/판본/RU/video.mp4', 시각: 손판 });
    fs.writeFileSync(path.join(dir, '게시', '준비.json'), JSON.stringify({ 브랜드: 'LAB', 슬롯: 시각.slice(0, 10), 판,
      돌림: { 형식: '이야기', 판본: { RU: { 언어: 'ru', 파일: '게시/판본/RU/video.mp4', 글: '게시/판본/RU/글.json' } } } }));
    return dir;
  };
  const 편 = (name) => path.join(root, 'docs', '마케팅', name);
  const 영상 = (name) => path.join(편(name), '게시', '판본', 'RU', 'video.mp4');
  try {
    편쓰기('LAB_물고기', '2026-11-17T13:00:00+03:00', 판본줄.물고기);
    편쓰기('LAB_지마', '2026-11-18T13:00:00+03:00', 판본줄.지마);
    편쓰기('LAB_미안', '2026-11-19T13:00:00+03:00', 판본줄.미안, { 손판: '2026-11-19T15:00:00+03:00' });
    편쓰기('LAB_화날때', '2026-11-20T13:00:00+03:00', 판본줄.화날때, { 손판: '2026-11-20T15:00:00+03:00' });
    // 11-18 실측처럼 윈도우 글자 인식은 키릴 끝 줄을 라틴 글자로 엉뚱하게 읽는다(두 편의 읽힘이 서로 닮지 않았다)
    const 읽힘 = new Map([
      [영상('LAB_화날때'), ['npu HauanbcTBe -', 'TOJ1bKO npo ce6A!']],
      [영상('LAB_미안'), ['(BoT 6bl eLLe', 'Koфe Ha py6awke 6occa?']],
      [영상('LAB_지마'), ['Komy Tbl ckaxellb']],
      [영상('LAB_물고기'), ['Pbl6a BCe cbena!']],
    ]);
    const 읽은 = [];
    const screen = (files) => { 읽은.push(...files); return new Map(files.map((f) => [f, 읽힘.get(f) || []])); };
    let 무대 = 0;
    const stage = () => { 무대 += 60; return { first: Buffer.alloc(9 * 16 * 3, 무대 % 256), last: Buffer.alloc(9 * 16 * 3, (무대 + 30) % 256) }; };
    const 견주기 = (dir) => { const bundle = 묶음.load(dir); return 반복.repeatFindings(bundle, 묶음.plates(bundle), { list: 반복.episodes([root]), stage, screen, narration: () => [] }); };

    const r = 견주기(편('LAB_화날때'));
    const 끝 = (where) => r.findings.filter((f) => f.where === where && /^ending-/.test(f.code));
    assert.deepEqual(codes(끝('lab-ru-vk')), ['고칠 것:ending-repeat'], '미안 러시아 판과 끝 한마디가 같다');
    assert.match(끝('lab-ru-vk')[0].message, /LAB_미안\(11-19\)/);
    assert.match(끝('lab-ru-vk')[0].message, /「только про себя!」 ~ 「только про себя!」/);
    const 줄 = (name, 판) => r.summary.지난편.find((s) => s.편 === name && s.판.includes(판));
    assert.equal(줄('LAB_미안', 'lab-ru-vk').끝줄, 1);
    assert.equal(줄('LAB_미안', 'lab-ru-vk').끝줄읽기, '판본 글 · 판본 글');
    assert.ok(줄('LAB_지마', 'lab-ru-vk').끝줄 < 반복.LINE_NEAR, '지마(「가지 마 = Не уходи」)와는 다르다');
    // 손으로 단 판은 전처럼 글자 인식 — 같은 영상이어도 엉뚱한 읽힘끼리라 잡히지 않는다(이번 고침 밖)
    assert.deepEqual(codes(끝('lab-ru-rutube')), []);
    assert.equal(줄('LAB_미안', 'lab-ru-rutube').끝줄읽기, '글자 인식 · 글자 인식');
    assert.ok(읽은.includes(영상('LAB_화날때')) && 읽은.includes(영상('LAB_미안')), '손 판이 쓰는 영상은 글자 인식에 넘긴다');

    // 글이 다른 짝 — 지마의 지난 편(물고기)과는 끝 줄이 겹치지 않는다. 손 판이 없는 편의 돌림 판 영상은 글자 인식에 넘기지 않는다
    읽은.length = 0;
    const 지마 = 견주기(편('LAB_지마'));
    assert.deepEqual(codes(지마.findings.filter((f) => /^ending-/.test(f.code))), []);
    assert.deepEqual(지마.summary.지난편.map((s) => [s.편, s.끝줄읽기]), [['LAB_물고기', '판본 글 · 판본 글']]);
    assert.deepEqual(읽은, [], '판본 글로 다 견줬으면 글자 인식을 부르지 않는다');

    // 판본 글이 없는 돌림 판은 전처럼 글자 인식으로 떨어진다(그래서 러시아 짝을 놓친다 — 11-18 실측)
    fs.rmSync(path.join(편('LAB_미안'), '게시', '판본', 'RU', '글.json'));
    const 글없음 = 견주기(편('LAB_화날때'));
    const 미안줄 = 글없음.summary.지난편.find((s) => s.편 === 'LAB_미안' && s.판.includes('lab-ru-vk'));
    assert.equal(미안줄.끝줄읽기, '판본 글 · 글자 인식');
    assert.deepEqual(codes(글없음.findings.filter((f) => f.where === 'lab-ru-vk' && /^ending-/.test(f.code))), []);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('⑯ 돌림 판 끝 줄 「같음」 — 게시결과로 세 갈래(나간 판 막지 않음 · 걸린 판 확인할 것 · 안 건 판 고칠 것), 손 판은 늘 고칠 것, 「돌림」.끝줄되부름 짝은 확인할 것', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), '무대반복-갈래-'));
  fs.mkdirSync(path.join(root, 'tools'), { recursive: true });
  const 편 = (name) => path.join(root, 'docs', '마케팅', name);
  const 편쓰기 = (name, 시각, 줄, { 결과 = null, 되부름 = null } = {}) => {
    const 판본 = path.join(편(name), '게시', '판본', 'RU');
    fs.mkdirSync(판본, { recursive: true });
    fs.writeFileSync(path.join(판본, 'video.mp4'), name);
    fs.writeFileSync(path.join(편(name), '게시', 'hand.mp4'), name);
    fs.writeFileSync(path.join(판본, '글.json'), JSON.stringify({ 꼴: '판본글/1', 편: name, 판본: 'RU', 언어: 'ru', 틀: '이야기', 줄 }));
    // 돌림 판 셋(VK · RUTUBE · 같은 판본을 쓰는 셋째 계정)과 손 판 하나(인스타 — 손 판끼리는 글자 인식 끝 줄로 견준다)
    const 판 = ['lab-ru-vk', 'lab-ru-rutube', 'lab-kz-tiktok'].map((계정) => ({ 계정, 파일: '게시/판본/RU/video.mp4', 시각, 돌림: true }))
      .concat([{ 계정: 'lab-instagram', 파일: 'hand.mp4', 시각 }]);
    fs.writeFileSync(path.join(편(name), '게시', '준비.json'), JSON.stringify({ 브랜드: 'LAB', 슬롯: 시각.slice(0, 10), 판,
      돌림: { 형식: '이야기', 판본: { RU: { 언어: 'ru', 파일: '게시/판본/RU/video.mp4', 글: '게시/판본/RU/글.json' } }, ...(되부름 ? { 끝줄되부름: 되부름 } : {}) } }));
    if (결과) fs.writeFileSync(path.join(편(name), '게시', '게시결과.json'), JSON.stringify({ 판: 결과 }));
  };
  try {
    편쓰기('LAB_미안', '2026-11-20T19:00:00+03:00', 판본줄.미안);
    // 화날때: VK는 게시됨(이미 나감) · RUTUBE는 예약됨(걸림) · 카자흐는 줄 없음(안 건 판) · 인스타 손 판도 게시됨
    편쓰기('LAB_화날때', '2026-11-21T19:00:00+03:00', 판본줄.화날때, { 결과: [
      { 계정: 'lab-ru-vk', 상태: '게시됨' }, { 계정: 'lab-ru-rutube', 상태: '예약됨', 작업: 'a' }, { 계정: 'lab-instagram', 상태: '게시됨' }] });
    const screen = (files) => new Map(files.map((f) => [f, /hand\.mp4$/.test(f) ? ['Секрет: только про себя!'] : []]));
    const stage = (() => { let n = 0; return () => { n += 70; return { first: Buffer.alloc(9 * 16 * 3, n % 256), last: Buffer.alloc(9 * 16 * 3, (n + 35) % 256) }; }; })();
    const 견주기 = () => { const bundle = 묶음.load(편('LAB_화날때')); return 반복.repeatFindings(bundle, 묶음.plates(bundle), { list: 반복.episodes([root]), stage, screen, narration: () => [] }); };

    const r = 견주기();
    const 끝 = r.findings.filter((f) => /^ending-/.test(f.code)).map((f) => `${f.level}:${f.code}@${f.where}`).sort();
    assert.deepEqual(끝, [
      '고칠 것:ending-repeat@lab-instagram', // 손 판은 게시됨이어도 전처럼 고칠 것
      '고칠 것:ending-repeat@lab-kz-tiktok', // 안 건 돌림 판
      '확인할 것:ending-repeat-booked@lab-ru-rutube', // 걸린 돌림 판
    ], '나간 돌림 판(VK)은 막지 않는다');
    assert.match(r.findings.find((f) => f.code === 'ending-repeat' && f.where === 'lab-kz-tiktok').message, /동결.*두 편 이상.*「돌림」\.이미받음.*「돌림」\.끝줄되부름/, '⑯은 지난 두 편을 보니 한 편만 끼워서는 안 풀린다(GA4)');
    assert.match(r.findings.find((f) => f.code === 'ending-repeat' && f.where === 'lab-instagram').message, /준비\.json 「끝줄」에 새 줄/, '손 판은 전처럼 끝줄을 새로 적으라고');

    // 되부르는 짝 — 미안 쪽에 적어도(지난 편) 화날때 쪽에서 보면 확인할 것으로 내린다. 나간 돌림 판은 여전히 안 보인다
    편쓰기('LAB_미안', '2026-11-20T19:00:00+03:00', 판본줄.미안, { 되부름: [{ 편: 'LAB_화날때', 까닭: '해설 딱지 「속으로만!」이 화날때 끝 카드를 되부른다' }] });
    const c = 견주기();
    const 되 = c.findings.filter((f) => /^ending-/.test(f.code)).map((f) => `${f.level}:${f.code}@${f.where}`).sort();
    assert.deepEqual(되, ['고칠 것:ending-repeat@lab-instagram', '확인할 것:ending-callback@lab-kz-tiktok · lab-ru-rutube'], '되부름은 돌림 판에만 — 손 판은 전처럼 고칠 것(GPT 검수 GA1)');
    assert.match(c.findings.find((f) => f.code === 'ending-callback').message, /속으로만!」이 화날때 끝 카드를 되부른다/);
    assert.equal(c.summary.지난편.find((s) => s.판.includes('lab-kz-tiktok')).끝줄되부름, true);
    // 이름이 틀리면 내리지 않는다
    편쓰기('LAB_미안', '2026-11-20T19:00:00+03:00', 판본줄.미안, { 되부름: ['LAB_화날떄'] });
    assert.ok(codes(견주기().findings).includes('고칠 것:ending-repeat'));

    // 「비슷함」(0.45~0.6)도 나간 돌림 판에는 안 낸다 — 러시아 미안 끝 질문 ~ 지마 끝 질문 0.53
    편쓰기('LAB_지마', '2026-11-19T19:00:00+03:00', 판본줄.지마);
    편쓰기('LAB_미안', '2026-11-20T19:00:00+03:00', 판본줄.미안, { 결과: [{ 계정: 'lab-ru-vk', 상태: '게시됨' }] });
    const 미안 = 묶음.load(편('LAB_미안'));
    const m = 반복.repeatFindings(미안, 묶음.plates(미안), { list: 반복.episodes([root]), stage, screen, narration: () => [] });
    assert.deepEqual(m.findings.filter((f) => f.code === 'ending-similar').map((f) => f.where), ['lab-ru-rutube · lab-kz-tiktok']);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
