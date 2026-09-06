#!/usr/bin/env node
/* 라디오배경굽기 — 24시간 라디오의 «장르별 정지 화면»을 굽는다. (유호 확정 2026-09-02)
 *
 * ■ 왜 «정지 화면»이 화면의 전부인가 — 송출이 `-c copy` 라서다.
 *   팩을 사전 인코딩해 재인코딩 0 으로 미는 구조(설계 §7-7)에서는 방송 중에 그림을 합성할 수 없다.
 *   그런데 유호님 지시(「한 장르 쭉 … 장르마다 마스코트를 변경」)는 그 제약 «안에서» 정확히 풀린다:
 *   **곡마다 배경이 이미 박혀 있으므로**, 장르별 배경으로 인코딩해 두면 블록이 넘어갈 때
 *   화면이 저절로 바뀐다. CPU 0 을 지키면서 DJ 가 교대한다.
 *   (talk `bots/송출/인코딩.sh` 가 곡 이름 꼬리 `-<장르>-air` 를 읽어 `<배경폴더>/<장르>.png` 를 고른다.)
 *
 * ■ 이 파일은 «합성»만 한다 — 무대는 `tools/라디오무대굽기.js` 가 따로 굽는다.
 *   유호 지시 09-02 「배경이 너무 허전해서 휴양지나 정말 아름다운 자연이나 드림코어형식으로」.
 *   🔑 갈라 놓은 까닭: 무대는 **돈이 드는 생성**(1컷 190원)이고 합성은 **공짜에 즉시**다.
 *     한 파일에 두면 글자 한 줄 고칠 때마다 무대를 다시 사게 된다.
 *   🔴 무대에는 **생명이 없다** — 마스코트를 생성시키지 않는다. 몽글·까몽은 정본이라
 *     모델이 그리면 「닮았지만 다른 것」이 24시간 방송에 걸린다. 정본을 여기서 올린다.
 *
 * ■ 스티커가 되지 않게 하는 것 셋 — 누끼 딴 물건을 사진 위에 얹을 때의 급소다(룸장면 §3-4 ③).
 *   ①접지 그림자(바닥에 눌린 타원) ②무대 광원에 맞춘 빛(시티팝=역광 후광 · 차분=달빛 방향)
 *   ③크기. 첫 판의 600px(화면 47%)은 무대가 없을 때의 값이라, 무대가 생긴 지금은 «인형이
 *   풍경을 가린다». 세계가 읽히려면 주인공이 3할대로 내려와야 한다.
 *
 * ■ 「학생은 보지 않고 듣는다」(이 트랙의 판정 자) — 그래서 화면에 뜻을 안 싣는다.
 *   글자는 각인 하나뿐이다. 곡 제목·시계·가사는 두지 않는다 — 정지 화면이라 낡는다.
 *
 * 쓰기:
 *   node tools/라디오배경굽기.js                 전 장르 → docs/라디오/배경/<장르>.png
 *   node tools/라디오배경굽기.js --장르 citypop  한 장만
 *   node tools/라디오배경굽기.js --썸네일        목록·검색용 간판 → docs/라디오/썸네일.png
 *   모두 1280×720. 무대는 `tools/라디오무대굽기.js` 가 먼저 구워 둔 것을 쓴다.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { 색, 워드마크 } = require('./lib/로고정본.js');
const { 양모천svg } = require('./배너굽기.js');
const 마스코트자산 = require('./lib/마스코트자산.js');

const ROOT = path.resolve(__dirname, '..');
const 낼곳 = path.join(ROOT, 'docs/라디오/배경');
const 무대방 = path.join(ROOT, 'docs/라디오/무대');
const W = 1280, H = 720;                       // 720p 단일 규격(설계 §7-7 확정)

/* ── 각인 — 유호 지시 09-02 「영어로 코퍼레이트 synk 이렇게 느낌있게」 ──────────────
 * 옛 판 = 「이 노래는 SYNK가 만들었습니다」. 뜻(자체 제작)은 지키고 말투만 갈았다:
 *   워드마크 `synk` + 가는 선 + 넓게 벌린 대문자 `ORIGINAL SOUND`.
 * 🔑 자리를 가운데에서 **왼쪽 아래 구석**으로 옮겼다 — 무대가 생기자 가운데는 주인공 자리다.
 *   구석 각인은 방송 채널 버그(bug)의 문법이라 「코퍼레이트」에 더 맞고, 화면도 안 막는다. */
const 각인 = 'ORIGINAL SOUND';

