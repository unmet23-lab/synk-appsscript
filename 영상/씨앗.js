/**
 * 「이 영상은 무엇으로 구웠나」 — **편별 씨앗**. 공용 소스의 내용 해시 + 그 편의 데이터 해시.
 *
 * 🔴 왜 파일 시각이 아니라 내용인가: 시각으로 재면 내용이 하나도 안 바뀌어도 빨개진다 —
 *   되돌린 편집, 체크아웃, A/B 로 잠깐 뒤집었다 원복(08-26 실측: 로고 두 판을 대조하느라
 *   `연출.tsx` 를 뒤집었다 되돌렸더니 영상 12편 전량이 «낡음»으로 찍혔는데 `git status` 는 깨끗했다).
 *   이 저장소가 이미 배운 자리다: 로고주입 `--check` 가 CRLF/LF 때문에 늘 빨간불이었고
 *   「**늘 실패하는 가드는 신호로서 죽는다**」로 고쳤다(결정.md 08-22).
 *
 * 🔴 왜 «편별»인가(09-02 · 트랙 §2-영상 「한 화 고치면 90클립 낡음」):
 *   첫 판(v1)은 `src/**` 전량 한 덩어리의 해시였다. 그런데 `src/클립/생성/대본클립들.ts` 는 90클립의
 *   데이터가 **한 파일**이라, 대본 한 화의 글자 하나를 고치면 그 파일이 바뀌고 → 전량 해시가 바뀌고 →
 *   **손도 안 댄 89클립이 「낡음」으로 빨개졌다.** 낡음 판정이 편 단위가 아니라 파일 단위였던 것이다.
 *   ⇒ 씨앗을 둘로 가른다: ① **공용 해시** = 그림을 만드는 코드(`src/**` 에서 `생성/` 을 뺀 것 +
 *   `remotion.config.ts` + `docs/디자인_토큰.json`) ② **편 해시** = 그 편의 데이터 기록 하나(JSON).
 *   한 화를 고치면 그 화의 클립(가이드 벌 + 표지)만 바뀌고, 다른 편은 한 글자도 안 움직인다.
 *   코드를 고치면(연출·조판·킷) 전량이 바뀐다 — 그건 실제로 전량이 낡은 것이니 맞다.
 *
 * 🔴 왜 «파일 하나»인가: 처음에 이 함수를 굽기.js 와 프레임뽑기.js 에 **복제**했더니
 *   이음쇠 한 글자가 갈렸다(한쪽 공백, 한쪽 NUL). 두 해시가 늘 달라서 가드가 100% 거짓 빨간불이었다.
 *   같은 판정을 두 곳에서 «따로» 계산하면 언젠가 갈린다 — 그래서 계산은 여기 한 번만 산다.
 *
 * 🔑 줄끝을 고른다(CRLF→LF) — git 이 Windows 체크아웃에서 줄끝을 바꿔 내려주므로, 안 고르면
 *   같은 소스가 기계마다 다른 씨앗을 낸다(대본읽기.js 가 md 에서 겪은 그 무늬).
 *
 * 쪽지 꼴: `v2 <sha256>` — 판을 앞에 적는다. 옛 쪽지(맨 64자리 = v1 전량 해시)는 편 단위로 «못 재는» 것이지
 *   «낡은» 것이 아니다 — 프레임뽑기가 그 둘을 갈라 말한다.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const 판 = 'v2';

/** 테스트가 가짜 방을 넣을 수 있게 만든다 — 기본은 이 파일이 있는 `영상/`. */
function 만들기(방 = __dirname) {
  const 저장소 = path.resolve(방, '..');
  const 씨앗방 = path.join(방, 'src');
  const 생성방 = path.join(씨앗방, '클립', '생성');
  /** 그림을 정하는데 `src/` 밖에 사는 것 — 색·서체 값과 렌더 설정. */
  const 공용파일들 = [path.join(방, 'remotion.config.ts'), path.join(저장소, 'docs', '디자인_토큰.json')];

  const 줄끝고르기 = (t) => t.replace(/\r\n?/g, '\n');
  const sha = (글) => crypto.createHash('sha256').update(글).digest('hex');
  const 상대 = (p) => path.relative(방, p).replace(/\\/g, '/');

  /** `src/**`(생성/ 제외) + 공용파일들을 이름순으로 훑어 «경로 + 내용»을 이어 붙인 sha256. */
  function 공용해시() {
    const 조각 = [];
    (function 훑기(뿌리) {
      if (!fs.existsSync(뿌리)) return;
      const 것들 = fs
        .readdirSync(뿌리, { withFileTypes: true })
        .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
      for (const e of 것들) {
        const p = path.join(뿌리, e.name);
        if (e.isDirectory()) {
          if (p === 생성방) continue; /* 편 데이터는 편 해시가 진다 — 여기 넣으면 v1 로 되돌아간다 */
          훑기(p);
        } else 조각.push(상대(p) + '\n' + 줄끝고르기(fs.readFileSync(p, 'utf8')));
      }
    })(씨앗방);
    for (const p of 공용파일들) {
      if (fs.existsSync(p)) 조각.push(상대(p) + '\n' + 줄끝고르기(fs.readFileSync(p, 'utf8')));
    }
    return sha(조각.join('\n----\n'));
  }

  function 목록읽기(파일) {
    const p = path.join(생성방, 파일);
    if (!fs.existsSync(p)) return [];
    const m = 줄끝고르기(fs.readFileSync(p, 'utf8')).match(/= (\[[\s\S]*\]);/);
    return m ? JSON.parse(m[1]) : [];
  }

  /**
   * 컴포지션 id 의 «데이터 기록» — 그 편의 JSON 하나. 표지(`-cover`)는 본편과 같은 기록을 본다.
   * 기록이 없는 id(logo-check · font-check-*)는 코드만으로 서므로 빈 문자열이다.
   */
  function 편기록(id) {
    if (!id) return '';
    const 본편id = id.replace(/-cover$/, '');
    const 기록 =
      목록읽기('대본클립들.ts').find((c) => c.id === 본편id) ||
      목록읽기('카운트다운들.ts').find((c) => c.id === 본편id) ||
      null;
    return 기록 ? JSON.stringify(기록) : '';
  }

  /** 편별 씨앗 = sha256(판 + 공용해시 + 편기록). 같은 입력이면 같은 값, 다른 편은 서로 무관하다. */
  function 씨앗해시(id) {
    return sha(`${판}\n${공용해시()}\n${편기록(id)}`);
  }

  /** 영상 옆에 적어 두는 자리. `out/clip-01-1.mp4` → `out/clip-01-1.mp4.씨앗` */
  const 씨앗파일 = (영상경로) => `${영상경로}.씨앗`;

  /** 쪽지에 적을 글 — `v2 <해시>`. */
  const 씨앗쪽지 = (id) => `${판} ${씨앗해시(id)}\n`;

  /** 쪽지를 읽어 «판»과 «해시»로 가른다. v1(맨 64자리)은 판 'v1' 로 돌려준다. */
  function 씨앗읽기(글) {
    const t = String(글 || '').trim();
    let m = t.match(/^(v\d+) ([0-9a-f]{64})$/);
    if (m) return { 판: m[1], 해시: m[2] };
    m = t.match(/^([0-9a-f]{64})$/);
    if (m) return { 판: 'v1', 해시: m[1] };
    return { 판: null, 해시: null };
  }

  return { 판, 공용해시, 편기록, 씨앗해시, 씨앗파일, 씨앗쪽지, 씨앗읽기 };
}

module.exports = { ...만들기(), 만들기 };
