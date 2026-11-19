// Y51 본편 — 고르기만 하면 되는 견본 여섯 장을 AI에게 맡겼더니 38시간 · 그림 80장, 「이걸 지금 왜 하고 있는 거야?」,
// 밤새 고쳐 구운 해 질 녘 견본은 마지막 심사에서 맨 처음 판이 골라졌다 → 세 번째 다시 하기 전에, 왜 하는지부터.
// 화면 숫자 · 시각은 모두 기록 값(data.ts). 화면 결(장부 머리말): 위 큰 글자가 곧 말 · 검정 · 흰 + 버터 한 곳(골라진 처음 판) · SUIT 하나.
// 진행자 컷 없음(Y37 · Y39 · Y44 · Y46 · Y54 · Y55 · Y63 · Y66과 같은 까닭 — 트랙 §1 「yuhobuilds 화면 결」).
import React from 'react';
import { Audio } from '@remotion/media';
import { AbsoluteFill, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from '../lib/fonts';
import { clamp, IN_OUT, mix, OUT, prog } from '../lib/motion';
import { BUTTER, DIM, INK, SAMPLES, STAGE } from './data';
import { Sunset, SunsetTimes, tilePos } from './Sunset';
import { LEN, SFX, T, VO } from './timeline';

export const FPS = 30;
export const F = (s: number) => Math.round(s * FPS);
export const TOTAL = F(LEN);

const inWin = (t: number, a: number, b: number) => t >= a && t < b;
/** 글자 그늘(올리기 전 검사 ⑤ 「흰 기본 글자」 — 바탕 위 맨글자로 얹지 않게) */
const SHADOW = '0 3px 16px rgba(0,0,0,0.85), 0 0 3px rgba(0,0,0,0.7)';
/** 보조 글 색 — 연회색 #D9D6CF는 회색 214로 검사의 흰 칸 문턱(215)에 걸쳐 글자 몸이 「판 없는 흰 글자」로 읽혔다(올리기 전 검사 r7) */
const SUB = '#BEB9AF';
const appear = (t: number, a: number, len = 0.24) => interpolate(t, [a, a + len], [0, 1], { ...clamp, easing: OUT });
/** 장면에 들어올 때 1.035배에서 당겨 앉음. */
const enter = (t: number, a: number) => 1 + 0.035 * (1 - prog(t * FPS, F(a), 9));

/** 위 큰 글 — 줄 단위로 28px 올라오며. 같은 자리에서 글이 바뀔 때는 앞 줄이 사라진다(until). */
type Line = { at: number; until?: number; node: React.ReactNode; size?: number; color?: string };
const Head: React.FC<{ t: number; lines: Line[]; size?: number; top?: number; color?: string }> = ({ t, lines, size = 104, top = 284, color = INK }) => (
  <div style={{ position: 'absolute', left: 74, width: 860, top, fontFamily: KO, fontWeight: 800, lineHeight: 1.14, letterSpacing: -2.6 }}>
    {lines
      .filter((l) => t >= l.at - 0.001 && (l.until === undefined || t < l.until))
      .map((l, i) => {
        const p = l.at <= 0 ? 1 : appear(t, l.at, 0.22);
        return (
          <div key={i} style={{ fontSize: l.size ?? size, color: l.color ?? color, opacity: p, transform: `translateY(${(1 - p) * 28}px)`, whiteSpace: 'nowrap', textShadow: SHADOW }}>
            {l.node}
          </div>
        );
      })}
  </div>
);

const Under: React.FC<{ children: React.ReactNode; p: number; color?: string }> = ({ children, p, color = BUTTER }) => (
  <span style={{ backgroundImage: `linear-gradient(${color}, ${color})`, backgroundRepeat: 'no-repeat', backgroundPosition: '0 94%', backgroundSize: `${p * 100}% 0.13em` }}>{children}</span>
);

const TopShade: React.FC<{ h?: number }> = ({ h = 620 }) => (
  <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: h, background: `linear-gradient(180deg, ${STAGE} 0%, ${STAGE} 80%, rgba(14,13,12,0) 100%)` }} />
);

