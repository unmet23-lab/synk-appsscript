'use strict';
/**
 * 공용 작업본(메인) 뿌리 — 코드가 운영 사본(tools/운영사본.js)이나 세션 워크트리에서 돌아도 데이터 대상(백업할 작업본, git 밖 미디어,
 * 앱 예약 작업이 편을 만드는 docs/마케팅, 헤르메스 작업 기록의 repo_root)은 메인 작업본이다(2026-10-22).
 * 공용 git 폴더(…/.git)의 부모를 준다. git을 부르지 않고 .git 파일과 commondir만 읽는다. 저장소가 아니거나 모양이 다르면 받은 폴더 그대로.
 *
 *   const { 공용작업본 } = require('./lib/공용작업본.js');
 *   const ROOT = 공용작업본(path.resolve(__dirname, '..'));
 */
const fs = require('fs');
const path = require('path');

function 공용작업본(뿌리) {
  const 시작 = path.resolve(뿌리);
  let st;
  try { st = fs.statSync(path.join(시작, '.git')); } catch { return 시작; }
  if (st.isDirectory()) return 시작;
  try {
    const m = /^gitdir:\s*(.+?)\s*$/m.exec(fs.readFileSync(path.join(시작, '.git'), 'utf8'));
    if (!m) return 시작;
    const 작업gitdir = path.resolve(시작, m[1]);
    let 공용 = 작업gitdir;
    try { 공용 = path.resolve(작업gitdir, fs.readFileSync(path.join(작업gitdir, 'commondir'), 'utf8').trim()); } catch {}
    const 메인 = path.dirname(공용);
    return path.basename(공용).toLowerCase() === '.git' && fs.existsSync(메인) ? 메인 : 시작;
  } catch { return 시작; }
}

/**
 * 미디어경로(p) — p가 이 작업본에 없으면 공용 작업본의 같은 경로를 준다(둘 다 없으면 p 그대로).
 * 예약 회차 · 세션 워크트리에는 git 밖 영상(게시/…/video.mp4 · remotion/out)이 없어 공용 작업본에서 읽는다(docs/_ops/예약작업_작업자리.md 「시작」 4).
 * 게시 장부 · 돌림표 · 올리기 전 검사가 판 파일 · 판본 영상을 찾을 때 쓴다(11-10).
 */
function 미디어경로(p) {
  const abs = path.resolve(p);
  if (fs.existsSync(abs)) return abs;
  for (let d = path.dirname(abs); ; d = path.dirname(d)) {
    if (fs.existsSync(path.join(d, '.git'))) {
      const main = 공용작업본(d);
      if (path.resolve(main) !== path.resolve(d)) { const alt = path.join(main, path.relative(d, abs)); if (fs.existsSync(alt)) return alt; }
      return abs;
    }
    if (path.dirname(d) === d) return abs;
  }
}

module.exports = { 공용작업본, 미디어경로 };
