// Y66 본편 — AI로 만든 내 홈페이지의 한 페이지, 11일 방문 1,039번. 처음 갈라 보니 로봇 1,022 · 사람 17, 그중 10번쯤은 아마 나.
// 화면 숫자는 모두 기록 값이다(data.ts). 화면 결(장부 머리말): 위 큰 글자가 곧 말 · 검정 · 흰 + 버터 한 곳(사람 17) · SUIT 하나.
// 무대는 어두운 방문 홀(지난 두 편의 먹색 영수증 더미 · 밝은 종이 책상과 다르게).
// r2(이해 시험 r1 반영 — 시험관 넷): 세 줄을 「사이트를 만든 AI에게 보낼 부탁」으로(넷 모두 「어디서 무엇을 하나」), 「고치면서 띄워 본 화면」은 1,039와 따로임을
// 글 · 상자로(넷), 「로봇」 풀이(둘), 결과 막대(이미 본 숫자 되풀이)는 빼고 끝은 「여러분 홈페이지」 홀을 띠가 훑다 멈추는 장면으로(셋 「흐지부지」).
import React from 'react';
import { Audio } from '@remotion/media';
import { AbsoluteFill, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from '../lib/fonts';
import { clamp, IN, IN_OUT, mix, OUT, prog } from '../lib/motion';
import { BigCount } from './Counter';
import { BUTTER, FIGS, HUMAN_FIGS, HUMANS, INK, ROBOT, STAGE, TOTAL_VISITS } from './data';
import { END_HUMANS, Hall, HallTimes, robotsSoFar } from './Hall';
import { LEN, SFX, T, VO } from './timeline';

export const FPS = 30;
export const F = (s: number) => Math.round(s * FPS);
export const TOTAL = F(LEN);
const ROBOT_TXT = '#A9ACB4';
const PAPER = '#F4F2EC';
const DARK = '#0E0F12';

const H: HallTimes = { fillA: T.hall, fillB: T.settle - 0.05, sweepA: T.sweep, sweepB: T.sweepEnd, glow: T.glow, meAt: T.me, bandIn: T.top };

/** 홀 그림 좌표 → 화면 좌표(홀을 scale · origin으로 당겨 잡았을 때). */
const HALL_OY = 0.57 * 1920;
const toScreen = (x: number, y: number, sc: number) => ({ x: 540 + (x - 540) * sc, y: HALL_OY + (y - HALL_OY) * sc });
/** 「사람?」 · 「로봇?」 이름표를 붙일 홀 안의 두 그림(r8 · 최종 확인 11-18 「이름표가 아주 작다」). */
const TAG_FIGS = [
  { k: '사람?', at: 4.6, f: FIGS.find((g) => g.r === 10 && g.c === 8)!, c: DARK, bg: INK, bd: INK },
  { k: '로봇?', at: 5.8, f: FIGS.find((g) => g.r === 13 && g.c === 23)!, c: DARK, bg: ROBOT_TXT, bd: ROBOT_TXT },
];

const inWin = (t: number, a: number, b: number) => t >= a && t < b;
/** 장면에 들어올 때 1.035배에서 당겨 앉음. */
const enter = (t: number, a: number) => 1 + 0.035 * (1 - prog(t * FPS, F(a), 9));
const appear = (t: number, a: number, len = 0.24) => interpolate(t, [a, a + len], [0, 1], { ...clamp, easing: OUT });

/** 위 큰 글 — 줄 단위로 28px 올라오며. */
const Head: React.FC<{ t: number; lines: { at: number; node: React.ReactNode }[]; size?: number; color?: string; top?: number }> = ({ t, lines, size = 104, color = INK, top = 284 }) => (
  <div style={{ position: 'absolute', left: 74, width: 846, top, fontFamily: KO, fontWeight: 800, fontSize: size, lineHeight: 1.14, letterSpacing: -2.6, color }}>
    {lines.map((l, i) => {
      const p = l.at <= 0 ? 1 : appear(t, l.at, 0.22);
      return (
        <div key={i} style={{ opacity: p, transform: `translateY(${(1 - p) * 28}px)`, whiteSpace: 'nowrap' }}>
          {l.node}
        </div>
      );
    })}
  </div>
);

const Under: React.FC<{ children: React.ReactNode; p: number }> = ({ children, p }) => (
  <span style={{ backgroundImage: `linear-gradient(${BUTTER}, ${BUTTER})`, backgroundRepeat: 'no-repeat', backgroundPosition: '0 94%', backgroundSize: `${p * 100}% 0.14em` }}>{children}</span>
);

/** 위를 덮는 그늘 — 홀을 당겨 잡아도 위 글 밑으로 파고들지 않게. */
const TopShade: React.FC<{ h?: number }> = ({ h = 700 }) => (
  <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: h, background: `linear-gradient(180deg, ${STAGE} 0%, ${STAGE} 82%, rgba(13,14,17,0) 100%)` }} />
);

