// 로맨스 「다 비침」 짧은 판들(2026-11-08, Claude) — 판마다 파이썬 도구가 화면(<폴더>/picture.mp4) · 소리(<폴더>/sound.wav) ·
//   timing*.json(컷 경계 · 대사 시각 · 제목 카드 · 끝 장면 글이 뜨는 때)을 넣고 이 판을 굽는다.
//   rs60 = 38초 판(romance-short-20261030/짧은판.py · timing60.json) · rs30 = 30초 판(짧은판30.py · timing30.json).
//   글의 결은 4분 35초 판(RS.tsx)을 따른다: 말자막은 아래 가운데 흰 글자 · 말한 사람 표시 없음 · 마침표 없음, 긴 줄은 두 줄로 고르게.
//   속말은 같은 자리에 가늘고 푸른 회색.
//   제목 카드(C06): 김 서린 유리 너머 우산 — 뿌연 판이 걷힌 뒤 오른쪽 빈 자리에 「다 비치는 우산」 + 그린 로고(원본 시작 편 6번 자리).
//   끝(C34 입맞춤 직전): 원본 시작 편 끝처럼 장면 위에 제품 — 펼친 두 우산 팩샷(곱하기 · 스크린 두 층, 4분 판 끝 카드와 같은 사진) · 표어 두 줄 ·
//     그린 로고를 두 사람이 없는 오른쪽 열에. 뒤 빗길 불빛 위에서 읽히게 오른쪽만 옅게 어둡게.
// 38초 판 둘째 판(11-08 첫 판 교차 검수 뒤 — Gemini 「고치고 통과」 · 그록 「고치고 통과」 · Fable 「기각」):
//   자막이 작고 흰 셔츠 위에서 안 읽힘(Fable) → 44 → 50px, 글자 뒤 띠를 더 짙고 높게. 30.5초부터 뜨던 오른쪽 위 작은 로고는 「중간에 생기는 워터마크」(Fable)라 뺐다.
//   끝 카드(김 서린 유리 너머 우산 혼자 + 큰 로고)는 「가장 슬롭한 3초 · 템플릿 엔드카드」(그록) · 「밋밋함」(Gemini) → 장면 위 끝으로.
// 30초 판(11-08 유호님 「처음 10초는 참 괜찮은데 이 이후로 뭔 스토리인지 잘 모르겠어」): 글 · 제목 · 끝은 같고 판만 다르다 — 한 틀(RSShort)에 판마다 timing · 폴더만 넘긴다.
import React from 'react';
import { AbsoluteFill, Img, OffthreadVideo, staticFile, useCurrentFrame } from 'remotion';
import { Audio } from '@remotion/media';
import { KO } from '../lib/fonts';
import { EXPO, ramp } from '../lib/motion';
import t60 from './timing60.json';
import t30 from './timing30.json';

const FPS = 24;
export const RS60_FRAMES = t60.frames as number;
export const RS30_FRAMES = t30.frames as number;
const PAPER = '#F4F1EA';
const INNER = '#CFD9E0';
const abs = (x: number, y: number, w?: number, h?: number): React.CSSProperties => ({ position: 'absolute', left: x, top: y, width: w, height: h });
const noDot = (s: string) => s.replace(/[.。]+$/, '');
const lin = (x: number) => x;

type Line = { a: number; b: number; who: string; s: string; inner?: boolean };
type Timing = { frames: number; lines: Line[]; title: number[]; end: number };

// 읽을 만큼 띄운다 — 짧은 줄도 1.0초, 소리 끝 뒤 0.25초 꼬리, 다음 줄과 겹치지 않게
const spread = (raw: Line[]) => raw.map((l, i) => {
  const next = raw.slice(i + 1).find((m) => m.a > l.a);
  const want = Math.max(l.b + 0.25, l.a + 1.0);
  const b = next ? Math.min(want, next.a - 0.06) : want;
  return { ...l, a: l.a - 0.04, b };
});

