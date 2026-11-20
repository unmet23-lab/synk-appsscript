// Y73 본편 — AI 그림에 「토마토색 동그라미」라고 적었더니 마크마다 꼭지가 달렸고, 1화는 「꼭지 없음 · 잎 없음 · 과일 없음」까지 적어 다시 만들어도
// 작은 꼭지가 또 붙었다 → 패치 세 장 다시 고친 그림 값 27크레딧 · 앞으로 그릴 장면의 91곳 바꿈 → 색은 물건 이름 말고 색과 모양으로.
// 그림은 모두 실제 기준 그림(data.ts). 화면 결: 위 큰 글자가 곧 말 · 검정 · 흰 + 버터 한 곳(꼭지에 두르는 테 · 짚는 낱말) · SUIT 하나.
// 진행자 컷 없음(Y51 · Y66 등과 같은 까닭 — 트랙 §1 「yuhobuilds 화면 결」). 무대는 밝은 종이(지난 두 편 Y51 먹색 · Y66 어두운 홀과 다름).
import React from 'react';
import { Audio } from '@remotion/media';
import { AbsoluteFill, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from '../lib/fonts';
import { clamp, IN_OUT, mix, OUT, prog } from '../lib/motion';
import { BUTTER, DISC, INK, PAPER, STAGE, STEM, STEM_R, SUB } from './data';
import { BGM, LEN, SFX, T, VO } from './timeline';

export const FPS = 30;
export const F = (s: number) => Math.round(s * FPS);
export const TOTAL = F(LEN);

const inWin = (t: number, a: number, b: number) => t >= a && t < b;
const appear = (t: number, a: number, len = 0.24) => interpolate(t, [a, a + len], [0, 1], { ...clamp, easing: OUT });

// ───────────────────────── 부품 ─────────────────────────

/** 위 큰 글 — 줄 단위로 28px 올라오며. */
type Line = { at: number; until?: number; node: React.ReactNode; size?: number; color?: string };
export const Head: React.FC<{ t: number; lines: Line[]; top?: number }> = ({ t, lines, top = 262 }) => (
  <div style={{ position: 'absolute', left: 82, width: 924, top, fontFamily: KO, fontWeight: 800, lineHeight: 1.14, letterSpacing: -2.4 }}>
    {lines
      .filter((l) => t >= l.at - 0.001 && (l.until === undefined || t < l.until))
      .map((l, i) => {
        const p = l.at <= 0 ? 1 : appear(t, l.at, 0.22);
        return (
          <div key={i} style={{ fontSize: l.size ?? 110, color: l.color ?? INK, opacity: p, transform: `translateY(${(1 - p) * 28}px)`, whiteSpace: 'nowrap' }}>
            {l.node}
          </div>
        );
      })}
  </div>
);

/** 낱말 뒤 버터 형광(왼쪽에서 오른쪽으로 칠함). */
export const Mark: React.FC<{ children: React.ReactNode; p: number }> = ({ children, p }) => (
  <span style={{ backgroundImage: `linear-gradient(${BUTTER}, ${BUTTER})`, backgroundRepeat: 'no-repeat', backgroundPosition: '0 88%', backgroundSize: `${p * 100}% 0.42em`, padding: '0 0.04em' }}>{children}</span>
);

/** 꼭지에 두르는 버터 테(그림 좌표 안에서). k = 화면 배율 — 선 굵기를 화면에서 같게. */
const Ring: React.FC<{ x: number; y: number; r: number; p: number; k: number; t: number }> = ({ x, y, r, p, k, t }) => {
  if (p <= 0) return null;
  const pop = 1 + 0.35 * (1 - p);
  const breathe = 1 + 0.03 * Math.sin(t * 5);
  const rr = r * pop * breathe;
  return (
    <div
      style={{
        position: 'absolute',
        left: x - rr,
        top: y - rr,
        width: rr * 2,
        height: rr * 2,
        borderRadius: '50%',
        border: `${11 / k}px solid ${BUTTER}`,
        boxShadow: `0 0 ${18 / k}px rgba(0,0,0,0.35)`,
        opacity: Math.min(1, p * 1.6),
      }}
    />
  );
};

/**
 * 그림 칸 — 1008px 판(또는 w0 × h0 판)을 칸(x, y, w, h)에 놓고, 그림 안 한 점(fx, fy)을 칸 가운데에 두어 s배로 본다.
 * s = 1이면 그림 폭이 칸 폭에 맞는다. children은 그림 좌표로 얹힌다(테 등).
 */
export const Pic: React.FC<{
  src: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fx: number;
  fy: number;
  s: number;
  w0?: number;
  h0?: number;
  radius?: number;
  opacity?: number;
  clip?: string;
  children?: (k: number) => React.ReactNode;
}> = ({ src, x, y, w, h, fx, fy, s, w0 = 1008, h0 = 1008, radius = 22, opacity = 1, clip, children }) => {
  const k = (w / w0) * s;
  // 그림 가장자리가 칸 안으로 들어오지 않게 가운데 점을 붙든다.
  const minFx = w / 2 / k;
  const maxFx = w0 - w / 2 / k;
  const minFy = h / 2 / k;
  const maxFy = h0 - h / 2 / k;
  const cx = minFx > maxFx ? w0 / 2 : Math.max(minFx, Math.min(maxFx, fx));
  const cy = minFy > maxFy ? h0 / 2 : Math.max(minFy, Math.min(maxFy, fy));
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, overflow: 'hidden', borderRadius: radius, opacity, clipPath: clip, boxShadow: '0 22px 60px rgba(40,30,15,0.22)' }}>
      <div style={{ position: 'absolute', left: w / 2 - cx * k, top: h / 2 - cy * k, width: w0, height: h0, transform: `scale(${k})`, transformOrigin: '0 0' }}>
        <Img src={staticFile(src)} style={{ width: w0, height: h0, display: 'block' }} />
        {children?.(k)}
      </div>
    </div>
  );
};