/** 사람을 찾는 듯 홀 위를 지나가는 옅은 노란 빛 — 군중 그림이 멈춰 보이지 않게(최종본 검사 「구간굳음」). */
const Spot: React.FC<{ t: number }> = ({ t }) => {
  const x = 540 + 330 * Math.sin(t * 1.25);
  const y = 1180 + 230 * Math.sin(t * 2.05 + 0.6);
  return <div style={{ position: 'absolute', left: x - 260, top: y - 260, width: 520, height: 520, borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,196,69,0.26) 0%, rgba(245,196,69,0.10) 45%, rgba(245,196,69,0) 70%)', mixBlendMode: 'screen' }} />;
};

const PersonIcon: React.FC<{ size: number; color: string; dashed?: boolean }> = ({ size, color, dashed }) => (
  <svg width={size} height={size * 1.25} viewBox="-10 -26 20 33">
    <circle cx={0} cy={-19} r={5.6} fill={dashed ? 'none' : color} stroke={color} strokeWidth={dashed ? 1.4 : 0} strokeDasharray={dashed ? '2 1.6' : undefined} />
    <path d="M-8 -2 Q-8 -11 0 -11 Q8 -11 8 -2 L8 6 L-8 6 Z" fill={dashed ? 'none' : color} stroke={color} strokeWidth={dashed ? 1.4 : 0} strokeDasharray={dashed ? '2 1.6' : undefined} />
  </svg>
);

const RobotIcon: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size * 1.4} viewBox="-10 -31 20 38">
    <rect x={-1} y={-30} width={2} height={5} fill={color} />
    <rect x={-6} y={-25} width={12} height={10} rx={1.5} fill={color} />
    <rect x={-8} y={-12} width={16} height={18} rx={1} fill={color} />
  </svg>
);

const LaptopIcon: React.FC<{ w: number; color: string }> = ({ w, color }) => (
  <svg width={w} height={w * 0.75} viewBox="0 0 32 24">
    <rect x={4} y={2} width={24} height={15} rx={2} fill="none" stroke={color} strokeWidth={2.4} />
    <path d="M1 21 H31" stroke={color} strokeWidth={2.6} strokeLinecap="round" />
  </svg>
);

// ───────────────────────── 장면 ─────────────────────────

