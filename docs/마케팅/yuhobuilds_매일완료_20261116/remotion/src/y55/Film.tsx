// Y55 본편 — AI는 3주 넘게 「완료」라고 했다. 새로 쌓인 양식은 0개.
// 실화(11-14): 회사 업무 앱의 참고 자료 조사. 10-21 뒤로 새 자료 0개(11-14 17:31 회사 DB · latestCreatedAt 10-21)인데 회차는 계속 완료였다.
// AI가 쓰는 프로그램의 도구 목록엔 웹 원문 읽기가 있었지만 실제로는 부를 수 없었고, 옛 문서를 읽어 확인 시각만 새로 붙였다.
// 화면 숫자는 모두 기록 값이다(data.ts). 실제 화면은 11-15 05:29 캡처 한 장(조사 도구 이름 가림).
// 화면 결(장부 머리말): 위 큰 흰 글자가 곧 말 · 검정 · 흰 + 버터 한 곳 · SUIT 하나.
// r2(장면 심사 반영): 회차 기록을 종이 영수증으로 크게 쌓아 화면 아래까지 쓰고, 날짜가 11월 14일에 멈추는 순간 쿵, 바탕의 흐린 화면 얼룩을 없앰.
import React from 'react';
import { Audio } from '@remotion/media';
import { AbsoluteFill, Img, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from '../lib/fonts';
import { IN_OUT, mix, prog } from '../lib/motion';
import { AFTER, BEFORE, DAYS, Receipt, TIMES } from './data';
import { DATE_KEYS, DROPS, LEN, SFX, T, VO } from './timeline';

export const FPS = 30;
export const F = (s: number) => Math.round(s * FPS);
export const TOTAL = F(LEN);

const WHITE = '#FFFFFF';
const BUTTER = '#F5C445';
const INK = '#0E0F12';
const PAPER = '#F6F4EE';
const GRAY = '#5A5C63';
const BGM = 0.36;

/** 바탕 — 짙은 먹색에 장부 줄이 아주 옅게 천천히 올라간다(흐린 화면 얼룩을 쓰지 않는다). */
const Backdrop: React.FC<{ f: number }> = ({ f }) => {
  const shift = (f * 1.3) % 72;
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(130% 75% at 50% 18%, #1B1D23 0%, #0D0E12 55%, #08090B 100%)' }}>
      <AbsoluteFill style={{ backgroundImage: 'repeating-linear-gradient(180deg, rgba(255,255,255,0.055) 0px, rgba(255,255,255,0.055) 2px, transparent 2px, transparent 72px)', backgroundPosition: `0 ${-shift}px` }} />
    </AbsoluteFill>
  );
};

/** 위 큰 글 — 줄 단위로 28px 올라오며 나타남(화면 결 ③). */
const Head: React.FC<{ f: number; from: number; to: number; lines: { at: number; node: React.ReactNode }[]; size?: number }> = ({ f, from, to, lines, size = 96 }) => {
  if (f < F(from) || f >= F(to)) return null;
  const out = to >= LEN ? 1 : 1 - prog(f, F(to) - 3, 3);
  return (
    <div style={{ position: 'absolute', left: 74, width: 846, top: 284, fontFamily: KO, fontWeight: 800, fontSize: size, lineHeight: 1.16, letterSpacing: -2.4, color: WHITE, textShadow: '0 2px 18px rgba(0,0,0,0.35)' }}>
      {lines.map((l, i) => {
        const p = l.at <= from ? (from === 0 ? 1 : prog(f, F(from), 6)) : prog(f, F(l.at), 7);
        return (
          <div key={i} style={{ opacity: p * out, transform: `translateY(${(1 - p) * 28}px)`, whiteSpace: 'nowrap' }}>
            {l.node}
          </div>
        );
      })}
    </div>
  );
};

const U: React.FC<{ children: React.ReactNode; p?: number }> = ({ children, p = 1 }) => (
  <span style={{ backgroundImage: `linear-gradient(${BUTTER}, ${BUTTER})`, backgroundRepeat: 'no-repeat', backgroundPosition: '0 94%', backgroundSize: `${p * 100}% 0.13em` }}>{children}</span>
);

/** 작은 출처 줄 — 무엇을 옮긴 화면인지. */
const Note: React.FC<{ f: number; f0: number; f1: number; text: string; top: number }> = ({ f, f0, f1, text, top }) => {
  if (f < F(f0) || f >= F(f1)) return null;
  return (
    <div style={{ position: 'absolute', left: 74, top, fontFamily: KO, fontWeight: 700, fontSize: 40, letterSpacing: -0.8, color: 'rgba(255,255,255,0.9)', opacity: prog(f, F(f0), 8) * (1 - prog(f, F(f1) - 3, 3)), background: 'rgba(255,255,255,0.1)', borderRadius: 14, padding: '8px 18px' }}>{text}</div>
  );
};

/** 회차 영수증 — 종이 한 장. 아래 끝은 톱니. 새 자료가 있으면 그 칸이 버터로. lit이면 「완료」가 버터로. */
const RECEIPT_W = 620;
const Slip: React.FC<{ r: Receipt; lit?: number; dimFresh?: number; glowZero?: number; ghost?: boolean }> = ({ r, lit = 0, dimFresh = 0, glowZero = 0, ghost = false }) => {
  const hot = r.fresh > 0;
  const teeth = Array.from({ length: 24 }, (_, i) => `${(i / 24) * 100}% 100%, ${((i + 0.5) / 24) * 100}% calc(100% - 14px)`).join(', ');
  return (
    <div style={{ width: RECEIPT_W, background: ghost ? '#E9E6DD' : PAPER, fontFamily: KO, color: INK, padding: '30px 38px 44px', visibility: 'visible', clipPath: `polygon(0 0, 100% 0, 100% calc(100% - 14px), ${teeth}, 0 calc(100% - 14px))` }}>
      <div style={{ opacity: ghost ? 0 : 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 700, fontSize: 38, letterSpacing: -1, color: GRAY, whiteSpace: 'nowrap' }}>{r.when}</div>
        <div style={{ fontWeight: 900, fontSize: 40, letterSpacing: -0.6, borderRadius: 10, padding: '2px 18px', background: lit > 0 ? `rgba(245,196,69,${lit})` : 'transparent', border: `4px solid ${INK}`, transform: 'rotate(-4deg)' }}>완료</div>
      </div>
      <div style={{ borderTop: '3px dashed rgba(14,15,18,0.25)', margin: '22px 0 14px' }} />
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', opacity: 1 - dimFresh * 0.65 }}>
        <div style={{ fontWeight: 800, fontSize: 52, letterSpacing: -1.4 }}>새 자료</div>
        <div style={{ fontWeight: 900, fontSize: 124, lineHeight: 1.05, letterSpacing: -5, fontVariantNumeric: 'tabular-nums', background: hot ? BUTTER : `rgba(245,196,69,${glowZero})`, borderRadius: 16, padding: '0 16px' }}>
          {r.fresh}
          <span style={{ fontSize: 60, letterSpacing: -1, marginLeft: 4 }}>건</span>
        </div>
      </div>
      <div style={{ fontWeight: 700, fontSize: 36, letterSpacing: -0.8, color: GRAY, marginTop: 4, opacity: 1 - dimFresh * 0.65 }}>고친 자료 {r.fixed}건</div>
      </div>
    </div>
  );
};

/** 영수증 더미 — 떨어져 쌓인다. fan이 1이면 부채처럼 펼쳐져 위 줄(시각 · 완료)이 모두 보인다. */
const ROT = [-5, 4, -2.5, 5.5, -4, 1.5, -3, 3];
const DX = [-34, 26, -12, 36, -26, 6, -18, 20];
const Pile: React.FC<{ f: number; slips: { r: Receipt; at: number }[]; top: number; fan?: number; lit?: number; dimFresh?: number; glowZero?: number; flashTop?: number }> = ({ f, slips, top, fan = 0, lit = 0, dimFresh = 0, glowZero = 0, flashTop = 0 }) => (
  <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920 }}>
    {slips.map((s, i) => {
      const p = prog(f, F(s.at), 6);
      if (p <= 0) return null;
      const isTop = i === slips.length - 1;
      const y = top + mix(-260, 0, p) + fan * (i - (slips.length - 1)) * 92;
      const rot = mix(ROT[i % ROT.length] * 2.2, ROT[i % ROT.length], p) * (1 - fan * 0.8);
      return (
        <div key={i} style={{ position: 'absolute', left: 540 - RECEIPT_W / 2 + DX[i % DX.length] * (1 - fan * 0.7), top: y, opacity: Math.min(1, p * 1.6), transform: `rotate(${rot}deg) scale(${mix(1.14, 1, p) * (isTop ? 1 + 0.05 * flashTop : 1)})`, transformOrigin: '50% 0%', filter: isTop && flashTop > 0 ? `drop-shadow(0 0 ${40 * flashTop}px rgba(245,196,69,0.8))` : 'drop-shadow(0 18px 30px rgba(0,0,0,0.5))' }}>
          <Slip r={s.r} lit={lit} dimFresh={dimFresh} glowZero={isTop ? glowZero : 0} ghost={!isTop && fan < 0.5} />
        </div>
      );
    })}
  </div>
);

