// 8번 앱 소개 30초 「캐스팅북」 화면 글(2026-11-07, Claude) — 16:9 30초 · castingbook-app-20261024/최종편집.py가 화면(p8/picture.mp4) · 소리(p8/sound.wav)를 넣고 이 판을 굽는다.
//   원본(네이버 탐색 30초)의 글 자리 · 시각 · 결을 따른다(02_콘티 1절 · 2절): 글자 1 · 2는 왼쪽 흰 글자, 제목은 왼쪽 위에서 비스듬히 세 덩이, 끝은 흰 바탕 로고 크게 → 작게.
//   글자 1 「이 얼굴이다 싶으면」(15번 — 왼쪽 어두운 어깨 위), 글자 2 「패키지에 담아 / 우리 가게 광고까지」(16 · 17번 — 17번은 엄지가 왼쪽 위를 덮어 왼쪽 아래로).
//     낱말마다 박에 맞춰 차례로 올라온다(슬롭 점검표 24번 — 한 줄 페이드로 두지 않는다). 마침표 없음(6번).
//   제목 「손님을 / 부르는 / 모델」 — 원본처럼 덩이마다 원근으로 기울어 왼쪽 가장자리에서 휘어 들어오고(0.22초에 셋), 28.2초에 오른쪽으로 비틀려 날아간다.
//     「모델」만 PULSE 베리. 20번은 창이 밝아 흰 글자 뒤에 옅은 그늘(콘티 4절 Fable 메모).
//   끝: end='card'(10-26 확정 — 흰 바탕 승인 로고 크게 → 작게 + 주소 한 줄) · end='scene'(견줄 시안 — 판 없이 마지막 장면 안 바닥에 로고, 점검표 1번).
//   말자막(11-08 초반 말 — 02_콘티 9절): 0~19초 사장 속말 · 23.8초 손님 말을 아래 가운데에 받아 적는다(브랜드 폰트 정본 §10-2 말자막 — 한 화면 한 문장,
//     마침표 · 쉼표 없음, 얼굴 · 폰 화면을 덮지 않음). 결은 다 비침 30초 판(rs/RS60.tsx — 맹검 두 차례 뒤 판)과 같다: 말은 흰 글자,
//     속말은 가늘고 옅은 푸른 회색에 아래 띠를 더 짙게. 시각 · 글은 최종소리.py가 받아쓰기 낱말 시각으로 timing.json `subs`에 쓴다.
//     화면 글 1 · 2(19~22초) · 제목(26.7초~)과 한 화면에 겹치지 않는다(정본 §10-4 — 한 화면에 갈래 하나).
import React from 'react';
import { AbsoluteFill, Img, OffthreadVideo, staticFile, useCurrentFrame } from 'remotion';
import { Audio } from '@remotion/media';
import { KO } from '../lib/fonts';
import { EXPO, SNAP, ramp } from '../lib/motion';
import timing from './timing.json';

const FPS = 24;
export const P8_FRAMES = 720;
const BERRY = '#99295D';
// 화면이 자르는 장 경계(최종편집.py F)
const F = [0, 34, 58, 98, 143, 179, 211, 271, 291, 340, 364, 380, 400, 420, 455, 482, 504, 537, 567, 641, 682, 720];
const T = (n: number) => F[n - 1] / FPS;   // n번 컷 시작 초
const abs = (x: number, y: number, w?: number, h?: number): React.CSSProperties => ({ position: 'absolute', left: x, top: y, width: w, height: h });
const lin = (x: number) => x;

// 낱말마다 차례로 — 아래에서 14px 올라오며 번짐(0.26초), 낱말 사이 0.07초
const Words: React.FC<{ t: number; a: number; words: string[]; step?: number }> = ({ t, a, words, step = 0.07 }) => (
  <>
    {words.map((w, i) => {
      const u = ramp(t, a + i * step, 0.26, EXPO);
      return (
        <span key={i} style={{ display: 'inline-block', opacity: u, transform: `translateY(${(1 - u) * 14}px)`, marginRight: i < words.length - 1 ? '0.26em' : 0 }}>{w}</span>
      );
    })}
  </>
);

// 원본 글자 높이 약 78px(1080 기준) · 굵게 — 처음 판(60px · 700)은 원본보다 작고 얇았다(원본과 나란히 11-07)
const TXT: React.CSSProperties = { fontFamily: KO, fontWeight: 760, fontSize: 84, lineHeight: 1.22, letterSpacing: '-0.02em', color: '#FFFFFF', whiteSpace: 'nowrap', textShadow: '0 0 1px #00000055, 0 2px 20px #00000070' };

