// synkbrief B31 「요금제 1위가 바뀐다」 본편 — 원본 7Tyo1JTY2BE(24.2초)의 뼈대: 0초 바로 판정 · 박자 9곳에서 칸이 바뀜 · 18.2초 카드를 비우고 마무리.
// 우리 칸: 실제 AI 답(어도비 승리 · 13,200원 · 매월 1,700원 절약) → 실제 결제 화면 ₩15,200 → 미리캔버스 · 어도비 결제 화면 시소
// (월간이면 미리캔버스, 연간이면 어도비가 「더 쌈」) → 결제 화면 값을 붙여 넣고 「한 달 · 1년 나눠서」 물은 실제 답 → 끝 3초 시소.
// 화면 결(장부 머리말 11-03): 위 그늘 위 큰 글자가 곧 말 · 검정 · 흰 + 버터 한 곳(「더 쌈」) · SUIT · 실제 화면은 위 작은 회색 출처 한 줄 · 마침표 없음.
import React from 'react';
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from './lib/fonts';
import PLACE from './vo-place.json';
import { AD_BOX, AD_MONTH, AD_YEAR, clamp, Crop, Dim, EASE_OUT, MI_BOX, MI_TOGGLE, Note, sec, Settle, Sfx, Tap, Crown } from './parts';
import { AI_CHIP, AI_ROW_LABEL, AI_ROW_NUM, AI_SAVE, AD_M_KEY } from './Scene';

export const S = {
  slam: 2.45,
  pay: 3.6, crown1: 4.3,
  tapY: 6.7, crownY: 7.0,
  tapM: 9.4, crownM: 9.7,
  tapY2: 11.1, crownY2: 11.4,
  paste: 13.0, hl: 14.4, ans: 16.3, con: 17.4,
  end: 18.2, crownE0: 18.45, tapE1: 20.3, crownE1: 20.6, tapE2: 22.9, crownE2: 23.2,
  total: 24.6,
};
export const TOTAL = sec(S.total);
const vo = (id: string) => (PLACE as { id: string; at: number }[]).find((c) => c.id === id)!.at / 30;
const seq = (from: number, to: number, el: React.ReactNode) => <Sequence from={sec(from)} durationInFrames={sec(to) - sec(from)}>{el}</Sequence>;
const X = 74, TOP = 284;

// 큰 글자가 곧 말 — 줄마다 28px 아래에서 올라온다(줄 사이 3프레임). still = 첫 프레임부터 다 보임
const T: React.FC<{ lines: React.ReactNode[]; from: number; to: number; size?: number; still?: boolean }> = ({ lines, from, to, size = 96, still }) => {
  const f = useCurrentFrame();
  const a = sec(from), b = sec(to);
  if (f < a || f >= b) return null;
  const out = interpolate(f, [b - 3, b], [1, 0], clamp);
  const up = (k: number) => {
    const p = still ? 1 : interpolate(f, [a + k * 3, a + k * 3 + 9], [0, 1], { ...clamp, easing: EASE_OUT });
    return { opacity: p * out, transform: `translateY(${(1 - p) * 28}px)` };
  };
  return (
    <div style={{ position: 'absolute', left: X, width: 900, top: TOP, fontFamily: KO, textShadow: '0 2px 14px rgba(0,0,0,0.55)' }}>
      {lines.map((l, i) => (
        <div key={i} style={{ ...up(i), fontWeight: 800, fontSize: size, lineHeight: 1.16, letterSpacing: -2.6, color: '#fff', wordBreak: 'keep-all', whiteSpace: 'nowrap' }}>{l}</div>
      ))}
    </div>
  );
};

const Small: React.FC<{ text: string; from: number; to: number; right?: boolean }> = ({ text, from, to, right }) => {
  const f = useCurrentFrame();
  if (f < sec(from) || f >= sec(to)) return null;
  const pos = right ? { right: 1080 - 1006 } : { left: X };
  return <div style={{ position: 'absolute', ...pos, top: 1372, fontFamily: KO, fontWeight: 700, fontSize: 30, color: 'rgba(255,255,255,0.86)', letterSpacing: -0.4, textShadow: '0 1px 10px rgba(0,0,0,0.75)' }}>{text}</div>;
};