/** 날짜 넘김 — DATE_KEYS 사이(첫 구간은 점점 빠르게, 그 뒤는 영수증 날짜에 맞춰 칸마다). */
const dateIdx = (t: number) => {
  if (t <= DATE_KEYS[0][0]) return 0;
  for (let k = 1; k < DATE_KEYS.length; k++) {
    const [t0, i0] = DATE_KEYS[k - 1];
    const [t1, i1] = DATE_KEYS[k];
    if (t < t1) {
      if (k === 1) return Math.round(i0 + (i1 - i0) * Math.pow((t - t0) / (t1 - t0), 1.45));
      return i0;
    }
  }
  return DATE_KEYS[DATE_KEYS.length - 1][1];
};

const NumCol: React.FC<{ x: number; label: string; value: string; unit: string; color: string; scale?: number; dim?: number; size?: number }> = ({ x, label, value, unit, color, scale = 1, dim = 0, size = 150 }) => (
  <div style={{ position: 'absolute', left: x, top: 684, width: 420, fontFamily: KO, color: WHITE, opacity: 1 - dim * 0.6 }}>
    <div style={{ fontWeight: 800, fontSize: 44, letterSpacing: -1.2, whiteSpace: 'nowrap' }}>{label}</div>
    <div style={{ display: 'flex', alignItems: 'flex-end', transformOrigin: '0% 85%', transform: `scale(${scale})` }}>
      <div style={{ fontWeight: 900, fontSize: size, lineHeight: 1.02, letterSpacing: -6, color, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontWeight: 800, fontSize: size * 0.45, letterSpacing: -2, color, paddingBottom: size * 0.12, marginLeft: 6 }}>{unit}</div>
    </div>
  </div>
);

