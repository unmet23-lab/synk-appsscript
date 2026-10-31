// yuhobuilds Y29 「AI 홈페이지가 다 똑같은 이유」(10-31~11-01, 장부 Y29). 기획 · 칸표는 ../../../기획.md.
// 같은 화면 · 같은 박자로 두 판: A = 범수 1인칭 내레이션, B = 내레이션 없이 화면 글 + 실제 작업 소리(클릭 · 타자 · 엔터) + 배경음.
//  · 판 안은 전부 실제 화면: 10-25 · 10-31 실험에서 AI가 만든 HTML을 휴대폰 폭(390×844, 2배)으로 찍은 것(../../../자료/폰찍기.mjs).
//    AI가 지어낸 사람 이름(세무사 화면)은 찍을 때 흐렸다.
//  · 무대는 지난 두 편(Y9 검정 무대 · Y28 크림 종이)과 다르게 밝은 회색 「전시 벽」. 강조는 형광펜 한 곳.
//  · 시도마다 일곱 판이 큰 화면 한 대에서 0.3초씩 넘어가며 위 칸에 작게 쌓이고, 몰림이 드러나는 순간 그 일곱이 화면 가득한
//    큰 벽(4+3칸)으로 펼쳐진다 — 회색(색 빼면 같은 틀) → 누런 종이 → 초록 · 금색 → 일곱 색(v6, 11-01 첫 이해 시험 반영:
//    「작은 폰 카드 줄이라 눈에 박히는 장면이 없다」 · 「18~20초 작은 두 줄이 멈춰 있다」 · 「색이 달라 '다 똑같다'가 안 와닿는다」).
//  · v8(둘째 시험 반영): 회색 벽 위로 가장 센 결과(빨간 우체통) 한 장이 올라오는 약속 · 「방법 n」 · 「또 비슷한」 · 성공 예를 빨간 우체통으로.
//  · v9(셋째 시험 반영): 방법 3은 넘김 없이 바로 초록 벽(여섯 모두 16~20초에서 넘김) · 끝은 첫 장면의 회색 일곱 장이 한 장씩 제 물건 색으로(우체통 반복 대신).
import { Audio } from '@remotion/media';
import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO, MONO } from '../lib/fonts';
import { clamp } from '../lib/motion';
import { at, B, FLIP, ORDER, vo, voEnd } from './time';

export type Cut = 'A' | 'B';

// ───────────── 색 · 자리 ─────────────
const STAGE = '#ECEAE4';
const STAGE2 = '#E3E0D8';
const INK = '#151513';
const MUTED = '#7A766D';
const MARK = '#F5C445'; // 형광펜(버터) — 「한쪽으로 몰린 것」 · 강조 낱말 한 뜻으로만
const BEZEL = '#1A1A19';
const MASTER = 0.8; // Remotion은 합친 소리가 0 dBFS를 넘으면 잘라 낸다 — 모든 소리에 같은 값을 곱한다(현장 노트)

const KICK_Y = 226;
const HEAD_Y = 280;
type Box = { x: number; y: number; w: number; h: number };
const WIN: Box = { x: 200, y: 706, w: 680, h: 734 }; // 큰 화면(390 CSS px를 1.74배)
const WIN7: Box = { x: 170, y: 410, w: 740, h: 1030 }; // 물건 셋 크게(오른쪽 끝 910 — 릴스 단추 자리 920 밖)
const TH = { w: 88, h: 190, gap: 12, y: 486 }; // 위 칸 작은 화면
const TX0 = (1080 - (7 * TH.w + 6 * TH.gap)) / 2;
// 큰 벽: 위 4칸 · 아래 3칸(가운데). 오른쪽 끝 1025는 위 줄만(릴스 단추 자리 920~는 아래쪽이다).
const TILE = { w: 232, h: 396, gap: 14, y: 488 };
const tileXY = (i: number) => {
  const row = i < 4 ? 0 : 1;
  const n = row === 0 ? 4 : 3;
  const k = row === 0 ? i : i - 4;
  const x0 = (1080 - (n * TILE.w + (n - 1) * TILE.gap)) / 2;
  return { x: x0 + k * (TILE.w + TILE.gap), y: TILE.y + row * (TILE.h + TILE.gap) };
};

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const EASE_MOVE = Easing.bezier(0.77, 0, 0.175, 1);
const ease = (f: number, a: number, len: number, e = EASE_OUT) => interpolate(f, [a, a + len], [0, 1], { ...clamp, easing: e });
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpBox = (a: Box, b: Box, t: number): Box => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), w: lerp(a.w, b.w, t), h: lerp(a.h, b.h, t) });

