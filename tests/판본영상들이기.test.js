'use strict';
// 판본 영상 들이기(tools/판본영상들이기.js) — 회차 사본에 공용 작업본의 git 밖 판본 영상 · 표지를 복사한다(덮지 않는다 · 지우지 않는다).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { 들이기 } = require('../tools/판본영상들이기.js');

const TOOL = path.join(__dirname, '..', 'tools', '판본영상들이기.js');
const PIECE = path.join('docs', '마케팅', 'LAB_가_mn_20261031');

function 자리() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), '판본영상-'));
  const 공용 = path.join(base, '공용');
  const 사본 = path.join(base, '사본');
  const put = (root, rel, text, mtime) => {
    const f = path.join(root, PIECE, '게시', '판본', rel);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, text);
    if (mtime) fs.utimesSync(f, mtime, mtime);
    return f;
  };
  fs.mkdirSync(path.join(사본, PIECE), { recursive: true });
  return { base, 공용, 사본, put };
}

test('공용 작업본의 판본 영상 · 표지를 사본의 같은 자리로 — 수정 시각은 원본대로', () => {
  const { base, 공용, 사본, put } = 자리();
  try {
    const when = new Date('2026-11-12T03:04:05Z');
    put(공용, 'US/video.mp4', '미국 영상', when);
    put(공용, 'US/cover.png', '미국 표지', when);
    put(공용, 'MN/video.mp4', '몽골 영상', when);
    put(공용, 'US/글.json', '{"git":"안"}');
    put(공용, 'US/낯선파일.mov', '들이지 않는 것');
    put(공용, '_임시/video.mp4', '키 꼴이 아닌 폴더');
    const r = 들이기(사본, 공용, PIECE);
    assert.equal(r.편, 'docs/마케팅/LAB_가_mn_20261031');
    assert.deepEqual(r.들임, ['MN/video.mp4', 'US/video.mp4', 'US/cover.png']);
    assert.equal(r.있음, 0);
    assert.equal(r.바이트, Buffer.byteLength('미국 영상') + Buffer.byteLength('미국 표지') + Buffer.byteLength('몽골 영상'));
    const got = path.join(사본, PIECE, '게시', '판본', 'US', 'video.mp4');
    assert.equal(fs.readFileSync(got, 'utf8'), '미국 영상');
    assert.equal(fs.statSync(got).mtime.toISOString(), when.toISOString());
    assert.ok(!fs.existsSync(path.join(사본, PIECE, '게시', '판본', 'US', '글.json')));
    assert.ok(!fs.existsSync(path.join(사본, PIECE, '게시', '판본', 'US', '낯선파일.mov')));
    assert.ok(!fs.existsSync(path.join(사본, PIECE, '게시', '판본', '_임시')));
    assert.ok(!fs.readdirSync(path.join(사본, PIECE, '게시', '판본', 'US')).some((f) => f.endsWith('.들이는중')));
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
});

test('사본에 이미 있는 파일은 덮지 않는다 — 이 회차가 방금 구운 판일 수 있다', () => {
  const { base, 공용, 사본, put } = 자리();
  try {
    put(공용, 'BR/video.mp4', '공용의 옛 판');
    put(공용, 'BR/cover.png', '공용 표지');
    put(사본, 'BR/video.mp4', '사본에서 방금 구운 판');
    const r = 들이기(사본, 공용, PIECE);
    assert.deepEqual(r.들임, ['BR/cover.png']);
    assert.equal(r.있음, 1);
    assert.equal(fs.readFileSync(path.join(사본, PIECE, '게시', '판본', 'BR', 'video.mp4'), 'utf8'), '사본에서 방금 구운 판');
    assert.equal(fs.readFileSync(path.join(공용, PIECE, '게시', '판본', 'BR', 'video.mp4'), 'utf8'), '공용의 옛 판');
    const again = 들이기(사본, 공용, PIECE);
    assert.deepEqual(again.들임, []);
    assert.equal(again.있음, 2);
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
});

test('공용 작업본에서 부르면 · 공용에 판본 폴더가 없으면 들이지 않고 까닭을 준다, 사본 밖 폴더는 거절', () => {
  const { base, 공용, 사본, put } = 자리();
  try {
    put(공용, 'US/video.mp4', '영상');
    assert.equal(들이기(공용, 공용, PIECE).까닭, '공용 작업본이라 들일 것이 없다');
    assert.equal(들이기(사본, 공용, path.join('docs', '마케팅', 'LAB_없는편_mn_20261101')).까닭, '공용 작업본에 그 편의 판본 폴더가 없다');
    assert.throws(() => 들이기(사본, 공용, path.join('..', '공용', PIECE)), /이 사본 안의 편 폴더가 아니다/);
    assert.throws(() => 들이기(사본, 공용, '.'), /이 사본 안의 편 폴더가 아니다/);
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
});

test('명령줄 — 편 여럿 · --json · 인자 없으면 종료 2', () => {
  const { base, 공용, 사본, put } = 자리();
  try {
    put(공용, 'US/video.mp4', '영상');
    const run = (...args) => spawnSync(process.execPath, [TOOL, ...args, '--저장소', 사본, '--공용', 공용], { encoding: 'utf8' });
    const text = run(PIECE, path.join('docs', '마케팅', 'LAB_없는편_mn_20261101'));
    assert.equal(text.status, 0, text.stderr);
    assert.match(text.stdout, /LAB_가_mn_20261031: 들임 1\(0\.0MB\) · 이미 있음 0 — US/);
    assert.match(text.stdout, /LAB_없는편_mn_20261101: 공용 작업본에 그 편의 판본 폴더가 없다/);
    const json = run(PIECE, '--json');
    assert.equal(json.status, 0, json.stderr);
    const parsed = JSON.parse(json.stdout);
    assert.equal(parsed.편[0].있음, 1);
    assert.deepEqual(parsed.편[0].들임, []);
    assert.equal(run().status, 2);
    assert.equal(run(path.join('..', '바깥')).status, 2);
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
});
