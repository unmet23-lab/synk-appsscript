// 로맨스 단편 「다 비침」 화면 글(2026-11-07, Claude) — 16:9 274.83초 · romance-short-20261030/최종편집.py가 화면(rs/picture.mp4) · 소리(rs/sound.wav) ·
//   로고(rs/logo_*.png, 비침_로고.py가 직접 그린 획)를 넣고 이 판을 굽는다. 화면 처리(회상 띠 · 김 서린 유리 손글씨 · 휴대폰 사진 · 제목 카드 뿌연 판)는 화면에 이미 구워져 있다.
//   말자막: 6번과 같은 결 — 아래 가운데 흰 글자, 말한 사람 표시 없음, 마침표 없음(슬롭 점검표 6번). 줄 시각은 최종소리.py가 놓은 소리 덩어리(timing.json).
//     속말(inner)은 같은 자리에 가늘게. C23 · C54 속말은 김 서린 유리의 손글씨가 글이라 자막을 달지 않는다(원본도 그 자리는 자막 없음).
//   제목 카드(C06): 오른쪽 빈 자리에 「다 비치는 우산」 한 줄 + 그린 로고 — 뿌연 판이 가라앉은 뒤(원본 16.3–17.6초 결).
//   오른쪽 위 작은 로고: 현재 장면(C24–C33 · C55–C64) — 원본이 현재 장면 내내 제품 로고를 두는 자리(02_콘티 3절).
//   끝(C70): 원본 자리(컷 2.4초 — 그의 옅은 웃음)에 왼쪽 위 흐린 나무 위로 표어 한 줄 + 로고 — 판 없이 장면에 바로, 뒤만 옅게 어둡게(슬롭 점검표 1 · 22번).
//     그는 가운데에서 걸어와 화면 오른쪽으로 빠져 왼쪽 위를 한 번도 지나지 않는다. 첫 판은 오른쪽에 두어 다가오는 그의 몸 위에 얹혔고,
//     둘째 판은 그가 빠진 뒤(컷 4.0초) 왼쪽 아래라 로고가 1.7초뿐이었다(11-07 낱장). 얼굴 가운데는 컷 3.6초까지 x 750~890(왼쪽 가장자리 615 위) — 글은 x 60~460.
//   원본의 「시작.」 · 「끝.」 · 노래 표기 「♪ 태준」은 뺐다 — 한 편 판에서 「끝.」을 영상 끝으로 읽었고(이해 시험 두 번), 노래가 연주곡이 되어 표기가 뜻이 없다.
// 둘째 판(첫 편집본 맹검 — Fable 「고치고 통과」 · Gemini 심사 뒤):
//   끝: 원본 끝 카드는 병 둘(두 맛)을 나란히 두고 닫는데 우리는 글자만 남아 「제품 없는 빈 길」로 읽혔다 → 펼친 두 우산(맑은 「비침」 · 새 색 옅은 푸른빛)
//     팩샷을 그가 지나지 않는 왼쪽 열에 두고, 아래에 표어 두 줄 · 다시 그린 로고. 팩샷은 회색 바탕 사진에서 뽑은 곱하기 · 스크린 두 층이다 — 검은 바탕
//     사진을 밝기로만 투명하게 한 판은 윤곽 · 빛만 남아 「선 그림 · 워터마크」로 읽혔고 새 색이 맑은 쪽과 안 갈렸다(둘째 맹검).
//     그는 컷 2.4–3.6초 가로 16~75%에 있고 어깨선은 세로 31% 아래라 팩샷은 위 왼쪽(가로 3~29% · 세로 11~35%), 글은 가로 15% 안쪽.
//     밝은 낮 장면 위라 원본처럼 짙은 먹청 글, 그림자 · 빛 번짐 없음(Gemini 「기본 폰트에 그림자만 넣은 꼴」).
//   말자막: 휴대폰에서 작다(Fable) → 40 → 44px, 긴 줄은 두 줄로 고르게. 글자 뒤는 늘 옅게 어둡게(아래 띠 — 자막이 뜰 때만).
//     속말은 같은 글꼴 · 같은 색이라 화면만으로는 말과 갈리지 않았다 → 더 가늘고(330) 작게(40) 푸른 회색.
//   C60(눈 익스트림 클로즈업) 속말이 입술 · 턱 위에 얹혔다 → 그 컷만 맨 아래(입술 아래 턱 끝 자리)로 내리고 띠를 조금 짙게.
import React from 'react';
import { AbsoluteFill, Img, OffthreadVideo, staticFile, useCurrentFrame } from 'remotion';
import { Audio } from '@remotion/media';
import { KO } from '../lib/fonts';
import { EXPO, ramp } from '../lib/motion';
import timing from './timing.json';

