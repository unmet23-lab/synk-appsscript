/**
 * 「이 영상은 무엇으로 구웠나」 — `영상/src/**` 전량의 **내용** 해시.
 *
 * 🔴 왜 파일 시각이 아니라 내용인가: 시각으로 재면 내용이 하나도 안 바뀌어도 빨개진다 —
 *   되돌린 편집, 체크아웃, A/B 로 잠깐 뒤집었다 원복(08-26 실측: 로고 두 판을 대조하느라
 *   `연출.tsx` 를 뒤집었다 되돌렸더니 영상 12편 전량이 «낡음»으로 찍혔는데 `git status` 는 깨끗했다).
 *   이 저장소가 이미 배운 자리다: 로고주입 `--check` 가 CRLF/LF 때문에 늘 빨간불이었고
 *   「**늘 실패하는 가드는 신호로서 죽는다**」로 고쳤다(결정.md 08-22).
 *
 * 🔴 왜 «파일 하나»인가: 처음에 이 함수를 굽기.js 와 프레임뽑기.js 에 **복제**했더니
 *   이음쇠 한 글자가 갈렸다(한쪽 공백, 한쪽 NUL). 두 해시가 늘 달라서 가드가 100% 거짓 빨간불이었다.
 *   같은 판정을 두 곳에서 «따로» 계산하면 언젠가 갈린다 — 이 저장소가 마스코트 10벌로 앓은 병의
 *   가장 작은 판이다. 그래서 계산은 여기 한 번만 산다.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const 방 = __dirname;
const 씨앗방 = path.join(방, 'src');

/** `src/**` 를 이름순으로 훑어 «경로 + 내용»을 이어 붙인 sha256. */
function 씨앗해시() {
  const 조각 = [];
  (function 훑기(뿌리) {
    const 것들 = fs
      .readdirSync(뿌리, { withFileTypes: true })
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const e of 것들) {
      const p = path.join(뿌리, e.name);
      if (e.isDirectory()) 훑기(p);
      else 조각.push(path.relative(방, p).replace(/\\/g, '/') + '\n' + fs.readFileSync(p, 'utf8'));
    }
  })(씨앗방);
  return crypto.createHash('sha256').update(조각.join('\n----\n')).digest('hex');
}

/** 영상 옆에 적어 두는 자리. `out/clip-01-1.mp4` → `out/clip-01-1.mp4.씨앗` */
const 씨앗파일 = (영상경로) => `${영상경로}.씨앗`;

module.exports = { 씨앗해시, 씨앗파일 };