// ───────────── 화면 목록 ─────────────
const shot = (round: string, name: string) => `shot/${round}/${name}.png`;
// 넘기는 순서: 기준은 Y5 빵집 ①로 끝난다 · 한줄B는 다른 한 판(세무사 ② 초록)이 다섯째 · 한줄E는 방금 만든 빨간 우체통 세무사가 첫째.
const R0 = ['꽃집_s_1', '세무사_s_1', '필라테스_s_1', '빵집_s_2', '세무사_s_2', '필라테스_s_2', '빵집_s_1'].map((n) => shot('기준', n));
const RB = ['빵집_s_1', '꽃집_s_1', '세무사_s_1', '필라테스_s_1', '세무사_s_2', '빵집_s_2', '필라테스_s_2'].map((n) => shot('한줄B', n));
const RB_HIT = [true, true, true, true, false, true, true]; // 누런 종이 6
const RD = ['꽃집_s_1', '빵집_s_1', '필라테스_s_1', '세무사_s_1', '빵집_s_2', '필라테스_s_2', '세무사_s_2'].map((n) => shot('한줄D', n));
const RD_HIT = [true, true, false, true, true, false, true]; // 짙은 초록 + 금색 5
const RE = ['세무사_s_1', '꽃집_s_1', '빵집_s_2', '빵집_s_1', '필라테스_s_1', '세무사_s_2', '필라테스_s_2'].map((n) => shot('한줄E', n));
// 끝: R0(기준) 자리마다 같은 가게의 한줄E — 「같은 7개, 물건 하나씩 정해 줬더니」
const RE_END = ['꽃집_s_1', '세무사_s_1', '필라테스_s_1', '빵집_s_2', '세무사_s_2', '필라테스_s_2', '빵집_s_1'].map((n) => shot('한줄E', n));
const PROMISE = shot('한줄E', '세무사_s_1'); // 약속 · 성공 예 · 끝이 같은 화면(가장 센 결과 — 둘째 시험 볼 이유 둘: 파란 차양 빵집은 약하다)

// 큰 화면에 들어갈 것(시각 순서). mode: swipe = 다음 결과로 넘김, wipe = 위에서 아래로 새로 덮임(생성), cut = 바로.
type Item = { src: string; at: number; mode: 'swipe' | 'wipe' | 'cut'; scroll?: [number, number, number, number]; tag?: string; counter?: string };
const counter = (i: number) => `${i + 1} / 7`;
const ITEMS: Item[] = [
  ...R0.map((src, i) => ({ src, at: i * B.riffle, mode: i === 0 ? ('cut' as const) : ('swipe' as const), counter: counter(i) })),
  { src: RB[0], at: B.result1, mode: 'wipe', counter: counter(0) },
  ...RB.slice(1).map((src, i) => ({ src, at: B.flipsB + (i + 1) * FLIP, mode: 'swipe' as const, counter: counter(i + 1) })),
  { src: shot('기준', '세무사_s_1'), at: B.cut5, mode: 'cut', tag: '그냥 맡긴 세무사' },
  { src: RE[0], at: B.result3, mode: 'wipe', tag: '세무사 하나 · 문 앞 빨간 우체통', scroll: [B.result3 + 20, B.flipsE, 0, 36] },
  ...RE.slice(1).map((src, i) => ({ src, at: B.flipsE + (i + 1) * FLIP, mode: 'swipe' as const, counter: counter(i + 1) })),
  { src: shot('한줄E', '꽃집_s_1'), at: B.cut7, mode: 'swipe', scroll: [B.cut7 + 8, B.chip2, 0, 30] },
  { src: shot('한줄E', '빵집_s_2'), at: B.chip2, mode: 'swipe', scroll: [B.chip2 + 6, B.chip3, 0, 24] },
  { src: shot('한줄E', '필라테스_s_2'), at: B.chip3, mode: 'swipe', scroll: [B.chip3 + 6, B.end, 0, 40] },
];

// 큰 벽이 펼쳐진 정도(0~1) — 시도마다. 큰 화면은 벽이 펼쳐진 동안 빠진다.
const WALLS = [
  { a: B.wall0, b: B.card1 },
  { a: B.revealB, b: B.card2 },
  { a: B.revealD, b: B.cut5 },
  { a: B.end, b: B.total + 30 }, // 끝: 회색 일곱 장이 다시 서고 한 장씩 제 물건 색으로
];
const wallK = (f: number, i: number) => ease(f, WALLS[i].a, 12, EASE_MOVE) * (1 - ease(f, WALLS[i].b, 8));
const anyWall = (f: number) => Math.max(...WALLS.map((_, i) => wallK(f, i)));

