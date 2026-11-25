// 「클로드가 만든 홈페이지, AI 티를 빼는 다섯 줄」 본편 — 수요 장부 yuhobuilds 5번(웹사이트와 발표 자료가 AI 티 나지 않게, 11-25 · 장부 Y81).
// 처음과 끝은 몽글이 장면(구운 그림 · 눈 둘레 조각만 바꿔 끼운다), 가운데는 범수 보이스오버와 실제 결과 화면이다.
// 결과는 2026-11-25에 직접 돌린 홈페이지 요청이다(기획.md 「실험 기록」 · 시안/실험/): 다섯 줄 없이 세 번 · 다섯 줄 붙여 세 번 · 사진 자리 한 줄을 더해 두 번.
// 화면은 받은 HTML을 크롬에서 휴대폰 폭(390px)으로 열어 2.5배로 찍은 그림(975px 폭)이다.
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
const CAP = 'rgba(255,255,255,0.84)';
const LEFT = 79;
const MASTER = 0.8;
const PW = 975; // 찍은 휴대폰 그림 폭
const PV = 2110; // 휴대폰 한 화면 높이(844px × 2.5)

const inWin = (t: number, a: number, b: number) => t >= a && t < b;
const appear = (t: number, a: number, len = 0.22) => interpolate(t, [a, a + len], [0, 1], { ...clamp, easing: OUT });
/** 몽글이 장면의 빛 숨결 — 2.4초에 한 번 6%만(몽글이는 크게 움직이지 않고 빛으로 작게, 11-20 유호님). */
const glow = (t: number) => 1 + 0.06 * Math.sin((2 * Math.PI * t) / 2.4);
const settle = (t: number, a: number) => 1.035 - 0.035 * appear(t, a, 0.34);

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

const Gold: React.FC<{ children: React.ReactNode }> = ({ children }) => <span style={{ color: BUTTER }}>{children}</span>;

const Tag: React.FC = () => (
  <div style={{ position: 'absolute', left: 84, top: 286, fontFamily: KO, fontSize: 34, fontWeight: 700, letterSpacing: '0.01em', lineHeight: 1.2, color: WHITE, whiteSpace: 'nowrap' }}>
    yuhobuilds<span style={{ fontWeight: 500, opacity: 0.7, marginLeft: 16 }}>AI와 회사 만들기</span>
  </div>
);

const Cap: React.FC<{ t: number; at: number; x: number; y: number; size?: number; children: React.ReactNode }> = ({ t, at, x, y, size = 44, children }) => {
  const p = appear(t, at, 0.26);
  if (p <= 0) return null;
  return <div style={{ position: 'absolute', left: x, top: y + (1 - p) * 20, opacity: p, fontFamily: KO, fontSize: size, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.28, color: CAP, whiteSpace: 'nowrap', textShadow: '0 2px 14px rgba(0,0,0,0.75)' }}>{children}</div>;
};

