// synkbrief B21 v2(11-03 밤) — 같은 말 · 소리 · 장면에 겉만 「화면 결」로 다시 입힌 판(본보기 synkbrief_요금제질문셋_20261103 FilmV2).
// 유호님 11-03 「누가봐도 ai 슬롭」 → 「응, 둘 다」 — 옛 판의 검은 머리 상자 · 노란 글자 · 검은 자막 상자 · 흰 경보 카드 · 노란 형광을 뺐다.
// 결: 장면을 아래로 내리고 위는 같은 장면을 뒤집어 흐리게 · 위 그늘 위 큰 글자가 곧 말(방 안 말은 흰, 전화 속 말은 회색 + 「전화 속」) ·
// 검정 · 흰 + 버터 한 곳(암호 「귤」) · 줄 단위 올림 · 컷이 1.035배에서 내려앉음 · SUIT 하나 · 마침표 없음 · 안전선 안.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from './lib/fonts';
import PLACE from './vo-place.json';
import { S, TOTAL, Shot } from './Film';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const sec = (s: number) => Math.round(s * 30);
const vo = (id: string) => (PLACE as { id: string; at: number }[]).find((c) => c.id === id)!.at / 30;
const seq = (from: number, to: number, el: React.ReactNode) => <Sequence from={sec(from)} durationInFrames={sec(to) - sec(from)}>{el}</Sequence>;

const BUTTER = '#F5C445';
const GREY = '#A3A3A3';
const X = 74;
const TOP = 284;

const Lowered: React.FC<{ d?: number; children: React.ReactNode }> = ({ d = 260, children }) => {
  const f = useCurrentFrame();
  const z = interpolate(f, [0, 8], [1.035, 1], { ...clamp, easing: EASE_OUT });
  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: '#0b0b0b' }}>
      <div style={{ position: 'absolute', inset: 0, transform: `translateY(${d}px) scaleY(-1)`, transformOrigin: '50% 0%', filter: 'blur(26px) brightness(0.55)' }}>{children}</div>
      <div style={{ position: 'absolute', inset: 0, transform: `translateY(${d}px) scale(${z})`, transformOrigin: '50% 30%' }}>{children}</div>
    </AbsoluteFill>
  );
};
type Crop = { s: number; cx: number; cy: number; ay?: number };
const Cut: React.FC<{ src: string; start: number; crop: Crop; rate?: number; drift?: number }> = (p) => <Lowered><Shot {...p} /></Lowered>;

const Shade: React.FC = () => (
  <AbsoluteFill style={{ background: 'linear-gradient(to bottom, rgba(10,10,10,0.92) 0px, rgba(10,10,10,0.8) 470px, rgba(10,10,10,0.34) 760px, rgba(10,10,10,0) 940px)' }} />
);

// 큰 글자가 곧 말. phone = 전화 속 말(회색 + 위에 「전화 속」)
const T: React.FC<{ lines: React.ReactNode[]; from: number; to: number; phone?: boolean; size?: number; meta?: string; below?: React.ReactNode; still?: boolean }> = ({ lines, from, to, phone, size = 96, meta, below, still }) => {
  const f = useCurrentFrame();
  const a = sec(from), b = sec(to);
  if (f < a || f >= b) return null;
  const out = interpolate(f, [b - 3, b], [1, 0], clamp);
  const up = (k: number) => {
    const p = still ? 1 : interpolate(f, [a + k * 3, a + k * 3 + 9], [0, 1], { ...clamp, easing: EASE_OUT });
    return { opacity: p * out, transform: `translateY(${(1 - p) * 28}px)` };
  };
  const m = meta ?? (phone ? '전화 속' : undefined);
  return (
    <div style={{ position: 'absolute', left: X, width: 846, top: TOP, fontFamily: KO, textShadow: '0 2px 14px rgba(0,0,0,0.55)' }}>
      {m ? <div style={{ ...up(0), fontWeight: 600, fontSize: 32, letterSpacing: -0.5, color: GREY, marginBottom: 18 }}>{m}</div> : null}
      {lines.map((l, i) => (
        <div key={i} style={{ ...up(i + (m ? 1 : 0)), fontWeight: phone ? 700 : 800, fontSize: size, lineHeight: 1.16, letterSpacing: -2.6, color: phone ? '#BDBDBD' : '#fff', wordBreak: 'keep-all' }}>{l}</div>
      ))}
      {below ? <div style={{ ...up(lines.length + 1), marginTop: 30 }}>{below}</div> : null}
    </div>
  );
};