// ───────────── 머리글 ─────────────
/** 형광펜: 강조 낱말 아래 절반에 버터 띠. */
const paint = (ln: string, accent?: string) => {
  const k = accent ? ln.indexOf(accent) : -1;
  if (!accent || k < 0) return ln;
  return (
    <>
      {ln.slice(0, k)}
      <span style={{ background: `linear-gradient(transparent 56%, ${MARK} 56%, ${MARK} 92%, transparent 92%)`, padding: '0 0.06em', margin: '0 -0.06em' }}>{accent}</span>
      {ln.slice(k + accent.length)}
    </>
  );
};
/** 머리글 한 벌: 줄마다 마스크 안에서 짧게 올라온다(10프레임, 둘째 줄 3프레임 늦게). 다음 머리글로는 컷. */
const Head: React.FC<{ lines: string[]; accent?: string; a: number; b: number; size?: number }> = ({ lines, accent, a, b, size = 70 }) => {
  const f = useCurrentFrame();
  if (f < a || f >= b) return null;
  return (
    <div style={{ position: 'absolute', left: 72, top: HEAD_Y, fontFamily: KO, fontWeight: 760, fontSize: size, lineHeight: 1.2, letterSpacing: '-0.04em', color: INK }}>
      {lines.map((ln, i) => {
        const p = a <= 0 ? 1 : ease(f, a + 3 * i, 10);
        return (
          <div key={i} style={{ overflow: 'hidden', whiteSpace: 'nowrap', padding: '0.04em 0 0.14em', margin: '-0.04em 0 -0.14em' }}>
            <div style={{ transform: p < 1 ? `translateY(${(1 - p) * 30}px)` : undefined, opacity: p }}>{paint(ln, accent)}</div>
          </div>
        );
      })}
    </div>
  );
};
/** 머리글 위 작은 줄: 「방법 n · …」(시험한 부탁 방법 — 둘째 시험에서 「시도 n」이 무슨 시도인지 모르겠다는 셋), 끝에는 @yuhobuilds. */
const Kicker: React.FC<{ text: string; a: number; b: number; font?: string }> = ({ text, a, b, font = KO }) => {
  const f = useCurrentFrame();
  if (f < a || f >= b) return null;
  const o = a <= 0 ? 1 : ease(f, a, 8);
  const n = text.match(/^방법 \d/)?.[0];
  return (
    <div style={{ position: 'absolute', left: 74, top: KICK_Y, fontFamily: font, fontWeight: 680, fontSize: 32, letterSpacing: '-0.02em', color: MUTED, opacity: o, whiteSpace: 'nowrap' }}>
      {n ? (
        <>
          <span style={{ display: 'inline-block', padding: '2px 12px', marginRight: 12, borderRadius: 8, background: INK, color: '#F4F2EC', fontWeight: 720 }}>{n}</span>
          {text.slice(n.length).replace(/^ · /, '')}
        </>
      ) : (
        text
      )}
    </div>
  );
};

const Heads: React.FC = () => (
  <>
    <Kicker text="방법 1 · 그냥 맡기기" a={0} b={B.promise} />
    <Head lines={['AI가 만든', '홈페이지 7개']} accent="7개" a={0} b={B.wall0} />
    <Head lines={['색만 빼면', '7개 다 이 모양']} accent="다 이 모양" a={B.wall0} b={B.promise} />
    <Head lines={['물건 하나면', '이렇게 바뀐다']} accent="이렇게" a={B.promise} b={B.card1} />
    <Kicker text="방법 2 · 물건도 AI가 고르게" a={B.card1} b={B.card2} />
    <Head lines={['물건 하나까지', 'AI가 알아서 고르게']} accent="AI가 알아서" a={B.card1} b={B.result1} />
    <Head lines={['확 달라졌는데']} accent="확" a={B.result1} b={B.revealB} />
    <Head lines={['7개 중 6개가', '또 비슷한 종이 느낌']} accent="또 비슷한" a={B.revealB} b={B.card2} />
    <Kicker text="방법 3 · 종이는 빼고" a={B.card2} b={B.cut5} />
    <Head lines={['“종이는 빼 줘”']} accent="빼 줘" a={B.card2} b={at('s4b', '이번엔') - 2} />
    <Head lines={['이번엔 5개가', '또 초록 · 금색']} accent="또 초록 · 금색" a={at('s4b', '이번엔') - 2} b={B.thesis} />
    <Head lines={['AI가 고르면', '또 다 비슷해진다']} accent="또 다 비슷해진다" a={B.thesis} b={B.cut5} />
    <Kicker text="방법 4 · 물건은 내가 정하기" a={B.cut5} b={B.cut7} />
    <Kicker text="정해 준 물건 → 나온 화면" a={B.cut7} b={B.end} />
    <Head lines={['물건을 하나하나', '제가 정해 줬어요']} accent="제가" a={B.cut5} b={B.flipsE} />
    <Head lines={['이번엔 7개 다', '정해 준 물건대로']} accent="정해 준 물건대로" a={B.flipsE} b={B.cut7} />
    <Kicker text="@yuhobuilds" a={B.end} b={B.total} font={MONO} />
    <Head lines={['같은 7개에', '물건만 하나씩 정해 주면']} accent="물건만 하나씩" a={B.end + 4} b={B.endLine} />
    <Head lines={['물건은 AI 말고', '사장님이 고르세요']} accent="사장님이" a={B.endLine} b={B.total + 1} />
  </>
);