// ───────────────────────── 장면 ─────────────────────────

/** 0~5.8초 — 견본 여섯 장(0프레임부터 다 보임) → AI한테 맡겼더니 → 벽시계 38시간 · 실제로 일한 7시간. */
const SixScene: React.FC<{ t: number }> = ({ t }) => {
  const shrink = prog(t * FPS, F(T.hand), 12);
  const TILE = 304;
  const GAP = 18;
  const left0 = (1080 - (TILE * 3 + GAP * 2)) / 2;
  const top0 = 640;
  const fill = interpolate(t, [T.hand + 0.1, T.h38], [0, 1], { ...clamp, easing: IN_OUT });
  const hours = Math.round(38 * fill);
  const land = t >= T.h38 ? Math.max(0, 1 - (t - T.h38) / 0.3) : 0;
  const seven = appear(t, T.h7, 0.35);
  return (
    <AbsoluteFill>
      {/* 견본 여섯 장 — 맡긴 뒤에는 뒤로 물러나 어둡게 */}
      <AbsoluteFill style={{ transform: `translateY(${mix(0, -40, shrink)}px) scale(${mix(1 + 0.025 * (t / T.hand), 0.9, shrink)})`, transformOrigin: '50% 40%', opacity: mix(1, 0.06, shrink) }}>
        {SAMPLES.map((k, i) => {
          const x = left0 + (i % 3) * (TILE + GAP);
          const y = top0 + Math.floor(i / 3) * (TILE + GAP);
          const bob = 4 * Math.sin(t * 1.6 + i);
          // r4(최종본 검사 r3 「구간굳음 0.58~」): 장마다 다른 방향으로 더 크게 — 화면 전체를 카메라로 걷어 내도 사진 안이 움직이게
          const kb = { s: 1.22 + 0.03 * Math.sin(t * 1.1 + i * 1.3), // 확대 여유(칸 절반 × (s−1))가 늘 움직임 폭보다 커야 칸 가장자리에 빈틈이 안 난다(r13)
            x: 28 * Math.sin(t * 1.9 + i * 2.3), y: 18 * Math.cos(t * 1.6 + i * 1.1) };
          return (
            <div key={k} style={{ position: 'absolute', left: x, top: y + bob, width: TILE, height: TILE, borderRadius: 10, overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
              <Img src={staticFile(`img/${k}.jpg`)} style={{ width: TILE, height: TILE, objectFit: 'cover', transform: `translate(${kb.x}px, ${kb.y}px) scale(${kb.s})` }} />
            </div>
          );
        })}
        <div style={{ position: 'absolute', left: 74, top: top0 + TILE * 2 + GAP + 30, fontFamily: KO, fontWeight: 700, fontSize: 44, color: SUB, opacity: appear(t, 1.2, 0.4) * (1 - shrink), textShadow: SHADOW }}>광고에 쓸 빛 견본 · AI로 만든 가상 모델</div>
      </AbsoluteFill>
      <TopShade h={560} />
      <Head
        t={t}
        lines={[
          { at: 0, until: T.hand, node: '고르기만 하면 되는', size: 84, color: SUB },
          { at: 0, until: T.hand, node: '견본 그림 여섯 장', size: 116 },
          { at: T.hand, node: 'AI한테 맡겼더니', size: 96 },
        ]}
      />
      {/* 벽시계 막대(38시간)와 실제로 일한 시간(7시간) */}
      {t >= T.hand && (
        <div style={{ position: 'absolute', left: 74, top: 520, width: 932 }}>
          <div style={{ fontFamily: KO, fontWeight: 900, fontSize: 250, lineHeight: 1, letterSpacing: -8, color: INK, transform: `scale(${1 + 0.05 * land})`, transformOrigin: '0% 100%' }}>
            {hours}
            <span style={{ fontSize: 110, letterSpacing: -3, marginLeft: 10 }}>시간</span>
          </div>
          <div style={{ marginTop: 34, fontFamily: KO, fontWeight: 700, fontSize: 44, color: SUB, textShadow: SHADOW }}>맡긴 때부터 끝날 때까지</div>
          <div style={{ marginTop: 16, height: 46, width: 932, borderRadius: 8, background: '#2A2722', overflow: 'hidden' }}>
            <div style={{ height: 46, width: `${fill * 100}%`, background: INK }} />
          </div>
          <div style={{ marginTop: 56, opacity: seven, transform: `translateY(${(1 - seven) * 24}px)` }}>
            <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 60, color: INK }}>그중 AI가 실제로 일한 시간</div>
            <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 24 }}>
              <div style={{ height: 46, width: 932 * (7 / 38) * seven, borderRadius: 8, background: '#BDB8AE' }} />
              <div style={{ fontFamily: KO, fontWeight: 900, fontSize: 96, color: INK }}>7시간</div>
            </div>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};

/** 썸네일 벽 — 실제로 구운 그림(gen_log 완료 순서). 77장이 남아 있어 80칸 가운데 셋은 같은 장면의 다른 벌을 한 번 더 쓴다. */
const N_THUMBS = 77;
const WALL_COLS = 8;
const WALL_ROWS = 10;
const CELL = 112;
const CGAP = 8;
const WALL_LEFT = (1080 - (WALL_COLS * CELL + (WALL_COLS - 1) * CGAP)) / 2;
const WALL_TOP = 600;
const thumbAt = (i: number) => (i < N_THUMBS ? i : [70, 73, 75][i - N_THUMBS]);
/** i번째 칸이 놓이는 초 — 굽기 · 심사 · 또 굽기 동안 천천히, 9.39초부터 쏟아져 9.8초에 80. */
const cellTime = (i: number) => {
  if (i < 2) return [T.loop + 0.2, T.again + 0.1][i];
  const k = (i - 2) / 77;
  return T.flood + (T.n80 - 0.05 - T.flood) * Math.pow(k, 0.8);
};
const Wall: React.FC<{ t: number; dim?: number }> = ({ t, dim = 0 }) => (
  <AbsoluteFill style={{ opacity: 1 - dim }}>
    {Array.from({ length: WALL_COLS * WALL_ROWS }, (_, i) => {
      const a = cellTime(i);
      const p = appear(t, a, 0.16);
      if (p <= 0) return null;
      const x = WALL_LEFT + (i % WALL_COLS) * (CELL + CGAP);
      const y = WALL_TOP + Math.floor(i / WALL_COLS) * (CELL + CGAP);
      return (
        <div key={i} style={{ position: 'absolute', left: x, top: y, width: CELL, height: CELL, borderRadius: 6, overflow: 'hidden', opacity: p, transform: `scale(${mix(1.25, 1, p)})` }}>
          <Img src={staticFile(`thumbs/${String(thumbAt(i)).padStart(2, '0')}.jpg`)} style={{ width: CELL, height: CELL, objectFit: 'cover' }} />
        </div>
      );
    })}
  </AbsoluteFill>
);

/** 5.8~12.13초 — AI가 굽고 · 다른 AI가 심사하고 · 떨어지면 또 굽고 · 그림만 80장. */
const LoopScene: React.FC<{ t: number }> = ({ t }) => {
  const s = enter(t, T.loop);
  const placed = Math.min(80, Array.from({ length: 80 }, (_, i) => cellTime(i)).filter((a) => t >= a).length);
  const n80hit = t >= T.n80 ? Math.max(0, 1 - (t - T.n80) / 0.3) : 0;
  // 굽기 · 심사 · 또 굽기 동안 가운데 큰 그림 한 장(앞 두 장) — 심사 「고쳐서 냄」 뒤 벽 첫 칸으로 들어간다
  const big = t < T.flood;
  const cur = t < T.again ? 0 : 1;
  const bigIn = appear(t, cur === 0 ? T.loop : T.again, 0.28);
  const verdict = t >= T.judge && t < T.again ? appear(t, T.judge, 0.2) : 0;
  const sweepX = interpolate(t, [T.sweep, T.sweep + 0.9], [-400, 1480], clamp);
  return (
    <AbsoluteFill style={{ transform: `scale(${s + 0.02 * interpolate(t, [T.flood, T.ask], [0, 1], clamp)})` }}>
      {!big && <Wall t={t} />}
      {big && (
        <div style={{ position: 'absolute', left: 140, top: 640, width: 800, height: 800, borderRadius: 14, overflow: 'hidden', opacity: bigIn, transform: `scale(${mix(0.94, 1, bigIn)})`, boxShadow: '0 30px 80px rgba(0,0,0,0.6)' }}>
          {/* 테 안에서 천천히 움직임(최종본 검사 r12 「구간굳음 6.08초」 — 사진 속 사람이 멎어 보이지 않게, 해 질 녘 벌과 같은 길) */}
          <Img src={staticFile(`img/first${cur}.jpg`)} style={{ width: 800, height: 800, objectFit: 'cover', transform: `translate(${34 * Math.sin(t * 1.8 + cur * 2.1)}px, ${24 * Math.cos(t * 1.5 + cur * 0.9)}px) scale(${1.13 + 0.03 * Math.sin(t * 0.9 + cur * 1.7)})`, filter: verdict > 0 ? `brightness(${mix(1, 0.55, verdict)})` : undefined }} />
          {verdict > 0 && (
            // 올리기 전 검사 r9 · r10 「판 없이 그림 위에 얹은 짧은 밝은 글자」(얼굴 위 흰 글) — 어두운 판 위로, 얼굴을 가리지 않게 그림 아래(어깨 자리)에(r12)
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 44, display: 'flex', justifyContent: 'center', opacity: verdict }}>
              <div style={{ background: 'rgba(14,13,12,0.88)', borderRadius: 20, padding: '26px 52px 30px', textAlign: 'center', fontFamily: KO, fontWeight: 900, fontSize: 88, color: INK, letterSpacing: -2, transform: `scale(${mix(1.08, 1, verdict)})`, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
                AI 심사
                <div style={{ fontSize: 72, marginTop: 6 }}>「고쳐서 다시」</div>
              </div>
            </div>
          )}
        </div>
      )}
      {t >= T.sweep && t < T.sweep + 1 && (
        <div style={{ position: 'absolute', left: sweepX - 200, top: 560, width: 400, height: 1240, background: 'linear-gradient(90deg, rgba(245,242,236,0) 0%, rgba(245,242,236,0.22) 50%, rgba(245,242,236,0) 100%)', transform: 'skewX(-12deg)' }} />
      )}
      <TopShade h={590} />
      <Head
        t={t}
        size={100}
        lines={[
          { at: T.loop, until: T.judge, node: 'AI가 그림을 만들고' },
          { at: T.judge, until: T.again, node: '다른 AI가 심사하고' },
          { at: T.again, until: T.flood, node: '떨어지면 또 만들고' },
          {
            at: T.flood,
            node: (
              <span>
                그림만{' '}
                <span style={{ display: 'inline-block', transform: `scale(${1 + 0.08 * n80hit})`, transformOrigin: '0% 80%', fontSize: 150, letterSpacing: -5 }}>{placed}</span>
                장
              </span>
            ),
          },
        ]}
      />
    </AbsoluteFill>
  );
};

/** 12.13~17.93초 — 「그러다 제가 물었어요」 · 「이걸 지금 왜 하고 있는 거야?」 · 「의미가 있어?」. 시계 숫자는 두지 않는다(사실 검수 — 물은 때는 36시간째쯤). */
const AskScene: React.FC<{ t: number }> = ({ t }) => {
  const back = prog(t * FPS, F(T.qBack), 14);
  const why = appear(t, T.qWhy, 0.3);
  const q1 = appear(t, T.q1, 0.22);
  const q1hit = t >= T.q1 ? Math.max(0, 1 - (t - T.q1) / 0.25) : 0;
  return (
    <AbsoluteFill>
      {/* 뒤: 앞 장면의 그림 80장 벽을 크게 당겨 흐리게(r4 — 사진 한 장은 화면 전체가 같이 움직여 최종본 검사가 「구간굳음」으로 읽었다 ·
          r1의 같은 크기 벽은 「같은구도」였다). 들어올 때 크게 당겨 앉는다(r1 「첫머리굳음」) */}
      <AbsoluteFill style={{ opacity: mix(0.34, 0.16, back), filter: `blur(${mix(5, 9, back)}px)`, transform: `scale(${mix(2.2, 1.8, prog(t * FPS, F(T.ask), 12)) - 0.1 * back}) translate(${-60 * interpolate(t, [T.ask, T.sun], [0, 1], clamp)}px, -120px)`, transformOrigin: '30% 60%' }}>
        <Wall t={99} />
      </AbsoluteFill>
      {/* 사진 위 글자가 맨글자로 얹히지 않게 왼쪽 그늘(검사 ⑤) */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, background: 'linear-gradient(90deg, rgba(14,13,12,0.7) 0%, rgba(14,13,12,0.45) 60%, rgba(14,13,12,0.1) 100%)' }} />
      <div style={{ position: 'absolute', left: 74, top: 300, fontFamily: KO, fontWeight: 800, fontSize: 66, color: SUB, opacity: appear(t, T.ask, 0.25) }}>그러다 제가 물었어요</div>
      <div style={{ position: 'absolute', left: 124, top: 520, width: 900, fontFamily: KO, fontWeight: 900, fontSize: 124, lineHeight: 1.12, letterSpacing: -4, color: INK, opacity: q1, transform: `translateY(${(1 - q1) * 30}px) scale(${1 + 0.03 * q1hit})`, transformOrigin: '0% 50%' }}>
        <div style={{ textIndent: '-0.42em' }}>“이걸 지금</div>
        <div>
          <Under p={why}>왜</Under> 하고
        </div>
        <div>있는 거야?”</div>
      </div>
      <div style={{ position: 'absolute', left: 124, top: 1010, fontFamily: KO, fontWeight: 900, fontSize: 124, letterSpacing: -4, color: INK, opacity: appear(t, T.q2, 0.22), transform: `translateY(${(1 - appear(t, T.q2, 0.22)) * 30}px)` }}>
        <span style={{ marginLeft: '-0.42em' }}>“의미가 있어?”</span>
      </div>
      <div style={{ position: 'absolute', left: 74, top: 1230, fontFamily: KO, fontWeight: 700, fontSize: 44, color: DIM, opacity: appear(t, T.q2 + 0.3, 0.3) }}>— 사장인 제가, 견본을 맡긴 AI에게</div>
    </AbsoluteFill>
  );
};