/* ── 장르 셋 — 색은 킷 램프 안에서만 고른다(철칙 ④: 주연 1실 + 조연 1실) ──────────
 * ⚠ 전자(house)는 **마린을 기다린다**(유호 확정 09-02) — 가이드가 몽글·까몽 둘뿐이라
 *   얼굴 없이 켜지 않는다. 여기 정의는 두되 `대기: true` 라 기본 굽기에서 빠진다. */
const 장르들 = {
  citypop: {
    이름: '시티팝', 가이드: '몽글', 표정: '눈웃음',
    /* 무대 = 노을 휴양지. 광원이 수평선 «뒤»라 주인공은 역광이다 ⇒ 따뜻한 후광을 두른다. */
    바탕: 색['Coral Wash'], 글자: 색['Ink'], 보조: 색['Ash Wool'],
    천: { 보풀: '#FFFFFF', 그늘: 색['Coral Soft'], 어둡나: false },
    빛: { 후광: 'rgba(255,206,163,0.42) 0 0 20px', 그림자각: '0 16px 22px rgba(120,64,44,0.34)' },
    접지: { 폭: 0.86, 높이: 0.14, 색: 'rgba(122,72,52,0.34)', 흐림: 22 },
    앉는선: 0.885,          // 모래와 물이 만나는 선
    무대자리: { 크기: '106%', 위치: '44% 40%' },
  },
  calm: {
    이름: '차분', 가이드: '까몽', 표정: '눈웃음',
    /* 무대 = 밤의 호수. 달이 오른쪽 위 ⇒ 그림자는 왼쪽 아래로 눕는다.
     * 까몽은 검은 털이라 어두운 언덕 위에서는 사라진다 — 물(밝은 회색 펠트) 앞에 앉힌다. */
    바탕: 색['Ink'], 글자: 색['Paper'], 보조: 색['Stone'],
    천: { 보풀: 색['Deep Wool'], 그늘: 색['Ink Deep'], 어둡나: true },
    빛: { 후광: 'rgba(255,243,219,0.62) 14px -12px 22px', 그림자각: '-16px 13px 22px rgba(8,6,4,0.62)' },
    접지: { 폭: 0.82, 높이: 0.13, 색: 'rgba(6,5,4,0.58)', 흐림: 18 },
    앉는선: 0.900,          // 호수 앞 물가 — 수놓인 달빛 띠 «앞»에 세워 실루엣이 살게 한다
    /* 🔴 무대 아래 «나무 탁자»(디오라마를 올려 둔 상)가 프레임에 남았다 — 118% 로 키우고 위로 밀어
     *   아래 91px 를 잘라 낸다. 미니어처의 실물감은 결 자체가 이미 지니고 있어 탁자가 없어도 산다. */
    무대자리: { 크기: '118%', 위치: '44% 26%' },
  },
  house: {
    /* ✅ 09-05 17:52 에 마린 정본 11컷이 서서 대기를 풀었다(유호 확정 「이거로 가자」).
     *   09-02 에 「가이드가 몽글·까몽 둘뿐이라 얼굴 없이 켜지 않는다」로 접어 둔 그 자리다. */
    이름: '전자', 가이드: '마린', 표정: '눈웃음',
    바탕: 색['Lapis Soft'], 글자: 색['Ink'], 보조: 색['Ash Wool'],
    천: { 보풀: '#FFFFFF', 그늘: 색['Lapis Soft'], 어둡나: false },
    빛: { 후광: 'rgba(214,232,255,0.44) 0 0 20px', 그림자각: '0 16px 22px rgba(40,58,88,0.32)' },
    접지: { 폭: 0.86, 높이: 0.14, 색: 'rgba(40,58,88,0.30)', 흐림: 22 },
    앉는선: 0.885,
    무대자리: { 크기: '106%', 위치: '44% 40%' },
  },

  /* ── 09-05 에 무대 넷이 더 생겨 여기로 잇는다 (유호 지시 「무대 넷도 배경으로 이어줘」) ──
   * 🔑 **누구를 세우나는 «대비»가 정한다** — 위 calm 주석의 그 원리다. 까몽은 검은 털이라
   *   어두운 무대에서 사라지고, 몽글은 코랄이라 옅은 파스텔 무대에서 묻힌다.
   *   ⇒ 어두운 무대(city)엔 몽글 · 밝은 무대(dream_sky·dream_water)엔 까몽 ·
   *      초록 들판(dream_field)엔 코랄이 보색으로 서니 몽글.
   * 🔑 그림자 방향도 무대 사진의 «광원»을 따라간다 — 넷 다 광원이 화면 «뒤 가운데»(노을·해·확산)라
   *   역광이다. 그래서 후광은 그 빛의 색을 두르고 그림자는 앞으로(아래로) 곧게 눕는다. */
  city: {
    이름: '도시', 가이드: '몽글', 표정: '눈웃음',
    /* 무대 = 비 갠 저녁의 골목 옥상. 남색 지붕에 창문 불빛, 수평선에 주황 노을.
     * 어두운 무대라 까몽은 지붕에 먹힌다 ⇒ 코랄 몽글이 창불빛과 같은 온도로 뜬다. */
    바탕: 색['Ink'], 글자: 색['Paper'], 보조: 색['Stone'],
    천: { 보풀: 색['Deep Wool'], 그늘: 색['Ink Deep'], 어둡나: true },
    빛: { 후광: 'rgba(255,196,140,0.42) 0 0 20px', 그림자각: '0 16px 22px rgba(14,18,34,0.58)' },
    접지: { 폭: 0.86, 높이: 0.14, 색: 'rgba(10,13,24,0.56)', 흐림: 20 },
    앉는선: 0.870,          // 앞쪽 옥상 바닥 — 난간 너머 지붕들 «앞»에 세운다
    무대자리: { 크기: '106%', 위치: '44% 42%' },
  },
  dream_sky: {
    이름: '드림하늘', 가이드: '까몽', 표정: '눈웃음',
    /* 무대 = 구름 위의 계단. 분홍·보라 파스텔에 양털 구름 ⇒ 검은 까몽이 또렷이 선다.
     * 광원이 사방으로 퍼져 방향이 없다 ⇒ 후광은 옅게, 그림자는 짧고 부드럽게. */
    바탕: 색['Paper'], 글자: 색['Ink'], 보조: 색['Ash Wool'],
    천: { 보풀: '#FFFFFF', 그늘: 색['Coral Soft'], 어둡나: false },
    빛: { 후광: 'rgba(255,242,250,0.40) 0 0 18px', 그림자각: '0 13px 20px rgba(146,118,150,0.26)' },
    접지: { 폭: 0.84, 높이: 0.12, 색: 'rgba(146,118,150,0.22)', 흐림: 26 },
    앉는선: 0.880,          // 아래쪽 구름 언덕 위
    무대자리: { 크기: '106%', 위치: '44% 44%' },
  },
  dream_water: {
    이름: '드림물', 가이드: '까몽', 표정: '눈웃음',
    /* 무대 = 끝없는 거울 물. 가운데 노란 해가 수면에 비친다 ⇒ 정면 역광.
     * 화면 전체가 옅어 까몽의 검은 실루엣이 주인공이 된다.
     * 물 위라 접지 그림자는 «반사»에 가깝다 ⇒ 가장 옅고 가장 넓게 흐린다. */
    바탕: 색['Paper'], 글자: 색['Ink'], 보조: 색['Ash Wool'],
    천: { 보풀: '#FFFFFF', 그늘: 색['Coral Soft'], 어둡나: false },
    빛: { 후광: 'rgba(255,235,176,0.46) 0 0 22px', 그림자각: '0 13px 20px rgba(142,126,140,0.24)' },
    접지: { 폭: 0.88, 높이: 0.11, 색: 'rgba(140,125,140,0.20)', 흐림: 30 },
    앉는선: 0.865,          // 수면 앞자락 — 해의 반사 띠를 가리지 않는 자리
    무대자리: { 크기: '106%', 위치: '44% 40%' },
  },
  기본: {
    이름: '기본', 가이드: '몽글', 표정: '눈웃음',
    /* 🔑 **장르가 아니다 — 「장르를 못 읽었을 때」의 자리다**(09-05 신설).
     *   talk `bots/송출/인코딩.sh` 는 곡 이름 꼬리에서 장르를 읽고, 못 읽으면 `<배경폴더>/기본.png`
     *   로 물러선다. 그 파일이 없어서 주석이 약속한 「조용히 단색으로 안 떨어진다」가
     *   정확히 그 조용한 단색으로 떨어지고 있었다(09-05 실측 · 배경 폴더에 기본.png 0개).
     * 🔑 **무대 사진을 일부러 안 준다.** 어느 장르의 무대를 빌려 오면 그 장르가 두 번 나온
     *   것처럼 보인다. 무대판 폴백(양모천)이 그대로 받아 «어느 곳도 아닌» 화면이 된다.
     * 🔑 어두운 결로 맞춘다 — 인코딩의 마지막 폴백이 킷 Ink Deep 단색이라 그 자리와 이어지고,
     *   24시간 방송이라 밤에도 눈이 안 부시다. 몽글은 코랄이라 어두운 천 위에서 뜬다. */
    바탕: 색['Ink Deep'], 글자: 색['Paper'], 보조: 색['Stone'],
    천: { 보풀: 색['Deep Wool'], 그늘: 색['Ink Deep'], 어둡나: true },
    빛: { 후광: 'rgba(255,206,163,0.34) 0 0 22px', 그림자각: '0 15px 22px rgba(8,6,4,0.60)' },
    접지: { 폭: 0.84, 높이: 0.13, 색: 'rgba(6,5,4,0.56)', 흐림: 20 },
    앉는선: 0.885,
    무대자리: { 크기: '106%', 위치: '44% 40%' },
  },
  dream_field: {
    이름: '드림들판', 가이드: '몽글', 표정: '눈웃음',
    /* 무대 = 빛나는 들판. 초록 언덕에 반딧불, 뒤로 주황 노을 ⇒ 역광.
     * 초록 위에서는 코랄이 보색으로 뜬다(까몽은 짙은 나무들과 뭉친다). */
    바탕: 색['Meadow Soft'], 글자: 색['Ink'], 보조: 색['Ash Wool'],
    천: { 보풀: '#FFFFFF', 그늘: 색['Meadow Soft'], 어둡나: false },
    빛: { 후광: 'rgba(255,214,150,0.44) 0 0 20px', 그림자각: '0 16px 22px rgba(64,84,46,0.36)' },
    접지: { 폭: 0.86, 높이: 0.14, 색: 'rgba(58,76,42,0.34)', 흐림: 22 },
    앉는선: 0.885,          // 앞쪽 풀언덕 마루
    무대자리: { 크기: '106%', 위치: '44% 40%' },
  },
};

