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
export const T = { slam: 3.6, left: 4.9, inside: 7.85, newAi: 10.1, answer: 13.3, salvage: 16.5, fix: 20.6, flow: 22.4, slam2: 24.9, end: 26.1 };
export const CUT = [0, T.slam, T.left, T.inside, T.newAi, T.answer, T.salvage, T.fix, T.flow, T.slam2, T.end];
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
const slot = (i: number) => ({ x: 150 + i * 42.5, y: ROW.y + 50 + (i % 2) * 8 });

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
    <div style={{ position: 'absolute', inset: 0, opacity: 1 - 0.62 * see, transform: `translateY(${(p - 1) * (BOX.h + 8)}px)`, background: 'repeating-linear-gradient(to bottom, #3A3E46 0px, #3A3E46 38px, #23262C 38px, #23262C 44px)', boxShadow: 'inset 0 -14px 0 #17191D', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: KO, color: INK }}>
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
      <div style={{ fontWeight: 700, fontSize: 40, letterSpacing: -0.8, opacity: 0.55 * prog(f, from + 4, 8) }}>다시 해 봤다 · 그 대화를 모르는 새 AI에게</div>
      <div style={{ fontWeight: 800, fontSize: 66, letterSpacing: -2, marginTop: 14, minHeight: 84 }}>
        {typed}
        <span style={{ opacity: caret ? 1 : 0 }}>|</span>
      </div>
      <div style={{ height: 3, background: INK, opacity: 0.28 * prog(f, ans - 6, 8), marginTop: 34, marginBottom: 40, transformOrigin: '0 50%', transform: `scaleX(${prog(f, ans - 6, 12)})` }} />
      <div style={{ fontWeight: 700, fontSize: 40, letterSpacing: -0.8, opacity: 0.55 * prog(f, ans, 8), marginBottom: 18 }}>실제로 받은 답</div>
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

