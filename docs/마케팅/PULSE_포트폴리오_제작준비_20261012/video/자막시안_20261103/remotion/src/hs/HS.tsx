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
export const HS_FRAMES = 1796;   // 원본 31컷 72.625초 + 끝 컷 2.2초(11-05) — homeshopping-horror 최종편집.py 화면.mp4
const INK = '#0E1320', PAPER = '#F6F3EA', LEMON = '#FFD43B';
const MASKS = masks as MaskCut[];
// 컷 첫 프레임(원본_샷.json f0, 끝은 f1) — 자막 꼬리를 컷에서 끊는 데 쓴다
const SHOT_F = [0, 13, 33, 80, 112, 160, 196, 218, 245, 274, 337, 439, 462, 502, 560, 593, 615, 640, 681, 730, 762, 936, 992, 1098, 1135, 1175, 1314, 1379, 1430, 1546, 1699, 1796];
const LAST = SHOT_F[30] / FPS;   // #31 첫 프레임
const STAMP_AT = LAST + 1.08;    // 강도가 말없이 인사해 가장 깊이 숙인 순간에 도장 쾅 — 최종편집.py와 같은 값
const BRAND_AT = STAMP_AT + 3 * 0.4925;   // 도장을 읽는 곡의 세 박 — 0.55초면 로고가 도장에 붙어 들어와 한 방이 약했다(11-05 Fable). 곡의 착지가 여기에 떨어진다
const abs = (x: number, y: number, w?: number, h?: number): React.CSSProperties => ({ position: 'absolute', left: x, top: y, width: w, height: h });
const noDot = (s: string) => s.replace(/\.$/, '');