type Eye = { x: number; y: number; rx: number; ry: number };
const Mong: React.FC<{ a: string; b: string; mix: number; eye: Eye; top: number; s: number; ox: number; oy: number; solid: number; fade: number; light?: number }> = ({ a, b, mix, eye, top, s, ox, oy, solid, fade, light = 1 }) => {
  const mask = `radial-gradient(ellipse ${eye.rx}px ${eye.ry}px at ${eye.x}px ${eye.y}px, #000 58%, transparent 100%)`;
  return (
    <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: INK }}>
      <div style={{ position: 'absolute', left: 0, top, width: 1080, height: 1620, transform: `scale(${s})`, transformOrigin: `${ox}px ${oy}px`, filter: `brightness(${light})` }}>
        <Img src={staticFile(a)} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1620 }} />
        {mix > 0 && <Img src={staticFile(b)} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1620, opacity: mix, WebkitMaskImage: mask, maskImage: mask }} />}
      </div>
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, rgba(10,10,10,1) 0, rgba(10,10,10,1) ${solid}px, rgba(10,10,10,0) ${fade}px)` }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 420, background: 'linear-gradient(0deg, rgba(10,10,10,1) 0, rgba(10,10,10,1) 120px, rgba(10,10,10,0) 420px)' }} />
    </AbsoluteFill>
  );
};

/** 받은 홈페이지를 휴대폰 폭으로 찍은 그림 한 장. 폭 w(화면 px)로 놓고, 그림 안 scroll(그림 px)만큼 내려 본다. boxes는 그림 px 자리. */
type Box = { x: number; y: number; w: number; h: number; at: number; out?: number };
const Phone: React.FC<{ src: string; x: number; y: number; w: number; scroll?: number; o?: number; dim?: number; boxes?: Box[]; t: number; clipTop?: number; vh?: number; bezel?: boolean }> = ({ src, x, y, w, scroll = 0, o = 1, dim = 0, boxes = [], t, clipTop = 0, vh = PV, bezel = false }) => {
  const s = w / PW;
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w, height: vh * s, opacity: o, borderRadius: bezel ? 34 : 22, overflow: 'hidden', backgroundColor: '#fff', boxShadow: bezel ? '0 0 0 12px #1C1C1E, 0 0 0 14px #3A3A3C, 0 30px 80px rgba(0,0,0,0.6)' : '0 18px 50px rgba(0,0,0,0.55)', clipPath: clipTop > 0 ? `inset(${clipTop * 100}% 0 0 0)` : undefined }}>
      <div style={{ position: 'absolute', left: 0, top: -scroll * s, width: PW, transform: `scale(${s})`, transformOrigin: '0 0' }}>
        <Img src={staticFile(src)} style={{ display: 'block', width: PW }} />
        {boxes.map((b, i) => {
          const p = appear(t, b.at, 0.25) * (b.out ? interpolate(t, [b.out, b.out + 0.2], [1, 0], clamp) : 1);
          return p > 0 ? <div key={i} style={{ position: 'absolute', left: b.x - 14, top: b.y - 14, width: b.w + 28, height: b.h + 28, borderRadius: 26, border: `${4.5 / s}px solid ${BUTTER}`, opacity: p, transform: `scale(${1.05 - 0.05 * p})` }} /> : null;
        })}
      </div>
      {dim > 0 && <div style={{ position: 'absolute', inset: 0, backgroundColor: `rgba(10,10,10,${dim})` }} />}
    </div>
  );
};

// ───────────────────────── 장면 ─────────────────────────

/** ① 처음 — 똑같은 분홍 판 셋 앞의 몽글이. 0초부터 「클로드가 만든 홈페이지 / AI 티」, 2.3초 「다섯 줄이면 빠져요」. */
const Opening: React.FC = () => {
  const t = useCurrentFrame() / FPS;
  const drift = 1 + 0.07 * interpolate(t, [0, T.bad], [0, 1], clamp);
  const lean = 0.03 * interpolate(t, [T.eye - 0.1, T.eye + 0.4], [0, 1], { ...clamp, easing: IN_OUT });
  const pulse = 1 + 0.05 * interpolate(t, [T.l3, T.l3 + 0.12, T.l3 + 0.5], [0, 1, 0], clamp);
  return (
    <AbsoluteFill>
      <Mong a="mong/a.jpg" b="mong/a2.jpg" mix={interpolate(t, [T.eye - 0.2, T.eye + 0.2], [0, 1], clamp)} eye={{ x: 638, y: 911, rx: 130, ry: 75 }} top={150} ox={560} oy={1050} s={drift + lean} solid={430} fade={700} light={glow(t)} />
      <Tag />
      <Head
        t={t}
        top={340}
        lines={[
          { at: 0, node: '클로드가 만든 홈페이지', size: 76, color: 'rgba(255,255,255,0.86)' },
          { at: T.l2, node: <Gold>AI 티</Gold>, size: 196 },
          {
            at: T.l3,
            node: (
              <span style={{ display: 'inline-block', transform: `scale(${pulse})`, transformOrigin: '0 80%' }}>
                <Gold>다섯 줄</Gold>이면 빠져요
              </span>
            ),
            size: 100,
          },
        ]}
      />
    </AbsoluteFill>
  );
};

/** ② 문제 — 같은 요청을 새 대화에서 세 번: 세 판 모두 같은 분홍 버튼, 이모지 · 꼬리표가 붙은 카드. */
const BEFORE: { src: string; btn: Box; card: Box; scroll: number }[] = [
  { src: 'img/b1.png', btn: { x: 50, y: 894, w: 399, h: 143, at: T.bSame }, card: { x: 128, y: 2680, w: 720, h: 136, at: T.bCard + 0.35 }, scroll: 2440 },
  { src: 'img/b2.png', btn: { x: 665, y: 19, w: 260, h: 122, at: T.bSame + 0.08 }, card: { x: 73, y: 2444, w: 213, h: 74, at: T.bCard + 0.4 }, scroll: 2290 },
  { src: 'img/b3.png', btn: { x: 50, y: 1017, w: 409, h: 146, at: T.bSame + 0.16 }, card: { x: 133, y: 3012, w: 710, h: 165, at: T.bCard + 0.45 }, scroll: 2800 },
];
const BadScene: React.FC<{ t: number }> = ({ t }) => {
  const drift = 1 + 0.04 * interpolate(t, [T.bad, T.make], [0, 1], clamp);
  const down = interpolate(t, [T.bCard, T.bCard + 0.5], [0, 1], { ...clamp, easing: IN_OUT });
  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${drift})`, transformOrigin: '540px 950px' }}>
        {BEFORE.map((b, i) => {
          const a = appear(t, T.bad + 0.1 + i * 0.12, 0.3);
          return (
            <Phone key={i} src={b.src} x={78 + i * 288} y={668 + (1 - a) * 40} w={268} o={a} t={t} scroll={down * b.scroll} boxes={[{ ...b.btn, out: T.bCard }, b.card]} />
          );
        })}
      </div>
      <Head
        t={t}
        top={292}
        lines={[
          { at: T.bad - 0.25, node: '꽃집 홈페이지를 세 번', size: 66, color: 'rgba(255,255,255,0.86)' },
          { at: T.bSame - 0.15, node: <>세 번 다 <Gold>같은 분홍</Gold></>, size: 112, gap: 18 },
          { at: T.bCard - 0.1, node: <>이모지 카드까지</>, size: 112 },
        ]}
      />
      <Cap t={t} at={T.bad + 0.6} x={84} y={1296} size={40}>
        같은 요청을 새 대화에서 세 번 맡긴 실제 화면
      </Cap>
    </AbsoluteFill>
  );
};

