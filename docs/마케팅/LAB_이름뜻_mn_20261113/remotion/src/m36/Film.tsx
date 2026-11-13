// LAB 몽골 M36 「이름 뜻」 — 대학 교실 첫 출석. 교수가 「나란 씨?」 부르자 이름표 «Наран» 뒤에서 펠트 해가 솟고(핵심 장면), 「사라 씨?」에 달이 뜨고,
// 「볼드 씨?」에는 강철 빔이 볼드 책상에 쾅 떨어진다(웃음 반전). 끝은 해 아래 웃는 나란 — 「네 이름은 한국어로?」 댓글로 이름.
// 장면은 GPT 이미지(구독 경로)로 같은 카메라에서 구운 판 다섯(판/*.png, 지시문 판/*.txt — 맨 위 민무늬 벽만 세로로 늘려 글자 자리를 냈다).
// 화면 글은 상자 · 띠 없이 위쪽 밝은 벽의 짙은 글자(옅은 빛 테), 말은 말한 이 곁의 글자. 전부 useCurrentFrame()으로만 움직인다.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { FONT, KO, READ, TEXT } from './data';
import { fr, T } from './timeline';

// cloud는 맹검(v10) 「탁한 청회색」 · 밝은 창빛 위 몽글 꼬리표가 안 읽힘 — 짙고 맑은 푸른빛으로, askSmall용 sunDeep은 「댓글에!」 줄이 해 후광과 겹쳐 흐림
const C = { ink: '#2A2140', inkDim: 'rgba(42,33,64,0.82)', sun: '#D9730B', sunDeep: '#B35400', moon: '#3F5F96', steel: '#46525F', cloud: '#3F5BA6' };
const MASTER = 0.8; // Remotion은 소리를 16비트로 더해 넘치면 자른다 — 모든 볼륨에 같은 값을 곱한다
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const FULL: React.CSSProperties = { position: 'absolute', inset: 0, width: 1080, height: 1920, objectFit: 'cover' };
const pop = (t: number, at: number, d = 0.22) => interpolate(t, [at, at + d], [0, 1], { ...clamp, easing: Easing.out(Easing.back(2.2)) });
const GLOW = '0 2px 0 rgba(255,250,240,0.85), 0 0 16px rgba(255,248,235,0.95), 0 0 30px rgba(255,244,225,0.8)';
// 작은 줄(이름 줄)용 얇은 빛 테 — 굵은 빛 테는 올리기 전 검사 ⑤-2가 「흰 기본 글자」로 읽는다(v10 · v11)
const GLOW_THIN = '0 1px 0 rgba(255,250,240,0.7), 0 0 6px rgba(255,246,230,0.55)';
// 안전선(올리기 전 검사 SAFE — 왼 65 · 오른 920 · 위 269 · 아래 1428) 안에서 가운데
const SAFE_L = 70;
const SAFE_W = 845;

// 자리(판 1080x1920 기준, 굽고 나서 잰 값)
export const SPOT = {
  sun: [436, 828, 262] as [number, number, number], // 해 가운데 · 햇살까지 반지름
  moon: [834, 846, 160, 190] as [number, number, number, number], // 달 + 별
  beam: [930, 1452, 185, 112] as [number, number, number, number], // 강철 빔
  beamFall: [930, 1426, 190, 78] as [number, number, number, number], // 떨어지는 빔 몸통(앞의 이름표 «Болд»가 딸려 오지 않게 이름표 위까지 — 맹검 v10 「작고 뭉개진 덩어리」로 키움)
  cardN: [396, 1522] as [number, number],
  cardS: [660, 1522] as [number, number],
  cardB: [931, 1522] as [number, number],
  mongleCloud: [145, 1170, 140, 170] as [number, number, number, number], // 구름 위로 올라간 몽글
  headLine: 1108, // 이 줄 아래(머리 · 몸)로는 솟는 해 · 달이 안 보인다 — 머리 뒤에서 솟는 것처럼
  mongle: [139, 1350, 150, 185] as [number, number, number, number],
  naran: [404, 1300, 150, 235] as [number, number, number, number],
  saraa: [656, 1300, 145, 235] as [number, number, number, number],
  bold: [925, 1265, 165, 260] as [number, number, number, number],
};