/** 가이드 누끼 — 경로는 `lib/마스코트자산.js` 한 창구에서만 온다. */
function 가이드img(가이드, 표정) {
  /* 🔴 **마린은 제 창구로 간다**(09-05). 그 전에는 갈래가 「까몽이냐 아니냐」 둘뿐이라
   *   마린을 시켜도 «몽글»이 나왔다 — 조용한 폴백이라 켜 보기 전에는 안 보인다.
   *   마린 4K 세트는 전부 투명이라 `누끼` 를 따로 가리지 않는다(`마스코트자산.js` 마린경로). */
  const p = 가이드 === '까몽'
    ? path.join(ROOT, 마스코트자산.까몽경로(표정, { 누끼: true }))
    : 가이드 === '마린'
      ? path.join(ROOT, 마스코트자산.마린경로(표정))
      : 마스코트자산.절대경로(표정, { 누끼: true });
  return `<img src="data:image/png;base64,${fs.readFileSync(p).toString('base64')}" alt="" data-synk-mascot>`;
}

/* 액자 실측 — 이 표가 하는 일은 하나뿐이다: **셋이 화면에서 «같은 키»로 보이게** 맞춘다.
 * 아래 «빈 몫»은 접지 그림자를 발밑에 붙이는 데도 쓴다 — 액자 아래 여백만큼 올려 줘야 뜨지 않는다.
 *
 * 🔴 **09-05 재실측 — 옛 값이 세트를 안 따라와 까몽이 35% 작게 나오고 있었다.**
 *   09-01 값(몽글 57.3% · 까몽 91.2% ⇒ 배율 0.650)은 «그때 세트»의 자다. 4K 정본으로 갈아탄
 *   지금은 알파가 차지하는 그림 높이가 **몽글 0.755 · 까몽 0.748 · 마린 0.679** 로 거의 같아,
 *   같은 키로 맞추는 배율은 몽글 1.000 · 까몽 1.009 · 마린 1.111 이다.
 *   ⇒ 옛 0.650 을 그대로 쓰면 까몽만 홀로 작다(09-05 배경 일곱 장에서 눈으로도 보였다).
 *   🔑 재는 법: `Image.open(정본_4K/<이름>_눈웃음.png).split()[3].getbbox()` 의 높이 ÷ 캔버스 높이.
 *      **세트를 다시 구우면 이 표도 다시 잰다** — 값이 아니라 «자»가 세트에 매여 있다. */