/** 패치 띠 셋(1화 · 2화 · 3화) — 핵심 장면 · 끝. at = 놓이는 초, rings = 테가 앉는 초, wipes = 고친 판으로 바뀌는 초(끝만). */
const STRIP = { x: 214, w: 830, h: 300, gap: 18, top: 580 };
const FIXED = { p1: 'f1', p2: 'f2', p3: 'f3' } as const;
export const Strips: React.FC<{ t: number; at: [number, number, number]; rings: [number, number, number]; wipes?: [number, number, number]; top?: number; labels?: boolean; push?: number }> = ({ t, at, rings, wipes, top = STRIP.top, labels = true, push = 1 }) => {
  const keys = ['p1', 'p2', 'p3'] as const;
  return (
    <>
      {keys.map((key, i) => {
        const p = appear(t, at[i], 0.3);
        if (p <= 0) return null;
        const y = top + i * (STRIP.h + STRIP.gap);
        const drift = (1.0 + 0.05 * interpolate(t, [at[i], at[i] + 6], [0, 1], clamp) + 0.012 * Math.sin(t * 1.3 + i * 2)) * push;
        const fy = (STEM[key].y + DISC[key].y) / 2 + 6 * Math.sin(t * 0.9 + i);
        const fx = STEM[key].x + 14 * Math.sin(t * 0.7 + i * 1.7);
        const rp = appear(t, rings[i], 0.28);
        const wp = wipes ? interpolate(t, [wipes[i], wipes[i] + 0.32], [0, 100], { ...clamp, easing: IN_OUT }) : 0;
        const fk = FIXED[key];
        return (
          <React.Fragment key={key}>
            <div style={{ opacity: p, transform: `translateY(${(1 - p) * 60}px)` }}>
              <Pic src={`img/${key}.jpg`} x={STRIP.x} y={y} w={STRIP.w} h={STRIP.h} fx={fx} fy={fy} s={drift}>
                {(k) => <Ring x={STEM[key].x} y={STEM[key].y} r={STEM_R[key]} p={rp * (1 - wp / 100)} k={k} t={t} />}
              </Pic>
              {wp > 0 && (
                <Pic src={`img/${fk}.jpg`} x={STRIP.x} y={y} w={STRIP.w} h={STRIP.h} fx={DISC[fk].x + 14 * Math.sin(t * 0.7 + i * 1.7)} fy={DISC[fk].y - 40 + 6 * Math.sin(t * 0.9 + i)} s={drift} clip={`inset(0 ${100 - wp}% 0 0 round 22px)`} />
              )}
              {wp > 0 && wp < 100 && (
                <div style={{ position: 'absolute', left: STRIP.x, top: y, width: STRIP.w, height: STRIP.h, overflow: 'hidden', borderRadius: 22 }}>
                  <div style={{ position: 'absolute', left: (STRIP.w * wp) / 100 - 6, top: 0, width: 12, height: STRIP.h, background: BUTTER }} />
                </div>
              )}
            </div>
            {labels && (
              <div style={{ position: 'absolute', left: 84, top: y + STRIP.h / 2 - 40, fontFamily: KO, fontWeight: 800, fontSize: 64, color: INK, opacity: p, letterSpacing: -1.5 }}>{i + 1}화</div>
            )}
          </React.Fragment>
        );
      })}
    </>
  );
};

