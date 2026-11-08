// synkbrief B31 「요금제 1위가 바뀐다」 본편 — 원본 7Tyo1JTY2BE(24.2초)의 뼈대: 0초 바로 판정 · 박자 9곳에서 칸이 바뀜 · 18.2초 카드를 비우고 마무리.
// 우리 칸: 실제 AI 답(어도비 승리 · 13,200원 · 매월 1,700원 절약) → 실제 결제 화면 ₩15,200 → 미리캔버스 · 어도비 결제 화면 시소
// (월간이면 미리캔버스, 연간이면 어도비가 「더 쌈」) → 결제 화면 값을 붙여 넣고 「한 달 · 1년 나눠서」 물은 실제 답 → 끝 3초 시소.
// 화면 결(장부 머리말 11-03): 위 그늘 위 큰 글자가 곧 말 · 검정 · 흰 + 버터 한 곳(「더 쌈」) · SUIT · 실제 화면은 위 작은 회색 출처 한 줄 · 마침표 없음.
import React from 'react';
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from './lib/fonts';
import PLACE from './vo-place.json';
import { AD_BOX, AD_MONTH, AD_YEAR, clamp, Crop, Dim, EASE_OUT, MI_BOX, MI_TOGGLE, Note, sec, Settle, Sfx, Tap } from './parts';
import { AI_CHIP, AI_ROW_LABEL, AI_ROW_NUM, AI_SAVE, AD_M_KEY } from './Scene';

export const S = {
  slam: 2.45,
  pay: 3.6, crown1: 4.3,
  tapY: 6.7, crownY: 7.0,
  off: 9.4, offZoom: 11.1,
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
  const pos = right ? { right: 1080 - 920 } : { left: X };
  return <div style={{ position: 'absolute', ...pos, top: 1398, fontFamily: KO, fontWeight: 700, fontSize: 30, color: 'rgba(255,255,255,0.86)', letterSpacing: -0.4, textShadow: '0 1px 10px rgba(0,0,0,0.75)' }}>{text}</div>;
};

const Punch: React.FC<{ at: number; children: React.ReactNode }> = ({ at, children }) => {
  const f = useCurrentFrame() - sec(at);
  const k = f < 0 ? 0 : interpolate(f, [0, 3, 10], [0, 1, 0], clamp);
  return <div style={{ position: 'absolute', inset: 0, transform: `scale(${1 + k * 0.05})`, transformOrigin: '74px 1300px', filter: `brightness(${1 + k * 0.12})` }}>{children}</div>;
};
const Rise: React.FC<{ at: number; children: React.ReactNode; ghost?: number }> = ({ at, children, ghost = 0 }) => {
  const f = useCurrentFrame() - sec(at);
  if (f < 0 && !ghost) return null;
  const p = interpolate(f, [0, 7], [0, 1], { ...clamp, easing: EASE_OUT });
  const op = ghost + (1 - ghost) * p;
  return <div style={{ position: 'absolute', inset: 0, opacity: op, filter: p < 1 ? `blur(${(1 - p) * 3}px)` : undefined, transform: `translateY(${(1 - p) * 24}px) scale(${1.04 - 0.04 * p})`, transformOrigin: '30% 70%' }}>{children}</div>;
};

// ── 칸 1: AI 답의 핵심 넷 → 결제 화면 월간 칸이 밑으로 쿵
// v4(이해 시험 v3 — 셋 다 「1,700원이 무엇과 견준 값인지」를 짚음): 미리캔버스 줄 14,900원도 같은 크기로 위에 둔다
const AI_MI_LABEL = { x: 34, y: 782, w: 270, h: 62 };
const AI_MI_NUM = { x: 888, y: 782, w: 164, h: 62 };
const NUM_S = 1.9, NUM_X = 1006 - AI_MI_NUM.w * NUM_S;
const AI_Q = { x: 330, y: 190, w: 722, h: 240 };
const ClashFilm: React.FC = () => (
  <Settle from={0} origin="74px 55%" drift={0.0008} pan={0.1}>
    <Note text="ChatGPT에 물은 것 · 11월 7일 실제 화면" style={{ position: 'absolute', left: X, top: 548 }} />
    <Crop src="ai_final" {...AI_Q} scale={0.74} radius={0} style={{ position: 'absolute', left: 920 - AI_Q.w * 0.74, top: 600 }} />
    <Rise at={0.2} ghost={0.001}><Crop src="ai_final" {...AI_CHIP} scale={1.0} radius={34} style={{ position: 'absolute', left: X, top: 800 }} /></Rise>
    <Rise at={0.4} ghost={0.001}>
      <Crop src="ai_final" {...AI_MI_LABEL} scale={1.2} radius={0} style={{ position: 'absolute', left: X, top: 910 }} />
      <Crop src="ai_final" {...AI_MI_NUM} scale={1.7} radius={0} style={{ position: 'absolute', left: 920 - AI_MI_NUM.w * 1.7, top: 894 }} />
    </Rise>
    <Rise at={0.6} ghost={0.001}>
      <Crop src="ai_final" {...AI_ROW_LABEL} scale={1.2} radius={0} style={{ position: 'absolute', left: X, top: 1024 }} />
      <Crop src="ai_final" {...AI_ROW_NUM} scale={1.7} radius={0} style={{ position: 'absolute', left: 920 - AI_ROW_NUM.w * 1.7, top: 1008 }} />
    </Rise>
    <Punch at={S.slam}>
      <Note text="어도비 결제 화면 · 같은 날" style={{ position: 'absolute', left: X, top: 1158 }} />
      <Crop src="hi_ad_month" {...AD_M_KEY} scale={1.36} radius={22} style={{ position: 'absolute', left: X, top: 1200 }} />
    </Punch>
  </Settle>
);