/** 끝 숫자 — 위: 고치기 전 24일 0개(30.3초에 그어짐), 아래: 고친 뒤 이틀 20개(크게 · 31.6초 끝 장치에서 한 번 더 커지며 번쩍). */
const EndNums: React.FC<{ f: number }> = ({ f }) => {
  const strike = prog(f, F(30.3), 8);
  const hi = prog(f, F(30.9), 8);
  const punch = f >= F(T.punch) ? 1 - prog(f, F(T.punch), 12) : 0;
  const big = f >= F(T.punch) ? mix(1.08, 1.0, prog(f, F(T.punch) + 4, 14)) + 0.2 * punch : 1;
  return (
    <>
      <div style={{ position: 'absolute', left: 74, top: 560, fontFamily: KO, color: WHITE, display: 'flex', alignItems: 'baseline', gap: 26, whiteSpace: 'nowrap' }}>
        <span style={{ fontWeight: 800, fontSize: 52, letterSpacing: -1.4, color: 'rgba(255,255,255,0.75)' }}>고치기 전 24일</span>
        <span style={{ position: 'relative', fontWeight: 900, fontSize: 130, letterSpacing: -5, opacity: mix(1, 0.55, strike) }}>0개<span style={{ position: 'absolute', left: -8, right: -8, top: '52%', height: 10, background: WHITE, borderRadius: 5, transformOrigin: '0 50%', transform: `scaleX(${strike})` }} /></span>
      </div>
      <div style={{ position: 'absolute', left: 74, top: 740, fontFamily: KO, color: WHITE, whiteSpace: 'nowrap' }}>
        <div style={{ fontWeight: 800, fontSize: 52, letterSpacing: -1.4, color: 'rgba(255,255,255,0.85)' }}>고친 뒤 이틀</div>
        <div style={{ position: 'relative', display: 'inline-block', transformOrigin: '15% 80%', transform: `scale(${big})` }}>
          <div style={{ position: 'absolute', inset: '-40px -60px', background: `radial-gradient(closest-side, rgba(245,196,69,${0.18 * hi + 0.4 * punch}), rgba(245,196,69,0))` }} />
          <span style={{ position: 'relative', fontWeight: 900, fontSize: 210, lineHeight: 1.0, letterSpacing: -8, color: BUTTER, fontVariantNumeric: 'tabular-nums' }}>{Math.round(20 * prog(f, F(28.6), F(0.8), (x) => x))}<span style={{ fontSize: 96, letterSpacing: -2, marginLeft: 6 }}>개</span></span>
        </div>
      </div>
    </>
  );
};