/** 17.93~27.22초 — 핵심 장면: 해 질 녘 네 벌, 노란 테가 거꾸로 훑어 맨 처음 판에 앉는다. */
const SUN_H: SunsetTimes = { put: [T.sun1, T.night, T.night + 0.18, T.night + 0.36], scan: T.scan, hop: 0.31, land: T.land };
const SunScene: React.FC<{ t: number }> = ({ t }) => {
  const s = enter(t, T.sun);
  const push = interpolate(t, [T.land, T.stop], [0, 1], { ...clamp, easing: IN_OUT });
  const u = appear(t, T.lift, 0.35);
  return (
    <AbsoluteFill style={{ transform: `scale(${s})` }}>
      <AbsoluteFill style={{ transform: `scale(${1 + 0.03 * push})`, transformOrigin: '30% 55%' }}>
        <Sunset t={t} h={SUN_H} />
      </AbsoluteFill>
      {t >= 26.1 && t < 26.9 && (() => { const g0 = tilePos(0); const gx = interpolate(t, [26.1, 26.8], [-200, 620], clamp); return (
        <div style={{ position: 'absolute', left: g0.x, top: g0.y, width: 418, height: 418, overflow: 'hidden', borderRadius: 10, zIndex: 4 }}>
          <div style={{ position: 'absolute', left: gx, top: -60, width: 160, height: 560, background: 'linear-gradient(90deg, rgba(255,240,210,0) 0%, rgba(255,240,210,0.35) 50%, rgba(255,240,210,0) 100%)', transform: 'skewX(-14deg)' }} />
        </div>); })()}
      <TopShade h={590} />
      <Head
        t={t}
        size={96}
        lines={[
          { at: T.sun, until: T.night, node: '더 허탈한 건', size: 84, color: SUB },
          { at: T.sun1, until: T.night, node: '해 질 녘 견본' },
          { at: T.night, until: T.pickHead, node: '밤새 고쳐 만들었는데' },
          { at: T.pickHead, node: '마지막 심사가 고른 건', size: 84, color: SUB },
          { at: T.land, node: <Under p={u}>맨 처음 그림</Under>, size: 112, color: BUTTER },
        ]}
      />
    </AbsoluteFill>
  );
};