const 액자 = {
  몽글: { 배율: 1.000, 아래여백: 0.220 },
  까몽: { 배율: 1.009, 아래여백: 0.057 },
  마린: { 배율: 1.111, 아래여백: 0.220 },
};

/* 무대판 — 있으면 사진을 깔고, 없으면 양모천으로 내려앉는다.
 * 🔑 폴백을 남겨 두는 까닭: 무대는 «돈 주고 사 온 것»이라 저장소를 새로 받은 기계엔 없을 수 있고,
 *   전자(house)처럼 아직 안 산 장르도 있다. 그때도 도구는 돌아야 한다. */
function 무대판(키) {
  const p = path.join(무대방, `${키}.png`);
  return fs.existsSync(p) ? `data:image/png;base64,${fs.readFileSync(p).toString('base64')}` : null;
}

/** 한 장르의 배경 지면.
 *  @param 마스코트만 true 면 «무대 없이 마스코트 층만» 그린다 — 움직이는 무대 영상 위에 얹을 층이다.
 *    끄는 것 = 무대 사진 · 양모천 폴백 · 공기(비네팅) · 바탕색. 남기는 것 = 접지 그림자 · 주인공 · 각인.
 *    🔑 접지와 후광을 남기는 까닭 = 그 둘이 「스티커」와 「앉은 것」을 가른다(이 파일 머리말의 규율). */