/** 0~2.7초 — 실제 페이지(휴대폰 화면 그대로) 위에 「1,039번 방문 · 그중 진짜 사람은?」. 첫 2초는 원본처럼 한 번에 바뀌는 순간 없이 천천히 오른다. */
const PageScene: React.FC<{ t: number }> = ({ t }) => {
  const rise = interpolate(t, [0, 2.7], [30, -40], clamp);
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: 190, top: 800 + rise, width: 700, height: 1515, borderRadius: 60, overflow: 'hidden', border: '6px solid #2A2C33', boxShadow: '0 30px 80px rgba(0,0,0,0.6)' }}>
        <Img src={staticFile('pulse_full.png')} style={{ width: 700, transform: `translateY(${-interpolate(t, [0, 2.7], [0, 520], clamp)}px)` }} />
      </div>
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 800, background: `linear-gradient(180deg, ${STAGE} 0%, ${STAGE} 90%, rgba(13,14,17,0) 100%)` }} />
      <div style={{ position: 'absolute', left: 74, top: 284, fontFamily: KO, fontWeight: 800, fontSize: 64, letterSpacing: -1.6, color: '#D7D8DC' }}>AI로 만든 내 홈페이지 · 한 페이지</div>
      <div style={{ position: 'absolute', left: 74, top: 372, fontFamily: KO, fontWeight: 900, fontSize: 196, lineHeight: 1, letterSpacing: -6, color: INK }}>
        1,039<span style={{ fontSize: 84, letterSpacing: -2, marginLeft: 12 }}>번 방문</span>
      </div>
      <div style={{ position: 'absolute', left: 74, top: 600, fontFamily: KO, fontWeight: 800, fontSize: 72, letterSpacing: -2, color: INK }}>
        그중 진짜 <span style={{ color: BUTTER }}>사람</span>은?
      </div>
      <div style={{ position: 'absolute', left: 74, top: 704, fontFamily: KO, fontWeight: 700, fontSize: 40, color: '#9FA2AA' }}>11월 6~16일 · 11일 동안</div>
    </AbsoluteFill>
  );
};