/** 27.22~35.29초 — 고리와 문(r2). 「그림 만들기 → AI 심사 → 고쳐서 다시」 고리를 점이 돌며 「다시 1번째 · 2번째」를 센다.
 *  멈출 때는 아무도 안 정했다(빈 「멈출 때 ?」 칸) → 30.81초 세 번째 바퀴 앞에 문이 내려와 점이 서고, 고리가 위로 물러나며 물음 셋.
 *  (이해 시험 r1: 밝은 종이 규칙 카드가 지난 편 끝 카드와 같아 보임 셋 · 고리 그림이 무엇인지 둘 · 「세 번째」가 어디서 나왔나 하나) */
const LAP = (T.card - T.stop) / 2; // 두 바퀴를 돌고 세 번째 바퀴 앞에서 선다
const GATE_A = -Math.PI / 2 - 0.85; // 문 자리(「고쳐서 다시」에서 꼭대기 「그림 만들기」로 가는 길목)
const RingScene: React.FC<{ t: number }> = ({ t }) => {
  const s = enter(t, T.stop);
  const g = prog(t * FPS, F(T.card), 14); // 고리가 위로 물러남
  const k = mix(1, 0.74, g);
  const cx = 540;
  const cy = mix(990, 790, g);
  const R = 270;
  // 점: 꼭대기 「그림 만들기」에서 출발해 시계 방향으로, 두 바퀴 뒤 문 앞에서 선다
  const run = Math.min(t - T.stop, T.card - T.stop);
  const slow = Math.min(1, Math.max(0, (t - (T.card - 0.4)) / 0.4));
  // 문 앞에 선 뒤에는 점이 문에 콩콩 부딪히며 기다린다(r5 최종본 검사 「구간굳음 31.21」 — 멈춘 채 대기하는 뜻 그대로 움직임을 남김)
  const knock = t >= T.card ? 0.07 * Math.abs(Math.sin((t - T.card) * 5.2)) : 0;
  const ang = -Math.PI / 2 + (2 * Math.PI * run) / LAP - 0.85 * slow - knock;
  const lap = Math.min(3, 1 + Math.floor((t - T.stop) / LAP));
  const lapR = ((t - T.stop) % LAP) / LAP;
  const lapHit = t < T.card && t - T.stop > LAP * 0.5 && lapR < 0.12 ? 1 - lapR / 0.12 : 0;
  const nodes = ['그림 만들기', 'AI 심사', '고쳐서 다시'];
  const empty = t < T.card ? appear(t, T.nobody, 0.3) : 1 - appear(t, T.card, 0.2);
  const q = t >= T.nobody2 && t < T.card ? Math.max(0, 1 - (t - T.nobody2) / 0.3) : 0;
  const gate = appear(t, T.card, 0.22);
  const gx = cx + R * k * Math.cos(GATE_A);
  const gy = cy + R * k * Math.sin(GATE_A);
  const nk = mix(1, 0.74, g);
  const items = [
    { at: T.item1, k: '무엇을 위해?' },
    { at: T.item2, k: '시간이 얼마나 들었나?' },
    { at: T.item3, k: '여기서 끊으면 잃는 것?' },
  ];
  const ax = cx + R * k * Math.cos(0.15);
  const ay = cy + R * k * Math.sin(0.15);
  return (
    <AbsoluteFill style={{ transform: `scale(${s})` }}>
      <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0 }}>
        <circle cx={cx} cy={cy} r={R * k} fill="none" stroke="#3A362F" strokeWidth={14 * k} />
        <path d={`M ${ax} ${ay} l ${-18 * k} ${-22 * k} M ${ax} ${ay} l ${22 * k} ${-14 * k}`} stroke="#6B665C" strokeWidth={8 * k} strokeLinecap="round" fill="none" />
        <circle cx={cx + R * k * Math.cos(ang)} cy={cy + R * k * Math.sin(ang)} r={24 * k} fill={INK} />
        <path d={`M ${cx + R + 30} ${cy + 130} C ${cx + R + 80} ${cy + 200}, ${cx + 280} ${cy + 250}, ${cx + 250} ${cy + 290}`} fill="none" stroke="#6B665C" strokeWidth={8} strokeDasharray="18 14" opacity={empty} />
        <g opacity={gate} transform={`translate(${gx} ${gy - (1 - gate) * 120}) rotate(${(GATE_A * 180) / Math.PI + 90})`}>
          <rect x={-15} y={-78 * k - 34} width={30} height={156 * k + 68} rx={10} fill={BUTTER} />
        </g>
      </svg>
      <div style={{ position: 'absolute', left: gx - 250, top: gy - 120, width: 150, textAlign: 'right', fontFamily: KO, fontWeight: 900, fontSize: 50, color: BUTTER, opacity: appear(t, T.card + 0.15, 0.25), textShadow: SHADOW }}>멈춤</div>
      {nodes.map((n, i) => {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / 3;
        const x = cx + R * k * Math.cos(a);
        const y = cy + R * k * Math.sin(a);
        const w = 330 * nk;
        return (
          <div key={n} style={{ position: 'absolute', left: x - w / 2, top: y - 52 * nk, width: w, height: 104 * nk, borderRadius: 56, background: STAGE, border: `5px solid ${INK}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: KO, fontWeight: 800, fontSize: 52 * nk, color: INK, opacity: appear(t, T.stop + 0.15 * i, 0.25) }}>
            {n}
          </div>
        );
      })}
      <div style={{ position: 'absolute', left: cx - 200, top: cy - 90, width: 400, textAlign: 'center', fontFamily: KO, color: INK, transform: `scale(${k * (1 + 0.1 * lapHit + (t >= T.card ? 0.04 * Math.abs(Math.sin((t - T.card) * 5.2)) : 0))})`, transformOrigin: '50% 50%' }}>
        <div style={{ fontWeight: 700, fontSize: 46, color: SUB }}>다시</div>
        <div style={{ fontWeight: 900, fontSize: 120, lineHeight: 1, color: t >= T.card ? BUTTER : INK }}>
          {lap}
          <span style={{ fontSize: 56 }}>{t >= T.card ? '번째?' : '번째'}</span>
        </div>
      </div>
      {t < T.card + 0.25 && (
        <div style={{ position: 'absolute', left: 600, top: 1286, width: 400, height: 130, borderRadius: 18, border: '6px dashed #8C877C', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, fontFamily: KO, fontWeight: 800, fontSize: 56, color: SUB, opacity: empty, transform: `scale(${mix(0.92, 1, empty) + 0.06 * q})` }}>
          멈출 때 <span style={{ fontSize: 76, color: INK }}>?</span>
        </div>
      )}
      {items.map((x, i) => {
        const p = appear(t, x.at, 0.24);
        return (
          <div key={i} style={{ position: 'absolute', left: 120, top: 1040 + i * 104, fontFamily: KO, fontWeight: 800, fontSize: 64, letterSpacing: -1.5, color: INK, opacity: p, transform: `translateX(${(1 - p) * -30}px)` }}>
            <span style={{ color: BUTTER, marginRight: 22 }}>—</span>
            {x.k}
          </div>
        );
      })}
      <div style={{ position: 'absolute', left: 120, top: 1356, fontFamily: KO, fontWeight: 700, fontSize: 42, color: DIM, opacity: appear(t, T.item3 + 0.15, 0.3) }}>AI에게 일 맡길 때 첫 메시지에 붙여 두세요 · 전문은 글에</div>
      <TopShade h={t >= T.card ? 600 : 560} />
      <Head
        t={t}
        size={96}
        lines={[
          { at: T.stop, until: T.card, node: '고치는 건 잘하는데', size: 84, color: SUB },
          { at: T.stopQ, until: T.nobody, node: '언제 멈출지는' },
          { at: T.nobody, until: T.card, node: <>멈출 때는 <Under p={appear(t, T.nobody2, 0.3)} color={INK}>아무도 안 정했다</Under></>, size: 80 },
          { at: T.card, until: T.card3, node: 'AI한테 정해 둔 것', size: 84, color: SUB },
          { at: T.card3, node: '세 번째 다시 하기 전에', size: 84, color: SUB },
          { at: T.card3b, node: <Under p={appear(t, T.card3b + 0.1, 0.4)}>먼저 말해 줘</Under>, size: 112 },
        ]}
      />
    </AbsoluteFill>
  );
};

/** 35.29초~ — 끝: 가장 센 장면(해 질 녘 네 벌 · 처음 그림에 앉는 노란 테) → 이긴 처음 그림이 화면을 채운다(r2 — 끝 흐지부지 둘). */
const END_H: SunsetTimes = { put: [T.end, T.end + 0.04, T.end + 0.08, T.end + 0.12], scan: T.end + 0.02, hop: 0.12, land: T.endLand };
const EndScene: React.FC<{ t: number }> = ({ t }) => {
  const grow = interpolate(t, [T.endGrow, T.endGrow + 0.55], [0, 1], { ...clamp, easing: IN_OUT });
  const push = interpolate(t, [T.endGrow + 0.55, LEN], [0, 1], clamp);
  const t0 = tilePos(0);
  const x = mix(t0.x, 0, grow);
  const y = mix(t0.y, 600, grow);
  const w = mix(418, 1080, grow);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ opacity: 1 - grow }}>
        <Sunset t={t} h={END_H} dimTo={0.08} liftTo={0.1} />
      </AbsoluteFill>
      {t >= T.endGrow && (
        <div style={{ position: 'absolute', left: x, top: y, width: w, height: w, overflow: 'hidden', borderRadius: mix(12, 0, grow), border: `${mix(12, 0, grow)}px solid ${BUTTER}`, boxSizing: 'border-box' }}>
          <Img src={staticFile('img/R3.jpg')} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${1.06 + 0.06 * push}) translate(${-40 * push}px, ${-14 * push}px)` }} />
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 360, background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.85) 100%)', opacity: grow }} />
        </div>
      )}
      <TopShade h={600} />
      <Head
        t={t}
        size={100}
        lines={[
          { at: T.end, node: '세 번째 다시 하기 전에', size: 84, color: SUB },
          { at: T.end + 0.1, node: <><span style={{ color: BUTTER }}>왜</span> 하는지부터</>, size: 124 },
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
      <AbsoluteFill style={{ background: `radial-gradient(120% 70% at ${50 + 8 * Math.sin(f / 80)}% 45%, #211B14 0%, ${STAGE} 62%)` }} />
      {inWin(t, T.six, T.loop) && <SixScene t={t} />}
      {inWin(t, T.loop, T.ask) && <LoopScene t={t} />}
      {inWin(t, T.ask, T.sun) && <AskScene t={t} />}
      {inWin(t, T.sun, T.stop) && <SunScene t={t} />}
      {inWin(t, T.stop, T.end) && <RingScene t={t} />}
      {t >= T.end && <EndScene t={t} />}
      {bgm && <Audio src={staticFile('bgm.wav')} volume={(fr: number) => 0.32 * interpolate(fr, [F(LEN - 0.9), F(LEN)], [1, 0.25], clamp)} />}
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