function 지면(키, 마스코트만 = false) {
  const a = 장르들[키];
  const 액 = 액자[a.가이드] || 액자.몽글;
  /* 🔴 크기 — 첫 판 600px(화면 47%)은 «무대가 없을 때»의 값이다. 무대가 생기자 인형이 풍경을 가렸다.
   *   410 이면 그림 높이가 약 229px(화면의 32%)로, 세계가 읽히면서 주인공도 안 작다. */
  const 폭 = Math.round(410 * 액.배율);
  const 무대 = 무대판(키);
  /* 액자 아래 빈 몫을 빼야 «발»이 앉는선에 닿는다. */
  const 발여백 = Math.round(폭 * 액.아래여백 * 0.9);

  return `<!doctype html><meta charset="utf-8">
<style>
  @font-face{font-family:'SYNK Bracket';src:local('Malgun Gothic'),local('Apple SD Gothic Neo'),local('Noto Sans KR');unicode-range:U+300C-300D;}
  html,body{margin:0;padding:0;background:${마스코트만 ? 'transparent' : a.바탕};}
  ${마스코트만 ? '.무대,.천,.결{display:none !important;} .판{background:transparent !important;}' : ''}
  .판{width:${W}px;height:${H}px;position:relative;overflow:hidden;background:${a.바탕};
    font-family:'Inter Tight','SYNK Bracket',system-ui,'Malgun Gothic',sans-serif;}
  /* ① 무대 — 106% 로 키워 앉힌다. 생성 모델이 우하단에 찍는 표식을 «잘라» 떨구는 자리다
     (지우지 않는다 · 비가시 SynthID 는 그대로 산다). 원판이 2752px 이라 확대 손해가 없다. */
  .무대{position:absolute;inset:0;z-index:0;
    background:${무대 ? `url(${무대}) no-repeat` : a.바탕};
    background-size:${a.무대자리.크기} auto;background-position:${a.무대자리.위치};}
  .천{position:absolute;inset:0;width:100%;height:100%;z-index:0;display:block;}
  /* ② 공기 — 드림코어의 «흐릿한 빛». 무대에 이미 블룸이 있으니 여기선 얇게만 얹는다. */
  .결{position:absolute;inset:0;z-index:1;pointer-events:none;
    background:
      radial-gradient(ellipse 62% 70% at 50% 40%, ${a.천.어둡나 ? 'rgba(255,241,214,0.06)' : 'rgba(255,236,214,0.20)'} 0%, transparent 64%),
      radial-gradient(ellipse 120% 150% at 50% 46%, transparent 0%, transparent 54%, ${a.천.어둡나 ? 'rgba(0,0,0,0.42)' : 'rgba(96,52,38,0.20)'} 100%);}
  /* ③ 접지 그림자 — 스티커와 «앉은 것»을 가르는 한 겹. 발밑에 눌려 퍼진 타원이다. */
  .접지{position:absolute;left:50%;top:${(a.앉는선 * 100).toFixed(2)}%;transform:translate(-50%,-50%);z-index:2;
    width:${Math.round(폭 * a.접지.폭)}px;height:${Math.round(폭 * a.접지.높이)}px;
    background:radial-gradient(ellipse at 50% 50%, ${a.접지.색} 0%, transparent 70%);
    filter:blur(${a.접지.흐림}px);}
  /* ④ 주인공 — 정본 누끼. 무대의 광원에 맞춰 후광과 그림자를 두른다. */
  .얼굴{position:absolute;left:50%;top:${(a.앉는선 * 100).toFixed(2)}%;
    transform:translate(-50%,calc(-100% + ${발여백}px));z-index:3;width:${폭}px;
    filter:drop-shadow(${a.빛.후광}) drop-shadow(${a.빛.그림자각});}
  .얼굴 img{width:100%;height:auto;display:block;}
  /* ⑤ 각인 — 왼쪽 아래 구석. 어느 무대에 얹혀도 읽히게 그늘을 깐다.
     🔑 밝은 무대(시티팝)가 더 어렵다 — 모래가 잉크와 명도가 붙어 첫 판에서 글자가 씻겼다.
        그래서 밝은 판엔 «어둡게 까는» 그늘을 더 진하게 준다(어두운 판보다 세다). */
  /* 🔴 «모서리에서 뻗는» 그늘은 radial 이어야 한다 — linear 로 두면 상자 오른쪽 끝에서 값이
     transparent 에 못 닿은 채 잘려 **세로 줄**이 선다(09-02 실측: 52%=665px 자리에 이음매).
     radial 은 사방으로 같은 거리에서 사라지므로 상자 경계가 안 보인다. 상자도 넉넉히 준다. */
  .각인막{position:absolute;left:0;bottom:0;width:64%;height:58%;z-index:4;pointer-events:none;
    background:radial-gradient(ellipse 100% 100% at 0% 100%, ${a.천.어둡나 ? 'rgba(8,6,4,0.62)' : 'rgba(62,30,20,0.50)'} 0%, transparent 72%);}
  .각인{position:absolute;left:56px;bottom:46px;z-index:5;}
  .로고{width:104px;margin:0 0 12px;filter:drop-shadow(0 1px 4px ${a.천.어둡나 ? 'rgba(0,0,0,0.6)' : 'rgba(50,22,14,0.45)'});}
  .로고 svg{width:100%;height:auto;display:block;}
  .선{width:104px;height:1px;margin:0 0 12px;background:${a.천.어둡나 ? 'rgba(251,247,240,0.46)' : 'rgba(251,247,240,0.62)'};}
  .말{margin:0;font-size:12.5px;font-weight:600;letter-spacing:.38em;text-transform:uppercase;
    color:${색['Paper']};opacity:.94;
    text-shadow:0 1px 4px rgba(0,0,0,${a.천.어둡나 ? '0.6' : '0.5'});}
</style>
<div class="판">
  ${무대 ? '<div class="무대"></div>' : 양모천svg({ ...a.천, w: W, h: H })}
  <div class="결"></div>
  <div class="접지"></div>
  <!-- 표정을 밖에서 덮어쓸 수 있다(env SYNK_FACE=눈감음). 움직이는 층을 만들 때 그 컷이 필요하다.
       기본은 결 정의의 표정 그대로라 여느 굽기는 아무 영향이 없다.
       ⚠ 이름이 영어인 까닭: bash 는 비ASCII 환경변수 이름을 못 받는다(09-06 실측 · 오늘 네 번째 자리).
       ⚠ 이 주석 안에 백틱을 쓰면 바깥 템플릿 문자열이 그 자리에서 끊긴다(같은 날 실측). -->
  <div class="얼굴">${가이드img(a.가이드, process.env.SYNK_FACE || a.표정)}</div>
  <div class="각인막"></div>
  <div class="각인">
    <!-- 🔑 각인은 «어느 장르든» 다크 판 워드마크다 — 뒤에 깔린 것이 무대가 아니라 어두운 그늘이라
         라이트 판(잉크 글자)을 쓰면 그늘 위에서 안 읽힌다. 판을 정하는 것은 «바로 뒤»지 화면 전체가 아니다. -->
    <div class="로고">${워드마크({ 판: '다크', 표현: '펠트', 색갈래: '코랄' })}</div>
    <div class="선"></div>
    <p class="말">${각인}</p>
  </div>
</div>`;
}