export const Film: React.FC<{ bgm?: boolean; voice?: boolean; bare?: boolean }> = ({ bgm = true, voice = true, bare = false }) => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const S1 = F(T.slam);
  const S2 = F(T.slam2);
  const fixed = t >= T.fix;

  // 셔터: 1차 2.9초에 닫힘 → 해법(18.9초)에서 걷힘 → 2차 23.6초에 다시 닫힘
  const shut = fixed ? prog(f, S2, 5, IN) : prog(f, S1, 5, IN) * (1 - prog(f, F(T.fix) - 8, 8, IN_OUT));
  const shakeAt = f >= S2 ? S2 + 5 : S1 + 5;
  const sd = f - shakeAt;
  const shake = sd >= 0 && sd < 8 ? (1 - sd / 8) * 16 * Math.sin(sd * 2.2) : 0;

  // 시계
  const min = t < T.slam ? mix(420, 626, prog(f, 0, S1, (x) => x)) : t < T.salvage ? 626 : 900;

  // 답 종이: 1막은 상자 안에 쌓임, 해법 막은 나오자마자 파일철로
  const born1 = (i: number) => (i < 5 ? -30 : 2 + Math.round(((i - 5) / (N - 5)) * (S1 - 8)));
  const born2 = (i: number) => F(T.fix) + 14 + Math.round((i / N) * (S2 - F(T.fix) - 44));

  // 건지기(15.2~): 셔터 밑으로 두 장만 빠져나와 질문지 1 · 2를 채운다
  const sal = (k: number) => (k === 1 ? prog(f, F(T.salvage) + 12, 18, IN_OUT) : 0);
  const rewrite = prog(f, F(T.salvage) + 70, 30, (x) => x);

  const see = t >= T.inside && t < T.newAi ? prog(f, F(T.inside), 10) * (1 - prog(f, F(T.newAi) - 5, 5)) : 0;
  const zoomQ = t >= T.left && t < T.inside ? prog(f, F(T.left), 12, IN_OUT) * (1 - prog(f, F(T.inside) - 6, 6, IN_OUT)) : 0;
  const asking = t >= T.newAi && t < T.salvage;
  const dim = asking ? prog(f, F(T.newAi), 8) * (1 - prog(f, F(T.salvage) - 5, 5)) : 0;
  const kick = CUT.slice(1).reduce((a, c) => {
    const d = f - F(c);
    return d >= 0 && d < 10 ? Math.max(a, 1 - d / 10) : a;
  }, 0);
  let ci = 0;
  for (let k = 0; k < CUT.length; k++) if (t >= CUT[k]) ci = k;
  const cEnd = ci + 1 < CUT.length ? CUT[ci + 1] : LEN;
  const inShot = Math.max(0, Math.min(1, (t - CUT[ci]) / (cEnd - CUT[ci])));
  const drift = 1 + Math.max(0.05, 0.022 * (cEnd - CUT[ci])) * inShot;
  const pan = (ci === CUT.length - 1 ? 0 : ci % 2 === 0 ? -1 : 1) * Math.max(12, 7 * (cEnd - CUT[ci])) * inShot;
  const breathe = 0.5 + 0.5 * Math.sin(f / 5);
  const qO = fixed ? 0 : prog(f, bare ? 20 : 8, 10);
  const folderO = fixed ? prog(f, F(T.fix) + 2, 10) : 0;
  const endZoom = prog(f, F(T.end), F(LEN - T.end), IN_OUT);
  void 0;
  const endGlow = prog(f, S2 + 16, 14);

  return (
    <AbsoluteFill style={{ background: BG }}>
      <AbsoluteFill style={{ background: 'radial-gradient(90% 60% at 50% 48%, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0) 70%)' }} />
      <AbsoluteFill style={{ transform: `translate(${pan}px, ${shake}px) scale(${drift * (1 + 0.025 * kick * kick) * (1 + 0.13 * zoomQ) * (1 + 0.07 * endZoom)}) translateY(${-230 * zoomQ}px)`, transformOrigin: '50% 78%', opacity: 1 - 0.82 * dim }}>
        {/* 상자 머리: 이름 · 시계 */}
        <div style={{ position: 'absolute', left: BOX.x + 6, top: BOX.y - 74, fontFamily: KO, fontWeight: 700, fontSize: 44, letterSpacing: -1, color: INK, opacity: 0.6 * (1 - endZoom * 3 > 0 ? 1 - endZoom * 3 : 0) * (1 - dim) }}>AI와 하던 대화 · 받은 답</div>
        <div style={{ position: 'absolute', left: 640, width: 260, textAlign: 'right', top: BOX.y - 86, fontFamily: KO, fontWeight: 800, fontSize: 62, letterSpacing: -1, color: INK, fontVariantNumeric: 'tabular-nums', opacity: fixed ? 0 : 1 - dim }}>{clock(min)}</div>
        {/* 상자 */}
        <div style={{ position: 'absolute', left: BOX.x, top: BOX.y, width: BOX.w, height: BOX.h, borderRadius: 22, background: 'rgba(255,255,255,0.05)', border: '3px solid rgba(244,241,234,0.5)', boxSizing: 'border-box' }} />
        {/* 1막 답 종이(상자 안) */}
        {!fixed
          ? Array.from({ length: N }, (_, i) => {
              const c = cell(i);
              const p = prog(f, born1(i), 7);
              if (p <= 0) return null;
              const k = i === 9 ? 1 : -1;
              if (k >= 0 && sal(k) > 0) return null;
              return <Sheet key={i} x={c.x} y={c.y + (1 - p) * 26} o={p} s={mix(0.7, 1, p)} />;
            })
          : null}
        <Shutter p={shut} see={see} hide={dim} />
        {/* 상자 밖: 질문지 셋(답 칸이 빈 종이) */}
        {qO > 0
          ? [0, 1, 2].map((k) => {
              const x = 110 + k * 280;
              const got = k === 0 ? 1 : k === 1 ? sal(1) : 0;
              return (
                <div key={k} style={{ position: 'absolute', left: x, top: ROW.y, width: 250, height: ROW.h, opacity: qO, background: PAPER, borderRadius: 8, boxShadow: '0 16px 26px rgba(0,0,0,0.5)', boxSizing: 'border-box', padding: '16px 24px', fontFamily: KO, color: '#1B1D21', transform: `rotate(${[-2, 1.2, -1][k]}deg)` }}>
                  <div style={{ fontWeight: 800, fontSize: 40, letterSpacing: -1, lineHeight: 1.1 }}><span>질문 {k + 1}</span><span style={{ display: 'block', fontWeight: 700, fontSize: 30, opacity: 0.6, marginTop: 4 }}>{k === 0 ? '답 있음' : k === 1 ? (got >= 1 ? '답 찾음' : '답 없음') : rewrite >= 1 ? '다시 물어 받음' : '답 없음'}</span></div>
                  {[0.92, 0.78, 0.6].map((l, i) => {
                    const fill = k < 2 ? (got >= 1 ? 1 : 0) : prog(rewrite, 0.15 + i * 0.25, 0.3, (v) => v);
                    return <div key={i} style={{ height: 15, marginTop: 15, borderRadius: 4, boxSizing: 'border-box', border: fill > 0 ? 'none' : '2px dashed #9A968C', background: fill > 0 ? '#2A2D33' : `rgba(154,150,140,${0.1 + 0.22 * breathe})`, width: `${l * 100 * (k < 2 || fill <= 0 ? 1 : fill)}%`, opacity: 0.85 }} />;
                  })}
                </div>
              );
            })
          : null}
        {/* 건져 나오는 두 장 */}
        {!fixed
          ? [1].map((k) => {
              const p = sal(k);
              if (p <= 0 || p >= 1) return null;
              const c = cell(9);
              return <Sheet key={k} x={mix(c.x, 190 + k * 280, p)} y={mix(c.y, ROW.y + 60, p)} rot={mix(0, -8 + k * 14, p)} />;
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
              return <Sheet key={i} x={mix(c.x, s.x, p)} y={mix(c.y, s.y, p) - Math.sin(Math.PI * p) * 40} o={a} rot={mix(0, -5 + (i % 3) * 5, p) + endZoom * (i - 8.5) * 1.1} s={mix(0.7, 1, a)} />;
            })}
          </>
        ) : null}
      </AbsoluteFill>

      {asking ? <AbsoluteFill style={{ opacity: dim, background: `radial-gradient(520px 900px at ${mix(-150, 1230, (t - T.newAi) / (T.salvage - T.newAi))}px 1000px, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0) 100%)` }} /> : null}
      {zoomQ > 0 ? <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 760, opacity: Math.min(1, zoomQ * 1.6), background: `linear-gradient(to bottom, ${BG} 0px, ${BG} 640px, rgba(17,19,22,0) 760px)` }} /> : null}
      {!bare ? (
        <>
          <Head from={0} to={F(T.slam)} lines={['아침 7시, AI한테 맡긴 일', '답이 대화 안에 쌓이다가']} size={84} step={F(1.6)} />
          <Head from={F(T.slam)} to={F(T.left)} lines={['10시 26분', '한도로 멈췄다']} size={110} step={1} />
          <Head from={F(T.left)} to={F(T.inside)} lines={['이어 받은 AI 앞엔', '질문지와 답 몇 장뿐']} size={88} />
          <Head from={F(T.inside)} to={F(T.newAi)} lines={['나머지 답은', '멈춘 대화 안에']} />
          <Head from={F(T.newAi)} to={F(T.salvage)} lines={['그 대화를 모르는 새 AI는', '이렇게 답한다']} size={78} />
          <Ask from={F(T.newAi)} ans={F(T.answer)} to={F(T.salvage)} />
          <Head from={F(T.salvage)} to={F(T.fix)} lines={['이어 받은 AI가 찾은 답만 건지고', '나머지는 다시 물어 받았다']} size={66} />
          <Head from={F(T.fix)} to={F(T.flow)} lines={['그래서 일을 맡길 때', '붙이는 한 줄']} />
          <Head from={F(T.flow)} to={F(T.slam2)} lines={['“답 받는 자리에서', <span key="u">바로 <U>파일</U>에 적어”</span>]} />
          <Head from={F(T.slam2)} to={TOTAL} lines={[<span key="u">또 멈춰도 <U>이 파일</U>로</span>, '어디까지 했는지 안다']} size={84} step={9} />
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
            : [T.answer, T.salvage + 1.0, T.salvage + 3.3].map((s) => (
                <Sequence key={`o${s}`} from={F(s)}>
                  <Audio src={staticFile('sfx/tok.wav')} volume={0.8} />
                </Sequence>
              ))}
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