// ───────────────────────── 장면 ─────────────────────────

const BIG = { x: 36, y: 640, w: 1008, h: 1008 };

/** 0~2.9초 — 꼭지 달린 2화 패치가 화면을 채움 · 「AI 그림에 색 적을 때 '토마토색'이라고 쓰지 마세요」. */
const OpenScene: React.FC<{ t: number }> = ({ t }) => {
  // 원본 첫 박자(1.6 · 2.2초) 자리에서 두 번 당겨 앉는다(나란히 「첫 2초」).
  const s = (t < T.zoom1 ? 1.32 : t < T.mark ? 1.52 : 1.72) + 0.03 * Math.sin(t * 1.4);
  const mk = appear(t, T.mark, 0.35);
  return (
    <AbsoluteFill>
      <Pic src="img/p2.jpg" {...BIG} fx={DISC.p2.x + 10 * Math.sin(t * 1.2)} fy={462 + 8 * Math.cos(t)} s={s} />
      <Head
        t={t}
        lines={[
          { at: 0, node: 'AI 그림에 색 적을 때', size: 80, color: SUB },
          { at: 0, node: <><Mark p={mk}>'토마토색'</Mark>이라고</>, size: 110 },
          { at: 0, node: '쓰지 마세요', size: 110 },
        ]}
      />
    </AbsoluteFill>
  );
};

/** 2.9~5.71초 — 꼭지로 바짝 · 테. */
const StemScene: React.FC<{ t: number }> = ({ t }) => {
  const u = t - T.stemCut;
  const s = 1.9 + 0.22 * interpolate(u, [0, 2.8], [0, 1], clamp);
  const rp = appear(t, T.ring, 0.3);
  const bump = t >= T.bump ? 1.14 : 1; // 원본 박자 5.8초 자리에서 한 번 당겨 앉음
  return (
    <AbsoluteFill>
      <Pic src="img/p2.jpg" {...BIG} fx={STEM.p2.x + 12 * Math.sin(u * 1.4)} fy={STEM.p2.y + 40 + 10 * Math.cos(u * 1.1)} s={s * bump}>
        {(k) => <Ring x={STEM.p2.x} y={STEM.p2.y} r={STEM_R.p2} p={rp} k={k} t={t} />}
      </Pic>
      <Head
        t={t}
        lines={[
          { at: T.stemCut, node: '동그라미 위에', size: 84, color: SUB },
          { at: T.stemCut + 0.12, node: '꼭지가 달려 나와요', size: 92 },
        ]}
      />
    </AbsoluteFill>
  );
};

/** 5.71~8.61초 — 2화 기준 그림 전신(가상 인물) → 가슴 패치로 다가감. 첫 화면과 같은 2화 · 같은 흰 티. */
const PersonScene: React.FC<{ t: number }> = ({ t }) => {
  // full2는 1080 × 1920. 패치 가운데 (599, 868).
  const push = interpolate(t, [T.push, T.s1 - 0.1], [0, 1], { ...clamp, easing: IN_OUT });
  const s = mix(1.0, 3.0, push) + 0.02 * Math.sin(t * 1.5);
  const fy = mix(700, 870, push);
  const fx = mix(560, 599, push);
  const lbl = appear(t, T.person + 0.3, 0.3);
  return (
    <AbsoluteFill>
      <Pic src="img/full2.jpg" x={36} y={620} w={1008} h={700} w0={1080} h0={1920} fx={fx} fy={fy} s={s} />
      <div style={{ position: 'absolute', left: 74, top: 1342, fontFamily: KO, fontWeight: 700, fontSize: 46, color: SUB, opacity: lbl }}>2화 · AI로 만든 가상 인물</div>
      <Head
        t={t}
        lines={[
          { at: T.person, node: '웹드라마 등장인물', size: 84, color: SUB },
          { at: T.person + 0.12, node: '조끼 마크였는데', size: 116 },
        ]}
      />
    </AbsoluteFill>
  );
};