// 글자 1 — 15번 컷 처음 0.12초 뒤부터 컷 끝까지(원본 18.95–20.09)
const Copy1: React.FC<{ t: number }> = ({ t }) => {
  const a = T(15) + 0.12, b = T(16);
  if (t < a - 0.02 || t >= b) return null;
  return (
    <div style={{ ...abs(116, 486), zIndex: 20, ...TXT }}>
      <Words t={t} a={a} words={['이', '얼굴이다', '싶으면']} />
    </div>
  );
};

// 글자 2 — 16번 처음부터 17번 「+ 패키지」 누름 앞까지(원본은 20.09–22.36). 17번은 엄지가 왼쪽 위를 덮어 두 컷 모두 왼쪽 아래(테두리 · 그늘 위)에 둔다.
// 누름(17번 0.87초)에 실제 앱 알림 「하린을 패키지에 담았어요」 · 베리 칩이 떠서, 그때까지 두면 글자 셋이 몰린다(11-07 v1 Fable 「22.0 글자 몰림」) — 누름 0.05초 앞에 내린다
const Copy2: React.FC<{ t: number }> = ({ t }) => {
  const a = T(16) + 0.06, b = T(17) + 0.82;
  if (t < a - 0.02 || t >= b) return null;
  const out = 1 - ramp(t, b - 0.16, 0.16, lin);
  return (
    <>
      {/* v4: 17번은 흰 앱 화면(01 카드 · 흰 티) 위라 글자가 묻혔다(v3 Fable 「지저분 · 가독 떨어짐」) — 글자 뒤 그늘을 진하게(드라마 자막 규칙 「글자 뒤는 늘 어둡게」) */}
      <AbsoluteFill style={{ zIndex: 19, opacity: out * ramp(t, a, 0.3, lin), background: 'radial-gradient(1200px 480px at 460px 780px, #000000C4, #00000080 45%, #00000000 78%)' }} />
      <div style={{ ...abs(116, 640), zIndex: 20, ...TXT, opacity: out }}>
        <div><Words t={t} a={a} words={['패키지에', '담아']} /></div>
        <div><Words t={t} a={a + 0.42} words={['우리', '가게', '광고까지']} /></div>
      </div>
    </>
  );
};