const Rise: React.FC<{ at: number; children: React.ReactNode }> = ({ at, children }) => {
  const f = useCurrentFrame() - sec(at);
  if (f < 0) return null;
  const p = interpolate(f, [0, 7], [0, 1], { ...clamp, easing: EASE_OUT });
  return <div style={{ position: 'absolute', inset: 0, opacity: p, transform: `translateY(${(1 - p) * 40}px) scale(${1.06 - 0.06 * p})`, transformOrigin: '30% 70%' }}>{children}</div>;
};

// ── 칸 1: AI 답의 핵심 넷 → 결제 화면 월간 칸이 밑으로 쿵
const ClashFilm: React.FC = () => (
  <Settle from={0} origin="40% 60%" drift={0.00035}>
    <Note text="AI 답 · 실제 화면" style={{ position: 'absolute', left: X, top: 566 }} />
    <Crop src="ai_final" {...AI_CHIP} scale={1.1} radius={36} style={{ position: 'absolute', left: X, top: 612 }} />
    <Crop src="ai_final" {...AI_ROW_LABEL} scale={1.3} radius={0} style={{ position: 'absolute', left: X - 8, top: 704 }} />
    <Crop src="ai_final" {...AI_ROW_NUM} scale={2.6} radius={0} style={{ position: 'absolute', left: X - 20, top: 782 }} />
    <Crop src="ai_final" {...AI_SAVE} scale={1.3} radius={0} style={{ position: 'absolute', left: X - 8, top: 958 }} />
    <Rise at={S.slam}>
      <Note text="어도비 결제 화면" style={{ position: 'absolute', left: X, top: 1072 }} />
      <Crop src="hi_ad_month" {...AD_M_KEY} scale={1.6} radius={22} style={{ position: 'absolute', left: X, top: 1116 }} />
    </Rise>
  </Settle>
);

// ── 시소 판 A: 두 카드 그대로(미리캔버스 위 · 어도비 아래). 「더 쌈」은 이긴 카드의 출처 줄 오른쪽 끝에 붙는다
const PA = { miS: 1.0, adS: 0.74, miTop: 612, adTop: 1010 };
const PA_L = { mi: (1080 - MI_BOX.w * PA.miS) / 2, ad: (1080 - AD_BOX.w * PA.adS) / 2 };
const PA_CROWN = { x: PA_L.mi + MI_BOX.w * PA.miS, mi: PA.miTop - 66, ad: PA.adTop - 66 };
const PA_TAP = { m: { x: 400, y: PA.adTop + (1365 - AD_BOX.y) * PA.adS }, y: { x: 400, y: PA.adTop + (1672 - AD_BOX.y) * PA.adS } };
const PairA: React.FC<{ year: boolean; from: number; origin?: string }> = ({ year, from, origin }) => (
  <Settle from={from} drift={0.0001} origin={origin}>
    <Note text="미리캔버스 요금 화면 · 11월 7일" style={{ position: 'absolute', left: PA_L.mi, top: PA.miTop - 46 }} />
    <Crop src={year ? 'hi_mi_year' : 'hi_mi_month'} {...MI_BOX} scale={PA.miS} style={{ position: 'absolute', left: PA_L.mi, top: PA.miTop }} />
    <Crop src={year ? 'hi_mi_year' : 'hi_mi_month'} {...MI_TOGGLE} scale={0.9} radius={40} style={{ position: 'absolute', left: PA_L.mi + MI_BOX.w * PA.miS - 280, top: PA.miTop + 18 }} />
    <Note text="어도비 결제 화면 · 11월 7일" style={{ position: 'absolute', left: PA_L.ad, top: PA.adTop - 46 }} />
    <Crop src={year ? 'hi_ad_year' : 'hi_ad_month'} {...AD_BOX} scale={PA.adS} style={{ position: 'absolute', left: PA_L.ad, top: PA.adTop }} />
    {year
      ? <Dim box={AD_BOX} s={PA.adS} y0={AD_MONTH.y} y1={AD_MONTH.y + AD_MONTH.h} left={PA_L.ad} top={PA.adTop} />
      : <Dim box={AD_BOX} s={PA.adS} y0={AD_YEAR.y} y1={AD_YEAR.y + AD_YEAR.h} left={PA_L.ad} top={PA.adTop} />}
  </Settle>
);

const END_DY = 100;
const Down: React.FC<{ children: React.ReactNode }> = ({ children }) => <div style={{ position: 'absolute', inset: 0, transform: `translateY(${END_DY}px)` }}>{children}</div>;