// ───────────── 큰 화면 ─────────────
const winBox = (f: number): Box => lerpBox(WIN, WIN7, ease(f, B.cut7 - 2, 12, EASE_MOVE));
const scrollOf = (it: Item, f: number) => (it.scroll ? interpolate(f, [it.scroll[0], it.scroll[1]], [it.scroll[2], it.scroll[3]], { ...clamp, easing: Easing.inOut(Easing.sin) }) : 0);

/** 한 장(390 CSS px 폭 화면을 box 폭에 맞춰). */
const Shot: React.FC<{ src: string; w: number; scroll: number; style?: React.CSSProperties }> = ({ src, w, scroll, style }) => {
  const k = w / 390;
  return <Img src={staticFile(src)} style={{ position: 'absolute', left: 0, top: -scroll * k, width: w, ...style }} />;
};

const Window: React.FC = () => {
  const f = useCurrentFrame();
  const box = winBox(f);
  const idx = ITEMS.reduce((acc, it, i) => (it.at <= f ? i : acc), 0);
  const cur = ITEMS[idx];
  const prev = idx > 0 ? ITEMS[idx - 1] : null;
  const hide = anyWall(f);
  // 어둡게: 요청을 치는 동안
  const dim = Math.max(
    0.62 * ease(f, B.card1, 8) * (1 - ease(f, B.result1, 4)),
    0.62 * ease(f, B.card2, 8) * (1 - ease(f, B.cut5, 4)),
    0.62 * ease(f, B.card3 - 4, 8) * (1 - ease(f, B.result3, 4)),
  );
  const radius = 30;
  const p = cur.mode === 'cut' ? 1 : ease(f, cur.at, cur.mode === 'swipe' ? 6 : 14, EASE_MOVE);
  if (hide >= 0.999) return null;
  return (
    <div style={{ position: 'absolute', left: box.x, top: box.y, width: box.w, height: box.h, opacity: 1 - hide, transform: `scale(${1 - 0.04 * hide})` }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: radius, overflow: 'hidden', background: '#fff', boxShadow: `0 0 0 6px ${BEZEL}, 0 40px 80px rgba(20,20,18,0.22)` }}>
        {prev && p < 1 ? <Shot src={prev.src} w={box.w} scroll={scrollOf(prev, f)} style={cur.mode === 'swipe' ? { transform: `translateX(${-p * box.w}px)` } : undefined} /> : null}
        <Shot
          src={cur.src}
          w={box.w}
          scroll={scrollOf(cur, f)}
          style={cur.mode === 'swipe' ? { transform: `translateX(${(1 - p) * box.w}px)` } : cur.mode === 'wipe' ? { clipPath: `inset(0 0 ${(1 - p) * 100}% 0)` } : undefined}
        />
        {cur.mode === 'wipe' && p > 0 && p < 1 ? <div style={{ position: 'absolute', left: 0, right: 0, top: p * box.h - 3, height: 6, background: MARK }} /> : null}
        {dim > 0 ? <div style={{ position: 'absolute', inset: 0, background: STAGE, opacity: dim }} /> : null}
      </div>
      {cur.counter && f < B.cut7 && dim < 0.3 ? <Counter text={cur.counter} /> : null}
      {cur.tag ? <Tag text={cur.tag} at={cur.at} /> : null}
    </div>
  );
};

/** 큰 화면 오른쪽 위 「n / 7」. */
const Counter: React.FC<{ text: string }> = ({ text }) => (
  <div style={{ position: 'absolute', right: 18, top: 18, padding: '8px 16px', borderRadius: 12, background: 'rgba(21,21,19,0.86)', fontFamily: MONO, fontWeight: 500, fontSize: 30, color: '#F4F2EC', letterSpacing: '0.02em' }}>{text}</div>
);
/** 큰 화면 왼쪽 위 이름표(판). */
const Tag: React.FC<{ text: string; at: number }> = ({ text, at: a }) => {
  const f = useCurrentFrame();
  const p = ease(f, a + 4, 9);
  return (
    <div style={{ position: 'absolute', left: 18, top: 18, padding: '10px 18px', borderRadius: 14, background: 'rgba(21,21,19,0.88)', fontFamily: KO, fontWeight: 700, fontSize: 31, letterSpacing: '-0.02em', color: '#F4F2EC', whiteSpace: 'nowrap', opacity: p, transform: `translateY(${(1 - p) * 10}px)` }}>
      {text}
    </div>
  );
};