const FPS = 24;
export const RS_FRAMES = 6596;
const PAPER = '#F4F1EA';
// 화면이 자르는 장 경계(최종편집.py F) — 컷 i(0 = C01)의 시작 장
const F = [0, 64, 143, 190, 276, 372, 456, 528, 655, 678, 701, 810, 910, 983, 1165, 1188, 1230, 1313, 1461, 1644, 1813, 1916, 2021, 2212, 2278, 2350, 2392,
  2550, 2629, 2700, 2759, 2778, 2845, 2943, 3027, 3107, 3143, 3197, 3307, 3404, 3476, 3582, 3680, 3822, 3907, 3982, 4063, 4180, 4289, 4441, 4599, 4700, 4754,
  5100, 5270, 5334, 5361, 5470, 5567, 5611, 5777, 5814, 5966, 6073, 6129, 6164, 6246, 6294, 6352, 6460, 6596];
const cutT = (c: number) => F[c - 1] / FPS;   // C번호 → 시작 초
const abs = (x: number, y: number, w?: number, h?: number): React.CSSProperties => ({ position: 'absolute', left: x, top: y, width: w, height: h });
const noDot = (s: string) => s.replace(/[.。]+$/, '');
const lin = (x: number) => x;

type Line = { a: number; b: number; who: string; s: string; inner?: boolean };
const RAW = timing.lines as Line[];
// 읽을 만큼 띄운다 — 짧은 줄도 1.0초, 소리 끝 뒤 0.25초 꼬리, 다음 줄과 겹치지 않게
const LINES = RAW.map((l, i) => {
  const next = RAW.slice(i + 1).find((m) => m.a > l.a);
  const want = Math.max(l.b + 0.25, l.a + 1.0);
  const b = next ? Math.min(want, next.a - 0.06) : want;
  return { ...l, a: l.a - 0.04, b };
});

const INNER = '#CFD9E0';
const C60_A = cutT(60), C60_B = cutT(61);
const Caption: React.FC<{ t: number }> = ({ t }) => {
  const c = LINES.find((l) => t >= l.a && t < l.b);
  if (!c) return null;
  const o = Math.min(ramp(t, c.a, 0.12, lin), 1 - ramp(t, c.b - 0.14, 0.14, lin));
  const inner = c.inner === true;
  const low = c.a >= C60_A - 0.1 && c.a < C60_B;   // C60 — 얼굴이 화면을 다 채운 컷
  // 한 줄 18자(빈칸 포함)를 넘으면 두 줄로 고르게(넷플릭스 한국어 한 줄 16자 언저리) — 아래 끝은 늘 같은 자리. C60은 입술 위로 올라가지 않게 한 줄 그대로
  const two = !low && noDot(c.s).length > 18;
  const w = two ? 820 : 1260;
  return (
    <>
      <AbsoluteFill style={{ zIndex: 19, opacity: o, background: `linear-gradient(to top, #000000${low ? '66' : '4d'} 0px, #00000000 ${low ? 250 : 230}px)` }} />
      <div style={{ position: 'absolute', left: (1920 - w) / 2, width: w, bottom: low ? 26 : 92, zIndex: 20, textAlign: 'center', opacity: o, fontFamily: KO,
        color: inner ? INNER : PAPER, fontWeight: inner ? 330 : 420, fontSize: inner ? 40 : 44, lineHeight: 1.34, letterSpacing: inner ? '0.01em' : '-0.005em',
        textWrap: 'balance', wordBreak: 'keep-all', textShadow: '0 0 2px #000000b0, 0 2px 14px #00000090' }} data-who={c.who}>
        {noDot(c.s)}
      </div>
    </>
  );
};

