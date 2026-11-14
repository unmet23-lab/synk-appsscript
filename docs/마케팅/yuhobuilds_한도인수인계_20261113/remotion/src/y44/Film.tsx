// Y44 본편 — 「대화」 상자 안에 쌓이던 답이 한도 셔터에 갇히고, 밖에는 빈 질문지만 남는다.
// 결: 답이 나오는 자리에서 바로 상자 밖 파일철로 — 셔터가 다시 내려와도 파일은 밖에 남는다.
// 실화 숫자(11-09): 07:00 시작 → 10:26 사용 한도로 멈춤 → 15:00 이어 받음. 새 AI의 답은 11-13에 실제로 받은 글(기획.md 「실제 답」).
import React from 'react';
import { Audio } from '@remotion/media';
import { AbsoluteFill, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from '../lib/fonts';
import { IN, IN_OUT, mix, prog } from '../lib/motion';

export const FPS = 30;
export const F = (s: number) => Math.round(s * FPS);
export const LEN = 28.9;
export const TOTAL = F(LEN);
export const HERO_LEN = F(5.2);

const BG = '#111316';
const INK = '#F4F1EA';
const BUTTER = '#F5C445';
const PAPER = '#F4F1EA';

// 시간표(초)
// 11-14 고침(최종 확인 미흡): 건지기는 셔터가 살짝 들려 한 장만 빠져나오고(lift · pull · drop) 질문지 3을 다시 채움(rewrite),
// 끝은 저장할 한 줄을 끝까지 두고 파일에서 「어디까지 했나」 한 장을 꺼낸다(card · 확인 셋).
export const T = { slam: 3.6, left: 4.9, inside: 7.85, newAi: 10.1, answer: 13.3, salvage: 16.5, lift: 17.2, found: 17.7, pull: 18.0, drop: 18.45, rewrite: 18.85, flip3: 20.05, fix: 20.6, flow: 22.4, slam2: 24.9, card: 25.5, end: 26.1 };
export const CUT = [0, T.slam, T.left, T.inside, T.newAi, T.answer, T.salvage, T.rewrite, T.fix, T.flow, T.slam2];
const CHECK = [26.45, 26.8, 27.15];
const ZOOM_Y = -445;
export const VO: { id: string; at: number }[] = [
  { id: 'V1', at: 0.3 },
  { id: 'V2', at: 4.9 },
  { id: 'V3', at: 10.1 },
  { id: 'V4', at: 16.5 },
  { id: 'V5', at: 20.6 },
  { id: 'V6', at: 24.6 },
];

// 상자 · 종이 자리
const BOX = { x: 110, y: 690, w: 860, h: 560 };
const COLS = 6;
const N = 18;
const SW = 96;
const SH = 136;
const cell = (i: number) => ({ x: BOX.x + 34 + (i % COLS) * ((BOX.w - 68 - SW) / (COLS - 1)), y: BOX.y + 40 + Math.floor(i / COLS) * (SH + 36) });
const ROW = { y: 1330, h: 230 };
const FOUND = 14; // 셔터가 들렸을 때 틈에 보이는 아래 줄의 한 장
// 파일철 안 종이는 세 더미로 가지런히 쌓인다(빽빽이 겹친 한 줄이 바코드처럼 뭉개졌다 — 11-14 카본 맹검)
const slot = (i: number) => {
  const pile = i % 3;
  const k = Math.floor(i / 3);
  return { x: 205 + pile * 270 + (k % 2) * 7, y: ROW.y + 82 - k * 7 };
};

const pad = (n: number) => String(n).padStart(2, '0');
const clock = (min: number) => `${pad(Math.floor(min / 60))}:${pad(Math.floor(min % 60))}`;

/** 답이 적힌 작은 종이 한 장. */
const Sheet: React.FC<{ x: number; y: number; o?: number; rot?: number; s?: number; blank?: boolean; w?: number; h?: number }> = ({ x, y, o = 1, rot = 0, s = 1, blank = false, w = SW, h = SH }) => (
  <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, opacity: o, transform: `rotate(${rot}deg) scale(${s})`, background: PAPER, borderRadius: 5, boxShadow: '0 10px 18px rgba(0,0,0,0.45)', boxSizing: 'border-box', padding: `${h * 0.16}px ${w * 0.14}px` }}>
    {[0.9, 0.7, 0.8, 0.5].map((l, i) => (
      <div key={i} style={{ height: h * 0.07, width: `${l * 100}%`, marginBottom: h * 0.1, borderRadius: 3, background: blank ? 'transparent' : '#2A2D33', border: blank ? '2px dashed #9A968C' : 'none', boxSizing: 'border-box', opacity: blank ? 0.9 : 0.82 }} />
    ))}
  </div>
);

