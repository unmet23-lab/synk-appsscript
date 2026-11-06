// synkbrief B31 한 장면(장면 심사용 · 제목 · 이름표 · 설명 말 없음).
// v1 「넘김 · 2 — 0~1초에 AI가 틀렸다는 신호가 없고, 작은 숫자 넷을 견줘야 하고, 1위의 뜻이 안 읽힌다」
// v2 「넘김 · 2 — 위쪽에 작은 표뿐 · 아래가 비고 숫자 맞춰 보기에만 기댄다」
// v3(11-07): 0초부터 화면 한가운데 실제 AI 답의 「13,200원」을 크게, 0.75초에 바로 밑으로 실제 결제 화면 「₩15,200/월」이 쿵.
//   시소(더 쌈이 오감)는 화면 폭 가득, 아래 빈자리엔 AI 답 「어도비 승리」가 그대로 남아 맞선다. 크게 쓰는 결제 화면은 5배로 다시 찍은 판.
import React from 'react';
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { AD_BOX, AD_MONTH, AD_YEAR, clamp, Crop, Crown, Dim, EASE_OUT, MI_BOX, MI_TOGGLE, Note, sec, Settle, Sfx, Tap } from './parts';

export const SCENE_TOTAL = sec(6.2);
export const P = { slam: 0.75, cut: 1.6, crown1: 1.85, tapY: 2.8, crownY: 3.1, tapM: 4.0, crownM: 4.3, tapY2: 5.1, crownY2: 5.4 };

// 실제 화면 칸(원본 화소 — 휴대폰 1080×2341 기준. hi_ 그림은 같은 자리를 5배로 찍은 판)
export const AI_CHIP = { x: 38, y: 462, w: 590, h: 68 };
export const AI_ROW_LABEL = { x: 34, y: 870, w: 470, h: 64 };
export const AI_ROW_NUM = { x: 888, y: 870, w: 164, h: 64 };
export const AI_SAVE = { x: 56, y: 988, w: 420, h: 64 };
export const AD_M_KEY = { x: 84, y: 1250, w: 524, h: 148 };

const Rise: React.FC<{ at: number; children: React.ReactNode }> = ({ at, children }) => {
  const f = useCurrentFrame() - sec(at);
  if (f < 0) return null;
  const p = interpolate(f, [0, 7], [0, 1], { ...clamp, easing: EASE_OUT });
  return <div style={{ position: 'absolute', inset: 0, opacity: p, transform: `translateY(${(1 - p) * 40}px) scale(${1.06 - 0.06 * p})`, transformOrigin: '30% 70%' }}>{children}</div>;
};

// 맞붙이기 — AI 답의 핵심 넷(승리 칩 · 어도비 줄 · 13,200원 · 매월 1,700원 절약), 그 밑에 결제 화면 월간 칸
export const ClashBig: React.FC<{ slam: number }> = ({ slam }) => (
  <Settle from={0} origin="40% 60%" drift={0.0004}>
    <Note text="AI 답" style={{ position: 'absolute', left: 74, top: 470 }} />
    <Crop src="ai_final" {...AI_CHIP} scale={1.25} radius={40} style={{ position: 'absolute', left: 74, top: 520 }} />
    <Crop src="ai_final" {...AI_ROW_LABEL} scale={1.45} radius={0} style={{ position: 'absolute', left: 64, top: 640 }} />
    <Crop src="ai_final" {...AI_ROW_NUM} scale={3.1} radius={0} style={{ position: 'absolute', left: 52, top: 730 }} />
    <Crop src="ai_final" {...AI_SAVE} scale={1.45} radius={0} style={{ position: 'absolute', left: 64, top: 940 }} />
    <Rise at={slam}>
      <Note text="어도비 결제 화면" style={{ position: 'absolute', left: 74, top: 1090 }} />
      <Crop src="hi_ad_month" {...AD_M_KEY} scale={1.86} radius={22} style={{ position: 'absolute', left: 74, top: 1140 }} />
    </Rise>
  </Settle>
);

