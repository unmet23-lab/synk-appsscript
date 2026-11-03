// 「매진 임박」 자막 · 모션그래픽 — 섞은 판 결(11-03 밤 유호님 「세 편에 넣기」)
//   컷 · 초 · 구도 · 홈쇼핑 카드는 원본 1:1 그대로(10-23 유호님 「구성을 아예 똑같이」) — 화면 글만 바꾼다
//   말자막(S42 상자, 핵심 낱말 레몬): 대사마다. 홈쇼핑 카드 셋(11 · 21 · 29) 위에는 안 얹는다(카드 글이 곧 자막)
//   A(사람 뒤 큰 글자): 강도 컷 둘 — 2 「내놔!」 · 23 「한국말이야?」(마스크 피사체따기_rembg.py hs, 자리는 ../가림검사.py · ../자리찾기.py)
//   B(색 블록 한 방): 끝 브랜드 — 16:9은 마지막 컷에 종이 블록(PULSE Ink 로고 · 제품 광고 문의), 9:16은 원본처럼 67.21초에 머리글이 같은 블록으로 바뀐다
// 9:16은 원본 릴스처럼 가운데 16:9 띠(1080×608) + 위 머리글 · 아래 말자막. 화면 · 소리는 git 밖 public(hs/picture.mp4 1920×1080 · sound.wav)
import React from 'react';
import { AbsoluteFill, Img, OffthreadVideo, staticFile, useCurrentFrame } from 'remotion';
import { Audio } from '@remotion/media';
import { KO } from '../lib/fonts';
import { EXPO, life, pop, ramp } from '../lib/motion';
import { MaskCut, maskAt, ProbeMeta, probeChars, Subject } from '../lib/subject';
import masks from './masks.json';

const FPS = 24;
export const HS_FRAMES = 1743;   // 원본 31컷 72.625초 — homeshopping-horror 최종편집.py 화면.mp4
const INK = '#0E1320', PAPER = '#F6F3EA', LEMON = '#FFD43B';
const MASKS = masks as MaskCut[];
const HEAD_CHANGE = 67.21;   // 원본 머리글이 바뀌는 자리(#30 도중)
// 컷 첫 프레임(원본_샷.json f0, 끝은 f1) — 자막 꼬리를 컷에서 끊는 데 쓴다
const SHOT_F = [0, 13, 33, 80, 112, 160, 196, 218, 245, 274, 337, 439, 462, 502, 560, 593, 615, 640, 681, 730, 762, 936, 992, 1098, 1135, 1175, 1314, 1379, 1430, 1546, 1699, 1743];
const LAST = SHOT_F[30] / FPS;   // #31 첫 프레임
const abs = (x: number, y: number, w?: number, h?: number): React.CSSProperties => ({ position: 'absolute', left: x, top: y, width: w, height: h });
const noDot = (s: string) => s.replace(/\.$/, '');