// 제목 — 세 덩이. 원본(26.70 · 26.76 · 26.84초에 차례로 휘어 들어옴, 28.2초부터 오른쪽으로 비틀려 날아감, 28.42초 끝 화면)
type Chunk = { s: string; x: number; y: number; size: number; rot: number; at: number; color: string; sy?: number[]; gr?: number[]; gy?: number[] };
const TITLE_IN = T(20);
// 원본 「나를 / 움직이는 / 탐색」은 왼쪽 절반을 덮는다(마지막 덩이 높이가 화면의 38%) — 처음 판(132 · 176 · 270px)은 반듯한 작은 묶음으로 읽혀 원본만큼 키웠다(11-07)
const CHUNKS: Chunk[] = [
  // 11-07 v1 이해 시험(둘 다) 「손님을 … 글자 윗부분이 잘려 있다」 — −11° 기울면 덩이 오른쪽 끝이 100px쯤 올라가 화면 위로 나갔다 → 셋 다 내림
  // 글자마다 크기(sy) · 기울기(gr, 도) · 높이(gy, px)를 달리 — 원본처럼 손으로 오린 듯한 결(11-07 v1 Fable 「기성 고딕에 기울임만 — 글꼴로 치고 기울인 티」)
  { s: '손님을', x: 46, y: 132, size: 196, rot: -11, at: 0.0, color: '#FFFFFF', sy: [1.08, 0.96, 0.76], gr: [-3, 2, 5], gy: [0, 8, 26] },
  { s: '부르는', x: 128, y: 344, size: 256, rot: -11, at: 0.07, color: '#FFFFFF', sy: [1.14, 0.98, 0.8], gr: [2, -2.5, 4], gy: [-6, 10, 30] },
  { s: '모델', x: 34, y: 596, size: 380, rot: -11, at: 0.15, color: BERRY, sy: [1.02, 0.95], gr: [-2, 3], gy: [0, 14] },
];
// v4 그린 글자(title='drawn') — 제목_그림.py가 손으로 오린 종이 글자를 초록 바탕에 구워 뺀 덩이 셋(title-1 · 2 · 3.png). 줄 기울기는 그림에 이미 있어 rotateZ는 0.
// 자리 · 너비는 친 글자 덩이와 같은 칸(왼쪽 절반)에 맞춘다. 종이라서 그늘은 drop-shadow 하나(장면 위에 몇 mm 뜬 종이).
const DRAWN = [
  { src: 'p8/title-1.png', x: 40, y: 96, w: 600 },
  { src: 'p8/title-2.png', x: 92, y: 318, w: 800 },
  { src: 'p8/title-3.png', x: 26, y: 570, w: 780 },
];
// 장면 안 끝(EndScene)의 로고 자리 — 제목 덩이가 여기로 모여 로고가 된다(v3 Fable 「원본은 제목 = 브랜드 한 몸 · 우리는 흩어진 뒤 하드컷」)
// v4 마감: 20c 판은 남자 손님 어깨가 x 760부터라 처음 자리(170 · 600px)는 「PULSE」가 어깨에 걸쳤다(v3 Fable 3차) — 왼쪽 · 위로 당기고 조금 줄임
const LOGO_W = 540, LOGO_X = 96, LOGO_Y = 742;
const LOGO_C = { x: LOGO_X + LOGO_W / 2, y: LOGO_Y + LOGO_W * 360 / 1359 / 2 };
const Title: React.FC<{ t: number; drawn: boolean; scene: boolean }> = ({ t, drawn, scene }) => {
  if (t < TITLE_IN - 0.01 || t >= T(21) + (scene ? 0.12 : 0)) return null;
  const outU = ramp(t, 28.2, T(21) - 28.2, SNAP);
  const goal = scene ? LOGO_C : { x: 960, y: 540 };   // 흰 끝 화면은 가운데 로고 자리로
  const items = drawn ? DRAWN : CHUNKS;
  return (
    <>
      <AbsoluteFill style={{ zIndex: 21, opacity: ramp(t, TITLE_IN, 0.25, lin) * (1 - outU), background: 'radial-gradient(1200px 820px at 520px 460px, #00000052, #00000000)' }} />
      <div style={{ position: 'absolute', inset: 0, zIndex: 22, perspective: 1400 }}>
        {items.map((_, i) => {
          const c = CHUNKS[i];
          const d = DRAWN[i];
          const u = ramp(t, TITLE_IN + c.at, 0.24, EXPO);
          const drift = ramp(t, TITLE_IN + c.at + 0.24, 1.3, lin);
          // 28.2초부터 덩이가 로고 자리로 모이며 작아져 로고로 이어진다 — 원본은 글자가 가운데로 모여 앱 아이콘이 된다
          const fly = ramp(t, 28.2 + i * 0.03, 0.2, SNAP);
          const x0 = drawn ? d.x : c.x, y0 = drawn ? d.y : c.y;
          const cx = drawn ? d.x + d.w / 2 : c.x + c.size * c.s.length * 0.47, cy = drawn ? d.y + d.w * 0.18 : c.y + c.size * 0.5;
          const tf = [
            `translate(${(1 - u) * -260 + fly * (goal.x - cx)}px, ${(1 - u) * 30 + fly * (goal.y - cy)}px)`,
            `rotateY(${(1 - u) * -80 + 20 - fly * 20}deg)`,
            `rotateZ(${drawn ? 0 : c.rot * (1 - fly)}deg)`,
            `scale(${(0.7 + 0.3 * u) * (1 + drift * 0.03) * (1 - fly * 0.7)})`,
          ].join(' ');
          const op = Math.min(1, u * 1.6) * (1 - fly * 0.85);
          if (drawn) {
            return <Img key={i} src={staticFile(d.src)} style={{ ...abs(x0, y0, d.w), transformOrigin: '0% 50%', transform: tf, opacity: op, filter: 'drop-shadow(0 7px 10px #00000066)' }} />;
          }
          return (
            <div key={i} style={{ ...abs(x0, y0), transformOrigin: '0% 50%', transform: tf, opacity: op,
              fontFamily: KO, fontWeight: 900, fontSize: c.size, lineHeight: 1, letterSpacing: '-0.06em', color: c.color, whiteSpace: 'nowrap',
              textShadow: c.color === '#FFFFFF' ? '0 3px 22px #00000059' : '0 3px 22px #00000040' }}>
              {[...c.s].map((ch, k) => (
                <span key={k} style={{ display: 'inline-block', transform: `translateY(${c.gy?.[k] ?? 0}px) rotate(${c.gr?.[k] ?? 0}deg) scaleY(${c.sy?.[k] ?? 1}) scaleX(${0.94 + 0.06 * (c.sy?.[k] ?? 1)})`, transformOrigin: '50% 80%' }}>{ch}</span>
              ))}
            </div>
          );
        })}
      </div>
    </>
  );
};