/** 8.61~11.91초 — 핵심 장면: 1화 · 2화 · 3화 세 장이 박마다 놓이고 꼭지마다 테. */
const ThreeScene: React.FC<{ t: number }> = ({ t }) => (
  <AbsoluteFill>
    <Strips t={t} at={[T.s1, T.s2, T.s3]} rings={[T.r1, T.r2, T.r3]} push={1 + 0.09 * interpolate(t, [T.r3 + 0.2, T.prompt], [0, 1], { ...clamp, easing: IN_OUT })} />
    <Head
      t={t}
      lines={[
        { at: T.s1, node: '1화 · 2화 · 3화', size: 84, color: SUB },
        { at: T.r1, node: '세 장 다 꼭지', size: 124 },
      ]}
    />
  </AbsoluteFill>
);

/** 11.91~16.66초 — 1화를 다시 만들 때 AI한테 적은 실제 말 한 줄 · 「꼭지 없음 · 잎 없음 · 과일 없음」(한국어를 크게). */
const PromptScene: React.FC<{ t: number }> = ({ t }) => {
  const u = t - T.prompt;
  const card = appear(t, T.prompt, 0.35);
  const float = 6 * Math.sin(u * 1.3);
  const hl = [appear(t, T.h1, 0.3), appear(t, T.h2, 0.3), appear(t, T.h3, 0.3)];
  const row = (ko: string, p: number) => (
    <div style={{ marginTop: 20, opacity: p, transform: `translateX(${(1 - p) * -40}px)`, fontFamily: KO, fontWeight: 900, fontSize: 86, color: INK, letterSpacing: -2 }}>
      <Mark p={p}>{ko}</Mark>
    </div>
  );
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: 64, top: 690 + float, width: 900, padding: '50px 52px 56px', boxSizing: 'border-box', borderRadius: 28, background: PAPER, boxShadow: '0 24px 70px rgba(40,30,15,0.18)', opacity: card, transform: `translateY(${(1 - card) * 50}px) scale(${1 + 0.02 * (u / 4.8)})` }}>
        <div style={{ fontFamily: KO, fontWeight: 700, fontSize: 42, color: SUB }}>1화를 다시 만들 때 AI한테 적은 말</div>
        <div style={{ fontFamily: KO, fontWeight: 600, fontSize: 44, color: INK, lineHeight: 1.3, marginTop: 18, marginBottom: 14 }}>
          A flat printed mark — <Mark p={hl[0]}>no stem</Mark>,
          <br />
          <Mark p={hl[1]}>no leaves</Mark>, <Mark p={hl[2]}>no fruit</Mark>, no drawing.
        </div>
        {row('꼭지 없음', hl[0])}
        {row('잎 없음', hl[1])}
        {row('과일 없음', hl[2])}
      </div>
      <Head
        t={t}
        lines={[
          { at: T.prompt, node: '1화는 AI한테', size: 84, color: SUB },
          { at: T.h1, node: "'꼭지 없음'까지", size: 110 },
        ]}
      />
    </AbsoluteFill>
  );
};

