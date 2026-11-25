// 「클로드가 만든 홈페이지, AI 티를 빼는 다섯 줄」 본편 — 수요 장부 yuhobuilds 5번(웹사이트와 발표 자료가 AI 티 나지 않게, 11-25 · 장부 Y81).
// 처음과 끝은 몽글이 장면(구운 그림 · 눈 둘레 조각만 바꿔 끼운다), 가운데는 범수 보이스오버와 실제 결과 화면이다.
// 결과는 2026-11-25에 직접 돌린 홈페이지 요청이다(기획.md 「실험 기록」 · 시안/실험/): 다섯 줄 없이 세 번 · 다섯 줄 붙여 세 번 · 사진 자리 한 줄을 더해 두 번 · 사진 넣기 한 번.
// 화면은 받은 HTML을 크롬에서 열어 찍은 그림이다 — 세 판 쌓기는 가로 1200px 창(s_*), 크게 보기는 960px 창(w_* · c*), 끝 짝은 휴대폰 폭 390px(m_*).
// r3(11-25 15시 회차): 작은 휴대폰 대신 화면 폭 가득 크게 · 다섯 줄마다 그 줄이 막는 것을 크게 · 끝 결과는 사진까지 넣은 판(장면 심사 세 판 「작다 · 바뀐 뒤가 밋밋하다」).
// 화면 결: 위 큰 글자가 곧 말 · 검정 · 흰 + 버터 한 곳 · SUIT 하나. 안전 영역 x 65~920 · y 269~1428.
import React from 'react';
import { Audio } from '@remotion/media';
import { AbsoluteFill, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from '../lib/fonts';
import { clamp, IN_OUT, OUT } from '../lib/motion';
import { BGM, LEN, P2G_AT, SFX, SFX_END, T, TG, VO } from './timeline';
import { FIVE } from './data';

export type Ending = 'dm' | 'post';

export const FPS = 30;
export const F = (s: number) => Math.round(s * FPS);
export const TOTAL = F(LEN);

const INK = '#0A0A0A';
const WHITE = '#FFFFFF';
const BUTTER = '#F5C445';
const SOFT = 'rgba(255,255,255,0.86)';
const LEFT = 79;
const MASTER = 0.8;

const inWin = (t: number, a: number, b: number) => t >= a && t < b;
const appear = (t: number, a: number, len = 0.22) => interpolate(t, [a, a + len], [0, 1], { ...clamp, easing: OUT });
/** 몽글이 장면의 빛 숨결 — 2.4초에 한 번 4%만(몽글이는 크게 움직이지 않고 빛으로 작게, 11-20 유호님). */
const glow = (t: number) => 1 + 0.04 * Math.sin((2 * Math.PI * t) / 2.4);
const settle = (t: number, a: number) => 1.03 - 0.03 * appear(t, a, 0.34);

// ───────────────────────── 부품 ─────────────────────────

type Line = { at: number; node: React.ReactNode; size: number; color?: string; gap?: number };
const Head: React.FC<{ t: number; lines: Line[]; top: number; left?: number }> = ({ t, lines, top, left = LEFT }) => (
  <div style={{ position: 'absolute', left, top, fontFamily: KO, fontWeight: 800, letterSpacing: '-0.045em', lineHeight: 1.1, color: WHITE, whiteSpace: 'nowrap' }}>
    {lines
      .filter((l) => t >= l.at - 0.001)
      .map((l, i) => {
        const p = l.at <= 0 ? 1 : appear(t, l.at);
        return (
          <div key={i} style={{ fontSize: l.size, color: l.color ?? WHITE, opacity: p, transform: `translateY(${(1 - p) * 28}px)`, marginTop: l.gap ?? 0 }}>
            {l.node}
          </div>
        );
      })}
  </div>
);

/** 같은 자리에서 바뀌는 큰 줄 — a초에 서고 b초에 물러난다. */
const Swap: React.FC<{ t: number; top: number; size: number; items: { a: number; b: number; node: React.ReactNode }[]; color?: string }> = ({ t, top, size, items, color = WHITE }) => (
  <>
    {items.map((l, i) => {
      const p = appear(t, l.a) * interpolate(t, [l.b - 0.08, l.b], [1, 0], clamp);
      return p > 0 ? (
        <div key={i} style={{ position: 'absolute', left: LEFT, top: top + (1 - appear(t, l.a)) * 28, opacity: p, fontFamily: KO, fontSize: size, fontWeight: 800, letterSpacing: '-0.045em', lineHeight: 1.1, color, whiteSpace: 'nowrap' }}>
          {l.node}
        </div>
      ) : null;
    })}
  </>
);

const Gold: React.FC<{ children: React.ReactNode }> = ({ children }) => <span style={{ color: BUTTER }}>{children}</span>;

const Tag: React.FC = () => (
  <div style={{ position: 'absolute', left: 84, top: 286, fontFamily: KO, fontSize: 34, fontWeight: 700, letterSpacing: '0.01em', lineHeight: 1.2, color: WHITE, whiteSpace: 'nowrap' }}>
    yuhobuilds<span style={{ fontWeight: 500, opacity: 0.7, marginLeft: 16 }}>AI와 회사 만들기</span>
  </div>
);

type Eye = { x: number; y: number; rx: number; ry: number };
const Mong: React.FC<{ a: string; b: string; mix: number; eye: Eye; top: number; s: number; ox: number; oy: number; solid: number; fade: number; light?: number }> = ({ a, b, mix, eye, top, s, ox, oy, solid, fade, light = 1 }) => {
  const mask = `radial-gradient(ellipse ${eye.rx}px ${eye.ry}px at ${eye.x}px ${eye.y}px, #000 62%, transparent 100%)`;
  return (
    <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: INK }}>
      <div style={{ position: 'absolute', left: 0, top, width: 1080, height: 1620, transform: `scale(${s})`, transformOrigin: `${ox}px ${oy}px`, filter: `brightness(${light})` }}>
        <Img src={staticFile(a)} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1620 }} />
        {mix > 0 && <Img src={staticFile(b)} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1620, opacity: mix, WebkitMaskImage: mask, maskImage: mask }} />}
      </div>
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, rgba(10,10,10,1) 0, rgba(10,10,10,1) ${solid}px, rgba(10,10,10,0) ${fade}px)` }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 360, background: 'linear-gradient(0deg, rgba(10,10,10,1) 0, rgba(10,10,10,1) 130px, rgba(10,10,10,0) 360px)' }} />
    </AbsoluteFill>
  );
};

type Box = { x: number; y: number; w: number; h: number; at: number; out?: number; r?: number };
/** 찍은 화면 한 장을 폭 w(화면 px)로 놓는다. cssW = 찍은 창 폭(css px). scroll · boxes는 css px. 높이 vh(화면 px)만큼만 보인다. */
const Shot: React.FC<{ src: string; cssW: number; x: number; y: number; w: number; vh: number; scroll?: number; boxes?: Box[]; t: number; clipTop?: number; o?: number; radius?: number; dim?: number; pad?: number; border?: number }> = ({ src, cssW, x, y, w, vh, scroll = 0, boxes = [], t, clipTop = 0, o = 1, radius = 0, dim = 0, pad = 10, border = 6 }) => {
  const s = w / cssW;
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w, height: vh, opacity: o, overflow: 'hidden', borderRadius: radius, backgroundColor: '#fff', clipPath: clipTop > 0 ? `inset(${clipTop * 100}% 0 0 0)` : undefined }}>
      <div style={{ position: 'absolute', left: 0, top: -scroll * s, width: w }}>
        <Img src={staticFile(src)} style={{ display: 'block', width: w }} />
        {boxes.map((b, i) => {
          const p = appear(t, b.at, 0.25) * (b.out ? interpolate(t, [b.out, b.out + 0.2], [1, 0], clamp) : 1);
          return p > 0 ? (
            <div key={i} style={{ position: 'absolute', left: b.x * s - pad, top: b.y * s - pad, width: b.w * s + pad * 2, height: b.h * s + pad * 2, boxSizing: 'border-box', borderRadius: b.r ?? 20, border: `${border}px solid ${BUTTER}`, opacity: p, transform: `scale(${1.05 - 0.05 * p})` }} />
          ) : null;
        })}
      </div>
      {dim > 0 && <div style={{ position: 'absolute', inset: 0, backgroundColor: `rgba(10,10,10,${dim})` }} />}
    </div>
  );
};

/** 안전선(x 65~920 · y 1428) 안에 두는 창 — 홈페이지 글이 앱 단추 · 글 자리에 걸리지 않게(11-25 올리기 전 검사). */
const WX = 65;
const WW = 855;
const WEND = 1428;
const Win: React.FC<{ y: number; h?: number; push?: number; ox?: number; oy?: number; o?: number; dy?: number; fade?: string; children: React.ReactNode }> = ({ y, h, push = 1, ox = 427, oy = 400, o = 1, dy = 0, fade, children }) => (
  <div style={{ position: 'absolute', left: WX, top: y + dy, width: WW, height: h ?? WEND - y, overflow: 'hidden', borderRadius: 18, backgroundColor: '#fff', opacity: o }}>
    <div style={{ position: 'absolute', inset: 0, transform: `scale(${push})`, transformOrigin: `${ox}px ${oy}px` }}>{children}</div>
    {fade && <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 64, background: `linear-gradient(0deg, ${fade} 12%, ${fade}00 100%)` }} />}
  </div>
);
const CREAM = '#FFFAF5';
/** 사람이 천천히 넘기듯 흘리는 양(css px). */
const flow = (t: number, a: number, rate: number) => Math.max(0, t - a) * rate;

/** 창 뒤 바탕 빛 — 다섯 줄 전은 분홍, 후는 따뜻한 흰빛(검정 바탕이 비어 보이지 않게). */
const Glow: React.FC<{ c: string; t: number; y?: number }> = ({ c, t, y = 1010 }) => (
  <AbsoluteFill style={{ backgroundColor: INK }}>
    <div style={{ position: 'absolute', inset: 0, opacity: 0.9 + 0.1 * Math.sin((2 * Math.PI * t) / 3), background: `radial-gradient(ellipse 860px 900px at 500px ${y}px, ${c} 0%, rgba(10,10,10,0) 78%)` }} />
  </AbsoluteFill>
);
const PINK = 'rgba(217,87,107,0.50)';
const WARM = 'rgba(237,226,206,0.34)';

// ───────────────────────── 장면 ─────────────────────────

/** ① 처음 — 똑같은 분홍 가게 셋 앞의 몽글이. 0초부터 「클로드가 만든 홈페이지 / AI 티」. 1.5초에 실제 분홍 판(말 「AI 티 나죠?」), 2.5초에 결과(사진까지 든 흰 판 · 「다섯 줄 + 사진 한 장」)를 먼저 보인다(제작 절차 「결과로 열고」 · 11-25 장면 심사 · 볼 이유 심사). */
const HOOK_Y = 796;
const Opening: React.FC = () => {
  const t = useCurrentFrame() / FPS;
  const drift = 1 + 0.06 * interpolate(t, [0, T.bad], [0, 1], clamp);
  const lean = 0.03 * interpolate(t, [T.eye - 0.1, T.eye + 0.4], [0, 1], { ...clamp, easing: IN_OUT });
  const pulse = 1 + 0.05 * interpolate(t, [T.l3, T.l3 + 0.12, T.l3 + 0.5], [0, 1, 0], clamp);
  return (
    <AbsoluteFill>
      <Mong a="mong/a.jpg" b="mong/a2.jpg" mix={t >= T.eye ? 1 : 0} eye={{ x: 375, y: 1010, rx: 215, ry: 110 }} top={172} ox={470} oy={560} s={drift + lean} solid={430} fade={790} light={glow(t)} />
      {t >= T.hook && (
        <AbsoluteFill>
          <Glow c={t < T.l3 ? PINK : WARM} t={t} y={1120} />
          <Win y={HOOK_Y} push={settle(t, t < T.l3 ? T.hook : T.l3) * (1 + (t < T.l3 ? 0.05 : 0.025) * interpolate(t, [t < T.l3 ? T.hook : T.l3, T.bad], [0, 1], clamp))} ox={t < T.l3 ? 300 : 60} oy={300} fade={t < T.l3 ? CREAM : undefined}>
            <Shot src={t < T.l3 ? 'img/o_b1.jpg' : 'img/o_pp.jpg'} cssW={1100} x={0} y={0} w={WW} vh={WEND - HOOK_Y} t={t} scroll={t < T.l3 ? flow(t, T.hook, 46) : 20 + flow(t, T.l3, 40)} />
          </Win>
          {t >= T.l3 && <div style={{ position: 'absolute', left: 84, top: 722, opacity: appear(t, T.l3 + 0.05, 0.2), fontFamily: KO, fontSize: 46, fontWeight: 700, letterSpacing: '-0.03em', color: SOFT, whiteSpace: 'nowrap' }}>다섯 줄 + 사진 한 장</div>}
        </AbsoluteFill>
      )}
      <Tag />
      <Head
        t={t}
        top={340}
        lines={[
          { at: 0, node: '클로드가 만든 홈페이지', size: 76, color: SOFT },
          { at: T.l2, node: <Gold>AI 티</Gold>, size: 172 },
          {
            at: T.l3,
            node: (
              <span style={{ display: 'inline-block', transform: `scale(${pulse})`, transformOrigin: '0 80%', textShadow: '0 2px 24px rgba(10,10,10,0.55)' }}>
                <Gold>다섯 줄</Gold>이면 빠져요
              </span>
            ),
            size: 84,
          },
        ]}
      />
    </AbsoluteFill>
  );
};

/** ② 문제 — 같은 요청을 새 대화에서 세 번: 세 판이 한 줄씩 쌓인다. 세 판 모두 같은 분홍 버튼, 세 판 모두 카드 상자. */
const ROW_Y = 496;
const ROW_H = 304;
const ROW_GAP = 10;
const ROWS: { src: string; at: number; y0: number; btn: Box; card: Box; y1: number }[] = [
  { src: 'img/s_b1.jpg', at: T.bad, y0: 124, btn: { x: 100, y: 455, w: 160, h: 57, at: T.bBox, out: T.bCard }, card: { x: 100, y: 778, w: 490, h: 378, at: T.bCard + 0.42 }, y1: 742 },
  { src: 'img/s_b2.jpg', at: T.r2, y0: 136, btn: { x: 60, y: 476, w: 170, h: 58, at: T.bBox + 0.08, out: T.bCard }, card: { x: 60, y: 786, w: 530, h: 327, at: T.bCard + 0.47 }, y1: 748 },
  { src: 'img/s_b3.jpg', at: T.r3, y0: 124, btn: { x: 100, y: 463, w: 164, h: 58, at: T.bBox + 0.16, out: T.bCard }, card: { x: 100, y: 819, w: 488, h: 475, at: T.bCard + 0.52 }, y1: 781 },
];
const BadScene: React.FC<{ t: number }> = ({ t }) => {
  const push = 1 + 0.03 * interpolate(t, [T.bad, T.make], [0, 1], clamp);
  const down = interpolate(t, [T.bCard, T.bCard + 0.5], [0, 1], { ...clamp, easing: IN_OUT });
  return (
    <AbsoluteFill>
      <Glow c={PINK} t={t} />
      {ROWS.map((r, i) => {
        const a = i === 0 ? appear(t, r.at, 0.1) : appear(t, r.at, 0.24);
        return a > 0 ? (
          <Win key={i} y={ROW_Y + i * (ROW_H + ROW_GAP)} h={ROW_H} push={push} ox={300} oy={150} o={a} dy={(1 - a) * 50} fade={down > 0.5 ? CREAM : undefined}>
            <Shot src={r.src} cssW={1200} x={0} y={0} w={WW} vh={ROW_H} t={t} scroll={r.y0 - 4 + flow(t, r.at, 9) * (1 - down) + (r.y1 - r.y0) * down + flow(t, T.bCard + 0.5, 7)} boxes={[r.btn, r.card]} pad={8} border={6} />
          </Win>
        ) : null;
      })}
      <Head t={t} top={286} lines={[{ at: T.bad - 0.25, node: '같은 요청을 새 대화에서', size: 60, color: SOFT }]} />
      <Swap
        t={t}
        top={358}
        size={104}
        items={[
          { a: T.bad - 0.25, b: T.bSame, node: <><Gold>세 번</Gold> 맡겼더니</> },
          { a: T.bSame, b: T.bCard + 0.3, node: <>세 번 다 <Gold>같은 분홍</Gold></> },
          { a: T.bCard + 0.3, b: 99, node: <>세 번 다 <Gold>카드 상자</Gold></> },
        ]}
      />
    </AbsoluteFill>
  );
};

/** ③ 다섯 줄 — 앞 3.1초는 요청 끝에 붙인 다섯 줄이 하나씩 서고 줄마다 그 줄이 막는 것을 아래 창에 크게(찍은 실제 화면을 3배로 자른 것), 뒤 1.9초는 다섯 줄만 크게 세워 읽게 둔다. */
const CROP_Y = 952;
const CROPS: { src: string; cssW: number; box: Box; fade?: string; scroll?: number; nobox?: boolean }[] = [
  { src: 'img/c1.jpg', cssW: 394, box: { x: 118, y: 58, w: 118, h: 118, at: 0 } }, // 💐
  { src: 'img/c2.jpg', cssW: 430, box: { x: 20, y: 34, w: 119, h: 31, at: 0 }, fade: CREAM }, // 알약 꼬리표
  { src: 'img/c3.jpg', cssW: 394, box: { x: 70, y: 26, w: 250, h: 150, at: 0 }, nobox: true }, // 분홍 · 흰 · 주황 꽃
  { src: 'img/c4.jpg', cssW: 430, box: { x: 196, y: 115, w: 192, h: 58, at: 0 }, scroll: 52 }, // 둘째 버튼
  { src: 'img/c5.jpg', cssW: 520, box: { x: 20, y: 22, w: 450, h: 300, at: 0 } }, // 카드 상자
];
const MakeScene: React.FC<{ t: number; bare?: boolean }> = ({ t, bare }) => {
  const n = Math.min(FIVE.length - 1, Math.max(-1, Math.floor((t - T.item) / T.itemGap + 0.001)));
  const at = n < 0 ? T.make : T.item + n * T.itemGap;
  const c = CROPS[Math.max(0, n)];
  const big = t >= T.list;
  const gone = interpolate(t, [T.list - 0.06, T.list + 0.1], [0, 1], clamp); // 창이 먼저 걷히고
  const grow = interpolate(t, [T.list + 0.04, T.list + 0.42], [0, 1], { ...clamp, easing: IN_OUT }); // 목록이 자란다
  const push = settle(t, at) * (1 + 0.07 * interpolate(t, [at, at + T.itemGap], [0, 1], clamp));
  const k = WW / c.cssW;
  return (
    <AbsoluteFill>
      <Glow c={big ? WARM : PINK} t={t} y={big ? 900 : 1150} />
      {gone < 1 && (
        <Win y={CROP_Y} push={push} ox={(c.box.x + c.box.w / 2) * k} oy={(c.box.y + c.box.h / 2 - (c.scroll ?? 0)) * k} o={1 - gone} dy={gone * 40} fade={c.fade}>
          <Shot src={c.src} cssW={c.cssW} x={0} y={0} w={WW} vh={WEND - CROP_Y} t={t} scroll={c.scroll ?? 0} boxes={n >= 0 && !c.nobox ? [{ ...c.box, at: at + 0.06 }] : []} pad={12} border={8} />
        </Win>
      )}
      {!bare && <Head t={t} top={286} lines={[{ at: T.make - 0.25, node: '그래서 요청 끝에', size: 64, color: SOFT }, { at: T.mL2, node: <>이 <Gold>다섯 줄</Gold></>, size: 104 }]} />}
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${1 + 0.03 * interpolate(t, [T.list, T.after], [0, 1], clamp)})`, transformOrigin: '84px 900px' }}>
        {FIVE.map((s, i) => {
          const p = appear(t, T.item + i * T.itemGap, 0.2);
          if (p <= 0) return null;
          const now = big ? (i < 2 ? inWin(t, T.list, T.li3) : i === 2 && inWin(t, T.li3, T.after)) : i === n;
          return (
            <div key={i} style={{ position: 'absolute', left: 84, top: 500 + 60 * grow + i * (86 + 72 * grow) + (1 - p) * 20, opacity: p, display: 'flex', alignItems: 'baseline', gap: 24, fontFamily: KO, whiteSpace: 'nowrap' }}>
              <div style={{ width: 38 + 8 * grow, fontSize: 54 + 12 * grow, fontWeight: 800, color: now ? BUTTER : 'rgba(255,255,255,0.46)', letterSpacing: '-0.02em' }}>{i + 1}</div>
              <div style={{ fontSize: 56 + 12 * grow, fontWeight: 800, letterSpacing: '-0.045em', color: now ? BUTTER : WHITE }}>{s}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/** ④ 결과 — 같은 자리(첫 화면 → 카드 자리)를 위아래로 맞댄다. 위 = 다섯 줄 전(분홍 판), 아래 = 다섯 줄 후(흰 판). 「카드」에 두 판이 함께 내려간다.
 *  11-25 볼 이유 심사 · 이해 시험 둘: 흰 판만 넘기면 다섯 줄이 무엇을 바꿨는지 안 보이고 밋밋하다. */
const K = WW / 960;
const A_LAB = 478;
const A_TOP = 534;
const A_H = 400;
const B_LAB = 950;
const B_TOP = 1006;
const AfterScene: React.FC<{ t: number; bare?: boolean }> = ({ t, bare }) => {
  const push = settle(t, T.after) * (1 + 0.02 * interpolate(t, [T.after, T.photo], [0, 1], clamp));
  const down = interpolate(t, [T.aScroll, T.aScroll + 0.55], [0, 1], { ...clamp, easing: IN_OUT });
  const b = appear(t, T.wipe, 0.28);
  const lab = (o: number, c: string): React.CSSProperties => ({ position: 'absolute', left: LEFT, fontFamily: KO, fontSize: 46, fontWeight: 800, letterSpacing: '-0.04em', color: c, opacity: o, whiteSpace: 'nowrap' });
  return (
    <AbsoluteFill>
      <Glow c={b > 0.5 ? WARM : PINK} t={t} />
      <Win y={A_TOP} h={A_H} push={push} ox={250} oy={200} fade={CREAM}>
        <Shot
          src="img/w_b3.jpg"
          cssW={960}
          x={0}
          y={0}
          w={WW}
          vh={A_H}
          t={t}
          scroll={104 + flow(t, T.after, 22) * (1 - down) + down * 660 + flow(t, T.aScroll + 0.55, 34)}
          boxes={[
            { x: 20, y: 445, w: 368, h: 58, at: T.aBtn, out: T.aScroll, r: 40 },
            { x: 53, y: 820, w: 58, h: 56, at: T.aScroll + 0.45 },
            { x: 525, y: 820, w: 58, h: 56, at: T.aScroll + 0.5 },
          ]}
          pad={10}
          border={8}
        />
      </Win>
      <Win y={B_TOP} push={push} ox={250} oy={200} o={b} dy={(1 - b) * 60} fade="#FFFFFF">
        <Shot src="img/w_a.jpg" cssW={960} x={0} y={0} w={WW} vh={WEND - B_TOP} t={t} scroll={104 + flow(t, T.after, 22) * (1 - down) + down * 452 + flow(t, T.aScroll + 0.55, 34)} boxes={[{ x: 124, y: 445, w: 188, h: 64, at: T.aBtn + 0.25, out: T.aScroll, r: 4 }]} pad={12} border={8} />
      </Win>
      {!bare && (
        <>
          <Head t={t} top={286} lines={[{ at: T.after - 0.25, node: '다섯 줄을 붙이면', size: 60, color: SOFT }]} />
          <Swap
            t={t}
            top={354}
            size={104}
            items={[
              { a: T.aBtn - 0.3, b: T.aScroll + 0.3, node: <>버튼은 <Gold>하나만</Gold></> },
              { a: T.aScroll + 0.3, b: 99, node: <>카드 · 이모지 <Gold>다 빠짐</Gold></> },
            ]}
          />
        </>
      )}
      <div style={{ ...lab(1, 'rgba(255,255,255,0.78)'), top: A_LAB }}>다섯 줄 전</div>
      <div style={{ ...lab(b, BUTTER), top: B_LAB }}>다섯 줄 후</div>
    </AbsoluteFill>
  );
};

/** ⑤ 사진 자리 — 꽃 그림까지 빠진 흰 판에 한 줄을 더하면 큰 사진 칸이 생기고, 가게 사진을 넣으면 칸이 찬다. */
const SLOT = { x: 437, y: 142, w: 499, h: 846 };
const P_Y = 272; // 창은 위(안전선 269부터), 글은 아래 — 앞 장면과 자리를 뒤집는다(11-25 올리기 전 검사 한 구성)
const P_H = 882;
const P_DROP = 258;
const PhotoScene: React.FC<{ t: number; bare?: boolean }> = ({ t, bare }) => {
  const push = settle(t, t < T.pSlot ? T.photo : T.pSlot) * (1 + 0.02 * interpolate(t, [t < T.pSlot ? T.photo : T.pSlot, t < T.pSlot ? T.pSlot : T.end], [0, 1], clamp));
  const fill = interpolate(t, [T.fill, T.fill + 0.45], [0, 1], { ...clamp, easing: IN_OUT });
  // 사진을 넣을 차례에 창이 아래로 내려가고 글이 위로 온다(한 구성 4초 안)
  const drop = interpolate(t, [T.pFillHead - 0.14, T.pFillHead + 0.2], [0, 1], { ...clamp, easing: IN_OUT });
  return (
    <AbsoluteFill>
      <Glow c={WARM} t={t} y={760 + 200 * drop} />
      <Win y={P_Y + P_DROP * drop} h={P_H} push={push} ox={t < T.pSlot ? 250 : 60} oy={430} fade={t < T.pSlot ? '#FFFFFF' : undefined}>
        {t < T.pSlot && <Shot src="img/w_a1.jpg" cssW={960} x={0} y={0} w={WW} vh={P_H} t={t} scroll={flow(t, T.photo, 60)} />}
        {t >= T.pSlot && <Shot src="img/w_p.jpg" cssW={960} x={0} y={0} w={WW} vh={P_H} t={t} boxes={[{ ...SLOT, at: T.pBox, out: T.fill }]} pad={2} border={9} />}
        {t >= T.pSlot && fill < 1 && (
          <>
            <div style={{ position: 'absolute', left: SLOT.x * K, top: SLOT.y * K, width: SLOT.w * K, height: SLOT.h * K, backgroundColor: BUTTER, opacity: (0.2 + 0.14 * Math.sin(2 * Math.PI * 1.1 * (t - T.pBox))) * appear(t, T.pBox, 0.2) * (1 - fill) }} />
            <div style={{ position: 'absolute', left: SLOT.x * K, width: SLOT.w * K, top: (SLOT.y + 330) * K, textAlign: 'center', opacity: appear(t, T.pBox, 0.2) * (1 - fill), fontFamily: KO, fontSize: 80, fontWeight: 800, letterSpacing: '-0.045em', color: INK, whiteSpace: 'nowrap' }}>사진 자리</div>
          </>
        )}
        {fill > 0 && (
          <div style={{ position: 'absolute', left: SLOT.x * K, top: SLOT.y * K, width: SLOT.w * K, height: SLOT.h * K, overflow: 'hidden', clipPath: `inset(0 0 ${(1 - fill) * 100}% 0)` }}>
            <Img src={staticFile('img/w_pp.jpg')} style={{ position: 'absolute', left: -SLOT.x * K, top: -SLOT.y * K, width: WW, transform: `scale(${1.02 + 0.075 * interpolate(t, [T.fill, T.end], [0, 1], clamp)})`, transformOrigin: `${(SLOT.x + SLOT.w / 2) * K}px ${(SLOT.y + SLOT.h / 2) * K}px` }} />
          </div>
        )}
      </Win>
      {!bare && (
        <>
          <Swap
            t={t}
            top={1180}
            size={64}
            color={SOFT}
            items={[
              { a: T.photo - 0.25, b: T.pFillHead - 0.12, node: <>꽃 그림까지 빠지면 <Gold>한 줄 더</Gold></> },
            ]}
          />
          <Swap
            t={t}
            top={1264}
            size={66}
            items={[{ a: T.pL2, b: T.pFillHead - 0.12, node: <>「오른쪽에 가게 사진이<br />들어갈 자리를 비워 둬」</> }]}
          />
          <Swap t={t} top={286} size={64} color={SOFT} items={[{ a: T.pFillHead, b: 99, node: '그 자리에' }]} />
          <Swap t={t} top={372} size={120} items={[{ a: T.pFillHead + 0.04, b: 99, node: <>가게 <Gold>사진만</Gold></> }]} />
          <div style={{ position: 'absolute', left: 640, top: 442, opacity: appear(t, T.fill + 0.2, 0.25), fontFamily: KO, fontSize: 46, fontWeight: 700, letterSpacing: '-0.03em', color: SOFT, whiteSpace: 'nowrap' }}>사진은 예시예요</div>
        </>
      )}
    </AbsoluteFill>
  );
};

/** ⑥ 끝 — 앞 1.4초는 분홍 판과 사진까지 든 흰 판을 휴대폰 두 대로 나란히(「붙여 넣을 다섯 줄」), 끝 3초는 분홍 가게들 사이 하얀 가게 앞의 몽글이가 웃으며 댓글 안내.
 *  11-25 이해 시험 둘이 「끝이 작은 비교 화면으로 흐지부지」라 해서 순서를 바꿨다. */
const EndScene: React.FC<{ ending: Ending }> = ({ ending }) => {
  const E = ending === 'post' ? TG : T;
  const t = useCurrentFrame() / FPS + T.end;
  const drift = 1 + 0.06 * interpolate(t, [E.cta, LEN], [0, 1], clamp);
  const row = appear(t, E.cta, 0.14);
  const line3 = appear(t, E.cta + 0.25);
  const smile = t >= E.smile ? 1 : 0; // 겹쳐 바꾸면 눈이 두 벌로 보인다(Y78 최종 확인) — 한 프레임에 바꾼다
  const pairPush = settle(t, T.end) * (1 + 0.03 * interpolate(t, [T.end, E.cta], [0, 1], clamp));
  const right = appear(t, T.end + 0.22, 0.26);
  if (t < E.cta) {
    return (
      <AbsoluteFill>
        <Glow c={WARM} t={t} y={1060} />
        <div style={{ position: 'absolute', inset: 0, transform: `scale(${pairPush})`, transformOrigin: '492px 900px' }}>
          <Shot src="img/m_b3.jpg" cssW={390} x={76} y={680} w={398} vh={728} scroll={118} radius={28} t={t} />
          <Shot src="img/m_pp.jpg" cssW={390} x={508} y={680 + (1 - right) * 46} w={398} vh={728} scroll={104} o={right} radius={28} t={t} />
        </div>
        <Head
          t={t}
          top={286}
          lines={[
            { at: T.end - 0.25, node: '붙여 넣을', size: 76, color: SOFT },
            { at: E.eL2, node: <Gold>다섯 줄</Gold>, size: 160 },
          ]}
        />
        <div style={{ position: 'absolute', left: 80, top: 598, fontFamily: KO, fontSize: 52, fontWeight: 800, letterSpacing: '-0.04em', color: 'rgba(255,255,255,0.72)', whiteSpace: 'nowrap' }}>전</div>
        <div style={{ position: 'absolute', left: 512, top: 598, fontFamily: KO, fontSize: 52, fontWeight: 800, letterSpacing: '-0.04em', color: BUTTER, whiteSpace: 'nowrap', opacity: right }}>다섯 줄 + 사진</div>
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill>
      <Mong a="mong/c.jpg" b="mong/c2.jpg" mix={smile} eye={{ x: 739, y: 1072, rx: 170, ry: 78 }} top={150} ox={600} oy={620} s={1.02 * drift * settle(t, E.cta)} solid={430} fade={770} light={glow(t)} />
      <div style={{ position: 'absolute', left: LEFT, top: 286, fontFamily: KO, fontSize: 76, fontWeight: 800, letterSpacing: '-0.045em', lineHeight: 1.12, color: SOFT, whiteSpace: 'nowrap', opacity: row, transform: `translateY(${(1 - row) * 28}px)` }}>AI 티 빼는 다섯 줄</div>
      <div style={{ position: 'absolute', left: LEFT, top: 376, fontFamily: KO, fontSize: 124, fontWeight: 800, letterSpacing: '-0.045em', lineHeight: 1.12, color: WHITE, whiteSpace: 'nowrap', opacity: row, transform: `translateY(${(1 - row) * 28}px)` }}>
        {ending === 'post' ? (
          <>
            <Gold>글에</Gold> 다 있어요
          </>
        ) : (
          <>
            댓글에 <Gold>「홈페이지」</Gold>
          </>
        )}
      </div>
      <div style={{ position: 'absolute', left: LEFT + 2, top: 534, fontFamily: KO, fontSize: 64, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.2, color: WHITE, whiteSpace: 'nowrap', opacity: line3, transform: `translateY(${(1 - line3) * 20}px)`, textShadow: '0 2px 24px rgba(10,10,10,0.5)' }}>
        {ending === 'post' ? <>사진 자리 한 줄까지 적어 뒀어요</> : <>쓰면 DM으로 보내 드려요</>}
      </div>
    </AbsoluteFill>
  );
};

// ───────────────────────── 본편 ─────────────────────────

export const Film: React.FC<{ bgm?: boolean; voice?: boolean; ending?: Ending }> = ({ bgm = true, voice = true, ending = 'dm' }) => {
  const fr = useCurrentFrame();
  const t = fr / FPS;
  const vo = VO.map((v) => (v.id === 'P2' && ending === 'post' ? { ...v, id: 'P2G', at: P2G_AT } : v));
  const sfx = [...SFX, ...SFX_END[ending]];
  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      <Sequence from={0} durationInFrames={F(T.bad)} name="처음 · 몽글이">
        <Opening />
      </Sequence>
      {inWin(t, T.bad, T.make) && <BadScene t={t} />}
      {inWin(t, T.make, T.after) && <MakeScene t={t} />}
      {inWin(t, T.after, T.photo) && <AfterScene t={t} />}
      {inWin(t, T.photo, T.end) && <PhotoScene t={t} />}
      <Sequence from={F(T.end)} durationInFrames={TOTAL - F(T.end)} name="끝 · 몽글이">
        <EndScene ending={ending} />
      </Sequence>

      {bgm && <Audio src={staticFile(BGM.file)} volume={(f: number) => MASTER * BGM.vol * interpolate(f, [F(LEN - BGM.fadeOut), F(LEN)], [1, 0.5], clamp)} />}
      {voice &&
        vo.map((v) => (
          <Sequence key={v.id} from={F(v.at)} name={`말 ${v.id}`}>
            <Audio src={staticFile(`vo/${v.id}.wav`)} volume={MASTER} />
          </Sequence>
        ))}
      {voice &&
        sfx.map((x, i) => (
          <Sequence key={i} from={F(x.at)} name={`효과음 ${x.file}`}>
            <Audio src={staticFile(`sfx/${x.file}.wav`)} volume={MASTER * x.v} />
          </Sequence>
        ))}
    </AbsoluteFill>
  );
};

/** 핵심 장면만(장면 심사용 · 제목 · 설명 없이) — 분홍 판이 흰 판으로, 다시 사진 칸에 사진이 차기까지. 결과 장면 앞 3.2초 + 사진 장면 뒤 3.2초를 잇는다. */
export const SCENE_A: [number, number] = [12.75, 15.9];
export const SCENE_B: [number, number] = [18.9, 21.5];
export const SCENE_LEN = SCENE_A[1] - SCENE_A[0] + (SCENE_B[1] - SCENE_B[0]);
export const Scene: React.FC = () => {
  const u = useCurrentFrame() / FPS;
  const la = SCENE_A[1] - SCENE_A[0];
  const t = u < la ? SCENE_A[0] + u : SCENE_B[0] + (u - la);
  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      {inWin(t, T.after, T.photo) && <AfterScene t={t} bare />}
      {inWin(t, T.photo, T.end) && <PhotoScene t={t} bare />}
      <Sequence from={F(la + (19.5 - SCENE_B[0]))} name="말 V5b">
        <Audio src={staticFile('vo/V5b.wav')} volume={MASTER} />
      </Sequence>
      {SFX.map((x, i) => {
        const at = x.at >= SCENE_A[0] && x.at < SCENE_A[1] ? x.at - SCENE_A[0] : x.at >= SCENE_B[0] && x.at < SCENE_B[1] ? la + x.at - SCENE_B[0] : -1;
        return at >= 0 ? (
          <Sequence key={i} from={F(at)} name={`효과음 ${x.file}`}>
            <Audio src={staticFile(`sfx/${x.file}.wav`)} volume={MASTER * x.v} />
          </Sequence>
        ) : null;
      })}
    </AbsoluteFill>
  );
};