/** 핵심 장면 — race: 날짜가 넘어가고 영수증이 쌓임 · held: 더미가 펼쳐져 「완료」 여섯 · after: 고친 뒤 영수증 둘 · end: 고치기 전 0 / 고친 뒤 20. */
const Scene: React.FC<{ f: number; f0: number; f1: number; mode: 'race' | 'held' | 'after' | 'end' }> = ({ f, f0, f1, mode }) => {
  if (f < F(f0) || f >= F(f1)) return null;
  const ap = prog(f, F(f0), 7);
  const out = f1 >= LEN ? 1 : 1 - prog(f, F(f1) - 3, 3);
  const t = f / FPS;
  const idx = mode === 'race' ? dateIdx(t) : DAYS.length - 1;
  const prevIdx = mode === 'race' ? dateIdx(t - 3 / FPS) : idx;
  const bump = idx !== prevIdx ? 1 : 0;
  const push = 1;
  // 끝 장치(원본 31.6초 「그만」 손짓 자리) — 「20개」 쪽으로 한 번 크게 당긴다
  const origin = '50% 60%';
  const zeroSlam = mode === 'race' && f >= F(T.zero) ? 1 - prog(f, F(T.zero), 9) : 0;
  const glow = mode === 'race' ? prog(f, F(T.stamp), 8) : 0;
  const a1 = mode === 'after' && f >= F(T.plus1);
  const a2 = mode === 'after' && f >= F(T.plus2);
  const newVal = mode === 'after' ? (a2 ? 20 : a1 ? 10 : 0) : mode === 'end' ? 20 : 0;
  const slamAfter = mode === 'after' ? Math.max(a1 ? 1 - prog(f, F(T.plus1), 9) : 0, a2 ? 1 - prog(f, F(T.plus2), 9) : 0) : mode === 'end' && f >= F(T.punch) ? 1 - prog(f, F(T.punch), 10) : 0;
  const dateText = mode === 'after' ? (a2 ? '11월 15일 새벽' : a1 ? '11월 14일 저녁' : '11월 14일') : `${DAYS[idx].split('.')[0]}월 ${Number(DAYS[idx].split('.')[1])}일`;
  const before = BEFORE.map((r, i) => ({ r, at: mode === 'race' ? DROPS[i] : f0 - 1 }));
  const after = AFTER.map((r, i) => ({ r, at: mode === 'after' ? (i === 0 ? T.plus1 : T.plus2) : f0 - 1 }));
  const fan = mode === 'held' ? prog(f, F(T.back2), 12, IN_OUT) : 0;
  const lit = mode === 'held' ? prog(f, F(T.back2) + 4, 8) : 0;
  return (
    <AbsoluteFill style={{ opacity: ap * out, transformOrigin: origin, transform: `scale(${push})` }}>
      {mode === 'race' || mode === 'after' ? (
        <div style={{ position: 'absolute', left: 74, top: 548, display: 'flex', alignItems: 'baseline', gap: 18, fontFamily: KO, whiteSpace: 'nowrap' }}>
          {mode === 'race' ? <span style={{ fontWeight: 700, fontSize: 46, letterSpacing: -1, color: 'rgba(255,255,255,0.6)' }}>10월 22일 →</span> : null}
          <span style={{ fontWeight: 900, fontSize: 104, letterSpacing: -4, color: WHITE, display: 'inline-block', transform: `translateY(${-bump * 10}px)` }}>{dateText}</span>
        </div>
      ) : null}
      {mode === 'race' || mode === 'after' ? (
        <>
          <NumCol x={74} label="며칠째" value={String(idx + 1)} unit="일째" color={WHITE} dim={mode === 'after' ? 1 : 0} />
          <NumCol x={510} label="새 자료" value={String(newVal)} unit="개" color={BUTTER} scale={1 + 0.22 * Math.max(zeroSlam, slamAfter) + 0.04 * glow} />
        </>
      ) : null}
      {mode === 'end' ? <EndNums f={f} /> : null}
      {mode === 'race' ? <Pile f={f} slips={before} top={960} glowZero={glow} /> : null}
      {mode === 'held' ? <Pile f={f} slips={before} top={mix(900, 1060, fan)} fan={fan} lit={lit} dimFresh={lit} /> : null}
      {mode === 'after' ? <Pile f={f} slips={[...before, ...after]} top={1000} /> : null}
      {mode === 'end' ? <Pile f={f} slips={[...before, ...after]} top={1070} flashTop={f >= F(T.punch) ? 1 - prog(f, F(T.punch), 12) : 0} /> : null}
    </AbsoluteFill>
  );
};