/** 위 큰 글 — 줄 단위로 28px 올라오며 나타남. */
const Head: React.FC<{ from: number; to: number; lines: React.ReactNode[]; size?: number; step?: number }> = ({ from, to, lines, size = 96, step = 5 }) => {
  const f = useCurrentFrame();
  if (f < from || f >= to) return null;
  const out = 1 - prog(f, to - 3, 3);
  return (
    <div style={{ position: 'absolute', left: 74, width: 840, top: 286, fontFamily: KO, fontWeight: 800, fontSize: size, lineHeight: 1.16, letterSpacing: -2.6, color: INK }}>
      {lines.map((l, i) => {
        const p = from === 0 && i === 0 ? 1 : prog(f, from + i * step, 7);
        return (
          <div key={i} style={{ opacity: p * out, transform: `translateY(${(1 - p) * 28}px)` }}>
            {l}
          </div>
        );
      })}
    </div>
  );
};

const U: React.FC<{ children: React.ReactNode; c?: string }> = ({ children, c = BUTTER }) => <span style={{ boxShadow: `inset 0 -0.2em 0 ${c}`, color: INK }}>{children}</span>;

/** 한도 셔터 — 상자 위에서 내려와 닫힌다. */
const Shutter: React.FC<{ p: number; see?: number; hide?: number }> = ({ p, see = 0, hide = 0 }) => (
  <div style={{ position: 'absolute', left: BOX.x, top: BOX.y, width: BOX.w, height: BOX.h, overflow: 'hidden', borderRadius: 22 }}>
    <div style={{ position: 'absolute', inset: 0, opacity: 1 - 0.45 * see, transform: `translateY(${(p - 1) * (BOX.h + 8)}px)`, background: 'repeating-linear-gradient(to bottom, #3A3E46 0px, #3A3E46 38px, #23262C 38px, #23262C 44px)', boxShadow: 'inset 0 -14px 0 #17191D', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: KO, color: INK }}>
      <div style={{ width: 84, height: 66, position: 'relative', marginBottom: 18, opacity: 1 - hide }}>
        <div style={{ position: 'absolute', left: 16, top: -34, width: 52, height: 56, border: `11px solid ${INK}`, borderBottom: 'none', borderRadius: '30px 30px 0 0', boxSizing: 'border-box' }} />
        <div style={{ position: 'absolute', inset: 0, background: INK, borderRadius: 10 }} />
      </div>
      <div style={{ fontWeight: 800, fontSize: 70, letterSpacing: -2, opacity: 1 - hide }}>사용 한도 · 멈춤</div>
    </div>
  </div>
);

/** 새 AI와의 주고받음 — 실제로 받은 답 글 그대로. */
const Ask: React.FC<{ from: number; ans: number; to: number }> = ({ from, ans, to }) => {
  const f = useCurrentFrame();
  if (f < from || f >= to) return null;
  const out = 1 - prog(f, to - 4, 4);
  const q = '아까 하던 작업 이어서 해 줘';
  const typed = q.slice(0, Math.round(q.length * prog(f, from + 12, 70, (x) => x)));
  const caret = f < ans && Math.floor(f / 8) % 2 === 0;
  const lines: React.ReactNode[] = ['“‘아까 하던 작업’이 어떤 것인지', <span key="k">이 세션에서는 <U c="rgba(244,241,234,0.42)">확인할 수 없어</U></span>, '이어서 실행하지 않았습니다.”'];
  return (
    <div style={{ position: 'absolute', left: 74, width: 846, top: 640, fontFamily: KO, color: INK, opacity: out, transform: `scale(${1 + 0.1 * ((f - from) / (to - from))}) translateY(${-60 * ((f - from) / (to - from))}px)`, transformOrigin: '0% 30%' }}>
      <div style={{ fontWeight: 700, fontSize: 48, letterSpacing: -1, opacity: 0.75 * prog(f, from + 4, 8) }}>다시 해 봤다</div>
      <div style={{ fontWeight: 800, fontSize: 66, letterSpacing: -2, marginTop: 14, minHeight: 84 }}>
        {typed}
        <span style={{ opacity: caret ? 1 : 0 }}>|</span>
      </div>
      <div style={{ height: 3, background: INK, opacity: 0.28 * prog(f, ans - 6, 8), marginTop: 34, marginBottom: 40, transformOrigin: '0 50%', transform: `scaleX(${prog(f, ans - 6, 12)})` }} />
      <div style={{ fontWeight: 700, fontSize: 48, letterSpacing: -1, opacity: 0.75 * prog(f, ans, 8), marginBottom: 18 }}>실제로 받은 답</div>
      {lines.map((l, i) => {
        const p = prog(f, ans + 4 + i * 9, 9);
        return (
          <div key={i} style={{ fontWeight: 600, fontSize: 66, lineHeight: 1.42, letterSpacing: -1.6, opacity: p, transform: `translateY(${(1 - p) * 18}px)` }}>
            {l}
          </div>
        );
      })}
    </div>
  );
};

