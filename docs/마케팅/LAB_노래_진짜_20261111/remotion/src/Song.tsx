// LAB 21:00 노래 가사판(2026-11-11 v2, 리듬 한국어 준비안 「라」 줄).
// 화면 문법은 만족 사례 S16(관용구 퀴즈 Remotion 재구성판 — 「너무 훌륭한데?? 대박이다」)을 따른다: 따뜻한 오프화이트 바탕 · 거의 검정 글자 ·
// 강조색은 코랄 하나 · 상자 없는 큰 글자가 박에 맞춰 바뀌고 튕김 없는 스프링으로 자리 잡는다. 낱말 노래의 짜임(음절마다 한 박 →
// 이어 부르면 뜻(소리 뒤) → 반주만 흐르는 네 차례)은 한글 노래 「첫 인사」 틀(가이드 §3 「낱말 노래 틀」) 그대로다.
// v1(흰 둥근 판 · 테두리 칸 · 검정 알약)은 맹검에서 「범용 학습 앱 템플릿」으로 기각 — 칸 · 판 · 그림자를 걷고 글자 자체로 보인다.
// v2(그림 카드 + 글 자리)는 「그림을 끼운 템플릿」(카드 모서리 · 그림자가 둘을 가름)으로 기각 — v3는 그림이 아래로 바탕에 스며들어 한 장이 된다.
// 위: 그림(stage.img = 장면 속 몽글 · stage.pic = 낱말 그림만 — 11-11 유호님이 mongle을 고르셨다). 아래: 글자 자리. 맨 아래: 박 막대
// (네 차례 때 손뼉 칠 박을 켠다). 안전 영역(S16): 글은 y ≤ 1536 · x ≤ 930. 화면에 AI 도구 이름 · 계정 이름을 쓰지 않는다.
// 언어판 장치는 퀴즈 은행 틀(언어 프로필 · fitBox · LOC 글꼴)을 그대로 쓴다. 0프레임에 이미 다 보인다(되풀이 재생 · 표지).
import { Audio } from '@remotion/media';
import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, interpolateColors, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { KO, LOC } from './fonts';
import { fitBox, profileFor } from './lang';
import { SONG, type Part, type SongDoc } from './songDoc';

const W = 1080;
// S16 theme 그대로 — 한 화면에 강조색 하나
const C = {
  bg: '#F2EFE9',
  ink: '#111112',
  muted: '#6F6A63',
  hair: 'rgba(17,17,18,0.10)',
  ghost: 'rgba(17,17,18,0.13)',
  pending: 'rgba(17,17,18,0.32)', // 다리 글의 아직 안 읽은 낱말(v3 맹검 — 0.13은 「비활성 메뉴」처럼 묻혔다)
  accent: '#F96859',
  accentInk: '#C9382A',
};
const PAD = 96;
export const REAL_LEAD = 0.5; // 진짜 속도 딱지가 그 구간보다 먼저 뜨는 초(아래 label)
const RIGHT = 930; // 오른쪽 단추 열
const TEXT_W = RIGHT - PAD;
const CARD = { x: 0, y: 0, w: W, h: 1000, fade: 260 }; // 위 전체 폭, 아래 fade px은 바탕으로 스민다(위 269px은 앱 머리 자리라 그림만)
const Y = { label: 960, glyph: 1040, meter: 1566 }; // 글은 1536 안, 박 막대(글 아님)는 그 아래
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);