/** 0~3.3초 — 11-14 새벽 회차의 실제 기록을 크게 옮긴 영수증 한 장(첫 프레임부터 보인다). */
const HookSlip: React.FC<{ f: number }> = ({ f }) => {
  if (f >= F(T.job)) return null;
  const z = mix(1.22, 1.3, prog(f, F(T.hook2), 10, IN_OUT)) * mix(1, 1.015, f / F(T.job));
  const drop = mix(0.92, 1, prog(f, 0, 8));
  const glow = prog(f, F(T.hook2) + 3, 9);
  return (
    <div style={{ position: 'absolute', left: 540 - RECEIPT_W / 2, top: 640, transformOrigin: '62% 70%', transform: `scale(${z * drop}) rotate(-2deg)`, opacity: 1 - prog(f, F(T.job) - 3, 3), filter: 'drop-shadow(0 24px 40px rgba(0,0,0,0.5))' }}>
      <Slip r={BEFORE[5]} glowZero={0.3 + 0.7 * glow} />
    </div>
  );
};

const Card: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ background: PAPER, borderRadius: 30, padding: '36px 44px 40px', fontFamily: KO, color: INK, boxShadow: '0 30px 80px rgba(0,0,0,0.45)', ...style }}>{children}</div>
);

/** 도구 목록 카드 둘 — 위: 목록엔 「웹 원문 읽기 · 있음」, 아래: 실제로 불러 보니 「부를 수 없음」. */
const Tools: React.FC<{ f: number }> = ({ f }) => {
  if (f < F(T.tool) || f >= F(T.doc)) return null;
  const ap = prog(f, F(T.tool), 9);
  const out = 1 - prog(f, F(T.doc) - 3, 3);
  const row = prog(f, F(9.7), 7);
  // 커서가 「인터넷 글 읽기」 줄로 와서 누른다(실제로 써 보니)
  const cur = prog(f, F(10.3), F(T.call) - F(10.3), IN_OUT);
  const ripple = f >= F(T.call) ? prog(f, F(T.call), 12) : 0;
  const back = prog(f, F(T.call), 10, IN_OUT);
  const press = f >= F(T.call) && f < F(T.call) + 6 ? 1 - (f - F(T.call)) / 6 : 0;
  const ok = prog(f, F(T.tool2), 6);
  const call = prog(f, F(T.call), 8);
  const x = prog(f, F(T.cross), 6);
  return (
    <AbsoluteFill style={{ opacity: ap * out }}>
      <div style={{ position: 'absolute', left: 74, top: 590, width: 846, opacity: mix(1, 0.6, back), transformOrigin: '50% 0%', transform: `translateY(${(1 - ap) * 40 - 40 * back}px) scale(${mix(1, 0.9, back)})` }}>
        <Card>
          <div style={{ fontWeight: 700, fontSize: 42, letterSpacing: -1, color: GRAY }}>AI가 쓰는 프로그램 · 기능 목록</div>
          <div style={{ height: 2, background: 'rgba(14,15,18,0.12)', margin: '24px 0 26px' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: row, transform: `translateX(${(1 - row) * 30}px)` }}>
            <div style={{ position: 'relative', fontWeight: 800, fontSize: 92, letterSpacing: -3.4, whiteSpace: 'nowrap', color: x > 0 ? `rgba(14,15,18,${mix(1, 0.45, x)})` : INK }}>
              인터넷 글 읽기
              <div style={{ position: 'absolute', left: -6, right: -6, top: '52%', height: 12, background: BUTTER, transformOrigin: '0 50%', transform: `scaleX(${x})`, borderRadius: 6 }} />
            </div>
            <div style={{ fontWeight: 800, fontSize: 50, letterSpacing: -1, borderRadius: 999, padding: '8px 28px', background: INK, color: WHITE, opacity: ok, transform: `scale(${mix(1.3, 1, ok)})`, whiteSpace: 'nowrap' }}>있음</div>
          </div>
        </Card>
      </div>
      <div style={{ position: 'absolute', left: 74, top: 960, width: 846, opacity: call, transformOrigin: '50% 30%', transform: `translateY(${(1 - call) * 60}px) scale(${mix(0.96, 1, call)})` }}>
        <Card style={{ background: '#1A1C21', color: WHITE, boxShadow: '0 30px 80px rgba(0,0,0,0.55), inset 0 0 0 2px rgba(255,255,255,0.12)' }}>
          <div style={{ fontWeight: 700, fontSize: 42, letterSpacing: -1, color: 'rgba(255,255,255,0.68)' }}>실제로 써 보니</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 26, marginTop: 22 }}>
            <div style={{ width: 120, height: 120, borderRadius: 60, background: x > 0 ? BUTTER : 'rgba(255,255,255,0.12)', color: INK, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 84, transform: `scale(${x > 0 ? mix(1.5, 1, x) : 1})` }}>{x > 0 ? '✕' : ''}</div>
            <div style={{ fontWeight: 900, fontSize: 96, letterSpacing: -3.6, whiteSpace: 'nowrap', opacity: mix(0.25, 1, x) }}>쓸 수 없음</div>
          </div>
        </Card>
      </div>
      {ripple > 0 && ripple < 1 ? <div style={{ position: 'absolute', left: 676 - 70 * ripple, top: 812 - 70 * ripple, width: 140 * ripple, height: 140 * ripple, borderRadius: '50%', border: `5px solid ${BUTTER}`, opacity: 1 - ripple }} /> : null}
      {f >= F(10.3) && f < F(T.call) + 14 ? (
        <svg width={72} height={88} viewBox="0 0 24 30" style={{ position: 'absolute', left: mix(880, 676, cur), top: mix(1340, 812, cur), opacity: 1 - prog(f, F(T.call) + 8, 6), transform: `scale(${1 - 0.15 * press})`, transformOrigin: '0 0', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))' }}>
          <path d="M2 2 L2 24 L8 18 L12 28 L16 26 L12 17 L20 17 Z" fill="#fff" stroke="#0E0F12" strokeWidth={1.6} strokeLinejoin="round" />
        </svg>
      ) : null}
    </AbsoluteFill>
  );
};