/** 끝: 파일에서 꺼낸 한 장 — 다음 AI가 이걸 보고 어디까지 했는지 안다. */
const EndCard: React.FC<{ from: number }> = ({ from }) => {
  const f = useCurrentFrame();
  if (f < from) return null;
  const p = prog(f, from, 16);
  const settle = prog(f, F(27.7), 24, IN_OUT);
  const rows: { q: string; a: string; mark: boolean }[] = [
    { q: '질문 1', a: '답 적음', mark: false },
    { q: '질문 2', a: '답 적음', mark: false },
    { q: '질문 3', a: '여기서부터', mark: true },
  ];
  return (
    <div style={{ position: 'absolute', left: 190, top: 772, width: 700, height: 412, background: PAPER, borderRadius: 14, boxShadow: '0 30px 60px rgba(0,0,0,0.55)', boxSizing: 'border-box', padding: '38px 56px', fontFamily: KO, color: '#1B1D21', opacity: Math.min(1, p * 1.5), transform: `translateY(${(1 - p) * 560}px) scale(${mix(0.42, 1, p) * (1 + 0.015 * settle)}) rotate(${mix(-6, -1.2, p)}deg)`, transformOrigin: '50% 100%' }}>
      <div style={{ fontWeight: 800, fontSize: 60, letterSpacing: -1.8, lineHeight: 1.1 }}>어디까지 했나</div>
      <div style={{ height: 3, background: '#1B1D21', opacity: 0.18, margin: '20px 0 8px' }} />
      {rows.map((r, i) => {
        const c = prog(f, F(CHECK[i]), 7);
        return (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 86, fontWeight: 700, fontSize: 52, letterSpacing: -1.2 }}>
            <span>{r.q}</span>
            <span style={{ opacity: c, transform: `scale(${mix(1.4, 1, c)})`, transformOrigin: '100% 50%', fontWeight: r.mark ? 800 : 700, boxShadow: r.mark ? `inset 0 -0.22em 0 ${BUTTER}` : 'none' }}>{r.a}</span>
          </div>
        );
      })}
    </div>
  );
};