/** 16.66~19.47초 — 다시 만든 1화에도 작은 꼭지가 또. */
const AgainScene: React.FC<{ t: number }> = ({ t }) => {
  const u = t - T.again;
  const close = t >= T.againClose;
  // 최종본 검사 r3 「굳음 16.67~17.92」 — 다시 만든 판이 놓인 뒤 바로 다가가며 판 안을 크게 움직인다.
  const step = t >= T.againStep2 ? 0.75 : t >= T.againStep ? 0.35 : 0; // 원본 박자 19.9 · 20.7초 자리에서 당겨 앉음
  const s = close ? 2.7 + 0.25 * interpolate(t, [T.againClose, T.word], [0, 1], clamp) : 1.15 + step + 0.25 * interpolate(u, [0, T.againClose - T.again], [0, 1], clamp);
  const fy = close ? STEM.p1b.y + 30 : (t >= T.againStep2 ? STEM.p1b.y - 10 : DISC.p1b.y + 40) + 18 * Math.sin(u * 2.1);
  const rp = appear(t, T.againRing, 0.3);
  const ddo = appear(t, T.againClose, 0.25);
  return (
    <AbsoluteFill>
      <Pic src="img/p1b.jpg" {...BIG} fx={STEM.p1b.x + 26 * Math.sin(u * 1.9)} fy={fy + 6 * Math.cos(u * 1.2)} s={s}>
        {(k) => <Ring x={STEM.p1b.x} y={STEM.p1b.y} r={close ? 40 : 46} p={rp} k={k} t={t} />}
      </Pic>
      <Head
        t={t}
        lines={[
          { at: T.again, node: '1화를 다시 만든 판에도', size: 80, color: SUB },
          { at: T.again + 0.1, until: T.againRing, node: '다시 만들었는데', size: 110 },
          { at: T.againRing, node: <>작은 꼭지가 <Mark p={ddo}>또</Mark></>, size: 124 },
        ]}
      />
    </AbsoluteFill>
  );
};

/** 19.47~21.72초 — 「'토마토'라는 말이 토마토를 불러온 것 같아요」: 「색 동그라미」가 물러나고 「토마토」만 남는다. */
const WordScene: React.FC<{ t: number }> = ({ t }) => {
  const u = t - T.word;
  const w = appear(t, T.word, 0.3);
  const mk = appear(t, T.wordMark, 0.2);
  const back = interpolate(t, [T.wordImg, T.wordImg + 0.2], [0, 1], { ...clamp, easing: IN_OUT });
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: 74, top: 690, fontFamily: KO, fontWeight: 900, fontSize: 196, lineHeight: 1.06, letterSpacing: -8, color: INK, opacity: w, transform: `translateY(${(1 - w) * 40}px) scale(${1 + 0.012 * u + 0.08 * back})`, transformOrigin: '0 0' }}>
        <div>
          <Mark p={mk}>토마토</Mark>
          <span style={{ opacity: 1 - 0.8 * back }}>색</span>
        </div>
        <div style={{ opacity: 1 - 0.8 * back }}>동그라미</div>
      </div>
      <Head
        t={t}
        lines={[
          { at: T.word, node: "'토마토'라는 말이", size: 84, color: SUB },
          { at: T.wordLine, node: '토마토를', size: 108 },
          { at: T.wordLine, node: '불러온 것 같아요', size: 108 },
        ]}
      />
    </AbsoluteFill>
  );
};

/** 21.72~24.7초 — 다시 고친 그림 값: 1화 · 2화 · 3화 패치 다시 → 「27크레딧」. */
const FixScene: React.FC<{ t: number }> = ({ t }) => {
  const u = t - T.fix;
  const c = appear(t, T.fix, 0.35);
  const ks = [appear(t, T.k1, 0.25), appear(t, T.k2, 0.25), appear(t, T.k3, 0.25)];
  const big = appear(t, T.credit, 0.3);
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: 64, top: 760 + 6 * Math.sin(u * 1.2), width: 900, padding: '46px 52px 52px', boxSizing: 'border-box', borderRadius: 28, background: PAPER, boxShadow: '0 24px 70px rgba(40,30,15,0.18)', opacity: c, transform: `translateY(${(1 - c) * 50}px)` }}>
        {['1화', '2화', '3화'].map((n, i) => (
          <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 24, padding: '20px 0', borderBottom: i < 2 ? `3px solid ${STAGE}` : 'none', opacity: 0.3 + 0.7 * ks[i], fontFamily: KO, fontSize: 70, letterSpacing: -2 }}>
            <span style={{ fontWeight: 900, color: INK }}>{n}</span>
            <span style={{ fontWeight: 700, color: SUB }}>패치 다시 고침</span>
            <span style={{ marginLeft: 'auto', width: 64, height: 64, borderRadius: 32, background: ks[i] > 0.5 ? BUTTER : STAGE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 44, color: INK, transform: `scale(${0.6 + 0.4 * ks[i]})` }}>✓</span>
          </div>
        ))}
      </div>
      <Head
        t={t}
        lines={[
          { at: T.fix, node: '다시 고친 그림 값', size: 84, color: SUB },
          { at: T.credit, node: <span style={{ display: 'inline-block', transform: `scale(${1 + 0.06 * (1 - big)})`, transformOrigin: '0 50%' }}>27크레딧</span>, size: 190 },
        ]}
      />
    </AbsoluteFill>
  );
};