/* ── 썸네일 — 방송 화면과 «다른 물건»이다 ──────────────────────────────────────
 * 배경은 24시간 켜 두는 «분위기»고, 썸네일은 목록·검색에서 **0.5초 안에 고르게 하는 간판**이다.
 * 그래서 규칙이 정반대다: 배경은 글자를 안 싣고, 썸네일은 글자가 주인공이다.
 * 🔑 그런데 **무대·마스코트·액자 보정은 같은 것을 쓴다** — 새 파일로 빼면 그 셋이 두 벌이 되고
 *   그 순간 갈린다([[constant-known-in-two-places]]). 여기 붙여 재료를 한 곳에 둔다.
 *
 * 작게 줄었을 때가 진짜 판이다 — 목록 카드는 360px 안팎이라 1280 설계가 **3.6배 줄어든다**.
 * ⇒ 큰 줄은 110px(줄면 ≈31px) · 실린 글자 수를 아낀다.
 * ⚠ 몽골어는 안 싣는다 — 원어민 감수 전이다(설계 규칙 그대로). 한국어가 곧 상품이라 손해가 적다.
 */
const 썸네일 = {
  무대: 'citypop',           // 노을이 목록에서 가장 눈에 든다(밤 판은 작게 줄면 검은 사각이 된다)
  가이드: '몽글', 표정: '눈웃음',
  작은줄: '24시간',
  큰줄: '한국어 라디오',
  받침줄: '공부할 때 켜 두세요',
};