// ───────────── 위 칸 → 큰 벽 ─────────────
/** 한 장: 위 칸 작은 화면(k=0)에서 큰 벽 칸(k=1)으로 자리 · 크기를 옮긴다. 그림은 위에 붙여 아래를 자른다. */
type Over = { x: number; y: number; rot: number; fade: number; c: number };
const Tile: React.FC<{ src: string; i: number; a: number; k: number; hit?: number; miss?: number; gray?: number; zoom?: number; over?: Over; to?: { src: string; at: number } }> = ({ src, i, a, k, hit = 0, miss = 0, gray = 0, zoom = 1, over, to }) => {
  const f = useCurrentFrame();
  if (f < a) return null;
  const p = a <= 0 ? 1 : ease(f, a, 6);
  const small = { x: TX0 + i * (TH.w + TH.gap), y: TH.y, w: TH.w, h: TH.h };
  const big = { ...tileXY(i), w: TILE.w, h: TILE.h };
  // 벽 전체를 가운데(540, 890) 기준으로 천천히 당긴다
  const zx = (v: number) => 540 + (v - 540) * zoom;
  const zy = (v: number) => 890 + (v - 890) * zoom;
  const c = over?.c ?? 0; // 몰림: 같은 쪽으로 몰린 장들이 한가운데로 모여 겹친다
  const x = lerp(lerp(small.x, zx(big.x), k), over?.x ?? 0, c);
  const y = lerp(lerp(small.y, zy(big.y), k), over?.y ?? 0, c);
  const w = lerp(small.w, big.w * zoom, k);
  const h = lerp(small.h, big.h * zoom, k);
  const r = lerp(12, 18, k);
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, opacity: p * (1 - 0.62 * miss) * (1 - (over?.fade ?? 0) * c), transform: `scale(${0.86 + 0.14 * p}) rotate(${(over?.rot ?? 0) * c}deg)` }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: r, overflow: 'hidden', background: '#fff', boxShadow: `0 0 0 ${lerp(2.5, 4, k)}px ${BEZEL}, 0 ${lerp(10, 24, k)}px ${lerp(22, 50, k)}px rgba(20,20,18,${lerp(0.18, 0.24, k)})` }}>
        <Img src={staticFile(src)} style={{ position: 'absolute', left: 0, top: 0, width: w, filter: gray > 0 ? `grayscale(${gray})` : undefined }} />
        {to && f >= to.at ? <Img src={staticFile(to.src)} style={{ position: 'absolute', left: 0, top: 0, width: w, clipPath: `inset(0 0 ${(1 - ease(f, to.at, 7, EASE_MOVE)) * 100}% 0)` }} /> : null}
      </div>
      {hit > 0 ? <div style={{ position: 'absolute', inset: -9, borderRadius: r + 8, boxShadow: `0 0 0 ${lerp(4, 7, k)}px ${MARK}`, opacity: hit, transform: `scale(${1.04 - 0.04 * hit})` }} /> : null}
      {to && f >= to.at ? <div style={{ position: 'absolute', inset: -2, borderRadius: r + 2, background: '#fff', opacity: 0.55 * (1 - ease(f, to.at, 10)) }} /> : null}
    </div>
  );
};
const Round: React.FC<{ list: string[]; t0: number; wall?: number; hits?: boolean[]; out: number; gray?: [number, number]; clump?: number; step?: number; to?: string[]; toAt?: number; toStep?: number }> = ({ list, t0, wall, hits, out, gray, clump, step = FLIP, to, toAt = 0, toStep = 4 }) => {
  const f = useCurrentFrame();
  if (f >= out + 8) return null;
  const o = 1 - ease(f, out, 8);
  const k = wall === undefined ? 0 : wallK(f, wall);
  const w = wall === undefined ? { a: 1e9, b: 1e9 + 100 } : WALLS[wall];
  const zoom = 1 + 0.035 * interpolate(f, [w.a + 12, w.b], [0, 1], clamp); // 벽이 머무는 동안 아주 천천히 다가간다(멈춘 화면 막기)
  const g = gray ? ease(f, gray[0], gray[1]) : 0;
  // 「또 한쪽으로 몰린다」: 같은 쪽 장들은 한가운데로 부채처럼 모이고(앞쪽이 위), 다른 장들은 양옆 아래로 밀려나 흐려진다
  const c = clump !== undefined ? ease(f, clump, 16, EASE_MOVE) : 0;
  const hitIdx = hits ? hits.map((h, i) => (h ? i : -1)).filter((i) => i >= 0) : [];
  const missIdx = hits ? hits.map((h, i) => (h ? -1 : i)).filter((i) => i >= 0) : [];
  const overOf = (i: number): Over | undefined => {
    if (!clump || !hits) return undefined;
    const tw = TILE.w * zoom;
    const j = hitIdx.indexOf(i);
    if (j >= 0) {
      const m = (hitIdx.length - 1) / 2;
      return { x: 540 - tw / 2 + (j - m) * 52, y: 560 + Math.abs(j - m) * 14, rot: (j - m) * 5, fade: 0, c };
    }
    const q = missIdx.indexOf(i);
    return { x: q === 0 ? 30 : 1050 - tw, y: 980, rot: q === 0 ? -9 : 9, fade: 0.55, c };
  };
  const order = clump && c > 0 ? [...missIdx, ...hitIdx] : list.map((_, i) => i); // 모일 때는 같은 쪽 장들을 위에 그린다
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: o }}>
      {order.map((i) => {
        const src = list[i];
        const h = hits ? ease(f, w.a + 10 + 2 * i, 8) : 0;
        return <Tile key={i} src={src} i={i} a={t0 + i * step} k={k} zoom={zoom} hit={hits?.[i] ? h : 0} miss={hits && !hits[i] ? h : 0} gray={g} over={overOf(i)} to={to ? { src: to[i], at: toAt + i * toStep } : undefined} />;
      })}
    </div>
  );
};
/** 약속: 회색 벽 위로 가장 센 결과(빨간 우체통 세무사) 한 장이 색을 띤 채 올라온다 — 「물건 하나면 이렇게 바뀐다」. */
const Promise: React.FC = () => {
  const f = useCurrentFrame();
  if (f < B.promise || f >= B.card1 + 8) return null;
  const p = ease(f, B.promise, 12, EASE_MOVE);
  const o = 1 - ease(f, B.card1, 8);
  const w = 330;
  const h = 560;
  return (
    <div style={{ position: 'absolute', left: 540 - w / 2, top: 600 + (1 - p) * 120, width: w, height: h, opacity: Math.min(1, p * 1.6) * o, transform: `scale(${0.82 + 0.18 * p}) rotate(${-3 * (1 - p)}deg)`, zIndex: 3 }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: 22, overflow: 'hidden', background: '#fff', boxShadow: `0 0 0 4px ${BEZEL}, 0 40px 90px rgba(20,20,18,0.35)` }}>
        <Img src={staticFile(PROMISE)} style={{ position: 'absolute', left: 0, top: 0, width: w }} />
      </div>
      <div style={{ position: 'absolute', inset: -11, borderRadius: 30, boxShadow: `0 0 0 7px ${MARK}`, opacity: ease(f, B.promise + 8, 8) }} />
    </div>
  );
};
const Walls: React.FC = () => (
  <>
    <Round list={R0} t0={0} wall={0} out={B.card1} gray={[B.gray0, 12]} step={B.riffle} />
    <Promise />
    <Round list={RB} t0={B.flipsB} wall={1} hits={RB_HIT} out={B.card2} clump={B.revealB + 50} />
    <Round list={RD} t0={B.revealD} step={3} wall={2} hits={RD_HIT} out={B.cut5} clump={B.thesis + 4} />
    <Round list={RE} t0={B.flipsE} out={B.cut7} />
    <Round list={R0} t0={B.end} step={2} wall={3} gray={[B.end - 30, 1]} out={B.total + 30} to={RE_END} toAt={B.endFlip} toStep={4} />
  </>
);