// 시소 — 위 미리캔버스 · 아래 어도비(화면 폭 가득) · 「더 쌈」은 출처 줄 오른쪽 · 맨 아래엔 AI 답이 남는다
export const MI_S = 1.15, AD_S = 0.96;
export const MI_TOP = 352, AD_TOP = 842;
const MI_L = (1080 - MI_BOX.w * MI_S) / 2, AD_L = (1080 - AD_BOX.w * AD_S) / 2;
export const LABEL = { x: 1034, mi: MI_TOP - 112, ad: AD_TOP - 112 };
export const TAP = {
  m: { x: 420, y: AD_TOP + (1365 - AD_BOX.y) * AD_S },
  y: { x: 420, y: AD_TOP + (1672 - AD_BOX.y) * AD_S },
};
export const PayPair: React.FC<{ year: boolean; from: number; witness?: boolean }> = ({ year, from, witness = true }) => (
  <Settle from={from} drift={0.00008}>
    <Note text="미리캔버스 요금 화면" style={{ position: 'absolute', left: 50, top: MI_TOP - 48 }} />
    <Crop src={year ? 'hi_mi_year' : 'hi_mi_month'} {...MI_BOX} scale={MI_S} style={{ position: 'absolute', left: MI_L, top: MI_TOP }} />
    <Crop src={year ? 'hi_mi_year' : 'hi_mi_month'} {...MI_TOGGLE} scale={1.0} radius={44} style={{ position: 'absolute', left: MI_L + MI_BOX.w * MI_S - 316, top: MI_TOP + 20 }} />
    <Note text="어도비 결제 화면" style={{ position: 'absolute', left: 50, top: AD_TOP - 48 }} />
    <Crop src={year ? 'hi_ad_year' : 'hi_ad_month'} {...AD_BOX} scale={AD_S} style={{ position: 'absolute', left: AD_L, top: AD_TOP }} />
    {year
      ? <Dim box={AD_BOX} s={AD_S} y0={AD_MONTH.y} y1={AD_MONTH.y + AD_MONTH.h} left={AD_L} top={AD_TOP} />
      : <Dim box={AD_BOX} s={AD_S} y0={AD_YEAR.y} y1={AD_YEAR.y + AD_YEAR.h} left={AD_L} top={AD_TOP} />}
    {witness ? (
      <div style={{ position: 'absolute', left: 50, top: 1574, opacity: 0.9 }}>
        <Note text="AI 답" style={{ marginBottom: 12 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 26 }}>
          <Crop src="ai_final" {...AI_CHIP} scale={1.0} radius={34} />
          <Crop src="ai_final" {...AI_ROW_NUM} scale={1.55} radius={0} />
        </div>
      </div>
    ) : null}
  </Settle>
);

export const Scene: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / 30;
  const year = (t >= P.tapY + 0.05 && t < P.tapM + 0.05) || t >= P.tapY2 + 0.05;
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <Sequence durationInFrames={sec(P.cut)}><ClashBig slam={P.slam} /></Sequence>
      <Sequence from={sec(P.cut)}><AbsoluteFill><PayPair year={year} from={0} /></AbsoluteFill></Sequence>
      <Tap at={P.slam + 0.25} x={360} y={1290} />
      <Tap at={P.tapY} {...TAP.y} />
      <Tap at={P.tapM} {...TAP.m} />
      <Tap at={P.tapY2} {...TAP.y} />
      <Crown text="더 쌈" right size={80} until={6.2}
        spots={[[P.crown1, LABEL.x, LABEL.mi], [P.crownY, LABEL.x, LABEL.ad], [P.crownM, LABEL.x, LABEL.mi], [P.crownY2, LABEL.x, LABEL.ad]]} />

      <Audio src={staticFile('sfx/room.wav')} volume={(fr: number) => 0.22 * interpolate(fr, [0, 6, SCENE_TOTAL - 8, SCENE_TOTAL], [0, 1, 1, 0], clamp)} />
      <Sfx at={0.05} src="tok" v={0.3} />
      <Sfx at={P.slam} src="thud" v={0.55} />
      <Sfx at={P.slam + 0.25} src="tick" v={0.45} />
      {[P.tapY, P.tapM, P.tapY2].map((a) => <Sfx key={a} at={a} src="tick" v={0.5} />)}
      {[P.crown1, P.crownY, P.crownM, P.crownY2].map((a) => <Sfx key={a} at={a} src="thud" v={0.42} />)}
    </AbsoluteFill>
  );
};
