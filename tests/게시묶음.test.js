/* 게시묶음 — 운영 사본·세션 워크트리에서 읽어도 git 밖 영상은 공용 작업본에서 찾는다(2026-10-22).
 * 임시 폴더에 공용 작업본(.git 폴더)과 연결 워크트리(.git 파일 → worktrees/<이름> → commondir) 모양만 만든다. git은 부르지 않는다. */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const 묶음 = require('../tools/lib/게시묶음.js');

function 쓰기(파일, 내용) {
  fs.mkdirSync(path.dirname(파일), { recursive: true });
  fs.writeFileSync(파일, 내용);
}

function 판(t) {
  const 뿌리 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-bundle-test-'));
  t.after(() => fs.rmSync(뿌리, { recursive: true, force: true }));
  const 공용 = path.join(뿌리, '공용');
  const 운영 = path.join(뿌리, '운영');
  const 영상 = 'docs/마케팅/편1/remotion/out/v.mp4';
  const 준비 = JSON.stringify({ 브랜드: 'lab', 판: [{ 계정: 'lab-youtube', 시각: '2026-10-23T10:00:00+09:00', 파일: 영상 }] });
  for (const 곳 of [공용, 운영]) {
    fs.mkdirSync(path.join(곳, 'tools'), { recursive: true });
    쓰기(path.join(곳, 'docs/마케팅/편1/게시/준비.json'), 준비);
  }
  fs.mkdirSync(path.join(공용, '.git', 'worktrees', '운영'), { recursive: true });
  fs.writeFileSync(path.join(공용, '.git', 'worktrees', '운영', 'commondir'), '../..\n');
  fs.writeFileSync(path.join(운영, '.git'), `gitdir: ${path.join(공용, '.git', 'worktrees', '운영')}\n`);
  쓰기(path.join(공용, 영상), '공용 작업본에서 렌더한 영상');
  return { 공용, 운영, 영상 };
}

test('운영 사본에서 읽으면 git 밖 영상은 공용 작업본에서 찾고, 검사 기록 열쇠(저장소 기준 경로)는 같은 글이다', (t) => {
  const p = 판(t);
  const bundle = 묶음.load(path.join(p.운영, 'docs/마케팅/편1'));
  assert.equal(bundle.repo, p.운영);
  assert.equal(bundle.mediaRoot, p.공용);
  const [plate] = 묶음.plates(bundle);
  assert.equal(plate.platform, 'youtube');
  assert.equal(plate.video.exists, true);
  assert.equal(plate.video.path, path.join(p.공용, p.영상));
  assert.equal(묶음.rel(bundle, plate.video.path), p.영상);
  // 이 작업본에도 있으면 이 작업본 것이 먼저다
  쓰기(path.join(p.운영, p.영상), '운영 사본에 있는 영상');
  const [again] = 묶음.plates(묶음.load(path.join(p.운영, 'docs/마케팅/편1')));
  assert.equal(again.video.path, path.join(p.운영, p.영상));
  assert.equal(묶음.rel(bundle, again.video.path), p.영상);
});

test('공용 작업본에서 읽으면 mediaRoot가 없고 경로 셈은 그대로다', (t) => {
  const p = 판(t);
  const bundle = 묶음.load(path.join(p.공용, 'docs/마케팅/편1'));
  assert.equal(bundle.mediaRoot, undefined);
  const [plate] = 묶음.plates(bundle);
  assert.equal(plate.video.path, path.join(p.공용, p.영상));
  assert.equal(묶음.rel(bundle, plate.video.path), p.영상);
  assert.equal(묶음.resolve(bundle, 'docs/마케팅/편1/없는.mp4'), path.join(p.공용, 'docs/마케팅/편1/없는.mp4'), '없으면 첫 후보(이 작업본)');
});
