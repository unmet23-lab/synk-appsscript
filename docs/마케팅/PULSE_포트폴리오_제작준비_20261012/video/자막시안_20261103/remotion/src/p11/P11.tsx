// 11번 첨벙댕 자막 · 모션그래픽 시안 세 판 — 같은 화면 · 같은 내레이션 위에 결만 바꾼다(2026-11-03)
//   A 「S42 결」: 개 · 사람 뒤로 들어가는 큰 낱말(SAM 3 마스크) + 앞에 뜨는 카드 + 문짝 전환 + 얇은 머리 · 발 줄
//   B 「색 블록 박자」: 핵심 낱말을 레몬 블록 위 큰 글자로, 나머지는 남색 띠 작은 글자로 — 말하는 박에 맞춰 바뀐다
//   C 「말풍선 · 쇼핑 카드」: 보호자 말이 메신저 말풍선으로 쌓이고, 조끼가 나오면 담기 카드가 올라온다
// 화면 · 소리는 git 밖 public(p11/picture.mp4 · sound_narr.wav), 마스크는 사람개분리.py가 만든 p11/cut/<컷>/.
import React from 'react';
import { AbsoluteFill, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { Audio } from '@remotion/media';
import { EN, KO } from '../lib/fonts';
import { EXPO, life, pop, ramp } from '../lib/motion';
import { Door, MaskCut, maskAt, ProbeMeta, probeChars, Subject } from '../lib/subject';
import { LINES } from './timing';
import masks from './masks.json';

export const P11_FRAMES = Math.round(22.06 * 24);
export const P11_DOG_FRAMES = 574;   // 고글 개 끝 — 9번 컷 + 물 판 끝까지(23.92초, pet-ad 최종편집.py dog_picture와 같은 값)
const TAG_AT = 21.35;   // 튜브 글자가 다 뜬 뒤 「반려견 구명조끼」(딩과 같은 자리)
const FPS = 24;
const INK = '#0E1320', PAPER = '#F6F3EA', LEMON = '#FFD43B', NAVY = '#17224D';
const abs = (x: number, y: number, w?: number, h?: number): React.CSSProperties => ({ position: 'absolute', left: x, top: y, width: w, height: h });
const last = <T,>(a: T[]): T | undefined => a[a.length - 1];
// 화면 글자에는 마침표를 쓰지 않는다(유호님 11-03) — 물음표 · 느낌표 · 쉼표는 뜻이라 둔다
const noDot = (s: string) => s.replace(/\.$/, '');
// 18자가 넘는 문장은 가운데에 가장 가까운 낱말 사이에서 두 줄로 나눈다
const splitAt = (words: { w: string }[]) => {
  const full = words.map((x) => x.w).join(' ');
  if (full.length <= 18) return words.length;
  let best = 1, gap = 1e9, acc = 0;
  words.forEach((x, i) => { acc += x.w.length + 1; const d = Math.abs(acc - full.length / 2); if (i < words.length - 1 && d < gap) { gap = d; best = i + 1; } });
  return best;
};
const lineAt = (t: number) => last(LINES.filter((l) => t >= l.at - 0.05 && t < l.end + 0.35));
// 낱말 시각 — timing.ts(내레이션시각.py)에서 문장 li의 낱말 wi가 들리는 초. 목소리를 바꿔 다시 재면 시안이 저절로 따라간다
const w = (li: number, wi: number) => LINES[li].words[wi].t;
const endOf = (li: number) => LINES[li].end;

// ── 마스크 컷(피사체를 다시 얹어 뒤 글자를 가림 — ../lib/subject)
const MASKS = (masks as MaskCut[]);
const masked = (t: number) => !!maskAt(MASKS, t);

// 눈금 고리(S42 Ring) — 천천히 돈다
const Ring: React.FC<{ t: number; style: React.CSSProperties; color: string }> = ({ t, style, color }) => (
  <svg viewBox="0 0 600 600" style={style}>
    <g transform={`rotate(${t * 13} 300 300)`}>
      {Array.from({ length: 48 }, (_, i) => <path key={i} d={i % 4 === 0 ? 'M300 16V47' : 'M300 20V35'} stroke={color} strokeWidth={i % 4 === 0 ? 3 : 2} opacity={i % 4 === 0 ? 0.75 : 0.3} transform={`rotate(${i * 7.5} 300 300)`} />)}
    </g>
  </svg>
);

// ── A 「S42 결」
// 큰 낱말 자리(11-03 밤 유호님 「처음에 외계인이 강아지 뒤로 가려져서 잘 안 보여 · 중간중간 가려져서 안 보이는 게 꽤 있어」):
//   ../가림검사.py로 프레임마다 글자별 가림 · 바탕 대비를 재고(여덟 낱말 가운데 여섯이 걸림) ../자리찾기.py로 자리 · 크기 · 색 · 층을 골랐다.
//   뒤 글자는 피사체가 글자마다 12% 넘게 덮지 않는 자리에만 둔다(S42 깊이). 피사체가 위 · 가운데를 다 채운 컷(c01 · c09)은 앞에 둔다.
//   짙은 바탕(개 몸) 위는 밝은 글자(light)에 옅은 그림자, x는 정렬(기본 왼쪽)
// 바닷가: 첫 컷(c01)은 밀려 들어오는 개 머리가 1.4초부터 왼쪽 위를 다 덮어 「바」만 0.8초 보였다(11-03 섞은 판 검수) → 다음 컷 첫 프레임에 얹는다
const cutEnd = (id: string) => MASKS.find((c) => c.cut === id)!.to;
const cutStart = (id: string) => MASKS.find((c) => c.cut === id)!.from;
const BIG_A: { w: string; a: number; b: number; y: number; size: number; front?: boolean; x?: 'c' | 'r'; light?: boolean; halo?: boolean; rpad?: number }[] = [
  { w: '외계인', a: w(0, 0), b: w(0, 4), y: 190, size: 240, front: true },     // 귀 · 머리털이 위를 다 덮어 뒤로는 「계 · 인」이 절반 넘게 가려졌다 → 하늘 위 앞
  { w: '바닷가', a: cutEnd('c01'), b: endOf(0) + 0.1, y: 250, size: 250 },
  // 3번 컷은 마스크가 없어 가림검사가 못 본다 — 왼쪽(y 300)이면 「사람들이 보면 깜짝」의 그 먼 두 사람을 글자가 덮었다(11-04 크몽 세션 검수) → 오른쪽 하늘, 컷이 바뀌면 함께 사라진다
  { w: '깜짝', a: w(1, 3), b: cutStart('c04'), y: 176, size: 270, x: 'r', rpad: 37 },   // 190이면 아래 획이 어두운 바다에 닿았다 · rpad: 오른쪽 끝을 머리 줄(1008)에 맞춘다(11-04 크몽 세션 P3 — 다음에 구울 때 들어간다)
  { w: '특별한 걸', a: w(2, 2), b: w(3, 0), y: 410, size: 165 },               // 남자 머리 왼쪽 벽 — 180이면 「걸」이 얼굴에 닿았다(11-04 크몽 세션 검수), 165면 덮임 0%
  { w: '튼튼', a: w(4, 2), b: w(5, 0), y: 290, size: 280, x: 'r' },            // 남자 머리 오른쪽 벽으로 — 전에는 검은 머리 위에 얹혀 묻혔다
  { w: '번쩍', a: w(5, 5), b: endOf(5) + 0.1, y: 430, size: 240, front: true }, // 서 있는 컷 · 들어 올리는 컷 모두 왼쪽 복도 위(전에는 민소매 위에 묻힘)
  { w: '멋있게', a: w(6, 2), b: endOf(6) + 0.1, y: 1130, size: 270, front: true, x: 'c', light: true },   // 남색은 회색 개 몸 · 남색 끈에 묻혔다
  // 카메라가 들어가 조끼 아래 끝이 1220(18초) → 1296(19초)까지 내려와 밝은 글자 위쪽이 노랑에 묻혔다(11-04 Fable). 더 내리면 옅은 배 · 수건이라 대비가 더 떨어져(자리찾기.py) 조금만 내리고 글자 둘레만 어둡게 깐다 — 가림검사.py는 후광 없는 화면으로 재서 「손볼 것」으로 나오지만 최종본 프레임으로 재면 둘레 91% 이상이 3:1을 넘는다
  { w: '외계인?', a: w(7, 1), b: endOf(7) + 0.08, y: 1236, size: 250, front: true, x: 'c', light: true, halo: true },   // 1200 · 270이면 조끼 아랫단을 덮었다(11-04 Fable)
];
type Big = (typeof BIG_A)[number];
const behind = (t: number, big: Big) => masked(t) && !big.front;
const bigBox = (t: number, big: Big): React.CSSProperties => {
  const p = pop(t, big.a);
  const out = 1 - ramp(t, big.b - 0.12, 0.12);
  return { ...abs(56, big.y, 980 - (big.rpad ?? 0)), textAlign: big.x === 'c' ? 'center' : big.x === 'r' ? 'right' : 'left', fontFamily: KO, fontWeight: 800, fontSize: big.size, letterSpacing: '-0.05em', lineHeight: 1, opacity: ramp(t, big.a, 0.08, (x) => x) * out, transform: `translateY(${(1 - p) * 110}px)` };
};
// 가림 검사용(가림검사.py): 큰 낱말만 글자마다 다른 순색으로 검은 바탕에(../lib/subject 탐침)
const Probe: React.FC<{ t: number }> = ({ t }) => {
  const i = BIG_A.findIndex((b) => t >= b.a && t < b.b);
  if (i < 0) return null;
  const big = BIG_A[i];
  return (
    <>
      <ProbeMeta i={i} behind={behind(t, big)} light={big.light} />
      <div style={bigBox(t, big)}>{probeChars(big.w)}</div>
    </>
  );
};
// mix(A+B, 11-03 유호님 「A+B 섞어 보기」): A 그대로에 두 순간만 B의 레몬 블록 — 제품 이름(기울어진 카드 대신 큰 블록 한 방 → 특징 칩) · 끝 브랜드(아래 절반 레몬 판, 엄지 든 끝 그림은 위에 남김)
const LookA: React.FC<{ t: number; mix?: boolean; dogEnd?: boolean }> = ({ t, mix, dogEnd }) => {
  const big = BIG_A.find((b) => t >= b.a && t < b.b);
  const l = lineAt(t);
  const card = !mix && t >= w(3, 0) && t < w(5, 0);
  const chips = t >= w(4, 0) && t < w(5, 0);
  const end = t >= 19.33;
  return (
    <>
      {big && <div style={{ ...bigBox(t, big), zIndex: behind(t, big) ? 3 : 6, textShadow: big.halo ? '0 0 16px #0E1320b8, 0 0 44px #0E1320a0, 0 6px 26px #0E132090' : big.light ? '0 4px 28px #0E132070' : undefined, color: big.light ? PAPER : INK }}>{big.w}</div>}
      <Subject film="p11" cuts={dogEnd ? MASKS.filter((c) => c.cut !== 'c10' && c.cut !== 'c09') : MASKS} t={t} />{/* 고글 개 끝의 9번 컷은 판이 달라졌고 뒤로 가는 낱말도 없다 */}
      {/* 머리 줄 · 발 줄 */}
      {!(mix && t >= w(8, 3)) && <>
        {/* 흰 천장 위에서 머리 줄이 묻혀(11-04) 위쪽만 살짝 어둡게 깐다 */}
        <AbsoluteFill style={{ zIndex: 7, background: 'linear-gradient(#0009 0%, #0000 14%)' }} />
        <div style={{ ...abs(72, 96, 936, 60), zIndex: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: PAPER, textShadow: '0 1px 12px #000b' }}>
          <span style={{ fontFamily: KO, fontWeight: 700, fontSize: 36, letterSpacing: '-0.03em' }}>외계 · 3살</span>
          {mix ? <span style={{ fontFamily: KO, fontWeight: 700, fontSize: 28, letterSpacing: '-0.02em', opacity: 0.9 }}>첨벙댕</span> : <span style={{ fontFamily: EN, fontSize: 24, letterSpacing: '0.08em', opacity: 0.8 }}>SUMMER WATER DAY / 01</span>}
        </div>
        <div style={{ ...abs(72, 170, 936, 2), zIndex: 20, background: PAPER, opacity: 0.6 }} />
        <div style={{ ...abs(72, 1812, 936, 3), zIndex: 20, background: '#ffffff30' }}><div style={{ height: 3, width: `${Math.min(1, t / (dogEnd ? 23.92 : 22.06)) * 100}%`, background: LEMON }} /></div>
      </>}
      {/* 조끼 카드(앞) */}
      {card && (() => {
        const p = pop(t, w(3, 0) + 0.03, 0.5);
        return (
          <div style={{ ...abs(72, 1150, 600), zIndex: 12, background: LEMON, color: NAVY, borderRadius: 30, padding: '26px 36px 30px', boxShadow: '0 30px 80px #0005', transform: `translateY(${(1 - p) * 520}px) rotate(${(1 - p) * 8 - 2.5}deg)`, opacity: 1 - ramp(t, w(5, 0) - 0.14, 0.14) }}>
            <div style={{ fontFamily: EN, fontSize: 24, letterSpacing: '0.1em', display: 'flex', justifyContent: 'space-between' }}><span>NEW / 01</span><span>↗</span></div>
            <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 96, letterSpacing: '-0.05em', lineHeight: 1.02, marginTop: 14 }}>첨벙댕<br />구명조끼</div>
            {chips && <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>{['등 손잡이 2개', '반사 띠', '버클 끈'].map((c, i) => <span key={c} style={{ fontFamily: KO, fontWeight: 700, fontSize: 26, border: `2px solid ${NAVY}`, borderRadius: 40, padding: '8px 16px', opacity: ramp(t, w(4, 0) + 0.08 + i * 0.12, 0.2) }}>{c}</span>)}</div>}
          </div>
        );
      })()}
      {mix && t >= w(3, 0) && t < w(4, 0) && (() => {
        const p = ramp(t, w(3, 0), 0.16, EXPO);
        const punch = 1 + (1 - ramp(t, w(3, 0), 0.14)) * 0.08;
        return (
          <div style={{ ...abs(60, 1040, 960), zIndex: 21, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12, transform: `scale(${punch})`, transformOrigin: 'left bottom' }}>
            <div style={{ fontFamily: KO, fontWeight: 750, fontSize: 56, letterSpacing: '-0.03em', color: PAPER, background: NAVY, padding: '8px 20px 10px', borderRadius: 10, clipPath: `inset(0 ${(1 - p) * 100}% 0 0 round 10px)` }}>첨벙댕</div>
            <div style={{ fontFamily: KO, fontWeight: 900, fontSize: 230, letterSpacing: '-0.06em', lineHeight: 0.98, color: NAVY, background: LEMON, padding: '6px 22px 14px', borderRadius: 14, clipPath: `inset(0 ${(1 - p) * 100}% 0 0 round 14px)` }}>구명조끼</div>
          </div>
        );
      })()}
      {mix && t >= w(4, 0) && t < w(5, 0) && <div style={{ ...abs(72, 1360, 936), zIndex: 12, display: 'flex', gap: 12 }}>{['등 손잡이 2개', '반사 띠', '버클 끈'].map((c, i) => <span key={c} style={{ fontFamily: KO, fontWeight: 700, fontSize: 40, letterSpacing: '-0.02em', color: PAPER, background: NAVY, borderRadius: 40, padding: '10px 24px 12px', boxShadow: '0 8px 24px #0003', opacity: ramp(t, w(4, 0) + 0.05 + i * 0.12, 0.2), transform: `translateY(${(1 - ramp(t, w(4, 0) + 0.05 + i * 0.12, 0.3, EXPO)) * 30}px)` }}>{c}</span>)}</div>}
      {/* 「번쩍」 별 */}
      {!mix && t >= w(5, 5) && t < endOf(5) + 0.1 && <div style={{ ...abs(780, 720, 130, 130), zIndex: 14, borderRadius: '50%', background: LEMON, color: NAVY, display: 'grid', placeItems: 'center', fontSize: 70, transform: `scale(${pop(t, w(5, 5))}) rotate(${(t - w(5, 5)) * 70}deg)` }}>✳</div>}
      {/* 끝 */}
      {end && !mix && (() => {
        const p = pop(t, w(8, 3), 0.5);
        return (
          <>
            <div style={{ ...abs(56, 1250, 980), zIndex: 12, fontFamily: KO, fontWeight: 900, fontSize: 230, letterSpacing: '-0.06em', lineHeight: 1, color: LEMON, opacity: Math.min(1, p), transform: `translateY(${(1 - p) * 120}px)`, textShadow: '0 6px 0 #17224D' }}>첨벙댕</div>
            <Ring t={t} color={LEMON} style={{ ...abs(700, 1180, 330, 330), zIndex: 9, opacity: ramp(t, 19.5, 0.4) * 0.9 }} />
            <div style={{ ...abs(72, 1110, 620), zIndex: 12, opacity: ramp(t, 19.4, 0.3), transform: `translateY(${(1 - ramp(t, 19.4, 0.4)) * 60}px)` }}>
              <div style={{ fontFamily: EN, fontSize: 24, letterSpacing: '0.1em', color: PAPER, textShadow: '0 1px 10px #0009' }}>LIFE VEST FOR PETS</div>
              <div style={{ fontFamily: KO, fontWeight: 700, fontSize: 52, letterSpacing: '-0.03em', color: PAPER, marginTop: 10, textShadow: '0 2px 16px #000a' }}>물놀이 가는 날엔</div>
            </div>
          </>
        );
      })()}
      {/* 고글 개 끝 — 레몬 판을 버리고(유호님 11-04 「너무 슬롭같은데」) 화면에 구운 튜브 글자(pet-ad 끝합성.py) 아래 작은 이름표만. 「첨벙댕 / 구명조끼」 칩과 같은 꼴 */}
      {dogEnd && t >= TAG_AT && (() => {
        const p = ramp(t, TAG_AT, 0.2, EXPO);
        return <div style={{ ...abs(0, 1758, 1080), zIndex: 21, display: 'flex', justifyContent: 'center' }}><div style={{ fontFamily: KO, fontWeight: 750, fontSize: 44, letterSpacing: '-0.03em', color: PAPER, background: NAVY, padding: '8px 22px 10px', borderRadius: 10, clipPath: `inset(0 ${(1 - p) * 100}% 0 0 round 10px)` }}>반려견 구명조끼</div></div>;
      })()}
      {end && mix && !dogEnd && t >= w(8, 3) && (() => {
        const p = ramp(t, w(8, 3), 0.22, EXPO);
        const q = pop(t, w(8, 3) + 0.06, 0.42);
        return (
          // 판이 27%일 땐 조끼 아래를 잘라 끝에 제품보다 로고가 남았다(11-04 GPT 검수) → 22%로 낮춰 조끼를 다 보인다
          // 로고는 판 안에서 함께 오른다 — 따로 두니 판보다 먼저 떠 운동화 · 개 다리 위를 지나갔다(11-04 크몽 세션 검수)
          <div style={{ ...abs(0, 1920 - p * 420, 1080, 440), zIndex: 22, background: LEMON }}>
            <div style={{ ...abs(0, 16, 1080), textAlign: 'center', fontFamily: KO, fontWeight: 900, fontSize: 190, letterSpacing: '-0.07em', lineHeight: 1, color: NAVY, transform: `scale(${0.94 + 0.06 * Math.min(1, q)})` }}>첨벙댕</div>
            <div style={{ ...abs(0, 216, 1080), textAlign: 'center', fontFamily: KO, fontWeight: 700, fontSize: 42, color: NAVY }}>반려견 구명조끼</div>
          </div>
        );
      })()}
      {/* 말자막(S42 Caption 결) */}
      {l && (!end || (mix && t < w(8, 3))) && l !== LINES[3] && (() => {   // 3번 줄(「첨벙댕 구명조끼」)은 카드 · 블록이 같은 말을 크게 보여 준다
        // mix 끝 줄: 브랜드가 레몬 판으로 터지기 전까지 「물놀이 가는 날엔」만 상자에 — 밝은 글자를 화면에 띄웠더니 흰 반바지 · 문 위에 묻혔다(11-04)
        const ws = l === LINES[8] ? l.words.slice(0, 3) : l.words;
        const cut = splitAt(ws);
        const o = life(t, l.at - 0.05, l.end + 0.35, 0.18, 0.14);
        return <div style={{ ...abs(72, 1500, 936), zIndex: 25, textAlign: 'center', opacity: o }}><span style={{ fontFamily: KO, fontWeight: 650, fontSize: 52, lineHeight: 1.32, color: PAPER, background: '#0E1320e0', boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone', padding: '10px 22px', borderRadius: 10 }}>{ws.map((w, i) => <React.Fragment key={i}>{i === cut ? <br /> : null}<span style={{ color: w.key && t >= w.t ? LEMON : PAPER }}>{i === ws.length - 1 ? noDot(w.w).replace(/,$/, '') : noDot(w.w)}{i < ws.length - 1 && i + 1 !== cut ? ' ' : ''}</span></React.Fragment>)}</span></div>;
      })()}
      {/* 섞은 판에서는 뺀다 — 화면 전체가 노랑으로 깜빡였다 걷히는 틈에 같은 노랑 블록이 묻혀 편에서 가장 싸 보였다(11-04 Fable). 블록이 혼자 치고 들어온다 */}
      {!mix && <Door t={t} at={w(3, 0)} color={LEMON} />}
      {!dogEnd && <Door t={t} at={19.33} color={NAVY} />}
    </>
  );
};

// ── B 「색 블록 박자」
type Chunk = { a: number; b: number; small?: string; big: string };
const CH: Chunk[] = [
  { a: w(0, 0), b: w(0, 1), big: '외계인' }, { a: w(0, 1), b: w(0, 4), small: '닮은 우리 개는', big: '' }, { a: w(0, 4), b: w(0, 6), big: '바닷가에서' }, { a: w(0, 6), b: w(1, 0), small: '제일 좋아해요', big: '' },
  { a: w(1, 0), b: w(1, 3), small: '근데 사람들이 보면', big: '' }, { a: w(1, 3), b: w(2, 0), big: '깜짝!' },
  { a: w(2, 0), b: w(2, 2), small: '그래서 올해는', big: '' }, { a: w(2, 2), b: w(3, 0), big: '특별한 걸' },
  { a: w(3, 0), b: w(4, 0), small: '첨벙댕', big: '구명조끼' },
  { a: w(4, 0), b: w(4, 2), small: '값도 착하고', big: '' }, { a: w(4, 2), b: w(5, 0), big: '튼튼!' },
  { a: w(5, 0), b: w(5, 5), small: '등에 손잡이 두 개', big: '' }, { a: w(5, 5), b: w(6, 0), big: '번쩍!' },
  { a: w(6, 0), b: w(6, 2), small: '올해는 진짜', big: '' }, { a: w(6, 2), b: w(7, 0), big: '멋있게' },
  { a: w(7, 0), b: w(7, 1), small: '아무도', big: '' }, { a: w(7, 1), b: endOf(7) + 0.3, small: '모를걸요?', big: '외계인' },
  { a: w(8, 0), b: w(8, 3), small: '물놀이 가는 날엔', big: '' },
];
const LookB: React.FC<{ t: number }> = ({ t }) => {
  const c = CH.find((x) => t >= x.a && t < x.b);
  const end = t >= w(8, 3);
  return (
    <>
      {c && (() => {
        const p = ramp(t, c.a, 0.16, EXPO);
        const punch = 1 + (1 - ramp(t, c.a, 0.14)) * 0.08;
        const len = c.big.length;
        const size = Math.min(230, 930 / Math.max(1, len * 0.98));
        return (
          <div style={{ ...abs(60, 1020, 960), zIndex: 20, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12, transform: `scale(${punch})`, transformOrigin: 'left bottom' }}>
            {c.small && <div style={{ fontFamily: KO, fontWeight: 750, fontSize: 56, letterSpacing: '-0.03em', color: PAPER, background: NAVY, padding: '8px 20px 10px', clipPath: `inset(0 ${(1 - p) * 100}% 0 0)` }}>{c.small}</div>}
            {c.big && <div style={{ fontFamily: KO, fontWeight: 900, fontSize: size, letterSpacing: '-0.06em', lineHeight: 0.98, color: NAVY, background: LEMON, padding: '6px 22px 14px', clipPath: `inset(0 ${(1 - p) * 100}% 0 0)` }}>{c.big}</div>}
          </div>
        );
      })()}
      {end && (() => {
        const p = ramp(t, w(8, 3), 0.18, EXPO);
        return (
          <>
            <AbsoluteFill style={{ zIndex: 18, background: LEMON, clipPath: `inset(${(1 - p) * 100}% 0 0 0)`, opacity: 1 - ramp(t, 21.0, 0.25) * 0.0 }} />
            <div style={{ ...abs(0, 760, 1080), zIndex: 22, textAlign: 'center', fontFamily: KO, fontWeight: 900, fontSize: 300, letterSpacing: '-0.07em', color: NAVY, transform: `scale(${0.8 + pop(t, w(8, 3) + 0.02, 0.4) * 0.2})`, opacity: Math.min(1, pop(t, w(8, 3) + 0.02, 0.4)) }}>첨벙댕</div>
            <div style={{ ...abs(0, 1110, 1080), zIndex: 22, textAlign: 'center', fontFamily: KO, fontWeight: 700, fontSize: 44, color: NAVY, opacity: ramp(t, w(8, 3) + 0.37, 0.2) }}>반려견 구명조끼</div>
          </>
        );
      })()}
    </>
  );
};

// ── C 「말풍선 · 쇼핑 카드」
const LookC: React.FC<{ t: number }> = ({ t }) => {
  const shown = LINES.filter((l) => t >= l.at - 0.05 && l.at < 19.33).slice(-2);
  const card = t >= w(3, 0) && t < 19.33;
  const tap = t >= w(4, 2) && t < w(4, 2) + 0.3;
  const end = t >= 19.33;
  return (
    <>
      <div style={{ ...abs(64, 1060, 952), zIndex: 20, display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'flex-start' }}>
        {!end && shown.map((l, i) => {
          const p = pop(t, l.at - 0.05, 0.38);
          const old = i < shown.length - 1;
          return (
            <div key={l.at} style={{ maxWidth: 840, background: old ? '#FFFFFFD9' : '#FFFFFF', color: INK, borderRadius: '34px 34px 34px 10px', padding: '20px 30px', fontFamily: KO, fontWeight: 650, fontSize: 46, lineHeight: 1.32, letterSpacing: '-0.02em', boxShadow: '0 12px 34px #0003', transform: `translateY(${(1 - p) * 40}px) scale(${0.85 + 0.15 * Math.min(1, p)})`, transformOrigin: 'left bottom', opacity: Math.min(1, p) * (old ? 0.75 : 1) }}>
              {l.words.map((w, k) => <span key={k} style={w.key ? { background: 'linear-gradient(transparent 58%, #FFD43B 58%)', fontWeight: 800 } : undefined}>{noDot(w.w)}{k < l.words.length - 1 ? ' ' : ''}</span>)}
            </div>
          );
        })}
        {!end && <div style={{ fontFamily: KO, fontWeight: 600, fontSize: 26, color: PAPER, textShadow: '0 1px 10px #0009', marginLeft: 12 }}>외계 보호자 · 방금</div>}
      </div>
      {card && (() => {
        const p = pop(t, w(3, 0) + 0.03, 0.5);
        const s = tap ? 0.94 : 1;
        return (
          <div style={{ ...abs(64, 1480, 952, 190), zIndex: 22, background: '#FFFFFF', borderRadius: 30, display: 'flex', alignItems: 'center', gap: 26, padding: '0 30px', boxShadow: '0 20px 60px #0004', transform: `translateY(${(1 - Math.min(1, p)) * 300}px)` }}>
            <div style={{ width: 128, height: 128, borderRadius: 24, background: LEMON, display: 'grid', placeItems: 'center' }}>
              <svg viewBox="0 0 100 100" width="92" height="92"><path d="M22 30 L38 18 H62 L78 30 L74 82 H26 Z" fill="#FFD43B" stroke={NAVY} strokeWidth="5" strokeLinejoin="round" /><path d="M40 40 H60 M40 56 H60" stroke={NAVY} strokeWidth="7" strokeLinecap="round" /><path d="M44 18 Q50 30 56 18" fill="none" stroke={NAVY} strokeWidth="5" /></svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 40, color: INK, letterSpacing: '-0.03em' }}>첨벙댕 구명조끼</div>
              <div style={{ fontFamily: KO, fontWeight: 500, fontSize: 27, color: '#5B6072', marginTop: 6 }}>등 손잡이 2개 · 반사 띠 · 버클 끈</div>
            </div>
            <div style={{ background: NAVY, color: '#fff', fontFamily: KO, fontWeight: 800, fontSize: 32, borderRadius: 22, padding: '20px 28px', transform: `scale(${s})`, position: 'relative' }}>
              담기
              {t >= w(4, 2) + 0.15 && <span style={{ position: 'absolute', right: -14, top: -14, width: 42, height: 42, borderRadius: '50%', background: LEMON, color: NAVY, fontSize: 24, display: 'grid', placeItems: 'center', transform: `scale(${pop(t, w(4, 2) + 0.15, 0.3)})` }}>1</span>}
            </div>
          </div>
        );
      })()}
      {end && (() => {
        const p = pop(t, 19.4, 0.45);
        return (
          <div style={{ ...abs(64, 1220, 952), zIndex: 22, transform: `translateY(${(1 - Math.min(1, p)) * 200}px)`, opacity: Math.min(1, p) }}>
            <div style={{ display: 'inline-block', background: '#FFFFFF', color: INK, borderRadius: '34px 34px 34px 10px', padding: '20px 30px', fontFamily: KO, fontWeight: 700, fontSize: 48 }}>물놀이 가는 날엔, <span style={{ background: 'linear-gradient(transparent 58%, #FFD43B 58%)', fontWeight: 900 }}>첨벙댕</span></div>
            <div style={{ marginTop: 22, background: NAVY, color: '#fff', borderRadius: 30, padding: '26px 34px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: ramp(t, w(8, 3), 0.25) }}>
              <span style={{ fontFamily: KO, fontWeight: 900, fontSize: 64, letterSpacing: '-0.04em' }}>첨벙댕</span>
              <span style={{ fontFamily: KO, fontWeight: 800, fontSize: 30, background: LEMON, color: NAVY, borderRadius: 18, padding: '14px 22px' }}>구명조끼 보기 →</span>
            </div>
          </div>
        );
      })()}
    </>
  );
};

// dogEnd: 고글 쓴 개로 닫는 최종 끝(11-04 유호님 「고글 개 끝으로」) — 9번 컷(주황 고글)에 이어 그 방에 물이 차오르고 튜브 글자가 뜬 화면(pet-ad 최종편집.py dog_picture · 끝합성.py)
export const P11: React.FC<{ look: 'A' | 'B' | 'C' | 'AB'; probe?: boolean; dogEnd?: boolean }> = ({ look, probe, dogEnd }) => {
  const f = useCurrentFrame();
  const t = f / FPS;
  if (probe) return <AbsoluteFill style={{ background: '#000' }}><Probe t={t} /></AbsoluteFill>;
  // 판이 오르는 동안(0.25초)은 고지 줄을 판 뒤로 — 앞에 두니 그 사이 로고 위에 얹혔다(11-04), 판이 선 뒤 판 안 어두운 글자로
  const rising = !dogEnd && (look === 'AB' || look === 'B') && t >= w(8, 3) && t < w(8, 3) + 0.25;
  const onPanel = !dogEnd && (look === 'AB' || look === 'B') && t >= w(8, 3);
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <OffthreadVideo src={staticFile(dogEnd ? 'p11/picture_dog.mp4' : 'p11/picture.mp4')} muted style={{ width: '100%', height: '100%' }} />
      {look === 'A' && <LookA t={t} />}
      {look === 'B' && <LookB t={t} />}
      {look === 'C' && <LookC t={t} />}
      {look === 'AB' && <LookA t={t} mix dogEnd={dogEnd} />}
      {/* 흰 침구 · 모래 · 나무 바닥 위에서 그림자만으로는 휴대폰 폭에서 안 보였다(11-04 크몽 세션 검수) → 옅은 어두운 바탕 */}
      <div style={{ ...abs(0, 1866, 1080), zIndex: rising ? 21 : 30, textAlign: 'center', fontFamily: KO, fontWeight: 500, fontSize: 24, color: onPanel ? '#17224Dd9' : '#ffffffeb' }}>
        <span style={{ background: onPanel ? undefined : '#0E132073', padding: '4px 14px 5px', borderRadius: 8 }}>가상 브랜드 · AI로 만든 가상 모델 · 음성</span>
      </div>
      <Sequence from={0}><Audio src={staticFile('p11/sound_narr.wav')} /></Sequence>
    </AbsoluteFill>
  );
};