// 증거 칸(v5 — 되풀이되던 시소 칸 대신): AI 답의 어도비 줄 · 어도비 공식 요금 화면 Premium 칸(₩15,200/월 · 연간 약정 없이 매월 청구)
const OFF_CARD = { x: 40, y: 920, w: 1000, h: 740 };
// 11-09 맹검(카드가 화면 오른쪽 밖으로 잘림 · 안쪽 오른편이 빔): 값이 있는 왼쪽만 잘라 크게 — 다가오는 효과까지 넣어도 오른쪽 끝 960 안
const OFF_PRICE = { x: 70, y: 1340, w: 640, h: 300 };
const AI_ROW = { x: 34, y: 868, w: 1018, h: 68 };
const Official: React.FC<{ zoom?: boolean }> = ({ zoom }) => (
  <Settle from={0} drift={0.0008} pan={0.3} origin="74px 60%">
    <Note text="ChatGPT 답" style={{ position: 'absolute', left: X, top: 548 }} />
    <Crop src="ai_final" {...AI_ROW} scale={0.9} radius={0} style={{ position: 'absolute', left: X - 14, top: 600 }} />
    <Note text="어도비 공식 요금 화면 · 11월 7일" style={{ position: 'absolute', left: X, top: 700 }} />
    {zoom
      ? <Crop src="hi_ad_official" {...OFF_PRICE} scale={1.32} radius={26} style={{ position: 'absolute', left: X - 4, top: 780 }} />
      : <Crop src="hi_ad_official" {...OFF_CARD} scale={0.86} radius={26} style={{ position: 'absolute', left: X, top: 760 }} />}
  </Settle>
);

// 출처 줄 + 「더 쌈」 — 이긴 쪽이면 출처 글 뒤에 버터 글이 내려앉는다(since = 이 판이 시작한 뒤 초)
const NoteWin: React.FC<{ text: string; win: boolean; since: number; left: number; top: number }> = ({ text, win, since, left, top }) => {
  const f = useCurrentFrame() - sec(since);
  const g = win ? f : -1;
  const drop = interpolate(g, [0, 6], [-26, 0], { ...clamp, easing: EASE_OUT });
  const op = g < 0 ? 0 : interpolate(g, [0, 3], [0, 1], clamp);
  return (
    <div style={{ position: 'absolute', left, top: top - 8, display: 'flex', alignItems: 'baseline', gap: 20, fontFamily: KO }}>
      <span style={{ fontWeight: 600, fontSize: 34, color: '#B8B8B8', letterSpacing: -0.4 }}>{text}</span>
      <span style={{ fontWeight: 800, fontSize: 38, color: '#F5C445', letterSpacing: -0.8, opacity: op, transform: `translateY(${drop * 0.25}px)`, display: 'inline-block' }}>더 쌈</span>
    </div>
  );
};