// ── 시소 판 B: 값 줄만 크게(미리캔버스 가격 줄 · 어도비 고른 칸)
const MI_PRICE = { x: 50, y: 2150, w: 820, h: 175 };
const PB = { miS: 1.15, adS: 1.0, miTop: 640, adTop: 1000 };
const PB_CROWN = { x: 1006, mi: PB.miTop - 66, ad: PB.adTop - 66 };
const PB_TAP = { x: 420, y: PB.adTop + 140 };
const PairB: React.FC<{ year: boolean; from: number }> = ({ year, from }) => (
  <Settle from={from} drift={0.00012} origin="50% 55%">
    <Note text="미리캔버스 요금 화면" style={{ position: 'absolute', left: X, top: PB.miTop - 46 }} />
    <Crop src={year ? 'hi_mi_year' : 'hi_mi_month'} {...MI_PRICE} scale={PB.miS} style={{ position: 'absolute', left: (1080 - MI_PRICE.w * PB.miS) / 2, top: PB.miTop }} />
    <Note text="어도비 결제 화면" style={{ position: 'absolute', left: X, top: PB.adTop - 46 }} />
    <Crop src={year ? 'hi_ad_year' : 'hi_ad_month'} {...(year ? AD_YEAR : AD_MONTH)} scale={PB.adS} style={{ position: 'absolute', left: (1080 - AD_MONTH.w * PB.adS) / 2, top: PB.adTop }} />
  </Settle>
);

// ── 고친 요청: 붙여 넣은 글 · 실제 답의 결론
const AFTER_IN = { x: 28, y: 915, w: 1024, h: 392 };
const AFTER_CON = { x: 28, y: 1208, w: 1024, h: 214 };
const AFTER_TBL = { x: 0, y: 880, w: 1080, h: 500 };
const PasteBox: React.FC<{ from: number; hl?: boolean }> = ({ from, hl }) => (
  <Settle from={from} drift={0.00025} origin="50% 40%">
    <Note text="AI에게 붙여 넣은 글 · 실제 화면" style={{ position: 'absolute', left: X, top: 600 }} />
    <Crop src="after_f0002" {...AFTER_IN} scale={1.0} radius={30} style={{ position: 'absolute', left: 28, top: 646 }} />
    {hl ? (
      <>
        <Dim box={AFTER_IN} s={1} y0={915} y1={1005} left={28} top={646} a={0.66} />
        <Dim box={AFTER_IN} s={1} y0={1078} y1={1307} left={28} top={646} a={0.66} />
      </>
    ) : null}
  </Settle>
);
const Answer: React.FC<{ from: number; con: number }> = ({ from, con }) => {
  const f = useCurrentFrame();
  const showCon = f >= sec(con);
  return (
    <Settle from={showCon ? con : from} drift={0.00025} origin="50% 40%">
      <Note text="AI 답 · 실제 화면" style={{ position: 'absolute', left: X, top: 600 }} />
      {showCon
        ? <Crop src="after_f0017" {...AFTER_CON} scale={1.0} radius={24} style={{ position: 'absolute', left: 28, top: 650 }} />
        : <Crop src="after_f0016" {...AFTER_TBL} scale={0.98} radius={24} style={{ position: 'absolute', left: 11, top: 646 }} />}
    </Settle>
  );
};

