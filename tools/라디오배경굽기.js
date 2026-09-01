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
 *   node tools/라디오배경굽기.js                 전 장르
 *   node tools/라디오배경굽기.js --장르 citypop  한 장만
 *   출력 = docs/라디오/배경/<장르>.png (1280×720)
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
    이름: '전자', 가이드: '마린', 표정: '눈웃음', 대기: true,
    바탕: 색['Lapis Soft'], 글자: 색['Ink'], 보조: 색['Ash Wool'],
    천: { 보풀: '#FFFFFF', 그늘: 색['Lapis Soft'], 어둡나: false },
    빛: { 후광: 'rgba(214,232,255,0.44) 0 0 20px', 그림자각: '0 16px 22px rgba(40,58,88,0.32)' },
    접지: { 폭: 0.86, 높이: 0.14, 색: 'rgba(40,58,88,0.30)', 흐림: 22 },
    앉는선: 0.885,
    무대자리: { 크기: '106%', 위치: '44% 40%' },
  },
};

/** 가이드 누끼 — 경로는 `lib/마스코트자산.js` 한 창구에서만 온다. */
function 가이드img(가이드, 표정) {
  const p = 가이드 === '까몽'
    ? path.join(ROOT, 마스코트자산.까몽경로(표정, { 누끼: true }))
    : 마스코트자산.절대경로(표정, { 누끼: true });
  return `<img src="data:image/png;base64,${fs.readFileSync(p).toString('base64')}" alt="" data-synk-mascot>`;
}

/* 액자 실측(알파 bbox · 09-01) — 몽글은 캔버스의 57.3%만 채우고 까몽은 91.2%다.
 * 같은 폭을 주면 까몽이 1.5배로 커진다 ⇒ 그림 높이를 같게 맞추는 배율은 0.558/0.859 ≈ 0.650.
 * 아래 «빈 몫»은 접지 그림자를 발밑에 붙이는 데도 쓴다 — 액자 아래 여백만큼 올려 줘야 뜨지 않는다. */
const 액자 = {
  몽글: { 배율: 1, 아래여백: 0.220 },
  까몽: { 배율: 0.650, 아래여백: 0.057 },
  마린: { 배율: 1, 아래여백: 0.220 },
};

/* 무대판 — 있으면 사진을 깔고, 없으면 양모천으로 내려앉는다.
 * 🔑 폴백을 남겨 두는 까닭: 무대는 «돈 주고 사 온 것»이라 저장소를 새로 받은 기계엔 없을 수 있고,
 *   전자(house)처럼 아직 안 산 장르도 있다. 그때도 도구는 돌아야 한다. */
function 무대판(키) {
  const p = path.join(무대방, `${키}.png`);
  return fs.existsSync(p) ? `data:image/png;base64,${fs.readFileSync(p).toString('base64')}` : null;
}

function 지면(키) {
  const a = 장르들[키];
  const 액 = 액자[a.가이드] || 액자.몽글;
  /* 🔴 크기 — 첫 판 600px(화면 47%)은 «무대가 없을 때»의 값이다. 무대가 생기자 인형이 풍경을 가렸다.
   *   410 이면 그림 높이가 약 229px(화면의 32%)로, 세계가 읽히면서 주인공도 안 작다. */
  const 폭 = Math.round(410 * 액.배율);
  const 무대 = 무대판(키);
  /* 액자 아래 빈 몫을 빼야 «발»이 앉는선에 닿는다(그림 높이 기준). */
  const 그림높이 = 폭 * (a.가이드 === '까몽' ? 0.859 : 0.558) / (a.가이드 === '까몽' ? 0.912 : 0.573);
  const 발여백 = Math.round(폭 * 액.아래여백 * 0.9);

  return `<!doctype html><meta charset="utf-8">
<style>
  @font-face{font-family:'SYNK Bracket';src:local('Malgun Gothic'),local('Apple SD Gothic Neo'),local('Noto Sans KR');unicode-range:U+300C-300D;}
  html,body{margin:0;padding:0;background:${a.바탕};}
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
  .각인막{position:absolute;left:0;bottom:0;width:52%;height:40%;z-index:4;pointer-events:none;
    background:linear-gradient(to top right, ${a.천.어둡나 ? 'rgba(8,6,4,0.60)' : 'rgba(62,30,20,0.46)'} 0%, transparent 66%);}
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
  <div class="얼굴">${가이드img(a.가이드, a.표정)}</div>
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

function 크롬() {
  const 후보 = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].filter(fs.existsSync);
  if (!후보.length) throw new Error('크롬을 못 찾았다');
  return 후보[0];
}

function 굽기(키) {
  const src = path.join(낼곳, `_${키}.html`);
  const png = path.join(낼곳, `${키}.png`);
  fs.writeFileSync(src, 지면(키), 'utf8');
  spawnSync(크롬(), ['--headless=new', '--disable-gpu', '--force-device-scale-factor=1',
    '--hide-scrollbars', `--window-size=${W},${H}`, `--screenshot=${png}`,
    'file:///' + src.replace(/\\/g, '/')], { encoding: 'utf8' });
  if (!fs.existsSync(png)) throw new Error(`굽기 실패: ${키}`);
  fs.unlinkSync(src);
  return { 키, png, 바이트: fs.statSync(png).size, 무대: !!무대판(키) };
}

function main() {
  const argv = process.argv.slice(2);
  const i = argv.indexOf('--장르');
  const 하나 = i >= 0 ? argv[i + 1] : null;
  const 모름 = argv.filter((x) => x.startsWith('--') && x !== '--장르');
  if (모름.length) { console.error(`[라디오배경굽기] 모르는 플래그 ${모름.join(' ')} — 아는 것은 --장르 뿐이다.`); process.exit(1); }
  if (하나 && !장르들[하나]) throw new Error(`모르는 장르: ${하나} (있는 것: ${Object.keys(장르들).join(' · ')})`);

  fs.mkdirSync(낼곳, { recursive: true });
  const 목록 = 하나 ? [하나] : Object.keys(장르들).filter((k) => !장르들[k].대기);
  const 뺀것 = Object.keys(장르들).filter((k) => 장르들[k].대기);
  for (const k of 목록) {
    const r = 굽기(k);
    console.log(`✅ ${k.padEnd(8)} ${장르들[k].이름} · ${장르들[k].가이드} · ${W}×${H} · ${(r.바이트 / 1024).toFixed(0)}KB`
      + ` · 무대 ${r.무대 ? '사진' : '⚠양모천 폴백(무대굽기 먼저)'}`);
  }
  if (!하나 && 뺀것.length) {
    console.log(`⏳ 대기 = ${뺀것.map((k) => `${k}(${장르들[k].가이드})`).join(' · ')} — 얼굴이 아직 없어 안 굽는다(유호 확정 09-02)`);
  }
  console.log(`\n[라디오배경굽기] ${목록.length}장 · ${path.relative(ROOT, 낼곳)}`);
}

if (require.main === module) main();
module.exports = { 장르들 };