// ── 시소 판 A: 두 카드 그대로(미리캔버스 위 · 어도비 아래) · 왼쪽 끝 X
const PA = { miS: 1.0, adS: 0.8, miTop: 612, adTop: 1018 };
const PA_L = { mi: X, ad: X };
const PA_TAP = { m: { x: 420, y: PA.adTop + (1365 - AD_BOX.y) * PA.adS }, y: { x: 420, y: PA.adTop + (1672 - AD_BOX.y) * PA.adS } };
const PairA: React.FC<{ year: boolean; from: number; origin?: string; winAt?: number }> = ({ year, from, origin, winAt = 0.3 }) => (
  <Settle from={from} drift={0.0008} pan={0.3} origin={origin || '74px 40%'}>
    <NoteWin text="미리캔버스 요금 화면 · 11월 7일" win={!year} since={winAt} left={PA_L.mi} top={PA.miTop - 46} />
    <Crop src={year ? 'hi_mi_year' : 'hi_mi_month'} {...MI_BOX} scale={PA.miS} style={{ position: 'absolute', left: PA_L.mi, top: PA.miTop }} />
    <Crop src={year ? 'hi_mi_year' : 'hi_mi_month'} {...MI_TOGGLE} scale={0.9} radius={40} style={{ position: 'absolute', left: PA_L.mi + MI_BOX.w * PA.miS - 280, top: PA.miTop + 18 }} />
    <NoteWin text="어도비 결제 화면 · 11월 7일" win={year} since={winAt} left={PA_L.ad} top={PA.adTop - 46} />
    <Crop src={year ? 'hi_ad_year' : 'hi_ad_month'} {...AD_BOX} scale={PA.adS} style={{ position: 'absolute', left: PA_L.ad, top: PA.adTop }} />
    {year
      ? <Dim box={AD_BOX} s={PA.adS} y0={AD_MONTH.y} y1={AD_MONTH.y + AD_MONTH.h} left={PA_L.ad} top={PA.adTop} />
      : <Dim box={AD_BOX} s={PA.adS} y0={AD_YEAR.y} y1={AD_YEAR.y + AD_YEAR.h} left={PA_L.ad} top={PA.adTop} />}
  </Settle>
);

const END_DY = 100;
const Down: React.FC<{ children: React.ReactNode }> = ({ children }) => <div style={{ position: 'absolute', inset: 0, transform: `translateY(${END_DY}px)` }}>{children}</div>;

// ── 시소 판 B: 값 줄만 크게(미리캔버스 가격 줄 · 어도비 고른 칸) · 왼쪽 끝 X
const MI_PRICE = { x: 50, y: 2150, w: 820, h: 175 };
// 11-09 맹검(끝 화면 어도비 칸이 오른쪽 밖으로 잘림): 두 칸 다 본문 폭(846) 안으로 — 다가오는 효과(최대 1.05배)까지 오른쪽 끝 960 안
const PB = { miS: 1.03, adS: 0.82, miTop: 650, adTop: 1010 };
const PB_TAP = { x: 420, y: PB.adTop + 122 };
const PairB: React.FC<{ year: boolean; from: number; winAt?: number }> = ({ year, from, winAt = 0.3 }) => (
  <Settle from={from} drift={0.0009} pan={0.3} origin="74px 55%">
    <NoteWin text="미리캔버스 요금 화면" win={!year} since={winAt} left={X} top={PB.miTop - 46} />
    <Crop src={year ? 'hi_mi_year' : 'hi_mi_month'} {...MI_PRICE} scale={PB.miS} style={{ position: 'absolute', left: X, top: PB.miTop }} />
    <NoteWin text="어도비 결제 화면" win={year} since={winAt} left={X} top={PB.adTop - 46} />
    <Crop src={year ? 'hi_ad_year' : 'hi_ad_month'} {...(year ? AD_YEAR : AD_MONTH)} scale={PB.adS} style={{ position: 'absolute', left: X, top: PB.adTop }} />
  </Settle>
);