/** 홀 장면(2.7~15.8초) — 차오름 · 재 봄 · 띠 · 로봇 · 사람 17 · 그중 10번쯤은 아마 나. */
const HallScene: React.FC<{ t: number }> = ({ t }) => {
  // 홀 안은 끊지 않고 한 흐름으로 움직인다(최종본 검사 「같은 판을 잘라 키워 붙임」 — 흠 장부 #50).
  let scale = 1;
  let origin = '50% 57%';
  if (t < T.settle) scale = mix(1.06, 1, prog(t * FPS, F(T.hall), F(T.settle - T.hall)));
  // 6.8초 박자는 띠가 홀 맨 위로 떨어져 서는 것이 맡는다(r8 — 글 바뀜은 말에 맞춰 5.55초로 당김). 카메라는 끊지 않고 천천히 다가간다.
  else if (t < T.sweep) scale = mix(1, 1.06, interpolate(t, [T.settle, T.sweep], [0, 1], clamp));
  // 띠가 다 내려간 뒤(10.5초~)에도 카메라가 천천히 다가가 홀이 멈춰 보이지 않게(r8 최종본 검사 「구간굳음」).
  else if (t < T.push) scale = mix(1.06, 1, prog(t * FPS, F(T.sweep), 8)) + 0.03 * interpolate(t, [T.sweepEnd, T.push], [0, 1], clamp);
  else {
    origin = '52% 66%';
    scale =
      t < T.me
        ? mix(1.03, 1.14, prog(t * FPS, F(T.push), 8)) + 0.04 * interpolate(t, [T.push, T.me], [0, 1], clamp)
        : mix(1.18, 1.52, prog(t * FPS, F(T.me), 10)) + 0.04 * interpolate(t, [T.me, T.laptop], [0, 1], clamp);
  }
  const robots = robotsSoFar(t, H);
  const humanPop = t >= T.glow ? Math.max(0, 1 - (t - T.glow) / 0.3) : 0;
  const pctPop = t >= T.pct ? Math.max(0, 1 - (t - T.pct) / 0.25) : 0;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: `scale(${scale})`, transformOrigin: origin }}>
        <Hall t={t} h={H} />
      </AbsoluteFill>
      <TopShade h={t >= T.me ? 760 : 680} />
      {t >= T.settle + 0.1 && t < T.sweep && <Spot t={t} />}
      {inWin(t, T.settle, T.askWho) && <Head t={t} size={96} top={312} lines={[{ at: T.settle, node: '처음으로' }, { at: T.settle, node: '제대로 재 봤다' }]} />}
      {inWin(t, T.settle, T.sweep + 0.25) &&
        TAG_FIGS.map((x) => {
          const p = appear(t, x.at, 0.2);
          const gone = interpolate(t, [T.sweep, T.sweep + 0.22], [0, 1], clamp);
          const head = toScreen(x.f.x, x.f.y - 22 * x.f.s, scale);
          const pillBottom = head.y - 64;
          return (
            <React.Fragment key={x.k}>
              <div style={{ position: 'absolute', left: head.x - 2, top: pillBottom, width: 4, height: 54 * p, background: x.bd, opacity: (1 - gone) * 0.8, borderRadius: 2 }} />
              <div
                style={{
                  position: 'absolute',
                  left: head.x,
                  top: pillBottom,
                  transform: `translate(-50%, -100%) scale(${0.7 + 0.3 * p})`,
                  transformOrigin: '50% 100%',
                  opacity: p * (1 - gone),
                  fontFamily: KO,
                  fontWeight: 900,
                  fontSize: 68,
                  letterSpacing: -1.6,
                  color: x.c,
                  background: x.bg,
                  border: `4px solid ${x.bd}`,
                  borderRadius: 48,
                  padding: '6px 34px 10px',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.55)',
                }}
              >
                {x.k}
              </div>
            </React.Fragment>
          );
        })}
      {inWin(t, T.askWho, T.sweep) && <Head t={t} size={96} top={312} lines={[{ at: T.askWho, node: '사람인지,' }, { at: T.askWho, node: '로봇인지' }]} />}
      {inWin(t, T.sweep, T.glow) && (
        <>
          <BigCount label="로봇" value={robots} color={ROBOT_TXT} size={176} />
          {t >= T.pct && (
            <div style={{ position: 'absolute', left: 676, top: 352, opacity: appear(t, T.pct, 0.12), transform: `scale(${1 + 0.08 * pctPop})`, transformOrigin: '0% 50%', fontFamily: KO, color: INK }}>
              <div style={{ fontWeight: 800, fontSize: 40, color: '#C9CBD1' }}>1,039번 중</div>
              <div style={{ fontWeight: 900, fontSize: 112, lineHeight: 1, letterSpacing: -4 }}>98%</div>
            </div>
          )}
          {t >= T.botNote && (
            <div style={{ position: 'absolute', left: 74, top: 588, opacity: appear(t, T.botNote, 0.12), fontFamily: KO, fontWeight: 800, fontSize: 60, lineHeight: 1.16, letterSpacing: -1.4, color: DARK, background: INK, borderRadius: 18, padding: '14px 32px 16px' }}>
              로봇 = 사람 없이
              <br />
              자동으로 들어온 프로그램
            </div>
          )}
        </>
      )}
      {inWin(t, T.glow, T.me) && <BigCount label="사람" value={HUMANS} color={BUTTER} pop={humanPop} />}
      {inWin(t, T.me, T.laptop) && (
        <Head
          t={t}
          lines={[
            { at: T.me, node: <>사람 <span style={{ color: BUTTER }}>17번</span> 중</> },
            { at: T.me, node: '10번쯤은 아마 나' },
          ]}
        />
      )}
    </AbsoluteFill>
  );
};