function 썸네일지면() {
  const t = 썸네일;
  const a = 장르들[t.무대];
  const 액 = 액자[t.가이드] || 액자.몽글;
  /* 배경(410)보다 크게 — 썸네일은 «누구인지»가 먼저 보여야 한다. */
  const 폭 = Math.round(520 * 액.배율);
  const 발여백 = Math.round(폭 * 액.아래여백 * 0.9);
  const 무대 = 무대판(t.무대);

  return `<!doctype html><meta charset="utf-8">
<style>
  html,body{margin:0;padding:0;background:${a.바탕};}
  .판{width:${W}px;height:${H}px;position:relative;overflow:hidden;background:${a.바탕};
    font-family:'Inter Tight','SUIT Variable',system-ui,'Malgun Gothic',sans-serif;}
  .무대{position:absolute;inset:0;z-index:0;
    background:${무대 ? `url(${무대}) no-repeat` : a.바탕};
    background-size:118% auto;background-position:64% 42%;}
  .천{position:absolute;inset:0;width:100%;height:100%;z-index:0;display:block;}
  /* 글자 자리를 만드는 그늘 — 왼쪽에서 뻗는다. 배경과 같은 이유로 radial 이다(모서리 이음매 방지). */
  .막{position:absolute;inset:0;z-index:1;pointer-events:none;
    background:radial-gradient(ellipse 86% 128% at 2% 50%, rgba(58,26,16,0.80) 0%, rgba(58,26,16,0.52) 38%, transparent 74%);}
  /* 주인공 — 오른쪽에 앉힌다(글자가 왼쪽이라). 발이 모래에 닿는 선은 배경과 같은 자 */
  .접지{position:absolute;left:73%;top:88.5%;transform:translate(-50%,-50%);z-index:2;
    width:${Math.round(폭 * 0.86)}px;height:${Math.round(폭 * 0.14)}px;
    background:radial-gradient(ellipse at 50% 50%, rgba(122,72,52,0.36) 0%, transparent 70%);filter:blur(24px);}
  .얼굴{position:absolute;left:73%;top:88.5%;transform:translate(-50%,calc(-100% + ${발여백}px));
    z-index:3;width:${폭}px;filter:drop-shadow(rgba(255,206,163,0.42) 0 0 22px) drop-shadow(0 18px 24px rgba(120,64,44,0.38));}
  .얼굴 img{width:100%;height:auto;display:block;}
  .말{position:absolute;left:74px;top:50%;transform:translateY(-50%);z-index:4;}
  .작은{margin:0 0 10px;font-size:34px;font-weight:700;letter-spacing:.30em;text-transform:uppercase;
    color:${색['Coral Soft']};text-shadow:0 2px 10px rgba(0,0,0,.5);}
  .큰{margin:0;font-size:110px;line-height:1.02;font-weight:900;letter-spacing:-.035em;
    color:${색['Paper']};text-shadow:0 4px 22px rgba(38,14,8,.62);}
  .받침{margin:22px 0 0;font-size:31px;font-weight:600;letter-spacing:-.01em;
    color:rgba(251,247,240,.90);text-shadow:0 2px 10px rgba(0,0,0,.55);}
  .선{width:96px;height:2px;margin:26px 0 0;background:${색['Coral']};}
  .로고{position:absolute;left:74px;bottom:52px;width:112px;z-index:4;
    filter:drop-shadow(0 2px 8px rgba(0,0,0,.55));}
  .로고 svg{width:100%;height:auto;display:block;}
</style>
<div class="판">
  ${무대 ? '<div class="무대"></div>' : 양모천svg({ ...a.천, w: W, h: H })}
  <div class="막"></div>
  <div class="접지"></div>
  <div class="얼굴">${가이드img(t.가이드, t.표정)}</div>
  <div class="말">
    <p class="작은">${t.작은줄}</p>
    <p class="큰">${t.큰줄}</p>
    <p class="받침">${t.받침줄}</p>
    <div class="선"></div>
  </div>
  <div class="로고">${워드마크({ 판: '다크', 표현: '펠트', 색갈래: '코랄' })}</div>
</div>`;
}

function 크롬() {
  const 후보 = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].filter(fs.existsSync);
  if (!후보.length) throw new Error('크롬을 못 찾았다');
  return 후보[0];
}