// 카메라 — [초, 가운데 x, y, 크기] 사이를 부드럽게
const CAM: [number, number, number, number][] = [
  [0, 404, 1450, 1.2], // 처음엔 나란 · 이름표 가까이(장면 심사 v1 「인물이 작고 위가 빈 벽」)
  [0.5, 404, 1450, 1.23],
  [1.15, 420, 300, 1.03], // 해가 솟는 동안 뒤로 빠지며 해와 교실을 드러낸다 — 이후는 위(y 300)를 붙잡고 키워 해 · 달이 위쪽 글자 밑으로 내려가게
  [3.1, 420, 300, 1.05],
  [3.45, 700, 300, 1.05],
  [6.1, 700, 300, 1.05],
  [6.45, 900, 300, 1.09],
  [T.hit - 0.001, 900, 300, 1.09],
  [T.hit, 900, 300, 1.18], // 쾅 — 볼드와 빔으로 확 다가간다(v8 볼 이유 심사 「쇳덩이가 작다」)
  [7.9, 540, 300, 1.04],
  [8.6, 540, 300, 1.04],
  [9.1, 330, 300, 1.08], // 「몽글 씨?」 — 모두 두리번, 몽글 쪽으로
  [T.bloom - 0.001, 330, 300, 1.08],
  [T.bloom, 240, 300, 1.12], // 구름이 확 — 몽글 쪽으로 끊음
  [T.end - 0.001, 300, 300, 1.06],
  [T.end, 540, 300, 1.0],
  [T.ask, 430, 300, 1.0],
  [T.total, 430, 300, 1.08], // 끝 3초 — 해 아래 나란으로 다가간다(위를 붙잡고 키워 해가 글자 밑으로 내려가게)
];
const camAt = (t: number) => {
  let i = 0;
  while (i < CAM.length - 2 && t >= CAM[i + 1][0]) i++;
  const [a, b] = [CAM[i], CAM[i + 1]];
  const u = interpolate(t, [a[0], b[0]], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  return { x: a[1] + (b[1] - a[1]) * u, y: a[2] + (b[2] - a[2]) * u, z: a[3] + (b[3] - a[3]) * u };
};

// 같은 그림의 한 자리만 따로 움직인다 — 기쁨 · 놀람 · 들썩
const Patch: React.FC<{ img: string; s: [number, number, number, number]; dx?: number; dy?: number; rot?: number }> = ({ img, s, dx = 0, dy = 0, rot = 0 }) => {
  const [cx, cy, rx, ry] = s;
  const mask = `radial-gradient(ellipse ${rx}px ${ry}px at ${cx}px ${cy}px, black 70%, transparent 100%)`;
  return <Img src={staticFile(`img/${img}.jpg`)} style={{ ...FULL, WebkitMaskImage: mask, maskImage: mask, transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg)`, transformOrigin: `${cx}px ${cy + ry * 0.85}px` }} />;
};

// 솟는 것 — 다음 판의 그 물건 자리만 오려 아래(머리 뒤)에서 올린다. 머리 줄 아래로는 부드럽게 사라진다(네모 끝이 안 보이게)
const Rise: React.FC<{ img: string; cx: number; cy: number; rx: number; ry: number; dy: number; o: number }> = ({ img, cx, cy, rx, ry, dy, o }) => {
  const mask = `radial-gradient(ellipse ${rx}px ${ry}px at ${cx}px ${cy}px, black 66%, transparent 100%)`;
  const hide = `linear-gradient(to bottom, black 0px, black ${SPOT.headLine - 70}px, transparent ${SPOT.headLine}px)`;
  return (
    <div style={{ position: 'absolute', inset: 0, WebkitMaskImage: hide, maskImage: hide, opacity: o }}>
      <Img src={staticFile(`img/${img}.jpg`)} style={{ ...FULL, WebkitMaskImage: mask, maskImage: mask, transform: `translateY(${dy}px)` }} />
    </div>
  );
};

const Plate: React.FC<{ t: number; scene?: boolean }> = ({ t, scene }) => {
  const cam = camAt(t);
  // 판 차례 — 교실 → 해(자리 잡는 순간 빛이 번쩍일 때 끊음) → 달(같이) → 강철(쾅에서 끊음) → 끝(끊음) — 사람 얼굴이 겹쳐 비치지 않게 섞지 않는다
  const afterHit = t >= T.hit;
  // 쾅 — 흔들림 · 번쩍
  const u = t - T.hit;
  const shake = afterHit && u < 0.7 ? Math.exp(-u * 7) : 0;
  const shx = 34 * shake * Math.sin(u * 63);
  const shy = 26 * shake * Math.cos(u * 51);
  const hitPunch = afterHit ? interpolate(u, [0, 0.05, 0.5], [0, 1, 0], clamp) : 0;
  // 솟는 해 · 달
  const r1 = interpolate(t, [T.rise1, T.land1], [1, 0], { ...clamp, easing: Easing.out(Easing.back(1.4)) });
  const r2 = interpolate(t, [T.rise2, T.land2], [1, 0], { ...clamp, easing: Easing.out(Easing.back(1.4)) });
  // 떨어지는 강철 빔(쾅 전 0.2초)
  const f = interpolate(t, [T.fall, T.hit], [1, 0], { ...clamp, easing: Easing.in(Easing.quad) });
  // 이름표가 빛남
  const g1 = interpolate(t, [T.glow1, T.rise1, T.land1 + 0.3], [0, 1, 0], clamp);
  const g2 = interpolate(t, [T.glow2, T.rise2 + 0.1, T.land2 + 0.3], [0, 0.75, 0], clamp);
  const g3 = interpolate(t, [T.glow3, T.fall + 0.1, T.hit], [0, 0.7, 0], clamp);
  // 꽃이 필 때 분홍 빛이 번쩍
  const bl = t >= T.bloom ? interpolate(t - T.bloom, [0, 0.06, 0.45], [0, 0.42, 0], clamp) : 0;
  const bloomPunch = t >= T.bloom ? interpolate(t - T.bloom, [0, 0.08, 0.5], [0, 1, 0], clamp) : 0;
  // 해 · 달이 떠오르는 동안 빛이 번짐
  // 해가 자리 잡는 순간 금빛이 확 번지고, 그 뒤로도 햇빛이 숨 쉰다(장면 심사 v1 「2.5~3초 다시 정지」)
  const sunGlow = interpolate(t, [T.rise1, T.land1, T.land1 + 0.6], [0, 0.78, 0.16], clamp) + (t > T.land1 + 0.6 && t < T.hit ? 0.08 * (1 + Math.sin((t - T.land1) * 3.4)) : 0);
  const punch = interpolate(t, [T.land1 - 0.02, T.land1 + 0.06, T.land1 + 0.45], [0, 1, 0], clamp);
  const moonGlow = interpolate(t, [T.rise2, T.land2, T.land2 + 0.6], [0, 0.5, 0.08], clamp);
  const ris1 = interpolate(t, [T.rise1, T.rise1 + 0.12], [0, 1], clamp);
  const ris2 = interpolate(t, [T.rise2, T.rise2 + 0.12], [0, 1], clamp);
  const flash = afterHit ? interpolate(u, [0, 0.04, 0.22], [0, 0.48, 0], clamp) : 0;
  const dust = afterHit ? interpolate(u, [0, 0.12, 0.8], [0, 0.7, 0], clamp) : 0;
  const dustR = afterHit ? interpolate(u, [0, 0.8], [90, 330], clamp) : 0;
  // 사람 · 몽글 들썩(작게 — 판을 늘였다 줄이지 않는다)
  const bob = (at: number, h: number, w = 2.6, dur = 1.2) => {
    const v = t - at;
    if (v < 0 || v > dur) return 0;
    return -h * Math.abs(Math.sin(v * Math.PI * w)) * (1 - v / dur);
  };
  const base = t < T.land1 ? 'class' : t < T.land2 ? 'sun' : !afterHit ? 'moon' : t < T.settle ? 'steel' : t < T.bloom ? 'steel2' : t < T.end ? 'cloud' : 'end';
  const sway = (k: number) => 1.6 * Math.sin(t * 2.1 + k);
  // 구름 위 몽글의 들썩 — 꼬리표도 같은 값으로 따라간다
  const cloudDy = bob(T.bloom + 0.05, 22, 2.0, 1.2) - 6 * Math.abs(Math.sin((t - T.bloom) * 2.2));
  // 떨어지는 빔의 빠르기(0 → 1) — 잔상 간격
  const fallP = interpolate(t, [T.fall, T.hit], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ transform: `translate(${shx}px, ${shy}px) scale(${cam.z * (1 + 0.03 * punch + 0.035 * bloomPunch + 0.06 * hitPunch)})`, transformOrigin: `${cam.x}px ${cam.y}px` }}>
      <Img src={staticFile(`img/${base}.jpg`)} style={FULL} />
      {/* 판마다 사람 · 몽글이 조금씩 움직인다 — 해가 뜨면 나란은 들썩, 몽글은 깡충 */}
      {base === 'sun' ? <Patch img="sun" s={SPOT.naran} dy={bob(T.land1, 12, 2.6, 2.4)} /> : null}
      {base === 'sun' ? <Patch img="sun" s={SPOT.mongle} dy={bob(T.land1 + 0.15, 30, 2.2, 1.0) + bob(T.land1 + 1.3, 16, 2.4, 0.8)} rot={sway(0)} /> : null}
      {base === 'sun' ? <Patch img="sun" s={SPOT.bold} dy={bob(T.land1 + 0.3, 6, 3, 0.8)} /> : null}
      {base === 'moon' ? <Patch img="moon" s={SPOT.saraa} dy={bob(T.land2 - 0.1, 9, 1.8)} rot={1.2 * Math.sin((t - T.land2) * 3)} /> : null}
      {base === 'moon' ? <Patch img="moon" s={SPOT.mongle} rot={sway(1)} /> : null}
      {base === 'steel' ? <Patch img="steel" s={SPOT.mongle} dy={bob(T.hit, 26, 2.2, 1.0)} rot={-3 * Math.exp(-(t - T.hit) * 2) * Math.cos((t - T.hit) * 12)} /> : null}
      {base === 'steel' ? <Patch img="steel" s={SPOT.bold} dy={bob(T.hit + 0.15, 8, 3, 1.4)} /> : null}
      {/* 「체첵 씨?」 — 대답이 없어 몽글이 두리번 */}
      {base === 'steel2' ? <Patch img="steel2" s={SPOT.mongle} dy={bob(T.p4 + 0.55, 14, 2.4, 0.6)} rot={t > T.p4 + 0.3 ? 4 * Math.sin((t - T.p4 - 0.3) * 5.5) : 0} /> : null}
      {/* 「몽글 씨?」 — 몽글 둘레에 폭신한 구름이 피어 몽글을 들어 올린다(몽글몽글) */}
      {base === 'cloud' ? <Patch img="cloud" s={SPOT.mongleCloud} dy={cloudDy} rot={2 * Math.sin((t - T.bloom) * 2.6)} /> : null}
      {base === 'cloud' && !scene ? <MongleTag t={t} dy={cloudDy} /> : null}
      {base === 'end' ? <Patch img="end" s={SPOT.naran} dy={-6 * Math.abs(Math.sin((t - T.end) * 2.6))} /> : null}
      {base === 'end' ? <Patch img="end" s={SPOT.bold} dy={-5 * Math.abs(Math.sin((t - T.end) * 3.1 + 0.6))} /> : null}
      {/* 끝 — 몽글이 한 번 크게 깡충(맹검 v10 「끝을 닫는 새 움직임이 없다」) */}
      {base === 'end' ? <Patch img="end" s={SPOT.mongleCloud} dy={-7 * Math.abs(Math.sin((t - T.ask) * 2.2)) + bob(T.hop, 46, 2.0, 1.0)} rot={t > T.hop && t < T.hop + 1 ? 5 * Math.sin((t - T.hop) * 12) * (1 - (t - T.hop)) : 0} /> : null}
      {/* 이름표가 빛남 */}
      {g1 > 0 ? <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 200px 120px at ${SPOT.cardN[0]}px ${SPOT.cardN[1]}px, #FFE7A0 0%, transparent 72%)`, opacity: g1, mixBlendMode: 'screen' }} /> : null}
      {g2 > 0 ? <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 200px 120px at ${SPOT.cardS[0]}px ${SPOT.cardS[1]}px, #DDE8FF 0%, transparent 72%)`, opacity: g2, mixBlendMode: 'screen' }} /> : null}
      {g3 > 0 ? <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 200px 120px at ${SPOT.cardB[0]}px ${SPOT.cardB[1]}px, #E4ECF5 0%, transparent 72%)`, opacity: g3, mixBlendMode: 'screen' }} /> : null}
      {bl > 0 ? <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle 460px at ${SPOT.mongleCloud[0]}px ${SPOT.mongleCloud[1]}px, #FFFFFF 0%, transparent 70%)`, opacity: bl, mixBlendMode: 'screen' }} /> : null}
      {/* 해가 이름표 뒤(나란 머리 뒤)에서 솟는다 */}
      {t >= T.rise1 && t < T.land1 ? <Rise img="sun" cx={SPOT.sun[0]} cy={SPOT.sun[1]} rx={SPOT.sun[2]} ry={SPOT.sun[2]} dy={r1 * 520} o={ris1} /> : null}
      {sunGlow > 0 ? <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle 620px at ${SPOT.sun[0]}px ${SPOT.sun[1] + r1 * 520}px, #FFD36B 0%, transparent 70%)`, opacity: sunGlow, mixBlendMode: 'screen' }} /> : null}
      {/* 달이 사라 머리 뒤에서 뜬다 */}
      {t >= T.rise2 && t < T.land2 ? <Rise img="moon" cx={SPOT.moon[0]} cy={SPOT.moon[1]} rx={SPOT.moon[2]} ry={SPOT.moon[3]} dy={r2 * 480} o={ris2} /> : null}
      {moonGlow > 0 ? <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle 420px at ${SPOT.moon[0]}px ${SPOT.moon[1] + r2 * 480}px, #CFE0FF 0%, transparent 70%)`, opacity: moonGlow, mixBlendMode: 'screen' }} /> : null}
      {/* 강철 빔이 위에서 떨어진다(쾅 전) — 책상에 그림자가 커진다 */}
      {t >= T.fall && !afterHit ? (
        <>
          <div style={{ position: 'absolute', left: SPOT.beam[0] - 170, top: SPOT.beam[1] + 40, width: 340, height: 70, borderRadius: '50%', background: 'rgba(40,20,5,0.55)', filter: 'blur(14px)', transform: `scale(${1.1 - 0.9 * f})`, opacity: 1 - f * 0.7 }} />
          {/* 천장 밖에서 들어와 떨어진다 — 잔상 둘로 빠르기를 보인다(맹검 v10 「달 위에 느리게 떠 있다가 순간이동」) */}
          {[2, 1].map((k) => (
            <div key={k} style={{ position: 'absolute', inset: 0, opacity: 0.16 * (3 - k) }}>
              <Patch img="steel" s={SPOT.beamFall} dy={-1500 * f - 70 * k * fallP} />
            </div>
          ))}
          <Patch img="steel" s={SPOT.beamFall} dy={-1500 * f} />
        </>
      ) : null}
      {dust > 0 ? <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse ${dustR}px ${dustR * 0.55}px at ${SPOT.beam[0]}px ${SPOT.beam[1] + 20}px, rgba(235,225,210,0.95) 0%, transparent 75%)`, opacity: dust }} /> : null}
      {flash > 0 ? <div style={{ position: 'absolute', inset: 0, background: '#FFFFFF', opacity: flash }} /> : null}
    </AbsoluteFill>
  );
};

// 화면 글 — 판 없이 위쪽 밝은 벽에: 작은 줄(옅게) + 큰 줄(굵게), 짙은 글자 + 옅은 빛 테
const Title: React.FC<{ t: number; at: number; until: number; small?: string; big: string; size?: number; top?: number; color?: string }> = ({ t, at, until, small, big, size = 84, top = 300, color }) => {
  if (t < at || t >= until) return null;
  const a = interpolate(t, [at, at + 0.2], [0, 1], { ...clamp, easing: EASE_OUT });
  const out = interpolate(t, [until - 0.12, until], [1, 0], clamp);
  return (
    <div style={{ position: 'absolute', left: SAFE_L, width: SAFE_W, top, textAlign: 'center', opacity: a * out, transform: `translateY(${(1 - a) * 16}px)`, textShadow: GLOW }}>
      {small ? <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 52, lineHeight: 1.2, color: C.inkDim }}>{small}</div> : null}
      <div style={{ fontFamily: /[가-힣]/.test(big) ? KO : FONT, fontWeight: 800, fontSize: size, lineHeight: 1.12, color: color ?? C.ink, marginTop: small ? 4 : 0, whiteSpace: 'pre-line' }}>{big}</div>
    </div>
  );
};

// 끝 — 「몽골 이름은 다 뜻이 있다」(작게) → 「네 이름은?」(크게) → 「댓글에!」(해 빛깔) — 이해 시험 v5 셋이 「작은 안내 줄을 못 읽음」이라 짧고 크게
const Ask: React.FC<{ t: number }> = ({ t }) => {
  if (t < T.ask) return null;
  const a = interpolate(t, [T.ask, T.ask + 0.2], [0, 1], { ...clamp, easing: EASE_OUT });
  const b = pop(t, T.ask + 0.3);
  const c = pop(t, T.ask + 0.75);
  return (
    <div style={{ position: 'absolute', left: SAFE_L, width: SAFE_W, top: 278, textAlign: 'center', textShadow: GLOW }}>
      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 54, lineHeight: 1.2, color: C.ink, opacity: a }}>{TEXT.askTop}</div>
      <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 118, lineHeight: 1.08, color: C.ink, transform: `scale(${b})`, transformOrigin: '50% 60%' }}>{TEXT.ask}</div>
      <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 64, lineHeight: 1.2, color: C.sunDeep, transform: `scale(${c})`, marginTop: 4 }}>{TEXT.askSmall}</div>
    </div>
  );
};

// 낱말 한 칸 — 한글(크게) · 키릴 읽기 · 몽골 뜻 세 줄
const Word: React.FC<{ t: number; at: number; until: number; name: string; ko: string; read: string; mean: string; color: string; size?: number; top?: number }> = ({ t, at, until, name, ko, read, mean, color, size = 118, top = 276 }) => {
  if (t < at || t >= until) return null;
  const a = pop(t, at);
  const out = interpolate(t, [until - 0.12, until], [1, 0], clamp);
  return (
    <div style={{ position: 'absolute', left: SAFE_L, width: SAFE_W, top, textAlign: 'center', opacity: out, transform: `scale(${a})`, transformOrigin: '50% 60%', textShadow: GLOW }}>
      {/* 이름 줄은 빛 테가 획보다 굵어 올리기 전 검사 ⑤-2가 「흰 기본 글자」로 읽었다(v10 · 58px로 키운 v11도) — 58px · 900 + 얇은 빛 테 */}
      <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 58, lineHeight: 1.2, color: C.ink, textShadow: GLOW_THIN }}>{name}</div>
      <div style={{ fontFamily: KO, fontWeight: 900, fontSize: size, lineHeight: 1.0, color }}>{ko}</div>
      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 58, lineHeight: 1.2, color: C.ink }}>[{read}]</div>
      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 58, lineHeight: 1.1, color: C.ink }}>{mean}</div>
    </div>
  );
};

// 말 — 말한 이 곁에 글자만(상자 · 테두리 없음). sub는 그 이름의 키릴
const Say: React.FC<{ t: number; from: number; until: number; x: number; y: number; text: string; size?: number; rot?: number; sub?: string; gloss?: string; who?: string; color?: string }> = ({ t, from, until, x, y, text, size = 96, rot = -4, sub, gloss, who, color }) => {
  if (t < from || t >= until) return null;
  const a = pop(t, from);
  const out = interpolate(t, [until - 0.1, until], [1, 0], clamp);
  return (
    <div style={{ position: 'absolute', left: x, top: y, transform: `translate(-50%, -50%) rotate(${rot}deg) scale(${a})`, opacity: out, textAlign: 'center', whiteSpace: 'nowrap', textShadow: GLOW }}>
      {who ? <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 44, lineHeight: 1.2, color: C.inkDim }}>{who}</div> : null}
      <div style={{ fontFamily: KO, fontWeight: 900, fontSize: size, lineHeight: 1.08, color: color ?? C.ink }}>{text}</div>
      {sub ? <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 58, lineHeight: 1.2, color: C.ink }}>{sub}</div> : null}
      {gloss ? <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 66, lineHeight: 1.15, color: C.sun, margin: '8px auto 0', width: 820, whiteSpace: 'normal' }}>{gloss}</div> : null}
    </div>
  );
};

// 몽글 이름 꼬리표 — 셋은 책상 이름표가 있는데 몽글만 없어 「빨간 인형이 몽글인지 모르겠다」(v8 GPT · 그록). 구름이 필 때 머리 위에 «몽글 ▼».
// 판(카메라) 안 좌표로 두고 몽글과 같은 dy로 움직인다 — 화면에 고정하니 구름 타고 올라오는 머리가 글자에 부딪혔다(맹검 v10)
const MongleTag: React.FC<{ t: number; dy: number }> = ({ t, dy }) => {
  if (t < T.bloom + 0.12 || t >= T.end) return null;
  const a = pop(t, T.bloom + 0.12);
  const out = interpolate(t, [T.end - 0.12, T.end], [1, 0], clamp);
  return (
    <div style={{ position: 'absolute', left: 160, top: 918 + dy, transform: `translate(-50%, 0) scale(${a})`, transformOrigin: '50% 100%', opacity: out, textAlign: 'center', whiteSpace: 'nowrap', textShadow: GLOW }}>
      <div style={{ fontFamily: KO, fontWeight: 900, fontSize: 64, lineHeight: 1.0, color: C.cloud }}>몽글</div>
      <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 28, lineHeight: 1.0, color: C.cloud, marginTop: 2 }}>▼</div>
    </div>
  );
};

const Vo: React.FC<{ id: string; at: number; vol?: number }> = ({ id, at, vol = 1 }) => (
  <Sequence from={fr(at)} layout="none">
    <Audio src={staticFile(`vo/${id}.wav`)} volume={vol * MASTER} />
  </Sequence>
);
const Sfx: React.FC<{ file: string; at: number; vol: number }> = ({ file, at, vol }) => (
  <Sequence from={Math.max(0, fr(at))} layout="none">
    <Audio src={staticFile(`sfx/${file}`)} volume={vol * MASTER} />
  </Sequence>
);
const Sound: React.FC = () => (
  <>
    <Audio src={staticFile('sfx/bgm.wav')} volume={(f) => 0.19 * MASTER * interpolate(f / 30, [0, T.total - 0.5, T.total], [1, 1, 0], clamp)} />
    <Audio src={staticFile('sfx/room.wav')} volume={(f) => 0.3 * MASTER * interpolate(f / 30, [0, 0.3, T.total - 0.4, T.total], [0, 1, 1, 0], clamp)} />
    <Vo id="p1" at={T.p1} />
    <Sfx file="glow.wav" at={T.glow1} vol={0.32} />
    <Sfx file="rise.wav" at={T.rise1} vol={0.5} />
    <Sfx file="pop.wav" at={T.w1} vol={0.25} />
    <Vo id="k1" at={T.w1 + 0.08} />
    <Sfx file="whoosh.wav" at={T.p2 - 0.3} vol={0.25} />
    <Vo id="p2" at={T.p2} />
    <Sfx file="glow.wav" at={T.glow2} vol={0.28} />
    <Sfx file="twinkle.wav" at={T.rise2} vol={0.5} />
    <Sfx file="pop.wav" at={T.w2} vol={0.25} />
    <Vo id="k2" at={T.w2 + 0.08} />
    <Sfx file="whoosh.wav" at={T.p3 - 0.3} vol={0.25} />
    <Vo id="p3" at={T.p3} />
    <Sfx file="glow.wav" at={T.glow3} vol={0.22} />
    <Sfx file="fall.wav" at={T.hit - 0.45} vol={0.42} />
    <Sfx file="thud.wav" at={T.hit} vol={0.95} />
    <Sfx file="boing.wav" at={T.hit + 0.06} vol={0.35} />
    <Sfx file="pop.wav" at={T.w3} vol={0.25} />
    <Vo id="k3" at={T.w3 + 0.08} />
    <Vo id="p5" at={T.p4} />
    <Sfx file="tick.wav" at={T.p4 + 0.7} vol={0.28} />
    <Sfx file="puff.wav" at={T.bloom - 0.05} vol={0.55} />
    <Sfx file="boing.wav" at={T.bloom + 0.1} vol={0.3} />
    <Sfx file="pop.wav" at={T.w4} vol={0.25} />
    <Vo id="k4" at={T.w4 + 0.08} />
    <Sfx file="whoosh.wav" at={T.end - 0.1} vol={0.18} />
    <Sfx file="glow.wav" at={T.ask - 0.1} vol={0.26} />
    <Sfx file="pop.wav" at={T.ask + 0.3} vol={0.22} />
    <Sfx file="boing.wav" at={T.hop} vol={0.32} />
  </>
);

// 장면 심사용(scene)에는 화면 글을 빼고 장면의 말 · 소리만 남긴다
export const Film: React.FC<{ scene?: boolean }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const t = frame / 30;
  return (
    <AbsoluteFill style={{ background: '#2A1A10' }}>
      <Plate t={t} scene={scene} />
      {!scene ? (
        <>
          <Title t={t} at={-1} until={T.hookTo} big={TEXT.hook} size={68} top={292} />
          {/* 첫 부름 글은 해가 솟을 자리에 — 해가 올라오며 글을 밀어낸다 */}
          <Say t={t} from={T.p1} until={T.rise1 + 0.1} x={436} y={760} text="나란 씨?" sub={TEXT.naran} who={TEXT.teacher} rot={-3} />
          <Word t={t} at={T.w1} until={T.p2 - 0.05} name={`${TEXT.naran} → 나란`} ko="해" read={READ.hae} mean={TEXT.sun} color={C.sun} />
          <Say t={t} from={T.p2} until={T.w2} x={492} y={445} text="사라 씨?" sub={TEXT.saraa} gloss={TEXT.ssi} who={TEXT.teacher} rot={-2} />
          <Word t={t} at={T.w2} until={T.p3 - 0.05} name={`${TEXT.saraa} → 사라`} ko="달" read={READ.dal} mean={TEXT.moon} color={C.moon} />
          <Say t={t} from={T.p3} until={T.hit} x={492} y={420} text="볼드 씨?" sub={TEXT.bold} who={TEXT.teacher} rot={-3} />
          <Word t={t} at={T.w3} until={T.p4 - 0.05} name={`${TEXT.bold} → 볼드`} ko="강철" read={READ.gangcheol} mean={TEXT.steel} color={C.steel} />
          <Say t={t} from={T.p4} until={T.w4} x={492} y={420} text="몽글 씨?" sub={TEXT.mongleAsk} who={TEXT.teacher} rot={-3} />
          <Word t={t} at={T.w4} until={T.end} name={TEXT.mongleName} ko="몽글몽글" read={READ.mongle} mean={TEXT.fluffy} color={C.cloud} />
          <Ask t={t} />
        </>
      ) : null}
      <Sound />
    </AbsoluteFill>
  );
};