// 끝 화면(card) — 흰 바탕, 승인 로고(펠트 synk + 실땀 PULSE)가 크게 떴다가 0.5초에 작아지고, 29.0초부터 아래 작은 한 줄(콘티 5절 3)
// v4: 「PULSE 모델 캐스팅북 · …」 긴 회색 한 줄은 휴대폰에서 못 읽음(v3 Fable) — 주소만 크게(이름은 로고 · 내레이션이 말한다)
const URL_LINE = 'synk.im/pulse/casting';
const EndCard: React.FC<{ t: number }> = ({ t }) => {
  const a = T(21);
  if (t < a) return null;
  // 한 방에 작아진다(0.32초) · 자리는 처음부터 그대로 — v1은 0.5초에 줄며 위로 22px 밀리고 0.5초 뒤 끝 줄이 따로 떠 「두 단계라 잔다」(11-07 v1 Fable)
  const u = ramp(t, a + 0.02, 0.32, EXPO);
  const w = 1180 + (520 - 1180) * u;
  const h = w * 360 / 1359;
  const line = ramp(t, a + 0.3, 0.22, EXPO);
  return (
    <AbsoluteFill style={{ zIndex: 30, background: '#FFFFFF' }}>
      <Img src={staticFile('p8/brand-pulse.png')} style={{ ...abs((1920 - w) / 2, 518 - h / 2, w, h) }} />
      <div style={{ ...abs(0, 540 + 520 * 360 / 1359 / 2 + 34, 1920), textAlign: 'center', fontFamily: KO, fontWeight: 650, fontSize: 58, letterSpacing: '0', color: '#222222', opacity: line, transform: `translateY(${(1 - line) * 8}px)` }}>{URL_LINE}</div>
    </AbsoluteFill>
  );
};

// 끝 화면(scene, v4 기본 — 슬롭 점검표 1번 「판으로 장면을 덮지 않는다 · 브랜드는 마지막 장면 안」) — 판 없이 마지막 장면(20번 이어짐) 안
// 왼쪽 아래 밝은 나무 바닥에 로고 · 주소. 제목 덩이가 28.2초부터 이 로고 자리로 모여 작아지고, 28.42초에 그 자리에서 로고가 커지며 나온다(제목 = 브랜드 한 몸).
const EndScene: React.FC<{ t: number }> = ({ t }) => {
  const a = T(21);
  if (t < a - 0.04) return null;
  const u = ramp(t, a - 0.04, 0.34, EXPO);
  const line = ramp(t, a + 0.3, 0.22, EXPO);
  const s = 0.55 + 0.45 * u;
  const lh = LOGO_W * 360 / 1359;
  return (
    <>
      <AbsoluteFill style={{ zIndex: 29, opacity: u, background: `radial-gradient(1000px 460px at ${LOGO_C.x}px ${LOGO_C.y + 40}px, #FFF8EEB0, #FFF8EE00)` }} />
      {/* 바닥에 놓인 듯 — 창 쪽(왼쪽 위)에서 오는 빛의 짧고 따뜻한 그늘(v3 Fable 3차 「빛 · 그림자와 무관하게 친 글자」) */}
      <Img src={staticFile('p8/brand-pulse.png')} style={{ ...abs(LOGO_X, LOGO_Y, LOGO_W, lh), zIndex: 30, opacity: Math.min(1, u * 1.4), transform: `scale(${s})`, transformOrigin: '50% 50%', filter: 'drop-shadow(6px 8px 10px #5A321866)' }} />
      {/* 주소 — 가늘고 작아 휴대폰에서 못 읽음(v3 Fable 3차) → 굵게 · 크게, 뒤에 옅은 빛 */}
      <div style={{ ...abs(LOGO_X, LOGO_Y + lh + 14, 1100), zIndex: 30, fontFamily: KO, fontWeight: 760, fontSize: 62, letterSpacing: '-0.01em', color: '#2A1A12', opacity: line, transform: `translateY(${(1 - line) * 8}px)`, textShadow: '0 0 18px #FFF6E8CC, 0 0 4px #FFF6E8AA' }}>{URL_LINE}</div>
    </>
  );
};