/** 24.7~28.16초 — 앞으로 그릴 장면에 적어 둔 「토마토색」 91곳을 「진한 빨강」으로. */
const RowsScene: React.FC<{ t: number }> = ({ t }) => {
  const n = Math.round(interpolate(t, [T.rows + 0.1, T.n91], [1, 91], { ...clamp, easing: IN_OUT }));
  // 나란히 r6: 목록이 천천히 흐르면 박자가 안 생기고 빨리 흐르면 박자가 쏟아진다 — 원본 박자 자리에서만 세 줄씩 넘긴다.
  const jumps = (t >= T.j1 ? 3 : 0) + (t >= T.j2 ? 3 : 0) + (t >= T.j3 ? 7 : 0);
  const ROW_H = 100;
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: 64, top: 690, width: 900, height: 700, overflow: 'hidden', borderRadius: 26, background: PAPER, boxShadow: '0 24px 70px rgba(40,30,15,0.16)' }}>
        <div style={{ transform: `translateY(${-(jumps + 0.3 * interpolate(t, [T.rows, T.card], [0, 1], clamp)) * ROW_H + 30}px)` }}>
          {Array.from({ length: 26 }, (_, i) => {
            const on = interpolate(t, [T.rows + 0.1 * i, T.rows + 0.1 * i + 0.2], [0, 1], clamp);
            return (
              <div key={i} style={{ height: ROW_H, display: 'flex', alignItems: 'center', gap: 30, padding: '0 50px', fontFamily: KO, fontSize: 62, borderBottom: `2px solid ${STAGE}` }}>
                <span style={{ fontWeight: 700, color: SUB, textDecoration: on > 0.5 ? 'line-through' : 'none', textDecorationThickness: 5 }}>토마토색</span>
                <span style={{ fontWeight: 800, color: SUB }}>→</span>
                <span style={{ fontWeight: 900, color: INK, opacity: on }}>진한 빨강</span>
              </div>
            );
          })}
        </div>
      </div>
      <Head
        t={t}
        lines={[
          { at: T.rows, node: "앞으로 그릴 장면의 '토마토색'", size: 70, color: SUB },
          { at: T.rows, node: <span style={{ letterSpacing: -8 }}>{n}곳</span>, size: 200 },
        ]}
        top={262}
      />
    </AbsoluteFill>
  );
};

/** 28.16~30.9초 — 저장할 한 장: 색은 물건 이름 말고 색과 모양으로. */
const CardScene: React.FC<{ t: number }> = ({ t }) => {
  const u = t - T.card;
  const c = appear(t, T.card, 0.35);
  const x1 = appear(t, T.x1, 0.28);
  const o1 = appear(t, T.o1, 0.28);
  const x2 = appear(t, T.x2, 0.28);
  const o2 = appear(t, T.o2, 0.28);
  const row = (no: string, yes: string, pn: number, py: number, swatch: React.ReactNode) => (
    <div style={{ marginTop: 44 }}>
      <div style={{ opacity: pn, transform: `translateX(${(1 - pn) * -140}px)`, fontFamily: KO, fontWeight: 700, fontSize: 58, color: SUB, display: 'flex', alignItems: 'center', gap: 20 }}>
        <span style={{ fontWeight: 900, fontSize: 50 }}>✕</span>
        <span>{no}</span>
      </div>
      <div style={{ opacity: py, transform: `translateX(${(1 - py) * -140}px)`, marginTop: 18, display: 'flex', alignItems: 'center', gap: 22, fontFamily: KO, fontWeight: 900, fontSize: 74, color: INK, letterSpacing: -2.5 }}>
        {swatch}
        <span>{yes}</span>
      </div>
    </div>
  );
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: 64, top: 690 + 6 * Math.sin(u * 1.1), width: 900, padding: '54px 52px 70px', boxSizing: 'border-box', borderRadius: 28, background: PAPER, boxShadow: '0 24px 70px rgba(40,30,15,0.18)', opacity: c, transform: `translateY(${(1 - c) * 50}px)` }}>
        <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 52, color: INK }}>AI 그림 색, 이렇게 적어요</div>
        <div style={{ height: 6, width: 120, background: BUTTER, marginTop: 16 }} />
        {row('토마토색 동그라미', '진한 빨강 동그라미', x1, o1, <span style={{ width: 72, height: 72, borderRadius: '50%', background: '#B0161E', display: 'inline-block', flexShrink: 0 }} />)}
        {row('레몬색 네모', '밝은 노랑 네모', x2, o2, <span style={{ width: 68, height: 68, background: '#F0CF2E', display: 'inline-block', flexShrink: 0 }} />)}
      </div>
      <Head
        t={t}
        lines={[
          { at: T.card, node: '색은 물건 이름 말고', size: 84, color: SUB },
          { at: T.card + 0.4, node: '색과 모양으로', size: 124 },
        ]}
      />
    </AbsoluteFill>
  );
};