/** 쾅: 0프레임에 이미 다 보이는 크기에서 제자리로(블러 · 페이드 없이) — S16 slam. */
const slam = (f: number, at: number, fps: number, from = 1.12) => {
  if (f < at) return 1;
  const s = spring({ frame: f - at, fps, config: { damping: 20, stiffness: 220, mass: 0.6 } });
  return from - (from - 1) * s;
};
/** 블러 인 한 조각의 모양(S16 BlurIn) */
const blurIn = (f: number, at: number, fps: number, rise = 26, blur = 6) => {
  // 흐림은 작게 · 빨리(v2 맹검 — 14px 흐림이 「얼룩처럼」 읽혔다)
  const s = spring({ frame: f - at, fps, config: { damping: 22, stiffness: 200, mass: 0.6 } });
  return { opacity: interpolate(s, [0, 0.6], [0, 1], clamp), filter: `blur(${(1 - s) * blur}px)`, translate: `0 ${(1 - s) * rise}px` } as React.CSSProperties;
};
/** 따옴표 안 띄어쓰기는 줄을 바꾸지 않는다(「I'm / hungry」로 갈리지 않게). */
const keepQuoted = (s: string) => s.replace(/([“"«「『])([^”"»」』]+)([”"»」』])/g, (_m, a, b, c) => a + b.replace(/ /g, '\u00A0') + c);
/** 두 글자 이하 낱말(in · to · a …)은 다음 낱말과 한 줄에(「in / your language?」로 갈리지 않게). */
const glueShort = (s: string) => s.replace(/(^|\s)(\S{1,2}) (?=\S)/gu, (_m, sp, w) => `${sp}${w}\u00A0`);

/** 마지막 박에서 지난 초(첫 박 전이면 큰 값) */
const sinceBeatPos = (doc: SongDoc, t: number) => {
  if (t < doc.first) return 99;
  const b = 60 / doc.bpm;
  return (t - doc.first) % b;
};

type Glyph = { mode: 'ghost' | 'on' | 'done' | 'ask'; scale: number };

function glyphStates(doc: SongDoc, f: number, fps: number): { glyphs: Glyph[]; part: Part } {
  const t = f / fps;
  const n = doc.syl.length;
  const part = doc.parts.find((p) => t >= p.t && t < p.end) ?? doc.parts[doc.parts.length - 1];
  const sung = doc.parts.some((p) => (p.kind === 'chop' || p.kind === 'whole' || p.kind === 'real') && p.t <= t);
  const glyphs: Glyph[] = Array.from({ length: n }, () => ({ mode: sung ? 'done' : 'ghost', scale: 1 }));
  const at = (sec: number) => Math.round(sec * fps);
  if (part.kind === 'chop') {
    // 처음 한 바퀴의 끊어 부르기에서는 아직 안 부른 음절을 흐린 글자로(노래방처럼 부른 데까지 짙어진다)
    const firstPass = !doc.parts.some((p) => (p.kind === 'chop' || p.kind === 'whole' || p.kind === 'real') && p.t < part.t);
    if (firstPass) part.at.forEach((a, i) => { if (i < n && t < a) glyphs[i] = { mode: 'ghost', scale: 1 }; });
    // 낱말을 두 번 끊어 부르면(메들리 B 「가! 자! 가! 자!」) at이 음절 수보다 길다 — 음절을 차례로 돌려 켠다(한 번이면 예전과 같다)
    part.at.forEach((a, i) => {
      const g = i % n;
      if (t < a) return;
      glyphs[g] = { mode: 'on', scale: slam(f, at(a), fps, 1.14) };
      const next = part.at[i + 1];
      if (next !== undefined && t >= next) glyphs[g] = { mode: 'done', scale: 1 };
    });
    // 아직 안 부른 칸: 처음 끊어 부르기 전이면 흐린 글자, 한 번 부른 뒤면 검정 그대로
  }
  if (part.kind === 'whole' || part.kind === 'real') {
    const last = [...part.at].reverse().find((a) => t >= a);
    if (last !== undefined) for (let i = 0; i < n; i++) glyphs[i] = { mode: 'done', scale: slam(f, at(last) + i * 2, fps, part.kind === 'real' ? 1.05 : 1.08) };
  }
  if (part.kind === 'rest') {
    const beat = 60 / doc.bpm;
    const k = Math.floor((t - doc.first) / beat);
    const beatAt = Math.max(doc.first + k * beat, part.t);
    for (let i = 0; i < n; i++) glyphs[i] = { mode: 'ask', scale: slam(f, at(beatAt), fps, 1.07) };
  }
  return { glyphs, part };
}

export const Song: React.FC<{ doc?: SongDoc }> = ({ doc = SONG }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = f / fps;
  const loc = doc.loc;
  const prof = profileFor(loc.lang);
  const { glyphs, part } = glyphStates(doc, f, fps);
  const n = doc.syl.length;
  const gap = n <= 3 ? 44 : 32;
  const G = Math.min(250, Math.floor((TEXT_W - (n - 1) * gap) / n / 0.98)); // 음절 글자 크기
  const fr = (sec: number) => Math.round(sec * fps);

  const count = doc.parts.find((p) => p.kind === 'count');
  const firstWhole = doc.parts.find((p) => p.kind === 'whole');
  const endPart = doc.parts.find((p) => p.kind === 'end');
  // 카운트인 → 음절 이음: 끝 0.3초 동안 다리 글은 위로 빠지고 음절 줄은 아래에서 올라와 겹친다(v5 맹검 — 통째로 바뀌는 「슬라이드 넘김」)
  const swapEase = { ...clamp, easing: Easing.bezier(0.65, 0, 0.35, 1) };
  const swapOut = count ? interpolate(t, [count.end - 0.3, count.end - 0.12], [0, 1], swapEase) : 1; // 다리 글이 먼저 빠지고
  const swap = count ? interpolate(t, [count.end - 0.2, count.end], [0, 1], swapEase) : 1; // 음절 줄이 뒤따른다
  const showBridge = !!count && t < count.end + 0.02;
  const showGlyphs = !count || t >= count.end - 0.3;
  const inEnd = !!endPart && t >= endPart.t;
  const meanAt = firstWhole ? firstWhole.at[0] + 0.25 : Infinity; // 뜻은 소리 뒤
  const leave = inEnd ? interpolate(f, [fr(endPart!.t), fr(endPart!.t) + 8], [0, 1], { ...clamp, easing: EASE_OUT }) : 0;

  // 박 — 첫 박부터 센다(되풀이 재생에서도 같은 자리)
  const beatLen = 60 / doc.bpm;
  const k = Math.floor((t - doc.first) / beatLen);
  const beatIdx = ((k % 4) + 4) % 4;
  const beatAt = doc.first + k * beatLen;
  const sinceBeat = t - beatAt;
  const endT = doc.parts.find((p) => p.kind === 'end')?.t ?? doc.duration;
  // 천천히 다가가다가 끝 물음에서 조금 더(멈춘 끝 화면이 되지 않게)
  const zoom = interpolate(t, [0, endT, doc.duration], [1.0, 1.035, 1.07], { ...clamp, easing: Easing.inOut(Easing.sin) });
  const flash = Math.exp(-sinceBeatPos(doc, t) / 0.12); // 박 직후 1 → 0
  const breath = 1 + 0.006 * Math.max(0, 1 - sinceBeat / 0.2);

  const readMax = loc.read.reduce((a, b) => (b.length > a.length ? b : a), '');
  const readSize = fitBox(readMax, prof, G + gap - 8, 52, 28, 1).size;
  // 진짜 속도 딱지는 그 구간보다 REAL_LEAD초 먼저 뜬다 — 진짜 속도 구간이 0.6~1.1초뿐이라(메들리 A) 딱지를 읽을 틈이 없었다(11-12 글자 검사).
  // 「이제 진짜 속도!」를 미리 알리는 자리라 이어 부르기 끝에 걸쳐도 뜻이 맞다. 판본 지도의 real 줄 시각도 같은 값(새편.mjs REAL_LEAD).
  const realPart = doc.parts.find((p) => p.kind === 'real');
  const realLead = !!realPart && part.kind !== 'rest' && t >= realPart.t - REAL_LEAD && t < realPart.end;
  const label = part.kind === 'rest' ? (part.mode === 'clap' ? loc.clap : loc.say) : realLead ? loc.real : '';
  const labelAt = realLead ? realPart!.t - REAL_LEAD : part.t;
  const labelSize = label ? fitBox(label, prof, TEXT_W, 76, 40, 1).size : 0;
  const meanSize = fitBox(`—— ${loc.mean}`, prof, TEXT_W, 86, 44, 1).size;
  const img = doc.stage.mode === 'mongle' ? doc.stage.img : doc.stage.pic;

  return (
    <AbsoluteFill style={{ background: C.bg, overflow: 'hidden', ['--loc-font' as string]: prof.font }}>
      <Audio src={staticFile(doc.audio)} />

      {/* 그림 카드 — 장면(몽글) 또는 낱말 그림 */}
      {img ? (
        <div style={{ position: 'absolute', left: CARD.x, top: CARD.y, width: CARD.w, height: CARD.h, overflow: 'hidden',
          maskImage: `linear-gradient(to bottom, #000 ${CARD.h - CARD.fade}px, transparent ${CARD.h}px)`,
          WebkitMaskImage: `linear-gradient(to bottom, #000 ${CARD.h - CARD.fade}px, transparent ${CARD.h}px)`, scale: `${breath}`, transformOrigin: '50% 0%' }}>
          <Img src={staticFile(img)} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: doc.stage.focus ?? '48% 50%',
            transformOrigin: '35% 45%', scale: `${zoom}` }} />
        </div>
      ) : null}

      {/* 카운트인 — 이 낱말을 쓰는 상황 한 줄(0프레임에 이미 보인다) */}
      {showBridge ? (() => {
        const box = fitBox(loc.bridge, prof, TEXT_W, 100, 56, 4);
        // 읽는 빠르기로 낱말마다 짙어진다 — 첫 박부터 카운트인 끝 0.7초 전까지(0프레임에는 흐리게 다 보인다 · 표지)
        const words = box.lines.map((l) => l.split(/(\s+)/).filter((x) => x !== ''));
        const total = words.flat().filter((w) => !/^\s+$/.test(w)).length;
        const span = Math.max(0.5, count!.end - 0.7 - doc.first);
        let k2 = -1;
        return (
          <div style={{ position: 'absolute', left: PAD, top: Y.label + 8, width: TEXT_W, fontFamily: LOC, fontWeight: 800, fontSize: box.size, lineHeight: 1.12,
            letterSpacing: '-0.025em', opacity: 1 - swapOut, translate: `0 ${-36 * swapOut}px` }}>
            {words.map((ws, i) => (
              <div key={i}>
                {ws.map((w, j) => {
                  if (/^\s+$/.test(w)) return <span key={j}>{w}</span>;
                  k2 += 1;
                  const at2 = doc.first + (span * k2) / total;
                  const on = interpolate(t, [at2, at2 + 0.18], [0, 1], clamp);
                  return <span key={j} style={{ color: interpolateColors(on, [0, 1], [C.pending, C.ink]) }}>{w}</span>;
                })}
              </div>
            ))}
          </div>
        );
      })() : null}

      {/* 딱지 줄 — 네 차례(손뼉 · 말하기) · 진짜 속도 */}
      {label && !inEnd ? (
        <div key={label} style={{ position: 'absolute', left: PAD, top: Y.label - 34, width: TEXT_W, fontFamily: LOC, fontWeight: 800, fontSize: labelSize,
          letterSpacing: '-0.02em', color: C.ink, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: labelSize * 0.32, ...blurIn(f, fr(labelAt), fps) }}>
          {/* 강조색은 코랄 하나 — 딱지 글은 검정, 앞의 점만 코랄(v3 맹검: 짙은 빨강 · 코랄 · 사이 색이 갈려 탁했다) */}
          <span style={{ width: labelSize * 0.42, height: labelSize * 0.42, borderRadius: '50%', background: C.accent, flex: 'none' }} />
          {label}
        </div>
      ) : null}

      {/* 음절 — 상자 없이 글자 그대로. 흐림 → 부를 때 코랄로 쾅 → 검정. 네 차례엔 속이 빈 글자가 박마다 뛴다 */}
      {showGlyphs ? (
        <div style={{ position: 'absolute', left: PAD, top: Y.glyph, display: 'flex', gap, opacity: (1 - leave) * swap, translate: `0 ${36 * (1 - swap) - 24 * leave}px` }}>
          {glyphs.map((g, i) => {
            // 네 차례(ask): 검정 글자가 박마다 코랄로 번쩍 — 손뼉 · 말할 자리(속 빈 테두리는 가변 글꼴의 겹친 획이 드러났고, 회색은 「꺼진 화면」으로 읽혔다)
            const color = g.mode === 'on' ? C.accent : g.mode === 'ghost' ? C.ghost : g.mode === 'ask' ? (flash > 0.3 ? C.accent : C.ink) : C.ink; // 사이 색(적갈색) 없이 켜고 끈다
            return (
              <div key={i} style={{ width: G * 0.98, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ fontFamily: KO, fontWeight: 900, fontSize: G, lineHeight: 1, letterSpacing: '-0.04em', color,
                  scale: `${g.scale}`, transformOrigin: '50% 85%' }}>
                  {doc.syl[i]}
                </div>
                <div style={{ marginTop: 12, fontFamily: LOC, fontWeight: 500, fontSize: readSize, color: g.mode === 'on' ? C.accentInk : C.muted,
                  opacity: g.mode === 'ghost' ? 0 : 1, whiteSpace: 'nowrap' }}>{loc.read[i] ?? ''}</div>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* 뜻 — 이어 부른 소리 뒤에 블러 인 */}
      {t >= meanAt && !inEnd ? (
        <div style={{ position: 'absolute', left: PAD, top: Y.glyph + G + readSize + 40, width: TEXT_W, fontFamily: LOC, fontWeight: 500, fontSize: meanSize,
          letterSpacing: '-0.03em', color: part.kind === 'rest' ? C.muted : C.ink, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: meanSize * 0.34,
          ...blurIn(f, fr(meanAt), fps) }}>
          {/* 「=」 수식 대신 짧은 코랄 줄(v3 맹검 — 굵은 영문 + 코랄 등호가 학습지 뜻풀이처럼 읽혔다) */}
          <span style={{ width: meanSize * 0.62, height: Math.max(6, meanSize * 0.09), borderRadius: 4, background: C.accent, flex: 'none' }} />
          {loc.mean}
        </div>
      ) : null}

      {/* 끝 물음 — 낱말과 뜻을 한 줄로 접고, 물음을 크게 */}
      {inEnd ? (() => {
        const q = glueShort(keepQuoted(loc.end));
        const box = fitBox(q, prof, TEXT_W, 74, 48, 4); // 물음은 한 단계 작게 — 기억할 것은 위의 낱말(v4 맹검: 「배고파가 작은 설명표로 밀린다」)
        const at0 = fr(endPart!.t);
        const qWords = q.split(/( +)/).filter((x) => x !== ''); // 보통 띄어쓰기로만 — 붙여 둔 NBSP(\u00A0)는 낱말 안에 남긴다
        let qk = -1;
        return (
          <>
            {/* 낱말 아래 줄에 뜻(v6 맹검 — 옆에 작게 붙인 뜻이 「매달린 주석」으로 읽혔다) */}
            <div style={{ position: 'absolute', left: PAD, top: Y.label - 10, display: 'flex', flexDirection: 'column', gap: 10, whiteSpace: 'nowrap', ...blurIn(f, at0, fps, 18, 10) }}>
              <span style={{ fontFamily: KO, fontWeight: 900, fontSize: Math.min(168, G * 0.68), lineHeight: 1, letterSpacing: '-0.04em', color: C.accent }}>{doc.word}</span>
              <span style={{ fontFamily: LOC, fontWeight: 500, fontSize: Math.min(52, meanSize), lineHeight: 1.1, color: C.muted }}>{loc.mean}</span>
            </div>
            {/* 줄은 균형 있게(「in」이 홀로 남지 않게 — text-wrap: balance), 낱말마다 차례로 */}
            <div style={{ position: 'absolute', left: PAD, top: Y.label - 10 + Math.min(168, G * 0.68) + 10 + Math.min(52, meanSize) * 1.1 + 58, width: TEXT_W, fontFamily: LOC, fontWeight: 800, fontSize: box.size, lineHeight: 1.12,
              letterSpacing: '-0.025em', color: C.ink, textWrap: 'balance' } as React.CSSProperties}>
              {(() => {
                // 따옴표 안 말(그 낱말의 뜻)만 코랄 — 끝 물음의 강약, 박마다 살짝 뛴다(멈춘 끝 화면이 되지 않게)
                let inQ = false;
                return qWords.map((w, i) => {
                  if (/^ +$/.test(w)) return <span key={i}>{w}</span>;
                  qk += 1;
                  const opens = /^[“"«「『]/.test(w);
                  const closes = /[”"»」』][?!.,…]*$/.test(w);
                  const hot = inQ || opens;
                  if (opens && !closes) inQ = true;
                  if (closes) inQ = false;
                  const beatPop = hot && f >= at0 + 12 ? 1 + 0.035 * flash : 1;
                  return <span key={i} style={{ display: 'inline-block', color: hot ? C.accent : C.ink, scale: `${beatPop}`, transformOrigin: '50% 80%',
                    ...blurIn(f, at0 + 4 + qk * 2, fps, 22) }}>{w}</span>;
                });
              })()}
            </div>
          </>
        );
      })() : null}

      {/* 손뼉 동그라미 넷 — 네 차례(반주만 흐르는 마디)에만. 지금 박이 코랄로 켜진다(v3까지 늘 있던 가는 박 막대는 「페이지 표시」로 읽혔다) */}
      {part.kind === 'rest' ? (() => {
        const grow = interpolate(f, [fr(part.t), fr(part.t) + 8], [0, 1], { ...clamp, easing: EASE_OUT });
        const D = 72;
        return (
          <div style={{ position: 'absolute', left: PAD, top: Y.meter - D / 2, display: 'flex', gap: 28, opacity: grow, translate: `0 ${(1 - grow) * 16}px` }}>
            {[0, 1, 2, 3].map((b) => {
              const lit = b === beatIdx;
              const pop = lit ? 1 + 0.16 * Math.exp(-sinceBeat / 0.09) : 1;
              return <div key={b} style={{ width: D, height: D, borderRadius: '50%', background: lit ? C.accent : 'transparent',
                boxShadow: lit ? 'none' : `inset 0 0 0 5px ${C.hair}`, scale: `${pop}` }} />;
            })}
          </div>
        );
      })() : null}
    </AbsoluteFill>
  );
};