// 말자막 — 다 비침 30초 판(RS60) 결에서 출발해 11-08 Fable 자막 검수(「고치고 통과」)로 고친 판:
//   ① 자리 체계 — 속말은 왼쪽 한 기둥(글 왼쪽 끝 x 176), 6번 컷(폰 속 얼굴이 화면을 채움)만 오른쪽 거울 자리(글 오른쪽 끝 1744), 사람 말은 가운데.
//      첫 판은 속말을 컷마다 가운데 · x 470 · 330 · 1720(가운데 기준)으로 옮겨 「자막이 떠돈다 · 급히 피한 자리」로 읽혔다.
//   ② 크기 · 굵기 · 그늘 — 46px 가는 획 + 옅은 띠는 휴대폰(390px 폭)에서 9px로 녹았다 → 속말 54px · 사람 말 58px, 띠와 그늘이 실제로 일하게.
//   ③ 속말을 옅은 푸른 회색으로 가르니 「바랜 자막」으로 읽혔다 → 거의 흰색에 아주 옅은 찬 기만, 말과 속말의 구분은 자리(왼쪽 기둥 / 가운데)가 맡는다.
type Sub = { a: number; b: number; s: string; who: string; inner?: boolean; align?: 'left' | 'right' | 'center'; x?: number };
const SUBS = ((timing as { subs?: Sub[] }).subs ?? []);
const PAPER = '#F6F3EC';
const INNER = '#E9EDF0';
const noDot = (s: string) => s.replace(/[.。…]+$/, '');
const Caption: React.FC<{ t: number }> = ({ t }) => {
  const c = SUBS.find((l) => t >= l.a && t < l.b);
  if (!c) return null;
  const o = Math.min(ramp(t, c.a, 0.12, lin), 1 - ramp(t, c.b - 0.14, 0.14, lin));
  const inner = c.inner === true;
  const size = inner ? 54 : 58;
  const align = c.align ?? 'center';
  const x = c.x ?? 960;
  const est = [...noDot(c.s)].length * size * 0.94;   // 띠를 글 가운데에 깔려고 어림한 글 폭
  const cx = align === 'left' ? x + est / 2 : align === 'right' ? x - est / 2 : x;
  const w = 1300;
  const left = align === 'left' ? x : align === 'right' ? x - w : x - w / 2;
  // 띠는 글 둘레에만(옆 기둥 자막이 폰 화면을 어둡게 하지 않게). 첫 판(가운데 #000000b0)은 글자 둘레 밝기 차가 10 남짓이라 휴대폰에서 일을 안 했다(Fable)
  const band = `radial-gradient(${Math.round(est + 560)}px 270px at ${Math.round(cx)}px 1000px, #000000cc, #00000085 42%, #00000000 100%)`;
  return (
    <>
      <AbsoluteFill style={{ zIndex: 17, opacity: o, background: band }} />
      <div style={{ position: 'absolute', left, width: w, bottom: 82, zIndex: 18, textAlign: align, opacity: o, fontFamily: KO,
        color: inner ? INNER : PAPER, fontWeight: inner ? 500 : 560, fontSize: size, lineHeight: 1.3, letterSpacing: '-0.005em',
        wordBreak: 'keep-all', whiteSpace: 'pre-line',
        textShadow: '0 0 2px #000000e6, 0 0 9px #000000b8, 0 2px 22px #000000a8' }} data-who={c.who}>
        {noDot(c.s)}
      </div>
    </>
  );
};

// copy: 'a' 글자 1 · 2를 얹음(최종) · 'b' 글자 없이(견줄 시안 — 슬롭 점검표 24번 「그릴 여력이 없으면 말로」 · 폰 화면의 「패키지에 담김」 알림이 대신 말한다)
// v4 기본: 장면 안 끝(scene) · 그린 제목(drawn). 견줄 판: end='card'(10-26 흰 끝 화면) · title='type'(친 글자).
export const P8: React.FC<{ end?: 'card' | 'scene'; copy?: 'a' | 'b'; title?: 'drawn' | 'type'; subs?: 'on' | 'off' }> = ({ end = 'scene', copy = 'a', title = 'drawn', subs = 'on' }) => {
  const t = useCurrentFrame() / FPS;
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <OffthreadVideo src={staticFile('p8/picture.mp4')} muted style={{ width: '100%', height: '100%' }} />
      {subs === 'on' && <Caption t={t} />}
      {copy === 'a' && <Copy1 t={t} />}
      {copy === 'a' && <Copy2 t={t} />}
      <Title t={t} drawn={title === 'drawn'} scene={end === 'scene'} />
      {end === 'card' ? <EndCard t={t} /> : <EndScene t={t} />}
      <Audio src={staticFile('p8/sound.wav')} />
    </AbsoluteFill>
  );
};