/** 옛 문서 카드 — 옛 원문의 설명 · 숫자를 다시 읽고, 확인 시각만 새로. */
const DocCard: React.FC<{ f: number }> = ({ f }) => {
  if (f < F(T.doc) || f >= F(T.back)) return null;
  const ap = prog(f, F(T.doc), 9);
  const out = 1 - prog(f, F(T.back) - 3, 3);
  const k = f >= F(T.flip2) ? 1 : 0;
  const flash = k ? 1 - prog(f, F(T.flip2), 12) : 0;
  const drop = k ? prog(f, F(T.flip2), 5) : 1;
  const bars = [0.92, 0.78, 0.86, 0.6, 0.82, 0.7];
  const scan = prog(f, F(T.flip1) - 6, 20, (x) => x);
  const tag = prog(f, F(T.flip1), 8);
  return (
    <div style={{ position: 'absolute', left: 74, top: 590, width: 846, opacity: ap * out, transform: `translateY(${(1 - ap) * 40}px)` }}>
      <Card>
        <div style={{ fontWeight: 800, fontSize: 60, letterSpacing: -1.6 }}>예전에 모아 둔 문서</div>
        <div style={{ position: 'relative', marginTop: 30, display: 'flex', flexDirection: 'column', gap: 22 }}>
          {bars.map((w, i) => <div key={i} style={{ height: 32, width: `${w * 100}%`, borderRadius: 16, background: 'rgba(14,15,18,0.13)' }} />)}
          {scan > 0 && scan < 1 ? <div style={{ position: 'absolute', left: -10, right: -10, top: -8 + scan * 300, height: 16, background: 'rgba(245,196,69,0.75)', borderRadius: 8 }} /> : null}
          <div style={{ position: 'absolute', right: 0, top: 100, fontWeight: 800, fontSize: 44, letterSpacing: -1, background: INK, color: WHITE, borderRadius: 12, padding: '8px 20px', opacity: tag, transform: `translateY(${(1 - tag) * 12}px)` }}>예전 자료를 다시 읽음</div>
        </div>
        <div style={{ height: 2, background: 'rgba(14,15,18,0.12)', margin: '40px 0 30px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 46, letterSpacing: -1, color: GRAY }}>확인한 날</div>
          <div style={{ fontWeight: 900, fontSize: 64, letterSpacing: -1.8, background: `rgba(245,196,69,${0.3 + 0.7 * flash})`, borderRadius: 12, padding: '2px 18px', transform: `rotate(${k ? -4 * drop : 0}deg) scale(${k ? mix(1.9, 1, drop) : 1})`, opacity: k ? drop : 1, fontVariantNumeric: 'tabular-nums', border: k ? `4px solid ${INK}` : 'none' }}>{TIMES[k]}</div>
        </div>
      </Card>
    </div>
  );
};

/** 규칙 카드 — 아침 조사에서 새로 찾은 원본 0 → 실패. */
const RuleCard: React.FC<{ f: number }> = ({ f }) => {
  if (f < F(T.rule) || f >= F(T.plus)) return null;
  const ap = prog(f, F(T.rule), 9);
  const out = 1 - prog(f, F(T.plus) - 3, 3);
  const zero = prog(f, F(T.rule0), 7);
  const fail = prog(f, F(T.fail), 6);
  const shake = f >= F(T.fail) && f < F(T.fail) + 8 ? Math.sin((f - F(T.fail)) * 2.2) * 8 * (1 - (f - F(T.fail)) / 8) : 0;
  return (
    <div style={{ position: 'absolute', left: 74, top: 620, width: 846, opacity: ap * out, transform: `translate(${shake}px, ${(1 - ap) * 40}px)` }}>
      <Card style={{ position: 'relative', padding: '44px 48px 52px' }}>
        <div style={{ fontWeight: 700, fontSize: 48, letterSpacing: -1.2, color: GRAY }}>아침 조사</div>
        <div style={{ fontWeight: 800, fontSize: 64, letterSpacing: -1.8, marginTop: 6 }}>새로 찾은 자료</div>
        <div style={{ fontWeight: 900, fontSize: 320, lineHeight: 1.0, letterSpacing: -12, marginTop: 10, opacity: zero, transform: `scale(${mix(1.3, 1, zero)})`, transformOrigin: '0 70%' }}>0<span style={{ fontSize: 120, letterSpacing: -3, marginLeft: 12 }}>개</span></div>
        <div style={{ position: 'absolute', right: 44, bottom: 80, fontWeight: 900, fontSize: 118, letterSpacing: -4, color: INK, background: BUTTER, borderRadius: 20, padding: '8px 32px', opacity: fail, transform: `rotate(-7deg) scale(${mix(1.9, 1, fail)})` }}>실패</div>
      </Card>
    </div>
  );
};

/** 실제 화면 — 11-15 05:29 업무 앱(조사 도구 이름 가림). 한 컷 그대로 보인 뒤 「새 자료 10건」 줄로 크게 다가간다. */
const RealShot: React.FC<{ f: number }> = ({ f }) => {
  if (f < F(T.real) || f >= F(T.end)) return null;
  const ap = prog(f, F(T.real), 5);
  const out = 1 - prog(f, F(T.end) - 3, 3);
  const W = 846, H = Math.round((669 / 1050) * W);
  const zp = prog(f, F(T.real) + 12, 14, IN_OUT);
  const z = mix(1, 3.15, zp);
  const line = prog(f, F(T.real) + 24, 8);
  return (
    <div style={{ position: 'absolute', left: 74, top: 640, width: W, height: H, opacity: ap * out, borderRadius: 24, overflow: 'hidden', background: '#fff', boxShadow: '0 30px 80px rgba(0,0,0,0.5)' }}>
      <div style={{ position: 'absolute', inset: 0, transformOrigin: '51.5% 93.9%', transform: `translateY(${-250 * zp}px) scale(${z})` }}>
        <Img src={staticFile('img/app_after.png')} style={{ width: W, height: H, display: 'block' }} />
        <div style={{ position: 'absolute', left: (392 / 1050) * W, top: (646 / 669) * H, width: (152 / 1050) * W * line, height: 3, background: BUTTER, borderRadius: 2 }} />
      </div>
    </div>
  );
};

const CUTS = [0, 3.3, 8.9, 15.3, 18.3, 21.5, 24.2, 26.8, 28.4, 33.0];
const driftY = (t: number) => {
  for (let i = 1; i < CUTS.length; i++) if (t < CUTS[i]) return 22 * (t - CUTS[i - 1]) / (CUTS[i] - CUTS[i - 1]);
  return 22;
};

export const Film: React.FC<{ bgm: boolean; voice: boolean; hero?: boolean }> = ({ bgm, voice, hero = false }) => {
  const fr = useCurrentFrame();
  const off = hero ? F(T.job) : 0; // 핵심 장면만(장면 심사): 편 시간 T.job부터, 글 · 말 없이
  const f = fr + off;
  return (
    <AbsoluteFill style={{ background: '#08090B' }}>
      <Backdrop f={f} />
      <AbsoluteFill style={{ transform: `translateY(${driftY(f / FPS)}px)` }}>
      {!hero ? <HookSlip f={f} /> : null}
      <Scene f={f} f0={T.job} f1={T.tool} mode="race" />
      {!hero ? (
        <>
          <Tools f={f} />
          <DocCard f={f} />
          <Scene f={f} f0={T.back} f1={T.rule} mode="held" />
          <RuleCard f={f} />
          <Scene f={f} f0={T.plus} f1={T.real} mode="after" />
          <RealShot f={f} />
          <Note f={f} f0={T.real + 0.1} f1={T.end} top={1230} text="실제 화면 · 11월 15일 새벽" />
          <Scene f={f} f0={T.end} f1={LEN + 1} mode="end" />

          <Head f={f} from={0} to={T.job} lines={[{ at: 0, node: <>AI가 3주 넘게</> }, { at: T.hook2, node: <>「완료」라고 했다</> }]} />
          <Note f={f} f0={0} f1={T.job} top={1215} text="실제 기록을 크게 옮김" />
          <Head f={f} from={T.job} to={T.zero} lines={[{ at: T.job, node: <>새 참고 자료를 찾아</> }, { at: 5.2, node: <>회사 자료함에 쌓는 일</> }]} />
          <Head f={f} from={T.zero} to={T.tool} lines={[{ at: T.zero, node: <>새로 쌓인 건</> }, { at: T.zero, node: <><span style={{ color: BUTTER }}>0개</span></> }]} />
          <Head f={f} from={T.tool} to={T.cross} lines={[{ at: T.tool, node: <>인터넷 글 읽는 기능이</> }, { at: 11.45, node: <>있다고 나왔는데</> }]} size={88} />
          <Head f={f} from={T.cross} to={T.doc} lines={[{ at: T.cross, node: <>실제로는</> }, { at: T.cross, node: <><U p={prog(f, F(T.cross) + 4, 9)}>쓸 수 없었다</U></> }]} />
          <Head f={f} from={T.doc} to={T.back} lines={[{ at: T.doc, node: <>예전 문서를 다시 읽고</> }, { at: T.flip2, node: <>날짜만 새로</> }]} />
          <Head f={f} from={T.back} to={T.rule} lines={[{ at: T.back, node: <>나는 「완료」만 보고</> }, { at: T.back2, node: <>넘겼다</> }]} />
          <Head f={f} from={T.rule} to={T.plus} lines={[{ at: T.rule, node: <>새로 찾은 자료가 0이면</> }, { at: T.fail, node: <><span style={{ color: BUTTER }}>실패</span>로 적는다</> }]} size={88} />
          <Head f={f} from={T.plus} to={T.end} lines={[{ at: T.plus, node: <>그날도 다음 날도</> }, { at: 27.2, node: <>새 자료 <span style={{ color: BUTTER }}>10개씩</span></> }]} />
          <Head f={f} from={T.end} to={LEN + 1} lines={[{ at: T.end, node: <>「완료」 말고</> }, { at: T.end2, node: <><U p={prog(f, F(30.3), 14)}>새로 늘어난 개수</U></> }]} size={104} />
        </>
      ) : null}

      </AbsoluteFill>
      {voice && !hero ? VO.map((v) => <Sequence key={v.id} from={F(v.at)}><Audio src={staticFile(`vo/${v.id}.wav`)} /></Sequence>) : null}
      {bgm && !hero ? <Audio src={staticFile('bgm.wav')} volume={(x) => (x < F(0.4) ? mix(0.12, BGM, x / F(0.4)) : x > F(LEN) - F(1.2) ? mix(BGM, 0, (x - (F(LEN) - F(1.2))) / F(1.2)) : BGM)} /> : null}
      {!hero ? SFX.map((s, i) => <Sequence key={i} from={F(s.at)}><Audio src={staticFile(`sfx/${s.id}.wav`)} volume={s.vol} /></Sequence>) : null}
    </AbsoluteFill>
  );
};
