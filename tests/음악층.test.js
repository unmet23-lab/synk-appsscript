'use strict';

// ⑲ 배경음 층(tools/lib/음악층관문.js · tools/음악층.js) — 렌더 없이 판정만 본다. 칸 줄은 11-08 LAB 두 편을 음악만 렌더해 잰 실측이다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const 관문 = require('../tools/lib/음악층관문.js');
const 도구 = require('../tools/음악층.js');

// 춥다차갑다(11-08 21:00) 음악만 — 4초 얼음 · 10.5초 찬바람에 일부러 낮춤, 12.5초에 0.5초 돌아온 뒤 13~14초 곡(밝은_052 16초부터) 빈 마디, 17초 끝 얼음
const 춥다 = [-49, -34, -37, -33, -38, -39, -33, -35, -33, -37, -38, -33, -36, -33, -37, -37, -47, -50, -49, -53, -53, -48, -39, -33, -38, -37, -33, -34, -33, -40, -37, -33, -35, -33, -38, -35, -33, -36, -33, -41, -36, -34, -48, -45, -55, -48, -46, -48, -45, -48, -39, -33, -44, -43, -50, -46, -32, -34, -34, -34, -38, -32, -37, -33, -34, -33, -33, -35, -45, -49, -53, -43, -39, -35, -33, -36, -33, -42];
// 잘하고있어(11-08 21:00) 음악만 — 첫 3초는 초침뿐(음악 없음), 6~8초 첫 장에서 낮춤 + 합성 피아노가 듬성한 마디
const 잘하고 = [-180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -54, -42, -38, -28, -26, -25, -26, -24, -26, -32, -33, -27, -36, -41, -29, -27, -32, -38, -32, -36, -31, -33, -29, -30, -34, -27, -28, -33, -38, -22, -26, -31, -28, -25, -26, -26, -23, -24, -29, -34, -24, -30, -34, -23, -22, -26, -31, -22, -24, -20, -22, -20, -25, -30, -26, -27, -32, -37, -22, -27, -36];

test('꺼짐찾기: 유호님이 들은 자리를 다 잡는다 — 잠깐 돌아왔다 곡 빈 마디로 다시 꺼진 3.5초는 한 자리로', () => {
  assert.deepEqual(관문.꺼짐찾기(춥다).map((z) => `${z.시작}~${z.끝}`), ['4~5.5', '10.5~14', '17~17.75']);
  assert.deepEqual(관문.꺼짐찾기(잘하고).map((z) => `${z.시작}~${z.끝}`), ['0.5~3.75', '6~8']);
  assert.equal(관문.꺼짐찾기(잘하고)[0].깊이, 99, '소리가 아예 없으면 99');
});

test('꺼짐찾기: 얕게만 낮은 곡의 조용한 마디 · 0.75초보다 짧은 꺼짐 · 처음과 끝은 꺼짐이 아니다', () => {
  const 고른 = Array(40).fill(-20);
  const 얕은 = 고른.map((v, i) => (i >= 10 && i < 20 ? -28 : v)); // 2.5초 동안 8dB — 10dB 넘게 꺼진 칸이 없다
  assert.deepEqual(관문.꺼짐찾기(얕은), []);
  const 짧은 = 고른.map((v, i) => (i === 10 || i === 11 ? -40 : v)); // 0.5초
  assert.deepEqual(관문.꺼짐찾기(짧은), []);
  const 끝 = 고른.map((v, i) => (i >= 37 ? -60 : v)); // 끝 0.75초 페이드
  assert.deepEqual(관문.꺼짐찾기(끝), []);
});

test('재기: 음악 가운데 · 전체 가운데 · 바닥차를 남긴다', () => {
  const r = 관문.재기(춥다, 춥다.map((v) => v + 13));
  assert.equal(r.바닥차, 13);
  assert.equal(r.꺼짐.length, 3);
  assert.equal(r.길이, 춥다.length * 0.25);
});

function 편(name, prep, 음악층, { bgm = true } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), '음악층시험-'));
  const 편폴더 = path.join(dir, name);
  fs.mkdirSync(path.join(편폴더, '게시'), { recursive: true });
  if (bgm) { fs.mkdirSync(path.join(편폴더, 'remotion', 'public', 'sfx'), { recursive: true }); fs.writeFileSync(path.join(편폴더, 'remotion', 'public', 'sfx', 'bgm.wav'), ''); }
  if (음악층) fs.writeFileSync(path.join(편폴더, '게시', '음악층.json'), JSON.stringify(음악층));
  return { bundle: { dir: 편폴더, name, prep }, 지우기: () => fs.rmSync(dir, { recursive: true, force: true }) };
}
const 레벨 = (fs_) => fs_.map((f) => `${f.level}:${f.code}`);

test('⑲ 판정: 11-09부터 만든 편은 잰 기록이 있어야 하고, 꺼짐은 판단이 없으면 고칠 것 · 있으면 확인할 것', () => {
  const 꺼짐 = { 만든때: new Date(Date.now() + 60_000).toISOString(), 꺼짐: [{ 시작: 13, 끝: 14, 깊이: 15 }], 낮음: [], 바닥차: 4 };
  const cases = [
    [편('LAB_새편_20261109', {}, null), ['고칠 것:music-layer-missing']],
    [편('LAB_옛편_20261107', {}, null), []],
    [편('LAB_못함_20261109', { 음악층못함: '진행자 편 — 음악을 ffmpeg로 깜' }, null), ['확인할 것:music-layer-skipped']],
    [편('LAB_꺼짐_20261109', {}, 꺼짐), ['고칠 것:music-layer-drop']],
    [편('LAB_판단_20261109', { 음악꺼짐판단: '얼음 0.5초 — 바람 소리 바닥 깔림' }, 꺼짐), ['확인할 것:music-layer-drop']],
    [편('LAB_바닥_20261109', {}, { ...꺼짐, 꺼짐: [], 바닥차: 13 }), ['확인할 것:music-layer-low']],
    [편('LAB_음악없음_20261109', {}, null, { bgm: false }), []],
  ];
  try {
    for (const [c, 기대] of cases) assert.deepEqual(레벨(관문.musicLayerFindings(c.bundle, [])), 기대, c.bundle.name);
  } finally { for (const [c] of cases) c.지우기(); }
});

test('⑲ 판정: 잰 뒤 영상이 바뀌면 다시 재라고 한다', () => {
  const c = 편('LAB_늦은편_20261109', {}, { 만든때: '2026-11-08T00:00:00Z', 꺼짐: [], 낮음: [], 바닥차: 3 });
  try {
    const 영상 = path.join(c.bundle.dir, '게시', 'video.mp4');
    fs.writeFileSync(영상, 'x');
    assert.deepEqual(레벨(관문.musicLayerFindings(c.bundle, [영상])), ['고칠 것:music-layer-stale']);
    assert.deepEqual(레벨(관문.musicLayerFindings(c.bundle, [])), []);
  } finally { c.지우기(); }
});

test('음악층 도구: 인자 · 첫 컴포지션(scene 뺌)', () => {
  assert.deepEqual(도구.인자(['--편', 'x', '--comp', 'e31-en', '--남김']), { 편: 'x', comp: 'e31-en', 남김: true, json: false });
  assert.throws(() => 도구.인자([]), /사용/);
  assert.throws(() => 도구.인자(['--편', 'x', '--모름']), /모르는 인자/);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), '음악층root-'));
  try {
    const root = path.join(dir, 'Root.tsx');
    fs.writeFileSync(root, '<Composition id="m33-scene" /><Composition id="m33" />');
    assert.equal(도구.첫컴포지션(root), 'm33');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
