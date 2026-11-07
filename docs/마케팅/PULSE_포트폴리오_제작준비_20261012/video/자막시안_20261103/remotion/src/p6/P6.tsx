// 6번 「연말 빈방」 화면 글(2026-11-07, Claude) — 16:9 60초 · yearend-family-20261024/최종편집.py가 화면(p6/picture.mp4) · 소리(p6/sound.wav)를 넣고 이 판을 굽는다.
//   말자막: 원본 결 — 아래 가운데의 흰 글자 한 줄, 말한 사람 표시 없음. 이야기 영화라 섞은 판 결(큰 낱말 · 레몬 낱말)은 쓰지 않는다.
//     줄 시각은 최종소리.py가 놓은 소리 덩어리(timing.json), 꼬리는 다음 컷에서 끊는다. 마침표는 쓰지 않는다(슬롭 점검표 6번).
//     속말(21번)은 사람을 덮지 않게 얼굴 반대편 왼쪽 아래로, 뒤를 옅게 어둡게.
//   글판 둘: 검은 화면 가운데 — 제목이 말자막보다 크다. 줄마다 단순 페이드.
//   끝 문구: 문틈 장면 왼쪽 회색 벽 안(스위치 판 위쪽), 한 굵기 세 줄, 한 번에 페이드(슬롭 점검표 24번 — 글꼴 한 줄 · 프리셋 모션으로 두지 않는다).
//   로고: 직접 그린 두 단 BI 「솜채 / SOMCHAE」(솜채_로고.py — 지붕 ㅅ · 베개 ㅁ) — 「솜채.」 목소리와 함께 같은 벽 안에. 판 없이 장면에 바로(점검표 1 · 22번).
//   고지 줄은 검은 글판 두 장에만 — 장면 위에 상시 두면 「AI 회사 꼬리표」, 끝 화면에선 글이 셋(11-07 Fable).
// 11-07 Fable 맹검 E1~E7 · E11과 Gemini 심사를 반영한 판. 옛 판(낱말마다 떠오르는 끝 문구 · 표장 로고)은 git 이력에.
import React from 'react';
import { AbsoluteFill, Img, OffthreadVideo, staticFile, useCurrentFrame } from 'remotion';
import { Audio } from '@remotion/media';
import { KO } from '../lib/fonts';
import { EXPO, life, ramp } from '../lib/motion';
import timing from './timing.json';

const FPS = 24;
export const P6_FRAMES = 1440;
const PAPER = '#F4F1EA';
// 화면이 자르는 장 경계(최종편집.py F) — 자막 꼬리를 다음 컷에서 끊는다
// 22번은 화면에선 p6-22 5.0초 + 22b(1309장부터) + 22c(1405장부터)지만 같은 장 이음이라 자막 · 글 경계는 1189 하나
const CUT_F = [0, 114, 182, 239, 372, 496, 596, 683, 745, 829, 911, 986, 1058, 1110, 1189, 1440];
const CUT22 = 1189 / FPS;
const BRAND_AT: number = timing.brand_at;
const abs = (x: number, y: number, w?: number, h?: number): React.CSSProperties => ({ position: 'absolute', left: x, top: y, width: w, height: h });
const noDot = (s: string) => s.replace(/\.$/, '');
const lin = (x: number) => x;

type Line = { a: number; b: number; who: string; s: string; inner?: boolean };
// 「엄마!」는 자막을 뺐다 — 끝 3초는 로고 하나로(11-07 Fable E3, 소리로 또렷이 들린다 — Gemini 소리 맹검 9점)
const LINES = (timing.lines as Line[]).filter((l) => l.s !== '엄마!');
const tailEnd = (b: number) => {
  const nx = CUT_F.find((f) => f / FPS >= b - 1 / FPS);
  return Math.min(b + 0.3, nx !== undefined ? nx / FPS : b + 0.3);
};
const headStart = (a: number) => {
  const pv = [...CUT_F].reverse().find((f) => f / FPS <= a + 1e-6);
  return Math.max(a - 0.06, pv !== undefined ? pv / FPS : 0);
};

const Caption: React.FC<{ t: number }> = ({ t }) => {
  const c = LINES.find((l) => t >= headStart(l.a) && t < tailEnd(l.b));
  if (!c) return null;
  const end = tailEnd(c.b);
  const o = life(t, headStart(c.a), end, 0.14, end < c.b + 0.3 - 1e-6 ? 0.001 : 0.18);
  const inner = c.inner === true;   // 21번 속말(20번 끝에서 J컷으로 시작한다 — 컷 구간이 아니라 최종소리.py가 붙인 표시로 가른다)
  if (inner) {
    return (
      <>
        <AbsoluteFill style={{ zIndex: 19, opacity: o, background: 'radial-gradient(620px 190px at 330px 985px, #0000003a, #00000000)' }} />
        <div style={{ ...abs(110, 950, 900), zIndex: 20, opacity: o, fontFamily: KO, color: PAPER, fontWeight: 360, fontSize: 38, letterSpacing: '0.01em', textShadow: '0 0 2px #00000090, 0 2px 14px #00000080' }}>{noDot(c.s)}</div>
      </>
    );
  }
  return (
    <div style={{ ...abs(0, 948, 1920), zIndex: 20, textAlign: 'center', opacity: o, fontFamily: KO, color: PAPER, fontWeight: 400, fontSize: 40, textShadow: '0 0 2px #000000a0, 0 2px 16px #00000090' }} data-who={c.who}>
      {noDot(c.s)}
    </div>
  );
};