// 말자막 — 시각은 최종편집.py EVENTS(놓은 자리), 글은 받아쓰기(large-v3)로 확인한 실제 말. ks: ★ 낱말이 레몬으로 바뀌는 초(없으면 줄 처음)
// left: 16:9에서 왼쪽 아래로 — 끼어듦 카드(27)는 가운데 아래에서 손이 떡볶이를 들어 올려 가운데 자막이 덮인다. 화면 위로 올리니 시선이 튀었다(11-04 Fable)
// 29.80은 콘티가 「잠깐만요!」였지만 판 목소리가 「안 돼!」다(받아쓰기 두 모델, 11-03)
const CAP: { a: number; b: number; s: string; ks?: number[]; left?: boolean; step?: boolean }[] = [   // step: ★ 낱말이 그 초에 나타난다(말 사이가 긴 줄만)
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
  { a: 52.6, b: 54.75, s: '★세상에!' },
  { a: 54.9, b: 55.8, s: '★왜?', left: true },
  { a: 57.46, b: 59.58, s: '안 돼, 내 ★코케트 ★떡볶이!', ks: [58.98, 58.98] },
  { a: SHOT_F[29] / FPS, b: 66.75, s: '그거 내 ★저녁인데!', ks: [64.92] },   // 말과 자막 모두 #30 첫 프레임부터(최종편집.py EVENTS)
  { a: 67.92, b: 70.79, s: '★그냥 ★죽여!', ks: [67.92, 69.48], step: true },   // 「그냥」 뒤 1.5초를 흐느끼다 69.5초에 「죽여!」 — 한꺼번에 띄우니 절규보다 먼저 보여 김이 샜다(11-05 아르곤)
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
const Caption: React.FC<{ t: number; y: number; x: number; w: number; size: number; wrap?: boolean; leftW?: number }> = ({ t, y, x, w, size, wrap, leftW }) => {
  const c = capAt(t);
  if (!c) return null;
  if (c.left && leftW !== undefined) w = leftW;
  const end = tailEnd(c.b);
  const o = life(t, headStart(c.a), end, 0.12, end < c.b + 0.2 - 1e-6 ? 0.001 : 0.12);   // 컷에서 끊기는 줄은 흐려지지 않고 컷과 함께 사라진다
  let ws = c.s.split(' ');
  if (c.step) { let kk = -1; ws = ws.filter((s) => !s.startsWith('★') || t >= (c.ks?.[++kk] ?? c.a)); }
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

const endShake = (t: number) => { const x = (t - STAMP_AT) / 0.34; return x < 0 || x > 1 ? 0 : Math.sin(t * 91) * 22 * (1 - x); };

// 16:9 화면 한 장 — 원본 그림 + 큰 낱말 + 강도 다시 얹기. 9:16은 이 판을 0.5625로 줄여 가운데 띠에 둔다
const Film: React.FC<{ t: number; probe?: boolean }> = ({ t, probe }) => {
  const i = BIG.findIndex((b) => t >= b.a && t < b.b);
  const b = i >= 0 ? BIG[i] : null;
  if (probe) return b ? <><ProbeMeta i={i} behind={behind(t, b)} light={b.light} /><div style={bigBox(t, b)}>{probeChars(b.w)}</div></> : null;
  return (
    <>
      {/* 끝 컷은 판이 거의 멈춰 있어(프레임 차이 0.27) 천천히 들어가고, 도장에 한 번 흔들린다 */}
      <div style={{ ...abs(0, 0, 1920, 1080), transformOrigin: '760px 560px', transform: t >= LAST ? `translate(${endShake(t)}px,${endShake(t + 0.13) * 0.7}px) scale(${1 + 0.05 * ramp(t, LAST, HS_FRAMES / FPS - LAST, (x) => x)})` : undefined }}>
        <OffthreadVideo src={staticFile('hs/picture.mp4')} muted style={{ width: '100%', height: '100%' }} />
      </div>
      {t >= STAMP_AT && <Img src={staticFile('hs/stamp.png')} style={{ ...abs(1108, 124, 760), zIndex: 7, transformOrigin: '380px 177px', transform: `rotate(-7deg) scale(${1.62 - 0.62 * ramp(t, STAMP_AT, 0.11, (x) => x)})`, opacity: ramp(t, STAMP_AT, 0.04, (x) => x) }} />}
      {b && <div style={{ ...bigBox(t, b), zIndex: behind(t, b) ? 3 : 6, color: b.light ? PAPER : INK, textShadow: b.light ? '0 6px 40px #0E132080' : undefined }}>{b.w}</div>}
      <Subject film="hs" cuts={MASKS} t={t} />
    </>
  );
};

// 끝 브랜드 — 종이 판은 장면 위 스티커처럼 떴다(11-04 슬롭 점검표 1번 · 유호님 「밑에 첨벙댕 … 너무 슬롭같은데」와 같은 짜임). 판 없이 어두운 바탕용 로고를 장면에 바로 얹고,
// 그 자리만 살짝 어둡게 해 읽히게 한다. 튀어나오지 않고 줄 단위로 조용히 올라온다
const Brand: React.FC<{ t: number; at: number; style: React.CSSProperties; logo: number; text: number; align: 'left' | 'right'; shade?: string }> = ({ t, at, style, logo, text, align, shade }) => {
  if (t < at) return null;
  const p = ramp(t, at, 0.34, EXPO);
  const q = ramp(t, at + 0.16, 0.34, EXPO);
  return (
    <>
      {shade && <AbsoluteFill style={{ zIndex: 25, background: shade, opacity: ramp(t, at, 0.3) }} />}
      <div style={{ ...style, zIndex: 26, textAlign: align }}>
        <Img src={staticFile('hs/pulse-paper.png')} style={{ width: logo, display: 'block', marginLeft: align === 'right' ? 'auto' : 0, opacity: p, transform: `translateY(${(1 - p) * 24}px)` }} />
        <div style={{ fontFamily: KO, fontWeight: 700, fontSize: text, color: PAPER, marginTop: 6, paddingRight: align === 'right' ? 14 : 0, paddingLeft: align === 'left' ? 14 : 0, letterSpacing: '-0.03em', opacity: q, transform: `translateY(${(1 - q) * 18}px)`, textShadow: '0 2px 18px #000a' }}>제품 광고 문의</div>
      </div>
    </>
  );
};

const NOTICE = '가상 브랜드 · AI로 만든 가상 모델 · 음성';

export const HS16: React.FC<{ probe?: boolean }> = ({ probe }) => {
  const t = useCurrentFrame() / FPS;
  if (probe) return <AbsoluteFill style={{ background: '#000' }}><Film t={t} probe /></AbsoluteFill>;
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <Film t={t} />
      <Caption t={t} x={0} y={918} w={1920} size={54} leftW={980} />
      {/* 오른쪽 아래 구석은 고지 줄과 붙어 워터마크처럼 보였다(11-04 아르곤) — 문 쪽 가운데 높이로 올려 끝 제목으로.
          PULSE 베리가 어두운 벽에서 약했다(11-05) — 사업명 색은 바꾸지 않는다(로고 정본 「사업명만 임의로 밝히지 않는다」) → 로고를 키우고 뒤를 더 어둡게 */}
      <Brand t={t} at={BRAND_AT} style={{ ...abs(1166, 610, 700) }} logo={700} text={50} align="right" shade="radial-gradient(860px 400px at 1520px 720px, #000000c0, #0000)" />{/* 도장과 같은 열에 같은 폭이면 시선이 다퉜다(11-05 Fable) — 조금 줄여 아래로 */}
      {/* 끼어듦 카드(27~29)는 「1577-꽉꽉」이 오른쪽 아래라 고지 줄이 그 위를 가로질렀다(11-04 Fable) — 그동안만 왼쪽으로 */}
      <div style={{ ...abs(40, 1034, 1840), zIndex: 30, textAlign: t >= 59.4 && t < 64.5 ? 'left' : 'right', fontFamily: KO, fontWeight: 500, fontSize: 22, color: '#ffffff96' }}>{NOTICE}</div>
      <Audio src={staticFile('hs/sound.wav')} />
    </AbsoluteFill>
  );
};

// 9:16 위 띠 머리글 — 원본 두 줄 그대로(글은 원본 자리 · 뜻 그대로), 꼴만 섞은 판 머리글(왼쪽 정렬 · 굵기 둘 · 얇은 줄)
const Head9: React.FC<{ t: number }> = ({ t }) => {
  const o = 1 - ramp(t, BRAND_AT - 0.08, 0.08);   // 16:9 끝 블록과 같은 자리까지 — 「그냥 죽여!」 위로 광고 문의가 먼저 뜨면 웃음을 뺏는다(11-04 Fable)
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
      <Brand t={t} at={BRAND_AT} style={{ ...abs(56, 330, 760) }} logo={700} text={62} align="left" />
      <Caption t={t} x={48} y={1334} w={984} size={66} wrap />
      <div style={{ ...abs(0, 1858, 1080), zIndex: 30, textAlign: 'center', fontFamily: KO, fontWeight: 500, fontSize: 22, color: '#ffffff88' }}>{NOTICE}</div>
      <Audio src={staticFile('hs/sound.wav')} />
    </AbsoluteFill>
  );
};