/** 15.8~19.5초 — 고치면서 내 컴퓨터에 띄워 본 화면도 측정됐다 — 1,039와는 따로. */
const LaptopScene: React.FC<{ t: number }> = ({ t }) => {
  const s = enter(t, T.laptop);
  const streamP = interpolate(t, [T.stream, T.ask], [0, 1], clamp);
  const pileN = Math.round(streamP * 120);
  const fly = Array.from({ length: 14 }, (_, k) => k);
  return (
    <AbsoluteFill style={{ transform: `scale(${s})` }}>
      <Head t={t} size={84} lines={[{ at: T.laptop, node: '고치면서 내 컴퓨터에' }, { at: T.laptop, node: <>띄워 본 화면도 <Under p={appear(t, T.apart, 0.3)}>따로</Under> 셌다</> }]} />
      <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0 }}>
        <rect x={300} y={590} width={480} height={300} rx={18} fill="#1E2026" stroke="#3A3D46" strokeWidth={6} />
        <rect x={322} y={612} width={436} height={256} rx={6} fill="#0A0B0D" />
        <path d="M250 900 L830 900 L800 940 L280 940 Z" fill="#2A2C33" />
      </svg>
      <div style={{ position: 'absolute', left: 322, top: 612, width: 436, height: 256, overflow: 'hidden', borderRadius: 6, opacity: 0.85 }}>
        <Img src={staticFile('pulse_top.png')} style={{ width: 436, height: 943, objectFit: 'cover', transform: `translateY(${-interpolate(t, [T.laptop, T.ask], [120, 260], clamp)}px)` }} />
      </div>
      <div style={{ position: 'absolute', left: 340, top: 625, fontFamily: KO, fontWeight: 800, fontSize: 32, color: DARK, background: PAPER, borderRadius: 10, padding: '4px 14px' }}>내 컴퓨터에서 미리 보기</div>
      {t >= T.stream &&
        fly.map((k) => {
          const cyc = ((t - T.stream) * 1.6 + k / fly.length) % 1;
          const x = mix(560, 780, cyc);
          const y = mix(930, 1080, cyc) - 120 * Math.sin(Math.PI * cyc);
          return <div key={k} style={{ position: 'absolute', left: x, top: y, width: 22, height: 22, borderRadius: 6, background: '#6A6D77', opacity: 1 - cyc * 0.3 }} />;
        })}
      <div style={{ position: 'absolute', left: 74, top: 1020, width: 420, height: 660, borderRadius: 28, border: '3px solid #2E3038', background: '#14151A' }}>
        <div style={{ position: 'absolute', left: 26, top: 22, fontFamily: KO, fontWeight: 800, fontSize: 44, color: INK }}>진짜 주소 방문</div>
        <div style={{ position: 'absolute', left: 26, top: 80, fontFamily: KO, fontWeight: 900, fontSize: 84, color: INK, letterSpacing: -2 }}>1,039번</div>
        <div style={{ position: 'absolute', left: 26, top: 200, width: 370, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {Array.from({ length: 96 }, (_, k) => (
            <div key={k} style={{ width: 24, height: 24, borderRadius: 6, background: k === 40 || k === 77 ? BUTTER : ROBOT }} />
          ))}
        </div>
      </div>
      <div style={{ position: 'absolute', left: 560, top: 1020, width: 446, height: 660, borderRadius: 28, border: `3px dashed ${t >= T.apart ? BUTTER : '#3A3D46'}`, background: '#121317' }}>
        <div style={{ position: 'absolute', left: 26, top: 22, fontFamily: KO, fontWeight: 800, fontSize: 44, color: INK }}>미리 보기 방문</div>
        <div style={{ position: 'absolute', left: 26, top: 84, fontFamily: KO, fontWeight: 900, fontSize: 54, lineHeight: 1.12, letterSpacing: -1.4, color: BUTTER, opacity: appear(t, T.stream) }}>
          1,039에는
          <br />안 섞임
        </div>
        <div style={{ position: 'absolute', left: 26, top: 240, width: 394, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {Array.from({ length: pileN }, (_, k) => (
            <div key={k} style={{ width: 24, height: 24, borderRadius: 6, background: '#3E414A' }} />
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 19.5~23.9초 — 사이트를 만든 AI한테 고치게 한 세 가지 = 방문 통계에서 뺄 셋(로봇 · 아마 나 · 미리 보기).
 *  r8(최종 확인 11-18 미흡): 머리 글을 셋 모두에 맞는 「방문 통계에서 빼기」로 바꾸고(미리 보기는 1,039 밖이지만 같은 측정 통계에 따로 쌓였다),
 *  칸마다 무엇을 고쳤는지 도장(걸러 내기 · 안 세기 · 측정 끄기)을 말에 맞춰 하나씩 찍은 뒤 밀어낸다. 마지막 칸이 23.4초에 빠진다. */
const ASK3 = [
  { k: '로봇', n: '1,022번', fix: '걸러 내기', icon: 'robot', at: T.fix1 },
  { k: '아마 나', n: '10번쯤', fix: '안 세기', icon: 'me', at: T.fix2 },
  { k: '미리 보기', n: '따로 쌓인 화면', fix: '측정 끄기', icon: 'laptop', at: T.fix3 },
] as const;

const AskScene: React.FC<{ t: number }> = ({ t }) => {
  const s = enter(t, T.ask);
  const sub = appear(t, T.fix1 - 0.4, 0.25);
  return (
    <AbsoluteFill style={{ transform: `scale(${s})` }}>
      <Head t={t} size={92} lines={[{ at: T.ask, node: '사이트를 만든 AI한테' }, { at: T.ask, node: '고치게 한 세 가지' }]} />
      <div style={{ position: 'absolute', left: 74, top: 532, fontFamily: KO, fontWeight: 800, fontSize: 58, letterSpacing: -1.4, color: BUTTER, opacity: sub, transform: `translateY(${(1 - sub) * 18}px)` }}>방문 통계에서 빼기</div>
      {ASK3.map((r, i) => {
        const inP = appear(t, T.ask + 0.1 + 0.22 * i, 0.3);
        const st = appear(t, r.at, 0.2);
        const go = interpolate(t, [r.at + 0.42, r.at + 0.72], [0, 1], { ...clamp, easing: IN });
        return (
          <div
            key={r.k}
            style={{
              position: 'absolute',
              left: 74 + (1 - inP) * 140 - go * 1180,
              // 셋째 칸 글이 아래 앱 글자 자리(1428px) 위에 오게(r8 올리기 전 검사).
              top: 628 + i * 262,
              width: 932,
              height: 240,
              borderRadius: 34,
              background: '#17181D',
              border: '2px solid #2A2C33',
              opacity: inP * (1 - 0.6 * go),
              transform: `rotate(${-2 * go}deg)`,
            }}
          >
            <div style={{ position: 'absolute', left: 36, top: 40 + 5 * Math.sin(t * 3 + i), width: 160, height: 160, borderRadius: 80, background: '#22242B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {r.icon === 'robot' ? <RobotIcon size={72} color={INK} /> : r.icon === 'me' ? <PersonIcon size={80} color={INK} dashed /> : <LaptopIcon w={104} color={INK} />}
            </div>
            <div style={{ position: 'absolute', left: 232, top: 30, fontFamily: KO, fontWeight: 900, fontSize: 82, letterSpacing: -2, color: INK, whiteSpace: 'nowrap' }}>{r.k}</div>
            <div style={{ position: 'absolute', left: 232, top: 140, fontFamily: KO, fontWeight: 700, fontSize: 52, letterSpacing: -1, color: '#B9BBC2', whiteSpace: 'nowrap' }}>
              <span style={{ position: 'relative' }}>
                {r.n}
                <span style={{ position: 'absolute', left: -6, top: '52%', height: 8, width: `calc(${st} * (100% + 12px))`, background: BUTTER, borderRadius: 4, opacity: st > 0 ? 1 : 0 }} />
              </span>
            </div>
            <div
              style={{
                position: 'absolute',
                right: 30,
                top: 30,
                opacity: st,
                transform: `rotate(-4deg) scale(${1.45 - 0.45 * st})`,
                transformOrigin: '100% 0%',
                fontFamily: KO,
                fontWeight: 900,
                fontSize: 50,
                letterSpacing: -1.2,
                color: BUTTER,
                border: `5px solid ${BUTTER}`,
                borderRadius: 16,
                padding: '4px 22px 8px',
                whiteSpace: 'nowrap',
              }}
            >
              {r.fix}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

const ROWS3 = [
  { k: '로봇 방문은 빼고 보여 줘', sub: '통계에서 사람 아닌 방문은 걸러 내기' },
  { k: '내 브라우저 방문은 세지 마', sub: '내가 연 방문이 사람 수에 섞이지 않게' },
  { k: '측정은 진짜 주소에서만', sub: '고치며 미리 본 화면은 세지 않기' },
] as const;

/** 23.9~30.2초 — 사이트를 만든 AI에게 보낼 세 줄(밝은 종이) · 26.9초 위로 · 28초 저장해 두세요. */
const SaveScene: React.FC<{ t: number }> = ({ t }) => {
  const s = enter(t, T.save);
  const ticks = [T.save + 0.08, T.tick2, T.tick3];
  const lift = interpolate(t, [T.lift, T.lift + 0.3], [0, 1], { ...clamp, easing: OUT });
  const rib = appear(t, T.ribbon, 0.3);
  return (
    <AbsoluteFill style={{ background: PAPER, transform: `scale(${s * (1 + 0.05 * interpolate(t, [T.ribbon, T.line], [0, 1], clamp))})`, transformOrigin: '50% 40%' }}>
      {t >= T.ribbon + 0.3 && (
        <div style={{ position: 'absolute', left: 50, width: 980, height: 200, borderRadius: 18, background: 'rgba(245,196,69,0.28)', top: 740 + 240 * Math.min(2, Math.floor((t - T.ribbon - 0.3) / 0.6)) + 60 * interpolate(t, [T.lift, T.lift + 0.3], [0, 1], clamp) - 30 }} />
      )}
      <div style={{ position: 'absolute', left: 74, top: 284 - 80 * lift, opacity: 1 - lift, fontFamily: KO, fontWeight: 800, fontSize: 56, color: '#5B5D63', letterSpacing: -1.2 }}>내 사이트를 만든 AI에게</div>
      <div style={{ position: 'absolute', left: 74, top: 360 - 76 * lift, fontFamily: KO, fontWeight: 900, fontSize: 104, lineHeight: 1.12, color: DARK, letterSpacing: -3 }}>
        이렇게 보내기
      </div>
      <div style={{ position: 'absolute', left: 74, top: 500, opacity: rib, transform: `translateY(${(1 - rib) * 20}px)`, fontFamily: KO, fontWeight: 900, fontSize: 64, color: DARK, letterSpacing: -1.6 }}>
        <Under p={rib}>저장해 두세요</Under>
      </div>
      <svg width={120} height={200} style={{ position: 'absolute', left: 860, top: mix(-200, 230, rib) }} viewBox="0 0 60 100">
        <path d="M0 0 H60 V100 L30 78 L0 100 Z" fill={BUTTER} />
      </svg>
      {ROWS3.map((r, i) => {
        const tk = appear(t, ticks[i], 0.18);
        return (
          <div key={r.k} style={{ position: 'absolute', left: 74, top: 680 + 60 * lift + i * 240, width: 932, height: 210, borderTop: '3px solid #D9D6CC' }}>
            <div style={{ position: 'absolute', left: 0, top: 46, width: 84, height: 84, borderRadius: 18, border: `5px solid ${DARK}`, background: tk > 0.5 ? DARK : 'transparent' }}>
              <svg width={84} height={84} viewBox="0 0 84 84" style={{ position: 'absolute', left: -5, top: -5, opacity: tk }}>
                <path d="M22 44 L37 58 L63 28" fill="none" stroke={PAPER} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div style={{ position: 'absolute', left: 116, top: 36, fontFamily: KO, fontWeight: 900, fontSize: 62, color: DARK, letterSpacing: -1.8, whiteSpace: 'nowrap' }}>「{r.k}」</div>
            <div style={{ position: 'absolute', left: 130, top: 122, fontFamily: KO, fontWeight: 700, fontSize: 40, color: '#5B5D63', letterSpacing: -0.8, whiteSpace: 'nowrap' }}>{r.sub}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/** 30.2~33.3초 — 한 문장과 사람 17. */
const LineScene: React.FC<{ t: number }> = ({ t }) => {
  const s = enter(t, T.line);
  const u = appear(t, T.under, 0.3);
  return (
    <AbsoluteFill style={{ transform: `scale(${s})` }}>
      <Head
        t={t}
        size={108}
        lines={[
          { at: T.line, node: '방문 숫자는' },
          { at: T.under, node: <><Under p={u}>로봇과 나를</Under> 빼고</> },
          { at: T.under, node: '봐야 진짜다' },
        ]}
      />
      <div style={{ position: 'absolute', left: 74, top: 820, width: 932, display: 'flex', flexWrap: 'wrap', gap: 18 }}>
        {HUMAN_FIGS.map((f, k) => {
          const p = appear(t, T.line + 0.03 * k, 0.18);
          return (
            <div key={f.i} style={{ opacity: p, transform: `translateY(${(1 - p) * 20 + 4 * Math.sin(t * 3 + k)}px)` }}>
              <PersonIcon size={128} color={BUTTER} dashed={f.me && t >= T.under} />
            </div>
          );
        })}
      </div>
      <div style={{ position: 'absolute', left: 74, top: 1360, fontFamily: KO, fontWeight: 800, fontSize: 56, color: BUTTER, opacity: appear(t, T.under, 0.2) }}>사람 17번 · 점선은 아마 나</div>
    </AbsoluteFill>
  );
};

/** 33.3초~ — 끝: 가장 센 장면(띠가 훑는 홀)을 「여러분 홈페이지」로.
 *  r8(최종 확인 11-18 「끝 3초가 약함」): 띠가 33.35초에 7.9초 훑기와 같은 빠르기(2.6초)로 출발해 홀을 끝까지 훑고,
 *  35.95초에 남은 일곱 자리만 노랗게 「?」로 빛나며 멈춘다(쿵) — 답은 보는 사람 몫이라 숫자는 세지 않는다. */
const EndScene: React.FC<{ t: number }> = ({ t }) => {
  const push = interpolate(t, [T.end, LEN], [0, 1], { ...clamp, easing: IN_OUT });
  const h: HallTimes = { fillA: T.end - 0.3, fillB: T.end, sweepA: T.endSweep, sweepB: T.endSweepEnd, glow: T.endGlow, qAt: T.endGlow + 0.04 };
  const hit = t >= T.endGlow ? Math.max(0, 1 - (t - T.endGlow) / 0.3) : 0;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: `scale(${1.02 + 0.08 * push + 0.015 * hit})`, transformOrigin: '50% 60%' }}>
        <Hall t={t} h={h} humans={END_HUMANS} />
      </AbsoluteFill>
      <div style={{ position: 'absolute', inset: 0, opacity: 1 - interpolate(t, [T.endSweep, T.endSweep + 0.3], [0, 1], clamp) }}>
        <Spot t={t} />
      </div>
      <TopShade h={680} />
      <Head
        t={t}
        size={104}
        top={300}
        lines={[
          { at: T.end, node: '여러분 홈페이지는' },
          { at: T.end, node: <>몇 번이 <Under p={appear(t, 35.2, 0.35)}><span style={{ color: BUTTER }}>사람</span></Under>일까</> },
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
      <AbsoluteFill style={{ background: `radial-gradient(120% 70% at ${50 + 8 * Math.sin(f / 80)}% 30%, #17181D 0%, ${STAGE} 60%)` }} />
      {inWin(t, T.page, T.hall) && <PageScene t={t} />}
      {inWin(t, T.hall, T.laptop) && <HallScene t={t} />}
      {inWin(t, T.laptop, T.ask) && <LaptopScene t={t} />}
      {inWin(t, T.ask, T.save) && <AskScene t={t} />}
      {inWin(t, T.save, T.line) && <SaveScene t={t} />}
      {inWin(t, T.line, T.end) && <LineScene t={t} />}
      {t >= T.end && <EndScene t={t} />}
      {bgm && <Audio src={staticFile('bgm.wav')} volume={0.3} />}
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

export { TOTAL_VISITS };