/** ③ 다섯 줄 — 요청 끝에 붙인 다섯 줄이 0.85초마다 하나씩 선다. */
const MakeScene: React.FC<{ t: number; bare?: boolean }> = ({ t, bare }) => {
  const push = settle(t, T.make) * (1 + 0.04 * interpolate(t, [T.make, T.after], [0, 1], clamp));
  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      {!bare && (
        <Head
          t={t}
          top={292}
          lines={[
            { at: T.make - 0.25, node: '그래서 요청 끝에', size: 92, color: 'rgba(255,255,255,0.86)' },
            { at: T.mL2, node: <>이 <Gold>다섯 줄</Gold></>, size: 112 },
          ]}
        />
      )}
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${push})`, transformOrigin: '84px 800px' }}>
        {FIVE.map((s, i) => {
          const p = appear(t, T.item + i * T.itemGap, 0.26);
          if (p <= 0) return null;
          return (
            <div key={i} style={{ position: 'absolute', left: 84, top: 600 + i * 132 + (1 - p) * 22, opacity: p, display: 'flex', alignItems: 'baseline', gap: 26, fontFamily: KO, whiteSpace: 'nowrap' }}>
              <div style={{ width: 40, fontSize: 54, fontWeight: 800, color: BUTTER, letterSpacing: '-0.02em' }}>{i + 1}</div>
              <div style={{ fontSize: 56, fontWeight: 800, letterSpacing: '-0.045em', color: WHITE }}>{s}</div>
            </div>
          );
        })}
      </div>
      {!bare && (
        <Cap t={t} at={T.make + 0.6} x={84} y={1310} size={40}>
          같은 요청에 다섯 줄만 붙여 다시 세 번
        </Cap>
      )}
    </AbsoluteFill>
  );
};

/** ④ 결과 — 휴대폰 한 대를 크게(폭 585px · 테두리) 두고, 분홍 판(🌸 이름 · 분홍 버튼 둘 · 💐 그림)이 위부터 흰 판으로 바뀐다.
 *  「하나만」에 빨강 버튼 하나에 테, 「카드」에 아래로 내려가 카드 상자 대신 가는 줄.
 *  11-25 장면 심사(Opus) v3 · v4 두 번 같이 짚음: 휴대폰이 작아 차이가 안 읽히고, 바뀐 판이 밋밋해 보인다 — 한 대를 크게, 실제 휴대폰처럼 테두리. */
const BIG_W = 585;
const BIG_X = 248;
const BIG_Y = 500;
const BIG_VH = 1420; // 그림 px — 화면 높이 852px(이름표까지 아래 안전선 1428 안)
const AfterScene: React.FC<{ t: number; bare?: boolean }> = ({ t, bare }) => {
  const push = settle(t, T.after) * (1 + 0.03 * interpolate(t, [T.after, T.photo], [0, 1], clamp));
  const wipe = interpolate(t, [T.wipe, T.wipe + 0.42], [0, 1], { ...clamp, easing: IN_OUT });
  const down = interpolate(t, [T.aScroll, T.aScroll + 0.55], [0, 1], { ...clamp, easing: IN_OUT });
  const lab = appear(t, T.after + 0.05, 0.25);
  const s = BIG_W / PW;
  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      {!bare && (
        <>
          <Head t={t} top={292} lines={[{ at: T.after - 0.1, node: '다섯 줄을 붙이면', size: 66, color: 'rgba(255,255,255,0.86)' }]} />
          {/* 둘째 줄은 같은 자리에서 「버튼은 하나만」 → 「카드 · 이모지 0」으로 바뀐다(머리 글이 화면을 밀어내지 않게). */}
          {[
            { a: T.aBtn - 0.35, b: T.aScroll - 0.05, node: <>버튼은 <Gold>하나만</Gold></> },
            { a: T.aScroll - 0.05, b: 99, node: <>카드 · 이모지 <Gold>0</Gold></> },
          ].map((l, i) => {
            const p = appear(t, l.a) * interpolate(t, [l.b, l.b + 0.15], [1, 0], clamp);
            return p > 0 ? (
              <div key={i} style={{ position: 'absolute', left: LEFT, top: 372 + (1 - appear(t, l.a)) * 28, opacity: p, fontFamily: KO, fontSize: 96, fontWeight: 800, letterSpacing: '-0.045em', lineHeight: 1.1, color: WHITE, whiteSpace: 'nowrap' }}>
                {l.node}
              </div>
            ) : null;
          })}
        </>
      )}
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${push})`, transformOrigin: '540px 950px' }}>
        <Phone src="img/a.png" x={BIG_X} y={BIG_Y} w={BIG_W} vh={BIG_VH} bezel t={t} scroll={down * 1150} boxes={[{ x: 60, y: 1030, w: 855, h: 159, at: T.aBtn, out: T.aScroll }]} />
        {wipe < 1 && <Phone src="img/b3.png" x={BIG_X} y={BIG_Y} w={BIG_W} vh={BIG_VH} t={t} clipTop={wipe} boxes={[
          { x: 50, y: 1017, w: 409, h: 146, at: T.after + 0.35 },
          { x: 50, y: 1193, w: 479, h: 146, at: T.after + 0.45 },
          { x: 50, y: 35, w: 236, h: 91, at: T.after + 0.55 },
        ]} />}
        {wipe > 0 && wipe < 1 && <div style={{ position: 'absolute', left: BIG_X - 16, top: BIG_Y + wipe * BIG_VH * s - 3, width: BIG_W + 32, height: 6, borderRadius: 3, backgroundColor: BUTTER }} />}
        {/* 판 이름표 — 휴대폰 아래 가운데 */}
        <div style={{ position: 'absolute', left: BIG_X, width: BIG_W, top: BIG_Y + BIG_VH * s + 14, textAlign: 'center', opacity: lab, fontFamily: KO, fontSize: 40, fontWeight: 800, letterSpacing: '-0.035em', whiteSpace: 'nowrap' }}>
          <span style={{ color: 'rgba(255,255,255,0.66)', opacity: 1 - wipe, position: 'absolute', left: 0, right: 0 }}>다섯 줄 없이</span>
          <span style={{ color: BUTTER, opacity: wipe, position: 'absolute', left: 0, right: 0 }}>다섯 줄 붙임</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** ⑤ 사진 자리 — 꽃 그림까지 빠지니, 한 줄을 더하면 첫 화면에 큰 사진 칸이 생긴다. */