export const Film: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / 30;
  // 결제 화면 상태(연간을 고른 동안 true)
  const yearAt = (a: number, b: number) => t >= a + 0.05 && t < b + 0.05;
  const bgmV = interpolate(f, [0, 8, TOTAL - 30, TOTAL], [0, 0.11, 0.11, 0], clamp);
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {seq(0, S.pay, <ClashFilm />)}
      {seq(S.pay, S.tapY, <PairA year={false} from={0} />)}
      {seq(S.tapY, S.tapM, <PairB year from={0} />)}
      {seq(S.tapM, S.tapY2, <PairB year={false} from={0} />)}
      {seq(S.tapY2, S.paste, <PairA year from={0} origin="50% 70%" />)}
      {seq(S.paste, S.hl, <PasteBox from={0} />)}
      {seq(S.hl, S.ans, <PasteBox from={0} hl />)}
      {seq(S.ans, S.end, <Answer from={0} con={0} />)}
      {/* 끝 — 큰 글자 석 줄 밑으로 판을 END_DY만큼 내린다 */}
      {seq(S.end, S.tapE1, <Down><PairA year={false} from={0} /></Down>)}
      {seq(S.tapE1, S.tapE2, <Down><PairA year={yearAt(S.tapE1, S.tapE2)} from={0} origin="50% 75%" /></Down>)}
      {seq(S.tapE2, S.total, <PairB year={false} from={0} />)}
      {/* 위 그늘 — 큰 글자 자리 */}
      <AbsoluteFill style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.9) 0px, rgba(0,0,0,0.75) 430px, rgba(0,0,0,0) 600px)' }} />

      <T lines={['AI가 1,700원', '싸다던 요금제']} from={0} to={S.slam} still />
      <T lines={['결제 화면엔', '15,200원']} from={S.slam} to={vo('n03')} />
      <T lines={['한 달씩 내면', '미리캔버스']} from={vo('n03')} to={S.tapY} />
      <T lines={['1년 치를 한 번에', '내면 어도비']} from={S.tapY} to={vo('n05')} />
      <T lines={['누르는 칸마다', '1위가 바뀐다']} from={vo('n05')} to={vo('n06')} />
      <T lines={['결제 화면 값을', '그대로 붙여 넣고']} from={vo('n06')} to={S.hl} />
      <T lines={['한 달 · 1년', '나눠서 물었더니']} from={S.hl} to={S.ans} />
      <T lines={['이번엔', '딱 맞게']} from={S.ans} to={S.end} />
      <T lines={['요금 비교는', 'AI 기억 말고', '결제 화면 값으로']} from={S.end} to={S.tapE2} size={88} />

      {/* 시소의 「더 쌈」 · 누름 */}
      <Crown text="더 쌈" right size={60} until={S.tapY}
        spots={[[S.crown1, PA_CROWN.x, PA_CROWN.mi]]} />
      <Crown text="더 쌈" right size={60} until={S.tapM} spots={[[S.crownY, PB_CROWN.x, PB_CROWN.ad]]} />
      <Crown text="더 쌈" right size={60} until={S.tapY2} spots={[[S.crownM, PB_CROWN.x, PB_CROWN.mi]]} />
      <Crown text="더 쌈" right size={60} until={S.paste} spots={[[S.crownY2, PA_CROWN.x, PA_CROWN.ad]]} />
      <Crown text="더 쌈" right size={60} until={S.tapE2}
        spots={[[S.crownE0, PA_CROWN.x, PA_CROWN.mi + END_DY], [S.crownE1, PA_CROWN.x, PA_CROWN.ad + END_DY]]} />
      <Crown text="더 쌈" right size={60} until={S.total} spots={[[S.crownE2, PB_CROWN.x, PB_CROWN.mi]]} />
      <Tap at={S.slam + 0.3} x={330} y={1250} />
      <Tap at={S.tapY} {...PB_TAP} />
      <Tap at={S.tapM} {...PB_TAP} />
      <Tap at={S.tapY2} {...PA_TAP.y} />
      <Tap at={S.tapE1} x={PA_TAP.y.x} y={PA_TAP.y.y + END_DY} />
      <Tap at={S.tapE2} {...PB_TAP} />

      <Small text="SYNK 브리핑" from={S.total - 2.6} to={S.total} right />

      {/* 소리 */}
      <Audio src={staticFile('bgm.wav')} volume={() => bgmV} />
      <Audio src={staticFile('sfx/room.wav')} volume={(fr: number) => 0.12 * interpolate(fr, [0, 6, TOTAL - 8, TOTAL], [0, 1, 1, 0], clamp)} />
      <Sfx at={0.05} src="tok" v={0.28} />
      <Sfx at={S.slam} src="thud" v={0.5} />
      <Sfx at={S.slam + 0.3} src="tick" v={0.42} />
      {[S.tapY, S.tapM, S.tapY2, S.tapE1, S.tapE2].map((a) => <Sfx key={'t' + a} at={a} src="tick" v={0.48} />)}
      {[S.crown1, S.crownY, S.crownM, S.crownY2, S.crownE0, S.crownE1, S.crownE2].map((a) => <Sfx key={'c' + a} at={a} src="thud" v={0.36} />)}
      <Sfx at={S.paste} src="snap" v={0.3} />
      <Sfx at={S.ans} src="tok" v={0.32} />
      {(PLACE as { id: string; at: number }[]).map((c) => (
        <Sequence key={c.id} from={c.at}><Audio src={staticFile(`vo/${c.id}.wav`)} volume={0.85} /></Sequence>
      ))}
    </AbsoluteFill>
  );
};