/** 30.9~35초 — 끝: 가장 센 장면(꼭지 달린 세 장)이 다시 놓이고, 하나씩 고친 판으로 바뀐다 · 「토마토 말고, 진한 빨강」. */
const EndScene: React.FC<{ t: number }> = ({ t }) => {
  const ul = appear(t, T.under, 0.4);
  // 원본 박자 39.9 · 42.6초 자리에서 띠 안 그림이 한 번씩 당겨 앉는다(이름표 · 띠 테두리는 그대로 — 올리기 전 검사 r8 「3화」 안전선).
  const punch = (t >= T.e1 ? 1.15 : 1) * (1 + 0.08 * appear(t, T.last, 0.3));
  return (
    <AbsoluteFill>
      <Strips t={t} at={[T.end + 0.05, T.end + 0.25, T.end + 0.45]} rings={[T.end + 0.6, T.end + 0.75, T.end + 0.9]} wipes={[T.w1, T.w2, T.w3]} push={punch} />
      <Head
        t={t}
        lines={[
          { at: T.end, node: '토마토 말고,', size: 110, color: SUB },
          { at: T.end + 0.2, node: <Mark p={ul}>진한 빨강</Mark>, size: 140 },
        ]}
      />
    </AbsoluteFill>
  );
};

export const Film: React.FC<{ bgm?: boolean; voice?: boolean }> = ({ bgm = true, voice = true }) => {
  const f = useCurrentFrame();
  const t = f / FPS;
  return (
    <AbsoluteFill style={{ background: STAGE }}>
      <AbsoluteFill style={{ background: `radial-gradient(130% 80% at ${50 + 10 * Math.sin(f / 90)}% ${40 + 6 * Math.cos(f / 110)}%, #F7F4EE 0%, ${STAGE} 55%, #E2DDD3 100%)` }} />
      {inWin(t, T.open, T.stemCut) && <OpenScene t={t} />}
      {inWin(t, T.stemCut, T.person) && <StemScene t={t} />}
      {inWin(t, T.person, T.s1) && <PersonScene t={t} />}
      {inWin(t, T.s1, T.prompt) && <ThreeScene t={t} />}
      {inWin(t, T.prompt, T.again) && <PromptScene t={t} />}
      {inWin(t, T.again, T.word) && <AgainScene t={t} />}
      {inWin(t, T.word, T.fix) && <WordScene t={t} />}
      {inWin(t, T.fix, T.rows) && <FixScene t={t} />}
      {inWin(t, T.rows, T.card) && <RowsScene t={t} />}
      {inWin(t, T.card, T.end) && <CardScene t={t} />}
      {t >= T.end && <EndScene t={t} />}
      {bgm && <Audio src={staticFile(BGM.file)} volume={(fr: number) => BGM.vol * interpolate(fr, [F(LEN - BGM.fadeOut), F(LEN)], [1, 0.25], clamp)} />}
      {voice &&
        VO.map((v) => (
          <Sequence key={v.id} from={F(v.at)}>
            <Audio src={staticFile(`vo/${v.id}.wav`)} />
          </Sequence>
        ))}
      {voice &&
        SFX.map((x, i) => (
          <Sequence key={i} from={F(x.at)}>
            <Audio src={staticFile(`sfx/${x.file}.wav`)} volume={x.v} />
          </Sequence>
        ))}
    </AbsoluteFill>
  );
};

// 쓰지 않는 값 경고를 막는다.
void prog;