// ── 고친 요청: 붙여 넣은 글 · 실제 답의 결론
const AFTER_IN = { x: 28, y: 915, w: 1024, h: 392 };
const CON_ROWS = { x: 30, y: 915, w: 580, h: 245 };
const AFTER_TBL = { x: 0, y: 880, w: 1080, h: 500 };
// v4(넷 다 「붙여 넣은 글이 작다」): 한 번 그대로 보인 뒤(hl 전), 시키는 줄과 값 석 줄만 크게 다시 짠다
const IN_REQ = { x: 60, y: 1018, w: 830, h: 62 };
const IN_VALS = { x: 60, y: 1138, w: 925, h: 182 };
const PasteBox: React.FC<{ from: number; hl?: boolean }> = ({ from, hl }) => (
  <Settle from={from} drift={0.0008} pan={0.3} origin="74px 40%">
    <Note text="ChatGPT에 붙여 넣은 글 · 실제 화면" style={{ position: 'absolute', left: X, top: 800 }} />
    <Crop src="after_f0002" {...IN_REQ} scale={1.15} radius={18} style={{ position: 'absolute', left: X, top: 850, opacity: hl ? 1 : 0.55 }} />
    <Crop src="after_f0002" {...IN_VALS} scale={1.04} radius={18} style={{ position: 'absolute', left: X, top: 992, opacity: hl ? 0.55 : 1 }} />
  </Settle>
);
const Answer: React.FC<{ from: number; con: number }> = ({ from, con }) => {
  const f = useCurrentFrame();
  const showCon = f >= sec(con);
  return (
    <Settle from={showCon ? con : from} drift={0.0008} pan={0.3} origin="74px 40%">
      <Note text="ChatGPT 답 · 실제 화면" style={{ position: 'absolute', left: X, top: 770 }} />
      {/* v4(볼 이유 심사 — 해결 장면이 글머리 두 줄뿐): 답의 「최종 비교」 표에서 구분 · 더 저렴한 서비스 두 칸만 크게 */}
      {showCon
        ? <Crop src="after_f0017" {...CON_ROWS} scale={1.7} radius={24} style={{ position: 'absolute', left: X, top: 818 }} />
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
      {seq(S.tapY, S.off, <PairB year from={0} />)}
      {seq(S.off, S.offZoom, <Official />)}
      {seq(S.offZoom, S.paste, <Official zoom />)}
      {seq(S.paste, S.hl, <PasteBox from={0} />)}
      {seq(S.hl, S.ans, <PasteBox from={0} hl />)}
      {seq(S.ans, S.end, <Answer from={0} con={0} />)}
      {/* 끝 — 큰 글자 석 줄 밑으로 판을 END_DY만큼 내린다 */}
      {seq(S.end, S.tapE1, <Down><PairA year={false} from={0} winAt={0.25} /></Down>)}
      {seq(S.tapE1, S.tapE2, <Down><PairA year={yearAt(S.tapE1, S.tapE2)} from={0} origin="74px 75%" winAt={0.3} /></Down>)}
      {seq(S.tapE2, S.total, <Down><PairB year={false} from={0} /></Down>)}
      {/* 위 그늘 — 큰 글자 자리 */}
      <AbsoluteFill style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.9) 0px, rgba(0,0,0,0.75) 430px, rgba(0,0,0,0) 600px)' }} />

      <T lines={['미리캔버스보다', '1,700원 싸다던 어도비']} from={0} to={S.slam} still size={92} />
      <T lines={['결제 화면엔', '15,200원']} from={S.slam} to={vo('n03')} />
      <T lines={['한 달씩 내면', '미리캔버스']} from={vo('n03')} to={S.tapY} />
      <T lines={['1년 치를 한 번에', '내면 어도비']} from={S.tapY} to={S.off} />
      <T lines={['AI가 말한 값은', '공식 요금 화면에 없다']} from={S.off} to={vo('n06')} />
      <T lines={['AI한테는 결제 화면', '값을 붙여 주고']} from={vo('n06')} to={S.hl} />
      <T lines={['한 달 · 1년', '나눠서 시키세요']} from={S.hl} to={vo('n07')} />
      <T lines={['그럼', '딱 맞게 갈라 줘요']} from={vo('n07')} to={S.end} />
      <T lines={['요금 비교는', 'AI 기억 말고', '결제 화면 값으로']} from={S.end} to={S.total} size={88} />

      {/* 시소의 「더 쌈」 · 누름 */}
      <Tap at={S.slam + 0.3} x={330} y={1236} />
      <Tap at={S.tapY} {...PB_TAP} />
      <Tap at={S.tapE1} x={PA_TAP.y.x} y={PA_TAP.y.y + END_DY} />
      <Tap at={S.tapE2} x={PB_TAP.x} y={PB_TAP.y + END_DY} />

      <Small text="SYNK 브리핑" from={S.tapE2 + 0.15} to={S.total} right />

      {/* 소리 */}
      <Audio src={staticFile('bgm.wav')} volume={() => bgmV} />
      <Audio src={staticFile('sfx/room.wav')} volume={(fr: number) => 0.12 * interpolate(fr, [0, 6, TOTAL - 8, TOTAL], [0, 1, 1, 0], clamp)} />
      <Sfx at={0.05} src="tok" v={0.28} />
      <Sfx at={S.slam} src="thud" v={0.5} />
      <Sfx at={S.slam + 0.3} src="tick" v={0.42} />
      {[S.tapY, S.tapE1, S.tapE2].map((a) => <Sfx key={'t' + a} at={a} src="tick" v={0.48} />)}
      {[S.crown1, S.crownY, S.crownE0, S.crownE1, S.crownE2].map((a) => <Sfx key={'c' + a} at={a} src="thud" v={0.36} />)}
      <Sfx at={S.off} src="snap" v={0.3} />
      <Sfx at={S.offZoom} src="tok" v={0.3} />
      <Sfx at={S.paste} src="snap" v={0.3} />
      <Sfx at={S.ans} src="tok" v={0.32} />
      {(PLACE as { id: string; at: number }[]).map((c) => (
        <Sequence key={c.id} from={c.at}><Audio src={staticFile(`vo/${c.id}.wav`)} volume={0.85} /></Sequence>
      ))}
    </AbsoluteFill>
  );
};