// ───────────── 요청 칸 ─────────────
type Piece = { text: string; key?: boolean };
const ONE: Piece[] = [
  { text: '먼저 이 가게에 어울리는 ' },
  { text: '실제 물건 하나', key: true },
  { text: '(간판, 포장지, 메뉴판 같은)를 정하고, ' },
  { text: '그 물건의 색과 글씨로', key: true },
  { text: ' 화면을 만들어 줘.' },
];
const NO_PAPER: Piece[] = [{ text: '단, ' }, { text: '종이·크라프트 느낌은 빼고.', key: true }];
const MINE: Piece[] = [{ text: '우리 사무실 문 앞 ' }, { text: '빨간 우체통', key: true }, { text: '의 색과 글씨로 화면을 만들어 줘.' }];
const plain = (ps: Piece[]) => ps.map((p) => p.text).join('');

/** 친 만큼만 보이는 글(n글자). 강조 조각은 다 친 뒤에 형광펜. */
const Typed: React.FC<{ pieces: Piece[]; n: number; lit: number }> = ({ pieces, n, lit }) => {
  let left = n;
  return (
    <>
      {pieces.map((p, i) => {
        const shown = p.text.slice(0, Math.max(0, left));
        left -= p.text.length;
        if (!shown) return null;
        return p.key ? (
          <span key={i} style={{ background: `linear-gradient(transparent 58%, rgba(245,196,69,${lit}) 58%, rgba(245,196,69,${lit}) 94%, transparent 94%)` }}>
            {shown}
          </span>
        ) : (
          <span key={i}>{shown}</span>
        );
      })}
    </>
  );
};