const PhotoScene: React.FC<{ t: number }> = ({ t }) => {
  const push = settle(t, T.photo) * (1 + 0.035 * interpolate(t, [T.photo, T.end], [0, 1], clamp));
  const a = appear(t, T.photo + 0.05, 0.35);
  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      <Head
        t={t}
        top={292}
        lines={[
          { at: T.photo - 0.25, node: '꽃 그림까지 빠지면', size: 76, color: 'rgba(255,255,255,0.86)' },
          { at: T.pL2, node: <>+ 사진 자리 <Gold>한 줄</Gold></>, size: 112, gap: 10 },
        ]}
      />
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${push})`, transformOrigin: '540px 1000px' }}>
        <Phone src="img/p.png" x={BIG_X} y={BIG_Y + 20 + (1 - a) * 60} w={BIG_W} vh={BIG_VH} bezel o={a} t={t} boxes={[{ x: 60, y: 1233, w: 855, h: 800, at: T.pBox }]} />
      </div>
    </AbsoluteFill>
  );
};

/** ⑥ 끝 — 흰 판 하나 옆 몽글이(가까이)가 「붙여 넣을 다섯 줄」을 꺼내고, 끝 3초는 핵심 장면(분홍 판 → 흰 판)으로 바뀌어 행동 안내를 얹는다. */
const EndScene: React.FC<{ ending: Ending }> = ({ ending }) => {
  const E = ending === 'post' ? TG : T;
  const t = useCurrentFrame() / FPS + T.end;
  const drift = 1 + 0.06 * interpolate(t, [T.end, E.cta], [0, 1], clamp);
  const row = appear(t, E.cta);
  const cta = appear(t, E.cta + 0.1);
  const under = interpolate(t, [E.key, E.key + 0.3], [0, 100], { ...clamp, easing: OUT });
  const smile = interpolate(t, [E.smile - 0.2, E.smile + 0.2], [0, 1], clamp);
  const coreIn = appear(t, E.cta - 0.05, 0.3);
  const endPush = 1 + 0.045 * interpolate(t, [E.cta, LEN], [0, 1], clamp);
  const pair = appear(t, E.cta + 0.2, 0.3);
  const flip = interpolate(t, [E.cta + 0.55, E.cta + 0.95], [0, 1], { ...clamp, easing: IN_OUT });
  const mark = (label: string) => (
    <span style={{ color: BUTTER, backgroundImage: `linear-gradient(${BUTTER}, ${BUTTER})`, backgroundRepeat: 'no-repeat', backgroundPosition: '0 100%', backgroundSize: `${under}% 7px`, paddingBottom: 6 }}>{label}</span>
  );
  return (
    <AbsoluteFill>
      {coreIn < 1 && (
        <AbsoluteFill style={{ opacity: 1 - coreIn }}>
          <Mong a="mong/c.jpg" b="mong/c2.jpg" mix={smile} eye={{ x: 648, y: 886, rx: 170, ry: 80 }} top={150} ox={620} oy={980} s={1.02 * drift * settle(t, T.end)} solid={500} fade={720} light={glow(t) * (0.96 + 0.08 * smile)} />
        </AbsoluteFill>
      )}
      {coreIn > 0 && (
        <AbsoluteFill style={{ backgroundColor: INK, opacity: coreIn }}>
          {/* 핵심 장면 다시: 분홍 판(다섯 줄 없이) 옆에 흰 판(다섯 줄 붙임)이 서고, 분홍 판이 어두워진다(천천히 다가감). */}
          <div style={{ position: 'absolute', inset: 0, transform: `scale(${endPush})`, transformOrigin: '540px 1100px', opacity: pair }}>
            <Phone src="img/b3.png" x={96} y={830 + (1 - pair) * 30} w={280} t={t} vh={2050} dim={0.55 * flip} />
            <Phone src="img/a.png" x={624} y={830 + (1 - pair) * 30} w={280} t={t} vh={2050} />
            <div style={{ position: 'absolute', left: 430, top: 1080, fontFamily: KO, fontSize: 110, fontWeight: 800, color: BUTTER, opacity: flip }}>→</div>
          </div>
        </AbsoluteFill>
      )}
      {t < E.cta ? (
        <Head
          t={t}
          top={292}
          lines={[
            { at: T.end - 0.25, node: '붙여 넣을', size: 100 },
            { at: E.eL2, node: <Gold>다섯 줄</Gold>, size: 150 },
          ]}
        />
      ) : (
        <>
          <div style={{ position: 'absolute', left: LEFT, top: 286, fontFamily: KO, fontWeight: 800, letterSpacing: '-0.045em', whiteSpace: 'nowrap', opacity: row, transform: `translateY(${(1 - row) * 28}px)` }}>
            <div style={{ fontSize: 52, fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>AI 티 빼는</div>
            <div style={{ fontSize: 150, lineHeight: 1.05, color: BUTTER }}>다섯 줄</div>
          </div>
          <div style={{ position: 'absolute', left: LEFT, top: 532, fontFamily: KO, fontSize: 96, fontWeight: 800, letterSpacing: '-0.045em', lineHeight: 1.1, color: WHITE, whiteSpace: 'nowrap', opacity: cta, transform: `translateY(${(1 - cta) * 28}px)` }}>
            {ending === 'post' ? <>{mark('글에')} 다 있어요</> : <>댓글에 {mark('「홈페이지」')}</>}
          </div>
          <div style={{ position: 'absolute', left: LEFT + 2, top: 660, fontFamily: KO, fontSize: 54, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.2, color: WHITE, whiteSpace: 'nowrap', opacity: appear(t, E.cta + 0.3), transform: `translateY(${(1 - appear(t, E.cta + 0.3)) * 20}px)` }}>
            {ending === 'post' ? <>다섯 줄과 사진 자리 한 줄까지</> : <>다섯 줄을 DM으로 보내 드려요</>}
          </div>
        </>
      )}
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

/** 핵심 장면만(장면 심사용 · 제목 · 설명 없이) — 다섯 줄의 마지막 둘이 선 뒤 분홍 판이 흰 판으로 바뀌고 버튼 하나에 테. */
export const SCENE_FROM = 10.1;
export const SCENE_TO = 16.1;
export const Scene: React.FC = () => {
  const t = useCurrentFrame() / FPS + SCENE_FROM;
  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      {inWin(t, T.make, T.after) && <MakeScene t={t} bare />}
      {inWin(t, T.after, T.photo) && <AfterScene t={t} bare />}
      {VO.filter((v) => v.id === 'V3b' || v.id === 'V4').map((v) => (
        <Sequence key={v.id} from={F(v.at - SCENE_FROM)} name={`말 ${v.id}`}>
          <Audio src={staticFile(`vo/${v.id}.wav`)} volume={MASTER} />
        </Sequence>
      ))}
      {SFX.filter((x) => x.at >= SCENE_FROM && x.at < SCENE_TO).map((x, i) => (
        <Sequence key={i} from={F(x.at - SCENE_FROM)} name={`효과음 ${x.file}`}>
          <Audio src={staticFile(`sfx/${x.file}.wav`)} volume={MASTER * x.v} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