const Small: React.FC<{ text: string; from: number; to: number; right?: boolean }> = ({ text, from, to, right }) => {
  const f = useCurrentFrame();
  if (f < sec(from) || f >= sec(to)) return null;
  const pos = right ? { right: 1080 - 920 } : { left: X };
  // 밝은 장면에서도 읽히게 아래쪽만 옅게 눌러 둔다(올리기 전 검사 「흰 기본 글자」)
  return <><div style={{ position: 'absolute', left: 0, right: 0, top: 1240, height: 240, background: 'linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,0.55) 55%, rgba(0,0,0,0.55))' }} /><div style={{ position: 'absolute', ...pos, top: 1372, fontFamily: KO, fontWeight: 700, fontSize: 34, color: 'rgba(255,255,255,0.9)', letterSpacing: -0.4, textShadow: '0 0 3px rgba(0,0,0,0.95), 0 0 8px rgba(0,0,0,0.85), 0 1px 18px rgba(0,0,0,0.8)' }}>{text}</div></>;
};

// 금감원 소비자경보 원문 — 흰 카드 · 노란 형광 대신 어두운 바탕 위 출처 줄 + 원문 글(글은 실제 그대로)
const Fss: React.FC = () => {
  const f = useCurrentFrame();
  const two = sec(S.fss2 - S.fss);
  const q = (k: number) => interpolate(f - k, [0, 9], [0, 1], { ...clamp, easing: EASE_OUT });
  const first = f < two;
  const k0 = first ? 0 : two;
  return (
    <AbsoluteFill style={{ background: '#0d0f12' }}>
      <Img src={staticFile('img/근접끝.jpg')} style={{ position: 'absolute', inset: 0, width: 1080, height: 1920, filter: 'blur(14px) brightness(0.5)', scale: `${1.08 + (f / 30) * 0.01}` }} />
      <div style={{ position: 'absolute', left: X, width: 846, top: 640, fontFamily: KO, borderLeft: '3px solid rgba(255,255,255,0.5)', paddingLeft: 26 }}>
        <div style={{ fontWeight: 600, fontSize: 32, color: '#C8C8C8', marginBottom: 14, opacity: q(k0) }}>{first ? '금융감독원 소비자경보 · 2026년 2월' : '같은 경보 자료에서'}</div>
        <div style={{ fontWeight: 700, fontSize: 66, lineHeight: 1.3, letterSpacing: -1.4, color: '#fff', wordBreak: 'keep-all', opacity: q(k0 + 3), transform: `translateY(${(1 - q(k0 + 3)) * 28}px)` }}>
          {first ? '울면서 “엄마” 부르는 아이 목소리… 알고보니 AI 보이스피싱' : '부모라 하더라도 … 판단하기가 어려움'}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Sfx: React.FC<{ t: number; src: string; vol: number }> = ({ t, src, vol }) => (
  <Sequence from={sec(t)} durationInFrames={75}><Audio src={staticFile(src)} volume={vol} /></Sequence>
);
const Say: React.FC<{ t: number; src: string; vol?: number }> = ({ t, src, vol = 1.15 }) => (
  <Sequence from={sec(t)}><Audio src={staticFile(`vo/${src}.wav`)} volume={vol} /></Sequence>
);

const MOM = { cx: 333, cy: 440 }, DAU = { cx: 838, cy: 574 };
const BM = { cx: 300, cy: 430 }, BD = { cx: 760, cy: 540 }, BP = { cx: 540, cy: 930 };
const WIDE = { s: 1.0, cx: 540, cy: 960 };

export const FilmV2: React.FC = () => {
  const f = useCurrentFrame();
  const drone = interpolate(f, [0, sec(1.5), sec(S.plan - 0.6), sec(S.plan)], [0.1, 0.2, 0.26, 0], clamp);
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {seq(S.phone, S.eye, <Cut src="img/A.mp4" start={0} crop={{ s: 2.8, cx: 218, cy: 551 }} />)}
      {seq(S.eye, S.daughter, <Cut src="img/A.mp4" start={0.3} crop={{ s: 2.5, ...MOM }} />)}
      {seq(S.daughter, S.eye2, <Cut src="img/A.mp4" start={0.8} crop={{ s: 2.1, cx: 880, cy: 720 }} />)}
      {seq(S.eye2, S.wide, <Cut src="img/A.mp4" start={1.4} crop={{ s: 3.0, cx: 333, cy: 430 }} />)}
      {seq(S.wide, S.wide2, <Cut src="img/A.mp4" start={0.1} crop={WIDE} drift={0.012} />)}
      {seq(S.wide2, S.hand, <Cut src="img/A.mp4" start={0.9} rate={0.8} crop={{ s: 1.28, cx: 590, cy: 620 }} drift={0.012} />)}
      {seq(S.hand, S.face, <Cut src="img/A.mp4" start={2.0} crop={{ s: 3.1, cx: 218, cy: 551 }} />)}
      {seq(S.face, S.why, <Cut src="img/A.mp4" start={3.0} rate={0.61} crop={{ s: 2.2, ...MOM }} />)}
      {seq(S.why, S.turn, <Cut src="img/A.mp4" start={5.1} crop={{ s: 2.0, ...DAU }} />)}
      {seq(S.turn, S.both, <Cut src="img/A.mp4" start={6.15} crop={{ s: 1.25, cx: 560, cy: 640 }} drift={0.01} />)}
      {seq(S.both, S.mom1, <Cut src="img/A.mp4" start={8.26} crop={{ s: 1.7, cx: 560, cy: 560 }} drift={0.01} />)}
      {seq(S.mom1, S.b, <Cut src="img/A.mp4" start={9.31} rate={0.65} crop={{ s: 2.2, ...DAU }} drift={0} />)}
      {seq(S.b, S.b1, <Cut src="img/B.mp4" start={0} crop={WIDE} drift={0.012} />)}
      {seq(S.b1, S.b2, <Cut src="img/B.mp4" start={S.b1 - S.b} crop={{ s: 2.1, ...BP }} />)}
      {seq(S.b2, S.b3, <Cut src="img/B.mp4" start={S.b2 - S.b} crop={{ s: 1.9, ...BD }} />)}
      {seq(S.b3, S.b4, <Cut src="img/B.mp4" start={S.b3 - S.b} crop={{ s: 1.2, cx: 540, cy: 760 }} />)}
      {seq(S.b4, S.b5, <Cut src="img/B.mp4" start={S.b4 - S.b} crop={{ s: 1.9, ...BM }} />)}
      {seq(S.b5, S.b6, <Cut src="img/Y.mp4" start={0.1} crop={{ s: 1.15, cx: 540, cy: 760 }} drift={0.012} />)}
      {seq(S.b6, S.ai, <Cut src="img/B.mp4" start={8.4} rate={0.8} crop={{ s: 2.3, ...BP }} />)}
      {seq(S.ai, S.fss, <Cut src="img/D.mp4" start={0.2} crop={WIDE} drift={0.03} />)}
      {seq(S.fss, S.plan, <Fss />)}
      {seq(S.plan, S.plan2, <Cut src="img/P.mp4" start={0} crop={{ s: 1.15, cx: 540, cy: 620 }} />)}
      {seq(S.plan2, S.plan3, <Cut src="img/P.mp4" start={S.plan2 - S.plan} crop={{ s: 1.7, cx: 520, cy: 620 }} />)}
      {seq(S.plan3, S.end, <Cut src="img/P.mp4" start={S.plan3 - S.plan} crop={{ s: 1.15, cx: 540, cy: 620 }} />)}
      {seq(S.end, S.end2, <Cut src="img/C.mp4" start={0} crop={WIDE} drift={0.01} />)}
      {seq(S.end2, S.end3, <Cut src="img/C.mp4" start={S.end2 - S.end} crop={{ s: 2.0, cx: 340, cy: 500 }} />)}
      {seq(S.end3, S.gyul, <Cut src="img/C.mp4" start={S.end3 - S.end} crop={{ s: 1.9, cx: 860, cy: 700 }} />)}
      {seq(S.gyul, S.gyul2, <Cut src="img/G.mp4" start={0.9} crop={{ s: 1.05, cx: 560, cy: 760 }} drift={0.01} />)}
      {seq(S.gyul2, S.total, <Cut src="img/G.mp4" start={0.9 + S.gyul2 - S.gyul} crop={{ s: 1.5, cx: 560, cy: 640 }} drift={0.01} />)}
      <Shade />

      <T lines={['전화 속에서', '딸이 운다']} from={0} to={S.wide} size={112} still
        below={<div style={{ fontFamily: KO, fontWeight: 700, fontSize: 44, color: '#BDBDBD', letterSpacing: -0.8 }}>“엄마… 엄마, 나 좀 살려줘…”</div>} />
      <T lines={['딸은', '옆에 있는데']} from={S.wide} to={vo('m01')} size={112} />
      <T phone lines={['민지 어머니시죠?', '따님, 저랑 같이 있어요']} from={vo('m01')} to={vo('m02')} size={84} />
      <T phone lines={['오십만 원만 보내세요', '전화는 끊지 마시고요']} from={vo('m02')} to={S.why} size={84} />
      <T lines={['엄마, 왜 그래?']} from={S.why + 0.05} to={S.why + 1.75} />
      <T phone lines={['엄마…']} from={13.96} to={15.3} />
      <T phone lines={['엄마… 나 무서워…']} from={S.b} to={S.b2} size={88} />
      <T lines={['이거…', '내 목소리잖아']} from={S.b2 + 0.05} to={20.1} />
      <T lines={['그럼…', '이건 누구야?']} from={20.85} to={23.1} />
      <T lines={['나 여기 있어…']} from={23.1} to={24.75} />
      <T phone lines={['엄마… 엄마,', '나 좀 살려줘…']} from={24.9} to={S.ai} />
      <T lines={['AI가 만든', '목소리예요']} from={vo('v01')} to={S.fss} size={112} />
      <T lines={['금융감독원이', '경보까지 낸 수법이에요']} from={vo('v02')} to={S.fss2} size={80} />
      <T lines={['우는 소리는,', '부모도 바로 못 가린대요']} from={vo('v03')} to={S.plan} size={80} />
      <T meta="미국 FBI도 권해요" lines={['가족끼리 암호', '한 단어만 정해 두세요']} from={vo('v04')} to={S.end} size={88} />
      <T phone lines={['엄마…']} from={S.end + 0.05} to={36.85} />
      <T lines={['우리 집 암호가 뭐지?']} from={36.9} to={38.45} size={88} />
      <T phone meta="" lines={['…전화가 끊겼어요']} from={38.75} to={39.4} size={72} />
      <T meta="우리 집 암호" lines={[<span style={{ color: BUTTER }}>귤</span>]} from={39.6} to={vo('v05')} size={200} />
      <T meta="우리 집 암호는 귤" lines={['목소리는 베껴도,', '우리 집 암호는 몰라요']} from={vo('v05')} to={S.total} size={84} />

      <Small text="재연 장면이에요" from={0} to={S.ai} />
      <Small text="SYNK 브리핑" from={S.total - 2.6} to={S.total} right />

      {[['p_m01', 'm01'], ['p_m02', 'm02']].map(([w, id]) => (
        <Sequence key={id} from={sec(vo(id))}><Audio src={staticFile(`vo/${w}.wav`)} volume={1.2} /></Sequence>
      ))}
      {['v01', 'v02', 'v03', 'v04', 'v05'].map((id) => (
        <Sequence key={id} from={sec(vo(id))}><Audio src={staticFile(`vo/${id}.wav`)} /></Sequence>
      ))}
      <Say t={0.05} src="s_cry" />
      <Say t={S.why} src="s_why" vol={1.1} />
      <Say t={13.96} src="s_mom1" />
      <Say t={S.b} src="s_scared" />
      <Say t={S.b2} src="s_mine" />
      <Say t={20.72} src="s_who" />
      <Say t={22.87} src="s_here" />
      <Sequence from={sec(24.85)} durationInFrames={sec(S.ai) - sec(24.85)}><Audio src={staticFile('vo/s_cry.wav')} volume={1.15} /></Sequence>
      <Say t={S.end + 0.02} src="s_mom2" vol={0.9} />
      <Say t={S.end + 0.0} src="s_code" vol={1.1} />
      <Sequence from={sec(S.gyul)}>
        <Audio src={staticFile('vo/s_gyul.wav')} trimBefore={27} volume={1.1} />
      </Sequence>
      <Sfx t={S.wide} src="sfx/thud.wav" vol={0.22} />
      <Sfx t={S.ai} src="sfx/thud.wav" vol={0.3} />
      <Sfx t={S.fss - 0.05} src="sfx/tok.wav" vol={0.3} />
      <Sfx t={38.7} src="sfx/끊김.wav" vol={0.6} />
      <Audio src={staticFile('bgm.wav')} volume={drone} />
    </AbsoluteFill>
  );
};

export { TOTAL };