/** 한 장 굽는다 — 어떤 지면이든 같은 크롬 호출을 탄다(호출 인자를 두 곳에 안 적는다). */
function 굽기(이름, html, 방 = 낼곳, 투명 = false) {
  const src = path.join(방, `_${이름}.html`);
  const png = path.join(방, `${이름}.png`);
  fs.mkdirSync(방, { recursive: true });
  fs.writeFileSync(src, html, 'utf8');
  /* 🔑 투명하게 찍으려면 크롬에게 «기본 바탕색이 없다»고 말해야 한다.
   *   이 옵션이 없으면 흰 종이가 깔려서 알파가 죽는다(무대 영상 위에 얹을 층은 알파가 생명이다). */
  const 더 = 투명 ? ['--default-background-color=00000000'] : [];
  spawnSync(크롬(), ['--headless=new', '--disable-gpu', '--force-device-scale-factor=1',
    '--hide-scrollbars', `--window-size=${W},${H}`, `--screenshot=${png}`, ...더,
    'file:///' + src.replace(/\\/g, '/')], { encoding: 'utf8' });
  if (!fs.existsSync(png)) throw new Error(`굽기 실패: ${이름}`);
  fs.unlinkSync(src);
  return { 이름, png, 바이트: fs.statSync(png).size };
}

function main() {
  const argv = process.argv.slice(2);
  const i = argv.indexOf('--장르');
  const 하나 = i >= 0 ? argv[i + 1] : null;
  const 아는것 = ['--장르', '--썸네일', '--마스코트만'];
  const 모름 = argv.filter((x) => x.startsWith('--') && !아는것.includes(x));
  if (모름.length) { console.error(`[라디오배경굽기] 모르는 플래그 ${모름.join(' ')} — 아는 것 = ${아는것.join(' · ')}`); process.exit(1); }
  if (하나 && !장르들[하나]) throw new Error(`모르는 장르: ${하나} (있는 것: ${Object.keys(장르들).join(' · ')})`);

  fs.mkdirSync(낼곳, { recursive: true });

  /* 썸네일만 굽는 갈래 — 배경과 산출 폴더가 다르다(배경 폴더는 «인코딩이 통째로 읽는» 자리라
   * 방송 화면이 아닌 파일을 섞으면 장르 하나가 더 있는 것처럼 보인다). */
  if (argv.includes('--썸네일')) {
    const 방 = path.join(ROOT, 'docs/라디오');
    const r = 굽기('썸네일', 썸네일지면(), 방);
    const MB = r.바이트 / 1024 / 1024;
    console.log(`✅ 썸네일 · ${W}×${H} · ${MB.toFixed(2)}MB ${MB < 2 ? '(유튜브 상한 2MB 안)' : '🔴 2MB 초과 — 유튜브가 거절한다'}`);
    console.log(`   무대 ${무대판(썸네일.무대) ? '사진' : '⚠양모천 폴백'} · ${path.relative(ROOT, r.png)}`);
    return;
  }

  const 목록 = 하나 ? [하나] : Object.keys(장르들).filter((k) => !장르들[k].대기);
  const 뺀것 = Object.keys(장르들).filter((k) => 장르들[k].대기);
  for (const k of 목록) {
    const 마스코트만 = argv.includes('--마스코트만');
    const 방2 = 마스코트만 ? path.join(ROOT, 'docs/라디오/마스코트층') : 낼곳;
    const r = 굽기(k, 지면(k, 마스코트만), 방2, 마스코트만);
    /* 「기본」은 무대 사진이 «없는 것이 옳다» — 빠진 게 아니므로 경고를 안 낸다.
     *   안 그러면 매번 뜨는 ⚠ 가 참말과 거짓말을 섞어, 진짜 빠진 무대를 못 보게 만든다. */
    const 무대말 = 무대판(k) ? '사진'
      : (k === '기본' ? '없음(일부러 · 어느 곳도 아닌 화면)' : '⚠양모천 폴백(무대굽기 먼저)');
    console.log(`✅ ${k.padEnd(8)} ${장르들[k].이름} · ${장르들[k].가이드} · ${W}×${H} · ${(r.바이트 / 1024).toFixed(0)}KB`
      + ` · 무대 ${무대말}`);
  }
  if (!하나 && 뺀것.length) {
    console.log(`⏳ 대기 = ${뺀것.map((k) => `${k}(${장르들[k].가이드})`).join(' · ')} — 얼굴이 아직 없어 안 굽는다(유호 확정 09-02)`);
  }
  console.log(`\n[라디오배경굽기] ${목록.length}장 · ${path.relative(ROOT, 낼곳)}`);
}

if (require.main === module) main();
module.exports = { 장르들 };