// 제목 카드 C06 — 오른쪽 빈 자리
const TITLE_A = cutT(6), TITLE_B = cutT(7);
const Title: React.FC<{ t: number }> = ({ t }) => {
  if (t < TITLE_A || t >= TITLE_B) return null;
  const inT = TITLE_A + 1.85;
  const o = ramp(t, inT, 0.8, lin) * (1 - ramp(t, TITLE_B - 0.28, 0.26, lin));
  const y = (1 - ramp(t, inT, 1.0, EXPO)) * 8;
  return (
    <div style={{ ...abs(1300, 430 + y, 520), zIndex: 15, opacity: o, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ fontFamily: KO, fontWeight: 400, fontSize: 29, color: '#FBFBF8', letterSpacing: '0.02em', marginBottom: 26 }}>다 비치는 우산</div>
      <Img src={staticFile('rs/logo_title.png')} style={{ width: 300 }} />
    </div>
  );
};

// 오른쪽 위 작은 로고 — 현재 장면
const BUG: [number, number][] = [[cutT(24), cutT(34)], [cutT(55), cutT(65)]];
const Bug: React.FC<{ t: number }> = ({ t }) => {
  const r = BUG.find(([a, b]) => t >= a && t < b);
  if (!r) return null;
  const o = 0.8 * Math.min(ramp(t, r[0] + 0.2, 0.5, lin), 1 - ramp(t, r[1] - 0.35, 0.3, lin));
  return <Img src={staticFile('rs/logo_bug.png')} style={{ ...abs(1920 - 58 - 84, 46, 84), zIndex: 12, opacity: o, filter: 'drop-shadow(0 1px 3px #00000050)' }} />;
};

// 끝 — C70 왼쪽 열(태준은 가운데에서 걸어와 화면 오른쪽으로 빠진다) · 팩샷 → 표어 → 로고 차례로
const END_IN = cutT(70) + 2.4;
const INK = '#222C36';
const End: React.FC<{ t: number }> = ({ t }) => {
  if (t < END_IN - 0.1) return null;
  const k = (d: number) => ramp(t, END_IN + d, 0.9, lin);
  const y = (d: number) => (1 - ramp(t, END_IN + d, 1.1, EXPO)) * 7;
  return (
    <>
      {/* 팩샷 두 층 — 곱하기(뒤 장면을 덮개만큼 조금 어둡게 · 새 색은 옅은 푸른빛으로 물들임) + 스크린(살 · 테 · 마개의 빛). 같은 회색 바탕 사진에서 뽑아 딱 맞는다 */}
      <Img src={staticFile('rs/pack_mul.png')} style={{ ...abs(46, 100 + y(0), 600), zIndex: 15, opacity: k(0), mixBlendMode: 'multiply' }} />
      <Img src={staticFile('rs/pack_add.png')} style={{ ...abs(46, 100 + y(0), 600), zIndex: 16, opacity: k(0), mixBlendMode: 'screen' }} />
      <div style={{ ...abs(74, 452 + y(0.35), 300), zIndex: 15, opacity: k(0.35), fontFamily: KO, fontWeight: 500, fontSize: 34, lineHeight: 1.4, color: INK, letterSpacing: '-0.01em' }}>
        비 오는 날,<br />서로가 보이게
      </div>
      <Img src={staticFile('rs/logo_end.png')} style={{ ...abs(72, 580 + y(0.7), 214), zIndex: 15, opacity: k(0.7) }} />
    </>
  );
};

export const RS: React.FC = () => {
  const t = useCurrentFrame() / FPS;
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <OffthreadVideo src={staticFile('rs/picture.mp4')} muted style={{ width: '100%', height: '100%' }} />
      <Title t={t} />
      <Bug t={t} />
      <End t={t} />
      <Caption t={t} />
      <Audio src={staticFile('rs/sound.wav')} />
    </AbsoluteFill>
  );
};