// 글판 — 원본 자리 · 초(02_콘티 3절). 제목 50px > 말자막 40px(11-07 Fable E5 「말자막이 제목보다 굵어 위계가 뒤집혔다」), 자간 벌림 없음,
// 줄마다 단순 페이드 — 둘째 줄은 0.4초 뒤(E6 「Blur In 프리셋 · 첫 줄만 뜬 시간이 길다」)
const CARDS: { a: number; b: number; lines: string[] }[] = [
  { a: 4.8, b: CUT_F[2] / FPS, lines: ['열일곱 살 딸의 방문에 노크가 필요해졌다'] },
  { a: 35.8, b: CUT_F[10] / FPS, lines: ['닫힌 문 앞이', '엄마의 자리였다'] },
];
const Card: React.FC<{ t: number }> = ({ t }) => {
  const c = CARDS.find((k) => t >= k.a && t < k.b);
  if (!c) return null;
  return (
    <div style={{ ...abs(0, 540 - c.lines.length * 44, 1920), zIndex: 10, textAlign: 'center', fontFamily: KO, fontWeight: 400, fontSize: 50, lineHeight: 1.76, color: '#F1EEE7' }}>
      {c.lines.map((s, i) => (
        <div key={i} style={{ whiteSpace: 'nowrap', opacity: ramp(t, c.a + i * 0.4, 0.7, lin) * (1 - ramp(t, c.b - 0.38, 0.36, lin)) }}>{s}</div>
      ))}
    </div>
  );
};

// 끝 문구 — 한 굵기 세 줄, 왼쪽 회색 벽 안(문틀 x 375 전, 스위치 판 y 455 위). 22번 컷 0.25초 뒤 한 번에 번지고, 「솜채.」 앞에 진다(E1)
const COPY_IN = CUT22 + 0.25;
const COPY_OUT = BRAND_AT - 0.35;
const EndCopy: React.FC<{ t: number }> = ({ t }) => {
  if (t < COPY_IN || t >= BRAND_AT) return null;
  const o = ramp(t, COPY_IN, 0.9, lin) * (1 - ramp(t, COPY_OUT, 0.32, lin));
  return (
    <div style={{ ...abs(58, 262, 330), zIndex: 15, fontFamily: KO, fontWeight: 400, fontSize: 30, lineHeight: 1.62, letterSpacing: '-0.005em', color: '#F8F5EF', textShadow: '0 0 1px #00000070, 0 1px 14px #00000050', opacity: o, transform: `translateY(${(1 - ramp(t, COPY_IN, 0.9, EXPO)) * 5}px)` }}>
      <div style={{ whiteSpace: 'nowrap' }}>아무도 자지 않는 방에도</div>
      <div style={{ whiteSpace: 'nowrap' }}>엄마는 철마다</div>
      <div style={{ whiteSpace: 'nowrap' }}>새 이불을 펴 둡니다</div>
    </div>
  );
};
// 글과 로고가 앉는 벽만 아주 옅게 — 판이 아니라 번진 어둠
const Shade: React.FC<{ t: number }> = ({ t }) => {
  if (t < CUT22) return null;
  return <AbsoluteFill style={{ zIndex: 14, background: 'radial-gradient(420px 260px at 200px 335px, #00000038, #00000000)', opacity: ramp(t, CUT22 + 0.1, 0.8, lin) }} />;
};

// 끝 로고 — 두 단 BI(솜채_로고.py render_lockup): 「솜채」가 오르고, 0.25초 뒤 아래 「SOMCHAE」가 번진다. 「솜채.」 목소리에 함께. 스위치 판 위쪽 · 문틀에서 40px 넘게(E2)
const LOGO_W = 240;
const Logo: React.FC<{ t: number }> = ({ t }) => {
  if (t < BRAND_AT - 0.05) return null;
  const w = ramp(t, BRAND_AT - 0.05, 0.75, EXPO);
  const s = ramp(t, BRAND_AT + 0.25, 0.8, EXPO);
  const box: React.CSSProperties = { ...abs(52, 228, LOGO_W), zIndex: 16 };
  return (
    <>
      <Img src={staticFile('p6/lock_word.png')} style={{ ...box, opacity: w, transform: `translateY(${(1 - w) * 9}px)` }} />
      <Img src={staticFile('p6/lock_sub.png')} style={{ ...box, opacity: s }} />
    </>
  );
};

const NOTICE = '가상 브랜드 · AI로 만든 가상 모델 · 음성';
const Notice: React.FC<{ t: number }> = ({ t }) => {
  const c = CARDS.find((k) => t >= k.a - 0.05 && t < k.b);
  if (!c) return null;
  const o = ramp(t, c.a, 0.6, lin) * (1 - ramp(t, c.b - 0.38, 0.36, lin));
  return <div style={{ ...abs(40, 1032, 1840), zIndex: 30, textAlign: 'right', fontFamily: KO, fontWeight: 500, fontSize: 19, color: '#ffffff70', opacity: o }}>{NOTICE}</div>;
};

// copy: 'a' 끝 문구를 벽에(최종) · 'b' 화면 글 없이 내레이션만(견줄 시안 — 슬롭 점검표 24번 「그릴 여력이 없으면 말로」). 시안 낱장은 --props 파일로
export const P6: React.FC<{ copy?: 'a' | 'b' }> = ({ copy = 'a' }) => {
  const t = useCurrentFrame() / FPS;
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <OffthreadVideo src={staticFile('p6/picture.mp4')} muted style={{ width: '100%', height: '100%' }} />
      <Card t={t} />
      <Shade t={t} />
      {copy === 'a' && <EndCopy t={t} />}
      <Logo t={t} />
      <Caption t={t} />
      <Notice t={t} />
      <Audio src={staticFile('p6/sound.wav')} />
    </AbsoluteFill>
  );
};