/** 요청 칸: 빵집 홈페이지 부탁 끝에 붙인 말만 보인다(기본 부탁 「… HTML 파일 하나로」는 첫 시험에서 셋이 「모르는 말」로 짚어 뺐다). keep이 있으면 보낸 뒤에도 작게 접혀 그때까지 남는다. */
const Card: React.FC<{ a: number; typeFrom: number; typeTo: number; send: number; done: number; pieces: Piece[]; label: string; keep?: number }> = ({ a, typeFrom, typeTo, send, done, pieces, label, keep }) => {
  const f = useCurrentFrame();
  const end = keep ?? done;
  if (f < a || f >= end + 8) return null;
  const p = ease(f, a, 9) * (1 - ease(f, end, 8));
  const fold = keep ? ease(f, done - 2, 10, EASE_MOVE) : 0; // 결과가 덮이면 작게 접힌다(보내기 단추 · 이름 줄이 빠진다)
  const total = plain(pieces).length;
  const n = Math.round(interpolate(f, [typeFrom, typeTo], [0, total], clamp));
  const typing = f >= typeFrom && f < typeTo;
  const caret = f < send && (typing || Math.floor(f / 8) % 2 === 0);
  const press = ease(f, send, 3) * (1 - ease(f, send + 3, 8));
  const lit = ease(f, typeTo, 8);
  return (
    <div style={{ position: 'absolute', left: 120, top: lerp(470, 494, fold), width: 840, opacity: p, transform: `translateY(${(1 - p) * 24}px)`, zIndex: 5 }}>
      <div style={{ borderRadius: 30, background: '#FFFFFF', boxShadow: '0 0 0 2px rgba(21,21,19,0.10), 0 30px 70px rgba(20,20,18,0.20)', padding: `${lerp(28, 22, fold)}px 34px ${lerp(96, 24, fold)}px` }}>
        <div style={{ fontFamily: KO, fontWeight: 660, fontSize: 28, color: '#8E8A80', letterSpacing: '-0.02em', height: lerp(40, 0, fold), opacity: 1 - fold, overflow: 'hidden' }}>{label}</div>
        <div style={{ marginTop: lerp(6, 0, fold), fontFamily: KO, fontWeight: 700, fontSize: lerp(40, 36, fold), color: INK, letterSpacing: '-0.03em', lineHeight: 1.42, wordBreak: 'keep-all', minHeight: 56 }}>
          <Typed pieces={pieces} n={n} lit={lit} />
          {caret ? <span style={{ display: 'inline-block', width: 4, height: 44, marginLeft: 3, verticalAlign: '-6px', background: INK }} /> : null}
        </div>
      </div>
      {/* 보내기 단추 */}
      <div style={{ position: 'absolute', right: 26, bottom: 22, width: 60, height: 60, borderRadius: 30, background: n >= total ? INK : '#CFCBC2', transform: `scale(${(1 - 0.14 * press) * (1 - fold)})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width={28} height={28} viewBox="0 0 28 28">
          <path d="M14 22 L14 7 M7.5 13 L14 6.5 L20.5 13" fill="none" stroke="#F4F2EC" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
};
const Cards: React.FC = () => (
  <>
    <Card a={B.card1} typeFrom={B.card1 + 6} typeTo={B.typed1} send={B.send1} done={B.result1} pieces={ONE} label="빵집 홈페이지 부탁 끝에 붙인 말" />
    <Card a={B.card2} typeFrom={B.card2 + 4} typeTo={B.typed2} send={B.send2} done={B.revealD} pieces={NO_PAPER} label="그 말 뒤에 하나 더" />
    <Card a={B.card3} typeFrom={B.card3 + 2} typeTo={B.typed3} send={B.send3} done={B.result3} keep={B.flipsE} pieces={MINE} label="세무사 홈페이지 부탁 끝에 붙인 말" />
  </>
);

// ───────────── 물건 셋(칩) ─────────────
const CHIPS: [string, number][] = [
  ['하늘색 물뿌리개 꽃집', B.cut7],
  ['노란 바구니 빵집', B.chip2],
  ['분홍 네온 필라테스', B.chip3],
];
const Chips: React.FC = () => {
  const f = useCurrentFrame();
  if (f < B.cut7 || f >= B.end + 6) return null;
  const out = ease(f, B.end, 6);
  const pos = [
    { x: 72, y: 262 },
    { x: 72 + 452, y: 262 },
    { x: 72, y: 336 },
  ];
  return (
    <>
      {CHIPS.map(([text, a], i) => {
        if (f < a) return null;
        const p = ease(f, a, 8);
        const active = f >= a && (i === CHIPS.length - 1 || f < CHIPS[i + 1][1]);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: pos[i].x,
              top: pos[i].y,
              padding: '10px 22px',
              borderRadius: 999,
              background: active ? MARK : '#FFFFFF',
              boxShadow: '0 0 0 2px rgba(21,21,19,0.12)',
              fontFamily: KO,
              fontWeight: 740,
              fontSize: 36,
              letterSpacing: '-0.03em',
              color: active ? INK : '#5E5A52',
              whiteSpace: 'nowrap',
              opacity: p * (1 - out),
              transform: `translateY(${(1 - p) * 14}px)`,
            }}
          >
            {text}
          </div>
        );
      })}
    </>
  );
};

// ───────────── 소리 ─────────────
type Hit = { at: number; src: string; v: number; len?: number };
const flipFrames = [...R0.map((_, i) => i * B.riffle), ...RB.slice(1).map((_, i) => B.flipsB + (i + 1) * FLIP), ...RE.slice(1).map((_, i) => B.flipsE + (i + 1) * FLIP), ...R0.map((_, i) => B.endFlip + i * 4)];
const hits = (cut: Cut): Hit[] => {
  // B판은 작업 소리가 말 자리를 맡는다. 타자는 작은 소리라 1.6배, 휙 · 클릭 · 엔터는 1.1배(11-01 아르곤: B의 휙 · 클릭이 음악보다 도드라진다 — 1.6배였다).
  // A판의 타자는 말과 겹치니 0.5배(11-01 아르곤: 요청 칸 타자가 말을 살짝 덮는다 — 타자 봉우리 −9 dBFS 실측).
  const kType = cut === 'B' ? 1.6 : 0.5;
  const k = cut === 'B' ? 1.1 : 1;
  const typing = (a: number, b: number): Hit[] => {
    const out: Hit[] = [];
    for (let t = a; t < b; t += 42) out.push({ at: t, src: 'sfx/typing.mp3', v: 0.34 * kType, len: Math.min(44, b - t + 4) });
    return out;
  };
  return [
    ...flipFrames.map((a) => ({ at: a, src: 'sfx/click.mp3', v: 0.26 * k })),
    ...typing(B.card1 + 6, B.typed1),
    ...typing(B.card2 + 4, B.typed2),
    ...typing(B.card3 + 2, B.typed3),
    ...[B.send1, B.send2, B.send3].map((a) => ({ at: a, src: 'sfx/key-press.mp3', v: 0.5 * k })),
    ...[B.result1, B.result3].map((a) => ({ at: a, src: 'sfx/whoosh-short.mp3', v: 0.22 * k })),
    ...WALLS.map((w) => ({ at: w.a, src: 'sfx/whoosh-short.mp3', v: 0.2 * k })),
    { at: B.promise, src: 'sfx/pop.mp3', v: 0.3 * k },
    ...[B.revealB, B.revealD].map((a) => ({ at: a + 10, src: 'sfx/pop.mp3', v: 0.24 * k })),
    { at: B.endFlip + 26, src: 'sfx/pop.mp3', v: 0.3 * k },
    ...[B.cut5, B.cut7].map((a) => ({ at: a - 2, src: 'sfx/whoosh-short.mp3', v: 0.18 * k })),
    ...[B.chip2, B.chip3].map((a) => ({ at: a, src: 'sfx/click-soft.mp3', v: 0.3 * k })),
  ];
};

const Sounds: React.FC<{ cut: Cut }> = ({ cut }) => {
  const ranges = ORDER.map((id) => [vo(id), voEnd(id)] as [number, number]);
  const bgmVolume = (fr: number) => {
    const head = interpolate(fr, [0, 6], [0.6, 1], clamp);
    const tail = interpolate(fr, [B.total - 24, B.total], [1, 0], clamp);
    if (cut === 'B') return 0.84 * head * tail * MASTER;
    const voice = Math.max(0, ...ranges.map(([a, b]) => interpolate(fr, [a - 8, a, b, b + 10], [0, 1, 1, 0], clamp)));
    return (0.4 - 0.2 * voice) * head * tail * MASTER;
  };
  return (
    <>
      {cut === 'A'
        ? ORDER.map((id) => (
            <Sequence key={id} from={vo(id)} layout="none">
              <Audio src={staticFile(`vo/${id}.wav`)} volume={MASTER} />
            </Sequence>
          ))
        : null}
      {hits(cut).map((x, i) => (
        <Sequence key={i} from={x.at} durationInFrames={x.len ?? 60} layout="none">
          <Audio src={staticFile(x.src)} volume={(fr) => x.v * MASTER * (x.len ? interpolate(fr, [x.len - 5, x.len], [1, 0], clamp) : 1)} />
        </Sequence>
      ))}
      <Audio src={staticFile('bgm.wav')} volume={bgmVolume} />
    </>
  );
};

// ───────────── 본편 ─────────────
export const Y29Film: React.FC<{ cut: Cut }> = ({ cut }) => {
  const f = useCurrentFrame();
  // 무대: 위에서 아래로 아주 옅게 어두워지는 벽.
  const drift = interpolate(f, [0, B.total], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${STAGE} 0%, ${STAGE} ${40 - 6 * drift}%, ${STAGE2} 100%)` }}>
      <Window />
      <Walls />
      <Cards />
      <Chips />
      <Heads />
      <Sounds cut={cut} />
    </AbsoluteFill>
  );
};