// 말자막 — 시각은 최종편집.py EVENTS(놓은 자리), 글은 받아쓰기(large-v3)로 확인한 실제 말. ks: ★ 낱말이 레몬으로 바뀌는 초(없으면 줄 처음)
// up: 16:9에서 화면 위에 — 끼어듦 카드(27)는 아래에서 손이 떡볶이를 들어 올려 아래 자막이 덮는다
// 29.80은 콘티가 「잠깐만요!」였지만 판 목소리가 「안 돼!」다(받아쓰기 두 모델, 11-03)
const CAP: { a: number; b: number; s: string; ks?: number[]; up?: boolean }[] = [
  { a: 0.0, b: 1.3, s: '가진 거 다 ★내놔!', ks: [0.46] },
  { a: 1.38, b: 2.4, s: '★여기요!' },
  { a: 2.92, b: 4.85, s: '다 앉아, ★당장!', ks: [3.92] },
  { a: 7.34, b: 8.8, s: '이게 ★전부예요!' },
  { a: 9.05, b: 10.0, s: '★진짜!' },
  { a: 12.26, b: 14.04, s: '안 돼 안 돼 안 돼 ★안 돼!', ks: [13.18] },
  { a: 18.3, b: 19.8, s: '★안 돼!' },
  { a: 23.32, b: 25.4, s: '안 돼! ★안 돼!', ks: [24.58] },
  { a: 29.8, b: 31.75, s: '★안 돼!' },
  { a: 39.6, b: 41.33, s: '★제발요!' },
  { a: 42.4, b: 44.45, s: '방금 그거 ★한국말이야?', ks: [43.3] },
  { a: 44.56, b: 46.9, s: '안 돼! ★안 돼!', ks: [45.79] },
  { a: 47.46, b: 48.4, s: '★으!' },
  { a: 52.6, b: 54.75, s: '★세상에…!' },
  { a: 54.9, b: 55.8, s: '…★왜?', up: true },
  { a: 57.46, b: 59.58, s: '안 돼, 내 ★코케트 ★떡볶이!', ks: [58.98, 58.98] },
  { a: SHOT_F[29] / FPS, b: 66.75, s: '그거 내 ★저녁인데!', ks: [64.24] },   // 말은 63.99에 시작하지만 그땐 카드 3(아래 「1577-꽉꽉」)이라 #30 첫 프레임부터
  { a: 67.92, b: 70.79, s: '★그냥 ★죽여!', ks: [67.92, 69.32] },
];
// 꼬리 0.2초는 다음 컷에서 끊는다 — 컷 끝에서 끝나는 줄이 홈쇼핑 카드 첫 프레임까지 남았다(11-04 경계 검수)
const tailEnd = (b: number) => { const nx = SHOT_F.find((f) => f / FPS >= b - 1 / FPS); return Math.min(b + 0.2, nx !== undefined ? nx / FPS : b + 0.2); };
// 머리 0.05초 앞당김도 앞 컷으로 넘지 않게(컷 첫 프레임에 시작하는 줄이 카드 마지막 프레임에 한 장 뜬다)
const headStart = (a: number) => { const pv = [...SHOT_F].reverse().find((f) => f / FPS <= a + 1e-6); return Math.max(a - 0.05, pv !== undefined ? pv / FPS : 0); };
const capAt = (t: number) => CAP.find((c) => t >= headStart(c.a) && t < tailEnd(c.b));
// 18자가 넘는 문장은 가운데에 가장 가까운 낱말 사이에서 두 줄로(9:16)
const splitAt = (ws: string[]) => {
  const full = ws.join(' ');
  if (full.length <= 18) return ws.length;
  let best = 1, gap = 1e9, acc = 0;
  ws.forEach((w, i) => { acc += w.length + 1; const d = Math.abs(acc - full.length / 2); if (i < ws.length - 1 && d < gap) { gap = d; best = i + 1; } });
  return best;
};
const Caption: React.FC<{ t: number; y: number; x: number; w: number; size: number; wrap?: boolean; upY?: number }> = ({ t, y, x, w, size, wrap, upY }) => {
  const c = capAt(t);
  if (!c) return null;
  if (c.up && upY !== undefined) y = upY;
  const end = tailEnd(c.b);
  const o = life(t, headStart(c.a), end, 0.12, end < c.b + 0.2 - 1e-6 ? 0.001 : 0.12);   // 컷에서 끊기는 줄은 흐려지지 않고 컷과 함께 사라진다
  const ws = c.s.split(' ');
  const cut = wrap ? splitAt(ws.map((s) => s.replace('★', ''))) : ws.length;
  let k = -1;
  return (
    <div style={{ ...abs(x, y, w), zIndex: 25, textAlign: 'center', opacity: o }}>
      <span style={{ fontFamily: KO, fontWeight: 650, fontSize: size, lineHeight: 1.32, color: PAPER, background: '#0E1320e0', boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone', padding: '10px 24px', borderRadius: 12 }}>
        {ws.map((s, i) => {
          const key = s.startsWith('★');
          if (key) k++;
          const on = key && t >= (c.ks?.[k] ?? c.a);
          return <React.Fragment key={i}>{i === cut ? <br /> : null}<span style={{ color: on ? LEMON : PAPER }}>{noDot(s.replace('★', ''))}{i < ws.length - 1 && i + 1 !== cut ? ' ' : ''}</span></React.Fragment>;
        })}
      </span>
    </div>
  );
};

// 큰 낱말(16:9 화면 좌표) — light: 어두운 바탕 위 밝은 글자, front: 피사체 앞, x: 정렬(기본 왼쪽)
type Big = { w: string; a: number; b: number; y: number; size: number; x?: 'c' | 'r'; light?: boolean; front?: boolean };
const BIG: Big[] = [
  { w: '내놔!', a: 13 / FPS, b: 33 / FPS, y: 300, size: 260, x: 'r', light: true },   // #2 강도 미디엄 — 340이면 칼날(마스크에 안 잡힘) 위를 글자가 덮어(11-04 GPT 검수) 오른쪽 벽으로, 뻗은 손끝만 글자 앞을 지난다
  { w: '한국말이야?', a: 42.4, b: 44.45, y: 180, size: 200, x: 'r', light: true },     // #23 상자를 들고 본다 — 220이면 반응 연기보다 글자가 먼저 보여 줄임
];
const behind = (t: number, b: Big) => !!maskAt(MASKS, t) && !b.front;
const bigBox = (t: number, b: Big): React.CSSProperties => {
  const p = pop(t, b.a, b.b - b.a < 1.2 ? 0.26 : 0.42);
  const out = 1 - ramp(t, b.b - 0.1, 0.1);
  return { ...abs(56, b.y, 1808), textAlign: b.x === 'c' ? 'center' : b.x === 'r' ? 'right' : 'left', fontFamily: KO, fontWeight: 800, fontSize: b.size, letterSpacing: '-0.05em', lineHeight: 1, whiteSpace: 'nowrap', opacity: Math.min(1, p) * out, transform: `translateY(${(1 - p) * 90}px)` };
};

// 16:9 화면 한 장 — 원본 그림 + 큰 낱말 + 강도 다시 얹기. 9:16은 이 판을 0.5625로 줄여 가운데 띠에 둔다
const Film: React.FC<{ t: number; probe?: boolean }> = ({ t, probe }) => {
  const i = BIG.findIndex((b) => t >= b.a && t < b.b);
  const b = i >= 0 ? BIG[i] : null;
  if (probe) return b ? <><ProbeMeta i={i} behind={behind(t, b)} light={b.light} /><div style={bigBox(t, b)}>{probeChars(b.w)}</div></> : null;
  return (
    <>
      <OffthreadVideo src={staticFile('hs/picture.mp4')} muted style={{ ...abs(0, 0, 1920, 1080) }} />
      {b && <div style={{ ...bigBox(t, b), zIndex: behind(t, b) ? 3 : 6, color: b.light ? PAPER : INK, textShadow: b.light ? '0 6px 40px #0E132080' : undefined }}>{b.w}</div>}
      <Subject film="hs" cuts={MASKS} t={t} />
    </>
  );
};

// B 블록 — PULSE Ink 로고 + 「제품 광고 문의」를 종이 블록에(PULSE 사업명은 고유색을 지켜 어두운 바탕에 베리 판을 깔지 않는다)
const Brand: React.FC<{ t: number; at: number; style: React.CSSProperties; logo: number; text: number; origin: string }> = ({ t, at, style, logo, text, origin }) => {
  if (t < at) return null;
  const p = ramp(t, at, 0.16, EXPO);
  const punch = 1 + (1 - ramp(t, at, 0.14)) * 0.06;
  return (
    <div style={{ ...style, zIndex: 26, background: PAPER, borderRadius: 18, padding: '26px 34px 26px', boxShadow: '0 24px 60px #0007', clipPath: `inset(0 ${(1 - p) * 100}% 0 0 round 18px)`, transform: `scale(${punch})`, transformOrigin: origin }}>
      <Img src={staticFile('hs/pulse-ink.png')} style={{ width: logo, display: 'block' }} />
      <div style={{ fontFamily: KO, fontWeight: 700, fontSize: text, color: INK, marginTop: 14, letterSpacing: '-0.03em' }}>제품 광고 문의</div>
    </div>
  );
};

const NOTICE = '가상 브랜드 · AI로 만든 가상 모델 · 음성';

export const HS16: React.FC<{ probe?: boolean }> = ({ probe }) => {
  const t = useCurrentFrame() / FPS;
  if (probe) return <AbsoluteFill style={{ background: '#000' }}><Film t={t} probe /></AbsoluteFill>;
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <Film t={t} />
      <Caption t={t} x={0} y={918} w={1920} size={54} upY={96} />
      <Brand t={t} at={LAST} style={{ ...abs(1372, 742) }} logo={420} text={44} origin="right bottom" />
      <div style={{ ...abs(0, 1034, 1880), zIndex: 30, textAlign: 'right', fontFamily: KO, fontWeight: 500, fontSize: 22, color: '#ffffff96' }}>{NOTICE}</div>
      <Audio src={staticFile('hs/sound.wav')} />
    </AbsoluteFill>
  );
};

// 9:16 위 띠 머리글 — 원본 두 줄 그대로(글은 원본 자리 · 뜻 그대로), 꼴만 섞은 판 머리글(왼쪽 정렬 · 굵기 둘 · 얇은 줄)
const Head9: React.FC<{ t: number }> = ({ t }) => {
  const o = 1 - ramp(t, HEAD_CHANGE - 0.08, 0.08);
  return (
    <>
      <div style={{ ...abs(64, 420, 952), zIndex: 20, opacity: o * Math.min(1, ramp(t, 0, 0.3)) }}>
        <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 92, lineHeight: 1.04, letterSpacing: '-0.05em', color: PAPER }}>홈쇼핑 덕후</div>
        <div style={{ fontFamily: KO, fontWeight: 650, fontSize: 52, lineHeight: 1.2, letterSpacing: '-0.03em', color: PAPER, opacity: 0.78, marginTop: 10 }}>코미디 스케치를 만들었다</div>
      </div>
      <div style={{ ...abs(64, 616, 952, 2), zIndex: 20, background: PAPER, opacity: 0.3 * o }} />
    </>
  );
};

export const HS9: React.FC = () => {
  const t = useCurrentFrame() / FPS;
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <div style={{ ...abs(0, 656, 1920, 1080), transform: 'scale(0.5625)', transformOrigin: 'left top', overflow: 'hidden' }}><Film t={t} /></div>
      <Head9 t={t} />
      {/* 검은 여백이 넓어 글자를 16:9 비례보다 키운다(11-04 GPT 검수) */}
      <Brand t={t} at={HEAD_CHANGE} style={{ ...abs(64, 318) }} logo={600} text={62} origin="left bottom" />
      <Caption t={t} x={48} y={1334} w={984} size={66} wrap />
      <div style={{ ...abs(0, 1858, 1080), zIndex: 30, textAlign: 'center', fontFamily: KO, fontWeight: 500, fontSize: 22, color: '#ffffff88' }}>{NOTICE}</div>
      <Audio src={staticFile('hs/sound.wav')} />
    </AbsoluteFill>
  );
};
