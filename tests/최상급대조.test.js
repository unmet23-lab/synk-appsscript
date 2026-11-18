'use strict';
// 최상급 대조(tools/최상급대조.py · 2026-11-18 유호님 「최상급과 겨룰만한지 검수도 추가하자」) — 판 · 적기 · 보기가 정답과 맞춰 통과를 가른다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const 도구 = path.join(__dirname, '..', 'tools', '최상급대조.py');
const 그림됨 = spawnSync('python', ['-I', '-X', 'utf8', '-c', 'import PIL'], { encoding: 'utf8' }).status === 0;
const ffmpeg = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' }).status === 0;
const 건너뜀 = { skip: !(그림됨 && ffmpeg) && '파이썬 PIL · ffmpeg 없음' };
const 돌리기 = (...args) => spawnSync('python', ['-I', '-X', 'utf8', 도구, ...args], { encoding: 'utf8' });

function 재료() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), '최상급-'));
  const 편 = path.join(d, '편_20261119'); fs.mkdirSync(편);
  spawnSync('python', ['-I', '-X', 'utf8', '-c', `
from PIL import Image
import sys
for n, c in [("우리1", (200, 120, 90)), ("기준1", (40, 60, 90)), ("기준2", (220, 220, 210)), ("기준3", (90, 160, 90))]:
    Image.new("RGB", (360, 640), c).save(sys.argv[1] + "/" + n + ".png")
`, d]);
  spawnSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc=size=320x180:rate=12', '-t', '2', '-pix_fmt', 'yuv420p', path.join(d, '최종.mp4'), '-y']);
  return { d, 편, f: (n) => path.join(d, n) };
}

test('판 — 우리 영상 + 기준 둘이면 판 셋 · 질문 · 카본 작업 · 정답이 생기고, 정답의 우리만 우리다', 건너뜀, () => {
  const { 편, f } = 재료(); const 밖 = path.join(편, '검수', '최상급_가');
  const r = 돌리기('판', 편, '--우리', f('최종.mp4'), '--기준', f('기준1.png'), f('기준2.png'), '--씨', '3', '--출력', 밖);
  assert.equal(r.status, 0, r.stderr);
  for (const x of ['판_A.jpg', '판_B.jpg', '판_C.jpg', '질문.md', '카본작업.json', '정답.json']) assert.ok(fs.existsSync(path.join(밖, x)), `${x}가 없다`);
  const 정답 = JSON.parse(fs.readFileSync(path.join(밖, '정답.json'), 'utf8'));
  assert.deepEqual(Object.values(정답.판).map((x) => x.누구).sort(), ['기준1', '기준2', '우리']);
  const 질문 = fs.readFileSync(path.join(밖, '질문.md'), 'utf8');
  assert.match(질문, /순위: 비싸=/); assert.doesNotMatch(질문, /우리|기준1|최종\.mp4/, '질문에 어느 판이 우리인지 새면 안 된다');
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(밖, '카본작업.json'), 'utf8')).files, ['판_A.jpg', '판_B.jpg', '판_C.jpg']);
});

test('판 — 기준이 하나뿐이거나 판이 넷을 넘으면 만들지 않는다', 건너뜀, () => {
  const { 편, f } = 재료();
  assert.equal(돌리기('판', 편, '--우리', f('우리1.png'), '--기준', f('기준1.png')).status, 3);
  const 넷넘음 = 돌리기('판', 편, '--우리', f('우리1.png'), '--기준', f('기준1.png'), f('기준2.png'), f('기준3.png'), f('최종.mp4'));
  assert.equal(넷넘음.status, 3); assert.match(넷넘음.stderr, /판은 4장까지/);
});

test('적기 · 보기 — 꼴찌거나 우리만 AI로 꼽히면 못 넘고, 눈 둘이 모두 넘어야 회차 통과, 보기는 최종본 해시로 회차를 찾는다', 건너뜀, () => {
  const { 편, f } = 재료(); const 밖 = path.join(편, '검수', '최상급_나');
  assert.equal(돌리기('판', 편, '--우리', f('최종.mp4'), '--기준', f('기준1.png'), f('기준2.png'), '--출력', 밖).status, 0);
  const 정답 = JSON.parse(fs.readFileSync(path.join(밖, '정답.json'), 'utf8'));
  const 우리 = Object.keys(정답.판).find((k) => 정답.판[k].누구 === '우리'); const 남 = Object.keys(정답.판).filter((k) => k !== 우리);
  // 눈 하나: 우리 2등 · AI 없음 — 답 파일 끝 줄을 읽는다
  fs.writeFileSync(path.join(밖, '답_카본.md'), `1. 까닭…\n순위: 비싸=${남[0]},${우리},${남[1]}; 다시=${우리},${남[0]},${남[1]}; AI=없음\n`);
  assert.equal(돌리기('적기', 밖, '--누가', '카본', '--답', path.join(밖, '답_카본.md')).status, 0);
  assert.equal(돌리기('보기', 편, '--최종', f('최종.mp4')).status, 1, '눈 하나로는 회차 통과가 아니다');
  // 눈 둘: 우리만 AI로 꼽힘 → 못 넘음
  const 못 = 돌리기('적기', 밖, '--누가', '오퍼스', '--비싸', `${우리},${남[0]},${남[1]}`, '--다시', `${남[0]},${우리},${남[1]}`, '--AI', 우리);
  assert.equal(못.status, 1); assert.match(못.stdout, /우리 판만 AI · CG로 꼽힘/);
  assert.equal(돌리기('보기', 편, '--최종', f('최종.mp4')).status, 1);
  // 같은 눈이 다시 답하면 덮는다 — 꼴찌 아님 · 남도 AI로 꼽힘 → 통과
  assert.equal(돌리기('적기', 밖, '--누가', '오퍼스', '--비싸', `${남[0]},${우리},${남[1]}`, '--다시', `${남[1]},${우리},${남[0]}`, '--AI', `${우리},${남[0]}`).status, 0);
  assert.equal(돌리기('보기', 편, '--최종', f('최종.mp4')).status, 0);
  assert.equal(돌리기('보기', 편, '--최종', f('우리1.png')).status, 2, '다른 파일로 만든 회차는 없다');
  // 순서가 판을 다 세우지 않으면 적지 않는다
  assert.equal(돌리기('적기', 밖, '--누가', '셋째', '--비싸', `${우리},${남[0]}`, '--다시', `${우리},${남[0]},${남[1]}`, '--AI', '없음').status, 3);
  // 꼴찌
  const 꼴 = 돌리기('적기', 밖, '--누가', '넷째', '--비싸', `${남[0]},${남[1]},${우리}`, '--다시', `${우리},${남[0]},${남[1]}`, '--AI', '없음');
  assert.equal(꼴.status, 1); assert.match(꼴.stdout, /비싸 보이는 순서 꼴찌\(3\/3\)/);
});