const Caption: React.FC<{ t: number; lines: Line[] }> = ({ t, lines }) => {
  const c = lines.find((l) => t >= l.a && t < l.b);
  if (!c) return null;
  const o = Math.min(ramp(t, c.a, 0.12, lin), 1 - ramp(t, c.b - 0.14, 0.14, lin));
  const inner = c.inner === true;
  const two = c.s.includes('\n') || noDot(c.s).length > 18;   // \n은 파이썬 도구가 정한 줄 바꿈 자리
  const w = two ? 900 : 1300;
  // 속말은 가늘고 옅은 글자라 흰 셔츠 위(C23)에서 묻혔다(30초 판 맹검 — Fable · 그록 「대비가 부족해 못 읽음」) → 속말일 때만 아래 띠를 더 짙고 높게
  const band = inner
    ? 'linear-gradient(to top, #000000b8 0px, #00000078 150px, #00000000 320px)'
    : 'linear-gradient(to top, #00000080 0px, #00000040 120px, #00000000 270px)';
  return (
    <>
      <AbsoluteFill style={{ zIndex: 19, opacity: o, background: band }} />
      <div style={{ position: 'absolute', left: (1920 - w) / 2, width: w, bottom: 84, zIndex: 20, textAlign: 'center', opacity: o, fontFamily: KO,
        color: inner ? INNER : PAPER, fontWeight: inner ? 400 : 460, fontSize: inner ? 46 : 50, lineHeight: 1.34, letterSpacing: inner ? '0.01em' : '-0.005em',
        textWrap: 'balance', wordBreak: 'keep-all', whiteSpace: 'pre-line',
        textShadow: inner ? '0 0 4px #000000e0, 0 2px 18px #000000c0' : '0 0 3px #000000c0, 0 2px 16px #000000a0' }} data-who={c.who}>
        {noDot(c.s)}
      </div>
    </>
  );
};

// 제목 카드 C06 — 오른쪽 빈 자리(4분 판 Title과 같은 자리, 로고는 조금 작게)
const Title: React.FC<{ t: number; a: number; b: number }> = ({ t, a, b }) => {
  if (t < a - 0.05 || t >= b) return null;
  const o = ramp(t, a, 0.6, lin) * (1 - ramp(t, b - 0.28, 0.26, lin));
  const y = (1 - ramp(t, a, 0.9, EXPO)) * 8;
  return (
    <div style={{ ...abs(1300, 440 + y, 520), zIndex: 15, opacity: o, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ fontFamily: KO, fontWeight: 400, fontSize: 32, color: '#FBFBF8', letterSpacing: '0.02em', marginBottom: 24 }}>다 비치는 우산</div>
      <Img src={staticFile('rs/logo_title.png')} style={{ width: 250 }} />
    </div>
  );
};

// 끝 — C34 오른쪽 열(두 사람은 화면 왼쪽 20~62%): 팩샷 → 표어 → 로고 차례로
const End: React.FC<{ t: number; at: number }> = ({ t, at }) => {
  if (t < at - 0.1) return null;
  const k = (d: number) => ramp(t, at + d, 0.9, lin);
  const y = (d: number) => (1 - ramp(t, at + d, 1.1, EXPO)) * 7;
  return (
    <>
      {/* 오른쪽만 옅게 어둡게 — 빗길 가로등 · 자판기 불빛 위에서 글이 읽히게 */}
      <AbsoluteFill style={{ zIndex: 14, opacity: k(0), background: 'linear-gradient(to left, #000000a6 0px, #00000066 520px, #00000000 860px)' }} />
      <Img src={staticFile('rs/pack_mul.png')} style={{ ...abs(1290, 96 + y(0), 540), zIndex: 15, opacity: k(0), mixBlendMode: 'multiply' }} />
      <Img src={staticFile('rs/pack_add.png')} style={{ ...abs(1290, 96 + y(0), 540), zIndex: 16, opacity: k(0), mixBlendMode: 'screen' }} />
      <div style={{ ...abs(1290, 430 + y(0.35), 540), zIndex: 17, opacity: k(0.35), textAlign: 'center', fontFamily: KO, fontWeight: 500, fontSize: 38, lineHeight: 1.42,
        color: PAPER, letterSpacing: '-0.01em', textShadow: '0 1px 10px #00000080' }}>
        비 오는 날,<br />서로가 보이게
      </div>
      <Img src={staticFile('rs/logo_title.png')} style={{ ...abs(1290 + (540 - 210) / 2, 576 + y(0.7), 210), zIndex: 17, opacity: k(0.7) }} />
    </>
  );
};

const RSShort: React.FC<{ tm: Timing; dir: string }> = ({ tm, dir }) => {
  const t = useCurrentFrame() / FPS;
  const lines = React.useMemo(() => spread(tm.lines), [tm]);
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <OffthreadVideo src={staticFile(`${dir}/picture.mp4`)} muted style={{ width: '100%', height: '100%' }} />
      <Title t={t} a={tm.title[0]} b={tm.title[1]} />
      <End t={t} at={tm.end} />
      <Caption t={t} lines={lines} />
      <Audio src={staticFile(`${dir}/sound.wav`)} />
    </AbsoluteFill>
  );
};

export const RS60: React.FC = () => <RSShort tm={t60 as Timing} dir="rs60" />;
export const RS30: React.FC = () => <RSShort tm={t30 as Timing} dir="rs30" />;