export const Film: React.FC<{ bgm?: boolean; voice?: boolean; bare?: boolean }> = ({ bgm = true, voice = true, bare = false }) => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const S1 = F(T.slam);
  const S2 = F(T.slam2);
  const fixed = t >= T.fix;

  // 건지기(16.5~20.6): 셔터가 4분의 1쯤 들려(17.2) 한 장이 빛나고(17.7) 빠져나와 질문지 2로(18.0~18.55), 셔터가 다시 닫힘(18.45),
  // 카메라가 질문지 줄로 내려가(18.85) 질문지 3을 줄마다 다시 채움(19.25~) → 「다시 물어 받음」(20.05)
  const inSalvage = t >= T.salvage && t < T.fix;
  const lift = inSalvage ? prog(f, F(T.lift), 10, IN_OUT) * (1 - prog(f, F(T.drop), 6, IN)) : 0;
  const found = inSalvage ? prog(f, F(T.found), 6) : 0;
  const pull = prog(f, F(T.pull), 16, IN_OUT);
  const landF = F(T.pull) + 16;
  const flip3F = F(T.flip3);
  const bars3 = [0, 1, 2].map((i) => prog(f, F(19.25) + i * 9, 8, (x) => x));

  // 셔터: 1차 3.6초에 닫힘 → 해법(20.6초)에서 걷힘 → 2차 24.9초에 다시 닫힘
  const shut = fixed ? prog(f, S2, 5, IN) : prog(f, S1, 5, IN) * (1 - prog(f, F(T.fix) - 8, 8, IN_OUT)) * (1 - 0.26 * lift);
  const shakeAt = f >= S2 ? S2 + 5 : S1 + 5;
  const sd = f - shakeAt;
  const shake = sd >= 0 && sd < 8 ? (1 - sd / 8) * 16 * Math.sin(sd * 2.2) : 0;

  // 시계
  const min = t < T.slam ? mix(420, 626, prog(f, 0, S1, (x) => x)) : t < T.salvage ? 626 : 900;

  // 답 종이: 1막은 상자 안에 쌓임, 해법 막은 나오자마자 파일철로
  const born1 = (i: number) => (i < 5 ? -30 : 2 + Math.round(((i - 5) / (N - 5)) * (S1 - 8)));
  const born2 = (i: number) => F(T.fix) + 14 + Math.round((i / N) * (S2 - F(T.fix) - 44));

  const see = t >= T.inside && t < T.newAi ? prog(f, F(T.inside), 10) * (1 - prog(f, F(T.newAi) - 5, 5)) : 0;
  // 질문지 줄만 보이는 두 구간: 상자는 위 그늘 아래로 통째로 숨어 셔터 글자가 반쯤 잘려 보이지 않는다
  // 끝은 되돌아오지 않고 바로 다음 컷으로(되돌아오는 0.2초에 상자 이름 · 시계가 머리 글과 겹쳤다)
  // 첫 구간은 다음 컷(갇힌 답 비침) 직전 15프레임(0.5초)에 물러난다 — 바로 넘기면 같은 판을 잘라 키운 점프컷(검사 ⑳ · 점검표 50)
  const zoomQ = t >= T.left && t < T.inside ? prog(f, F(T.left), 12, IN_OUT) * (1 - prog(f, F(T.inside) - 15, 15, IN_OUT)) : 0;
  // 셔터 글자 · 자물쇠는 질문지 줄 · 갇힌 답 · 새 AI 답 장면 내내 숨긴다(물러나는 동안 반쯤 잘려 보이지 않게)
  const noLabel = t >= T.left && t < T.salvage ? 1 : 0; // 질문지 줄로 내려갈 때(18.85~)는 zq로 서서히 걷는다 — 한 프레임에 사라지면 「글자만 먼저 사라짐」(11-14 카본 맹검)
  const zoomQ2 = t >= T.rewrite && t < T.fix ? prog(f, F(T.rewrite), 14, IN_OUT) : 0;
  const zq = Math.max(zoomQ, zoomQ2);
  const asking = t >= T.newAi && t < T.salvage;
  // 답 장면 끝은 바로 다음 컷으로(겹쳐 밝아지던 5프레임에 답 글과 셔터 글 · 시계가 겹쳤다)
  const dim = asking ? prog(f, F(T.newAi), 8) : 0;
  const kick = CUT.slice(1).reduce((a, c) => {
    const d = f - F(c);
    return d >= 0 && d < 10 ? Math.max(a, 1 - d / 10) : a;
  }, 0);
  let ci = 0;
  for (let k = 0; k < CUT.length; k++) if (t >= CUT[k]) ci = k;
  const cEnd = ci + 1 < CUT.length ? CUT[ci + 1] : LEN;
  const inShot = Math.max(0, Math.min(1, (t - CUT[ci]) / (cEnd - CUT[ci])));
  // 질문지 줄을 볼 때는 다가감 · 옆 이동을 빼 종이 글자가 화면 끝에 닿지 않게 한다
  const drift = 1 + Math.max(0.05, 0.022 * (cEnd - CUT[ci])) * inShot * (1 - zq);
  const pan = (ci === CUT.length - 1 ? 0 : ci % 2 === 0 ? -1 : 1) * Math.max(12, 7 * (cEnd - CUT[ci])) * inShot * (1 - zq);
  const breathe = 0.5 + 0.5 * Math.sin(f / 5);
  const qO = fixed ? 0 : prog(f, bare ? 20 : 8, 10);
  const folderO = fixed ? prog(f, F(T.fix) + 2, 10) : 0;
  const endGlow = prog(f, S2 + 16, 14) * (1 + 0.6 * Math.sin(Math.PI * prog(f, F(27.7), 18, (x) => x)));
  const pop = (at: number) => (f >= at ? 1 + 0.07 * (1 - prog(f, at, 9)) : 1);

  return (
    <AbsoluteFill style={{ background: BG }}>
      <AbsoluteFill style={{ background: 'radial-gradient(90% 60% at 50% 48%, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0) 70%)' }} />
      <AbsoluteFill style={{ transform: `translate(${pan}px, ${shake}px) scale(${drift * (1 + 0.025 * kick * kick) * (1 + 0.04 * zq)}) translateY(${ZOOM_Y * zq}px)`, transformOrigin: '50% 78%', opacity: 1 - 0.82 * dim }}>
        {/* 상자 머리: 이름 · 시계 */}
        <div style={{ position: 'absolute', left: BOX.x + 6, top: BOX.y - 76, fontFamily: KO, fontWeight: 700, fontSize: 46, letterSpacing: -1, color: INK, opacity: 0.78 * (1 - dim) * (1 - Math.min(1, zq * 12)) }}>AI와 하던 대화 · 받은 답</div>
        <div style={{ position: 'absolute', left: 640, width: 260, textAlign: 'right', top: BOX.y - 86, fontFamily: KO, fontWeight: 800, fontSize: 62, letterSpacing: -1, color: INK, fontVariantNumeric: 'tabular-nums', opacity: fixed ? 0 : (1 - dim) * (1 - Math.min(1, zq * 12)) }}>{clock(min)}</div>
        {/* 상자 */}
        <div style={{ position: 'absolute', left: BOX.x, top: BOX.y, width: BOX.w, height: BOX.h, borderRadius: 22, background: 'rgba(255,255,255,0.05)', border: '3px solid rgba(244,241,234,0.5)', boxSizing: 'border-box' }} />
        {/* 1막 답 종이(상자 안) */}
        {!fixed
          ? Array.from({ length: N }, (_, i) => {
              const c = cell(i);
              const p = prog(f, born1(i), 7);
              if (p <= 0) return null;
              if (i === FOUND && pull > 0) return null;
              const glow = i === FOUND ? found : 0;
              return (
                <React.Fragment key={i}>
                  {glow > 0 ? <div style={{ position: 'absolute', left: c.x - 9, top: c.y - 9, width: SW + 18, height: SH + 18, borderRadius: 10, border: `6px solid ${BUTTER}`, boxSizing: 'border-box', opacity: glow, boxShadow: `0 0 ${30 * glow}px rgba(245,196,69,0.55)` }} /> : null}
                  <Sheet x={c.x} y={c.y + (1 - p) * 26} o={p} s={mix(0.7, 1, p)} />
                </React.Fragment>
              );
            })
          : null}
        <Shutter p={shut} see={see} hide={Math.min(1, Math.max(dim, noLabel, see * 2.5, zq * 2))} />
        {/* 셔터 틈으로 건져 나오는 한 장 → 질문지 2 — 질문지 밑으로 들어가 「질문 2 · 답 없음」 글자를 덮지 않는다(11-14 카본 맹검) */}
        {!fixed && pull > 0 && f < landF
          ? (() => {
              const c = cell(FOUND);
              const tx = 110 + 280 + 77;
              const ty = ROW.y + 46;
              const down = Math.min(1, pull * 2.2);
              const y = pull < 0.45 ? mix(c.y, BOX.y + BOX.h + 10, down) : mix(BOX.y + BOX.h + 10, ty, (pull - 0.45) / 0.55);
              return (
                <>
                  <div style={{ position: 'absolute', left: mix(c.x, tx, pull) - 9, top: y - 9, width: SW + 18, height: SH + 18, borderRadius: 10, border: `6px solid ${BUTTER}`, boxSizing: 'border-box', transform: `rotate(${mix(0, 7, pull)}deg)` }} />
                  <Sheet x={mix(c.x, tx, pull)} y={y} rot={mix(0, 7, pull)} />
                </>
              );
            })()
          : null}
        {/* 상자 밖: 질문지 셋(답 칸이 빈 종이) */}
        {qO > 0
          ? [0, 1, 2].map((k) => {
              const x = 110 + k * 280;
              const got2 = f >= landF;
              const got3 = f >= flip3F;
              const label = k === 0 ? '답 있음' : k === 1 ? (got2 ? '답 찾음' : '답 없음') : got3 ? '다시 물어 받음' : '답 없음';
              const marked = (k === 1 && got2) || (k === 2 && got3);
              const s = k === 1 ? pop(landF) : k === 2 ? pop(flip3F) : 1;
              return (
                <div key={k} style={{ position: 'absolute', left: x, top: ROW.y, width: 250, height: ROW.h, opacity: qO, background: PAPER, borderRadius: 8, boxShadow: '0 16px 26px rgba(0,0,0,0.5)', boxSizing: 'border-box', padding: '16px 22px', fontFamily: KO, color: '#1B1D21', transform: `rotate(${[-2, 1.2, -1][k]}deg) scale(${s})` }}>
                  <div style={{ fontWeight: 800, fontSize: 40, letterSpacing: -1, lineHeight: 1.1 }}>
                    <span>질문 {k + 1}</span>
                    <span style={{ display: 'block', fontWeight: 800, fontSize: 31, letterSpacing: -0.8, opacity: marked ? 1 : 0.68, marginTop: 4 }}>
                      <span style={{ boxShadow: marked ? `inset 0 -0.3em 0 ${BUTTER}` : 'none' }}>{label}</span>
                    </span>
                  </div>
                  {[0.92, 0.78, 0.6].map((l, i) => {
                    const fill = k === 0 ? 1 : k === 1 ? (got2 ? 1 : 0) : bars3[i];
                    return <div key={i} style={{ height: 15, marginTop: 15, borderRadius: 4, boxSizing: 'border-box', border: fill > 0 ? 'none' : '2px dashed #9A968C', background: fill > 0 ? '#2A2D33' : `rgba(154,150,140,${0.1 + 0.22 * breathe})`, width: `${l * 100 * (k < 2 || fill <= 0 ? 1 : fill)}%`, opacity: 0.85 }} />;
                  })}
                </div>
              );
            })
          : null}
        {/* 해법 막: 상자 밖 파일철 */}
        {fixed ? (
          <>
            <div style={{ position: 'absolute', left: 110, top: ROW.y - 44, width: 500, height: 60, borderRadius: '16px 16px 0 0', background: BUTTER, opacity: folderO }} />
            <div style={{ position: 'absolute', left: 110, top: ROW.y, width: 860, height: ROW.h + 20, borderRadius: '0 18px 18px 18px', border: `6px solid ${BUTTER}`, boxSizing: 'border-box', background: 'rgba(245,196,69,0.08)', opacity: folderO, boxShadow: `0 0 ${60 * endGlow}px ${10 * endGlow}px rgba(245,196,69,${0.35 * endGlow})` }} />
            <div style={{ position: 'absolute', left: 134, top: ROW.y - 40, fontFamily: KO, fontWeight: 800, fontSize: 40, letterSpacing: -1, color: '#1B1D21', opacity: folderO }}>대화 밖 · 내 폴더의 파일</div>
            {Array.from({ length: N }, (_, i) => {
              const c = cell(i);
              const a = prog(f, born2(i), 6);
              if (a <= 0) return null;
              const p = prog(f, born2(i) + 7, 12, IN_OUT);
              const s = slot(i);
              return <Sheet key={i} x={mix(c.x, s.x, p)} y={mix(c.y, s.y, p) - Math.sin(Math.PI * p) * 40} o={a} rot={mix(0, -2 + ((i * 7) % 5), p)} s={mix(0.7, 1, a)} />;
            })}
            {bare ? null : <EndCard from={F(T.card)} />}
          </>
        ) : null}
      </AbsoluteFill>

      {asking ? <AbsoluteFill style={{ opacity: dim, background: `radial-gradient(520px 900px at ${mix(-150, 1230, (t - T.newAi) / (T.salvage - T.newAi))}px 1000px, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0) 100%)` }} /> : null}
      {zq > 0 ? <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 850, opacity: Math.min(1, zq * 1.6), background: `linear-gradient(to bottom, ${BG} 0px, ${BG} 800px, rgba(17,19,22,0) 850px)` }} /> : null}
      {!bare ? (
        <>
          <Head from={0} to={F(T.slam)} lines={['아침 7시, AI한테 맡긴 일', '답이 대화 안에 쌓이다가']} size={84} step={F(1.6)} />
          <Head from={F(T.slam)} to={F(T.left)} lines={['10시 26분', '한도로 멈췄다']} size={110} step={1} />
          <Head from={F(T.left)} to={F(T.inside)} lines={['이어받은 AI 앞엔', '질문지와 답 몇 장뿐']} size={88} />
          <Head from={F(T.inside)} to={F(T.newAi)} lines={['나머지 답은', '멈춘 대화 안에']} />
          <Head from={F(T.newAi)} to={F(T.salvage)} lines={['그 대화를 모르는 새 AI는', '이렇게 답한다']} size={78} />
          <Ask from={F(T.newAi)} ans={F(T.answer)} to={F(T.salvage)} />
          <Head from={F(T.salvage)} to={F(T.fix)} lines={['이어받은 AI가 찾은 답만 건지고', '나머지는 다시 물어 받았다']} size={66} />
          <Head from={F(T.fix)} to={F(T.flow)} lines={['그래서 일을 맡길 때', '붙이는 한 줄']} />
          {/* 저장할 한 줄은 끝까지 그대로(11-14 — 24.8초에 사라지던 것) */}
          <Head from={F(T.flow)} to={TOTAL + 4} lines={['“답 받는 자리에서', <span key="u">바로 <U>파일에</U> 적어”</span>]} />
        </>
      ) : null}

      {bgm && !bare ? <Audio src={staticFile('bgm.wav')} volume={0.36} /> : null}
      {voice && !bare
        ? VO.map((v) => (
            <Sequence key={v.id} from={F(v.at)}>
              <Audio src={staticFile(`vo/${v.id}.wav`)} volume={1} />
            </Sequence>
          ))
        : null}
      {voice ? (
        <>
          {Array.from({ length: N }, (_, i) => (
            <Sequence key={`a${i}`} from={born1(i)}>
              <Audio src={staticFile(i % 2 ? 'sfx/tick.wav' : 'sfx/tick2.wav')} volume={0.3} />
            </Sequence>
          ))}
          {[S1 + 3, S2 + 3].map((s) => (
            <Sequence key={`t${s}`} from={s}>
              <Audio src={staticFile('sfx/thud.wav')} volume={1} />
            </Sequence>
          ))}
          {bare
            ? null
            : [T.left, T.inside, T.newAi, T.salvage, T.fix].map((s) => (
                <Sequence key={`s${s}`} from={F(s)}>
                  <Audio src={staticFile('sfx/swish.wav')} volume={0.5} />
                </Sequence>
              ))}
          {bare
            ? null
            : Array.from({ length: 14 }, (_, i) => (
                <Sequence key={`k${i}`} from={F(T.newAi) + 12 + i * 5}>
                  <Audio src={staticFile('sfx/tick2.wav')} volume={0.22} />
                </Sequence>
              ))}
          {bare
            ? null
            : (
                [
                  [T.answer, 0.8],
                  [T.found, 0.55],
                  [T.pull + 16 / FPS, 0.8],
                  [19.25, 0.42],
                  [19.25 + 9 / FPS, 0.42],
                  [19.25 + 18 / FPS, 0.42],
                  [T.flip3, 0.8],
                  ...CHECK.map((c) => [c, 0.6] as [number, number]),
                ] as [number, number][]
              ).map(([s, v]) => (
                <Sequence key={`o${s}`} from={F(s)}>
                  <Audio src={staticFile('sfx/tok.wav')} volume={v} />
                </Sequence>
              ))}
          {bare
            ? null
            : (
                [
                  [T.lift, 0.32],
                  [T.rewrite, 0.3],
                  [T.card, 0.36],
                ] as [number, number][]
              ).map(([s, v]) => (
                <Sequence key={`w${s}`} from={F(s)}>
                  <Audio src={staticFile('sfx/swish.wav')} volume={v} />
                </Sequence>
              ))}
          {bare ? null : (
            <Sequence from={F(T.drop) + 6}>
              <Audio src={staticFile('sfx/thud.wav')} volume={0.32} />
            </Sequence>
          )}
          {bare
            ? null
            : Array.from({ length: N }, (_, i) => (
                <Sequence key={`b${i}`} from={born2(i) + 17}>
                  <Audio src={staticFile(i % 2 ? 'sfx/tick.wav' : 'sfx/tick2.wav')} volume={0.34} />
                </Sequence>
              ))}
          {bare ? null : (
            <Sequence from={S2 + 18}>
              <Audio src={staticFile('sfx/calm.wav')} volume={0.8} />
            </Sequence>
          )}
        </>
      ) : null}
    </AbsoluteFill>
  );
};
