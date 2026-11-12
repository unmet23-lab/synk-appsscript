// LAB 몽골 M37 「피곤할 때 네 마디」(11-09) — 머리 칸(1% · 녹아내린 몽글) → 하루의 네 칸(상황 → 표현, 왼쪽 배터리가 칸마다 줄어든다) → 1%에 친구 문자 「노래방 갈래?」 → 100%로 번쩍 → 노래방 「한 곡 더!」.
// 우리편 M1 「화날 때 네 마디」의 틀 · 말풍선 꼴을 M31에서 가져왔다. 그림은 장면마다 구운 한 장(누끼 없음). 같은 판을 부드러운 타원 가면으로 겹쳐 그 자리만 움직인다.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { EN, KO } from '../lib/fonts';
import { BGM_HIGH, BGM_LOW, Bubble as BubbleData, CELLS, CHARGE_AT, END_AT, FPS, KARAOKE_AT, MONGLE, MSG_AT, NEXT_AT, SFX, TEXT, TOTAL, UP_AT } from './data';

const fr = (sec: number) => Math.round(sec * FPS);
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const MASTER = 0.8; // Remotion은 소리를 16비트로 더해 넘치면 자른다 — 모든 볼륨에 같은 값을 곱한다(현장 노트)
export const TOTAL_FRAMES = fr(TOTAL);
export { FPS };
export const SCENE_FROM = 24.4;

const INK = '#2B2522';
const MEAN = '#B8325A';
const ROSE = '#E2456B';
const CREAM = '#FFFDF7';
const FONT = "'Inter Tight', 'SUIT', sans-serif";
const FULL: React.CSSProperties = { position: 'absolute', inset: 0, width: 1080, height: 1920, objectFit: 'cover' };
// v10(11-10 15시 회차) — GPT 대체 맹검 v9 넷 다 기각 「글 상자가 둘 셋 쌓인 학습지 틀 · 스피커 이모지 · 배터리 표지판」 → 상자 · 테두리 · 이모지를 모두 걷고
// 글자만 둔다: 위는 어두운 빛(그늘) 위 크림 글자, 말은 몽글 곁 글자 + 부드러운 그늘, 배터리는 가는 선 하나.
const SH = '0 3px 0 rgba(24,12,8,0.5), 0 5px 18px rgba(16,8,4,0.62)';
const PINK = '#FFC2D0';
const DIM = 'rgba(255,248,236,0.84)';
const Glow: React.FC<{ x: number; y: number; w: number; h: number; a?: number }> = ({ x, y, w, h, a = 0.5 }) => <div style={{ position: 'absolute', left: x - w / 2, top: y - h / 2, width: w, height: h, background: `radial-gradient(ellipse at 50% 50%, rgba(22,12,8,${a}) 0%, rgba(22,12,8,${a * 0.55}) 45%, rgba(22,12,8,0) 72%)` }} />;
const bump = (t: number, at: number, up = 0.05, down = 0.35) => interpolate(t, [at - 0.02, at + up, at + down], [0, 1, 0], clamp);

const cellAt = (sec: number) => {
  let i = 0;
  CELLS.forEach((c, k) => {
    if (sec >= c.at) i = k;
  });
  return i;
};

const Patch: React.FC<{ img: string; cx: number; cy: number; rx: number; ry: number; sx?: number; sy?: number; dx?: number; dy?: number; rot?: number; ox?: number; oy?: number }> = ({ img, cx, cy, rx, ry, sx = 1, sy = 1, dx = 0, dy = 0, rot = 0, ox, oy }) => {
  const mask = `radial-gradient(ellipse ${rx}px ${ry}px at ${cx}px ${cy}px, black 78%, transparent 100%)`;
  return <Img src={staticFile(`img/${img}`)} style={{ ...FULL, WebkitMaskImage: mask, maskImage: mask, transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(${sx}, ${sy})`, transformOrigin: `${ox ?? cx}px ${oy ?? cy + ry * 0.75}px` }} />;
};

const Plate: React.FC<{ i: number; t: number }> = ({ i, t }) => {
  const c = CELLS[i];
  const end = i + 1 < CELLS.length ? CELLS[i + 1].at : TOTAL;
  const img = c.img;
  const m = MONGLE[img];
  let z = interpolate(t, [c.at, end], [1, 1.05], clamp);
  let ox = 540;
  let oy = 1100;
  let dx = 0;
  let dy = 0;
  // 표현 칸 — 말이 터질 때 한 번 당김, 둘째 말에 더 다가감
  if (c.bubble) {
    z += 0.05 * bump(t, c.at, 0.06, 0.45);
    const second = (c.vo ?? [])[1];
    if (second && t >= second.at - 0.05) z *= 1.09;
    ox = m.cx;
    oy = m.cy;
  }
  if (img === 'open.jpg') {
    z = interpolate(t, [0, 3.2], [1.0, 1.1], { ...clamp, easing: Easing.inOut(Easing.quad) });
    ox = m.cx;
    oy = m.cy;
  }
  // 몽글의 움직임
  let msx = 1 + 0.012 * Math.sin(t * 5.5);
  let msy = 2 - msx;
  let mdx = 0;
  let mdy = 0;
  let mrot = 0;
  for (const v of c.vo ?? []) {
    const b = bump(t, v.at, 0.05, 0.3);
    msx += 0.03 * b;
    msy += 0.03 * b;
  }
  if (img === 'open.jpg') {
    // 녹아내린 채 숨만 — 천천히 더 퍼진다
    const melt = interpolate(t, [0, 3.2], [0, 1], clamp);
    msx = 1 + 0.03 * melt + 0.01 * Math.sin(t * 3);
    msy = 1 - 0.025 * melt + 0.012 * Math.sin(t * 3);
  }
  if (img === 'class1.jpg') {
    // 꾸벅꾸벅 — 앞으로 고개가 떨어졌다 번쩍
    const nod = (t - c.at) % 0.9;
    mrot = -2 + 7 * interpolate(nod, [0, 0.62, 0.72, 0.9], [0, 1, 0.1, 0], clamp);
    mdy = 18 * interpolate(nod, [0, 0.62, 0.72, 0.9], [0, 1, 0.1, 0], clamp);
  }
  if (img === 'class2.jpg') {
    // 책상에 쿵 — 판이 한 번 튄다
    dy = 16 * interpolate(t, [c.at, c.at + 0.06, c.at + 0.4], [0, 1, 0], clamp);
    msy *= 1 - 0.05 * bump(t, c.at, 0.06, 0.5);
  }
  if (img === 'sub1.jpg') {
    // 지하철 덜컹 — 온 판이 흔들리고 몽글은 더 크게
    dx = 5 * Math.sin(t * 15);
    dy = 4 * Math.sin(t * 23);
    mdx = 10 * Math.sin(t * 15 + 0.6);
  }
  if (img === 'sub2.jpg') {
    dx = 5 * Math.sin(t * 15);
    dy = 3 * Math.sin(t * 23);
    // 더 눌린다 — 옆으로 납작
    const sq = interpolate(t, [c.at, c.at + 0.2], [0, 1], { ...clamp, easing: Easing.out(Easing.back(2)) });
    msx += 0.05 * sq + 0.015 * Math.sin(t * 15);
    msy -= 0.05 * sq;
  }
  if (img === 'store1.jpg') mrot = 1.2 * Math.sin(t * 2.2);
  if (img === 'store2.jpg') {
    // 상자에 푹 — 판이 한 번 튀고, 밖으로 나온 몸이 잠든 숨으로 들썩이다 말할 때 꿈틀
    dy = 22 * interpolate(t, [c.at, c.at + 0.05, c.at + 0.5], [0, 1, 0], clamp);
    dx = 9 * Math.sin(t * 60) * interpolate(t, [c.at, c.at + 0.6], [1, 0], clamp);
    const breath = Math.sin(t * 2.4);
    msy = 1 + 0.028 * breath + 0.04 * bump(t, 14.52, 0.05, 0.3) + 0.04 * bump(t, 16.0, 0.05, 0.3);
    msx = 1 - 0.012 * breath;
    mrot = -1.4 * Math.sin(t * 1.2);
  }
  if (img === 'desk1.jpg') {
    // 고개가 천천히 내려간다
    mdy = 26 * interpolate(t, [c.at, end], [0, 1], clamp);
    msy -= 0.03 * interpolate(t, [c.at, end], [0, 1], clamp);
  }
  if (img === 'desk2.jpg') {
    const melt = interpolate(t, [c.at, c.at + 1.6], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
    msx = 1 + 0.07 * melt + 0.008 * Math.sin(t * 4);
    msy = 1 - 0.06 * melt;
  }
  if (img === 'phone.jpg') {
    // 휴대폰이 울리면 눈만 번쩍 — 살짝 들썩
    z = interpolate(t, [c.at, end], [1.0, 1.14], { ...clamp, easing: Easing.inOut(Easing.quad) });
    ox = 500;
    oy = 1200;
    mdy = -10 * bump(t, 23.25, 0.1, 0.6);
    if (t >= CHARGE_AT) {
      // 충전 — 몽글이 떨리며 부푼다
      const up = interpolate(t, [CHARGE_AT, UP_AT], [0, 1], clamp);
      mdx = 8 * up * Math.sin(t * 90);
      msy = 1 + 0.55 * up * up;
      msx = 1 - 0.1 * up;
      mdy = -60 * up;
    }
  }
  if (img === 'up.jpg') {
    z = interpolate(t, [UP_AT, UP_AT + 0.1, UP_AT + 0.8, end], [1.2, 1.06, 1.02, 1.0], { ...clamp, easing: Easing.out(Easing.cubic) });
    ox = m.cx;
    oy = m.cy;
    // 이불 위에 선 판(판/번쩍2.txt — 허공에 뜬 휴대폰은 「AI 생성물 티」, 아르곤 맹검 v6 [K21])이라 몸을 띄우지 않고 위로 늘였다 줄인다(늘 1 이상 — 밑의 원래 몸이 비치지 않게)
    msy = 1 + 0.07 * Math.abs(Math.sin((t - UP_AT) * 6.2)) * Math.max(0, 1 - (t - UP_AT) / 1.6);
    msx = 1 + 0.015 * Math.abs(Math.sin((t - UP_AT) * 6.2 + 1.2)) * Math.max(0, 1 - (t - UP_AT) / 1.6);
    const s = interpolate(t, [UP_AT, UP_AT + 0.6], [1, 0], clamp);
    dx = 12 * s * Math.sin(t * 80);
    dy = 9 * s * Math.cos(t * 67);
  }
  if (img === 'next.jpg') {
    dy = 18 * interpolate(t, [c.at, c.at + 0.06, c.at + 0.4], [0, 1, 0], clamp);
    z = interpolate(t, [c.at, end], [1.0, 1.08], clamp);
    ox = m.cx;
    oy = m.cy;
    msy *= 1 - 0.05 * bump(t, c.at, 0.06, 0.5);
  }
  if (img === 'karaoke.jpg') {
    z = interpolate(t, [KARAOKE_AT, KARAOKE_AT + 0.1, end], [1.1, 1.04, 1.1], clamp);
    ox = m.cx;
    oy = m.cy;
    // 박에 맞춰 좌우로 흔든다(곡 없이 탬버린 0.25초)
    mrot = 5 * Math.sin((t - KARAOKE_AT) * Math.PI * 2);
    mdy = -16 * Math.abs(Math.sin((t - KARAOKE_AT) * Math.PI * 2));
  }
  return (
    <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: '#2a1d16' }}>
      <AbsoluteFill style={{ transform: `translate(${dx}px, ${dy}px) scale(${z})`, transformOrigin: `${ox}px ${oy}px` }}>
        <Img src={staticFile(`img/${img}`)} style={FULL} />
        {img === 'phone.jpg' ? <Patch img="phone.jpg" cx={368} cy={1310} rx={290} ry={350} rot={phoneBuzz(t) * 0.45} dx={phoneBuzz(t)} /> : null}
        {img === 'phone.jpg' ? <PhoneGlow t={t} /> : null}
        <Patch img={img} cx={m.cx} cy={m.cy} rx={m.rx} ry={m.ry} sx={msx} sy={msy} dx={mdx} dy={mdy} rot={mrot} />
        {img === 'karaoke.jpg' ? <Patch img="karaoke.jpg" cx={919} cy={1046} rx={165} ry={215} rot={7 * Math.sin((t - KARAOKE_AT) * Math.PI * 4)} dy={-10 * Math.abs(Math.sin((t - KARAOKE_AT) * Math.PI * 4))} oy={1230} /> : null}
        {img === 'karaoke.jpg' ? <Disco t={t} /> : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// 휴대폰 진동 — 효과음 buzz.wav와 같은 초
const phoneBuzz = (t: number) => {
  const on = (t >= 22.65 && t < 22.95) || (t >= 23.07 && t < 23.37);
  return on ? 7 * Math.sin(t * 130) : 0;
};

// 휴대폰 불빛 — 울릴 때 번쩍인다(판 안 화면 자리)
const PhoneGlow: React.FC<{ t: number }> = ({ t }) => {
  const a = 0.25 + 0.5 * bump(t, 22.65, 0.05, 0.3) + 0.5 * bump(t, 23.07, 0.05, 0.3);
  return <div style={{ position: 'absolute', left: 150, top: 1000, width: 460, height: 560, background: 'radial-gradient(ellipse at 50% 50%, rgba(255,235,245,0.9) 0%, rgba(255,235,245,0) 68%)', opacity: a, mixBlendMode: 'screen' }} />;
};

// 노래방 불빛 — 색 점이 벽을 돈다
const Disco: React.FC<{ t: number }> = ({ t }) => (
  <>
    {[0, 1, 2, 3, 4, 5, 6].map((k) => {
      const a = t * 1.7 + k * 0.9;
      const x = 540 + 480 * Math.cos(a);
      const y = 1000 + 620 * Math.sin(a * 0.8 + k);
      const c = ['#FF6FA8', '#4FE0D2', '#FFD24F', '#B58CFF'][k % 4];
      return <div key={k} style={{ position: 'absolute', left: x - 100, top: y - 100, width: 200, height: 200, borderRadius: '50%', background: `radial-gradient(circle, ${c} 0%, transparent 68%)`, opacity: 0.32, mixBlendMode: 'screen' }} />;
    })}
  </>
);

// 왼쪽 배터리 — 칸마다 줄어든다, 1%면 빨갛게 깜빡, 충전되면 100%
const batteryAt = (t: number) => {
  if (t < 3.2) return 0.01;
  let from = 1;
  let to = 1;
  let at = 0;
  CELLS.forEach((c) => {
    if (c.bubble && t >= c.at) {
      from = to;
      to = c.bubble.battery;
      at = c.at + 0.2;
    }
  });
  let v = interpolate(t, [at, at + 0.4], [from, to], { ...clamp, easing: Easing.out(Easing.cubic) });
  if (t >= CHARGE_AT) v = interpolate(t, [CHARGE_AT, UP_AT], [0.01, 1], { ...clamp, easing: Easing.in(Easing.quad) });
  if (t >= NEXT_AT) v = interpolate(t, [NEXT_AT, NEXT_AT + 0.25], [1, 0.01], { ...clamp, easing: Easing.out(Easing.cubic) });
  return v;
};
const Battery: React.FC<{ t: number; scene?: boolean }> = ({ t }) => {
  const v = batteryAt(t);
  const low = v < 0.08;
  const blink = low ? (Math.sin(t * 9) > -0.1 ? 1 : 0.35) : 1;
  const full = t >= UP_AT && t < NEXT_AT;
  const grow = 1 + (full ? 0.22 * interpolate(t, [UP_AT, UP_AT + 0.12, UP_AT + 0.5], [1, 1.4, 1], clamp) : 0) + 0.08 * bump(t, 5.2, 0.05, 0.3) + 0.08 * bump(t, 9.8, 0.05, 0.3) + 0.08 * bump(t, 14.6, 0.05, 0.3) + 0.08 * bump(t, 19.6, 0.05, 0.3);
  const col = v > 0.5 ? '#9CCB8E' : v > 0.2 ? '#F0C060' : '#F0766A';
  const W = 84;
  const H = 190;
  const fillH = Math.max(0.04, v) * (H - 16);
  // 밝은 벽(편의점 · 노래방) 위에서 흰 글자가 묻히지 않게 배터리 뒤를 어둡게 한다(11-13 올리기 전 검사 ⑤)
  return (
    <>
    <Glow x={125} y={790} w={360} h={520} a={0.55} />
    <div style={{ position: 'absolute', left: 50, top: 640, width: 150, display: 'flex', flexDirection: 'column', alignItems: 'center', transform: `scale(${grow})`, transformOrigin: '50% 40%', filter: 'drop-shadow(0 4px 10px rgba(16,8,4,0.55))' }}>
      <div style={{ width: 30, height: 9, background: CREAM, borderRadius: '5px 5px 0 0' }} />
      <div style={{ position: 'relative', width: W, height: H, border: `4px solid ${CREAM}`, borderRadius: 18, boxSizing: 'border-box', overflow: 'hidden', background: 'rgba(22,12,8,0.28)' }}>
        <div style={{ position: 'absolute', left: 5, right: 5, bottom: 5, height: fillH, background: col, borderRadius: 9, opacity: blink }} />
      </div>
      <div style={{ marginTop: 8, fontFamily: EN, fontWeight: 900, fontSize: 46, color: CREAM, lineHeight: 1.1, textShadow: SH }}>{Math.round(v * 100)}%</div>
      <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 26, color: DIM, whiteSpace: 'nowrap', textShadow: SH, letterSpacing: 1 }}>{TEXT.gauge}</div>
    </div>
    </>
  );
};

const Sit: React.FC<{ text: string; at: number; t: number }> = ({ text, at, t }) => {
  const p = interpolate(t, [at, at + 0.17], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  return <div style={{ position: 'absolute', left: 60, right: 60, top: 250, textAlign: 'center', opacity: p, transform: `translateY(${(1 - p) * 14}px)`, color: CREAM, fontFamily: FONT, fontWeight: 700, fontSize: 58, lineHeight: 1.2, whiteSpace: 'pre-line', textShadow: SH }}>{text}</div>;
};

const Hook: React.FC<{ t: number }> = ({ t }) => {
  const p = interpolate(t, [0, 0.2], [0.92, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  return <div style={{ position: 'absolute', left: 60, right: 60, top: 210, textAlign: 'center', transform: `scale(${p})`, color: CREAM, fontFamily: FONT, fontWeight: 800, fontSize: 84, lineHeight: 1.14, whiteSpace: 'pre-line', textShadow: SH }}>{TEXT.hook}</div>;
};

const Speech: React.FC<{ b: BubbleData; at: number; t: number }> = ({ b, at, t }) => {
  const p = interpolate(t, [at, at + 0.13], [0.86, 1], { ...clamp, easing: Easing.out(Easing.back(2)) });
  const cx = b.side === 'right' ? 1080 - 160 - b.width / 2 : 150 + b.width / 2;
  return (
    <>
      <Glow x={cx} y={b.bottom - 170} w={b.width + 340} h={680} a={0.8 * Math.min(1, p)} />
      <div style={{ position: 'absolute', bottom: 1920 - b.bottom, ...(b.side === 'right' ? { right: 160 } : { left: 150 }), width: b.width, textAlign: 'center', transform: `scale(${p}) rotate(-2deg)`, transformOrigin: '50% 100%', textShadow: SH }}>
        <div style={{ fontFamily: EN, fontWeight: 800, fontSize: 40, color: DIM, lineHeight: 1, letterSpacing: 2 }}>{b.n} / 4</div>
        <div style={{ fontFamily: KO, fontWeight: 900, fontSize: 124, color: CREAM, lineHeight: 1.14, whiteSpace: 'nowrap' }}>{b.ko}</div>
        <div style={{ fontFamily: EN, fontWeight: 700, fontSize: 50, color: DIM, lineHeight: 1.15, marginTop: 2, fontStyle: 'italic' }}>{b.read}</div>
        <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 52, color: PINK, lineHeight: 1.14, marginTop: 8, whiteSpace: 'pre-line' }}>{b.mn}</div>
      </div>
    </>
  );
};

// 작은 말풍선 — 머리 칸 · 끝 칸(한국어 · 읽기 · 몽골 뜻)
const Small: React.FC<{ t: number; from: number; until: number; left: number; top: number; width: number; ko: string; read: string; mn?: string; tip: [number, number]; koSize?: number }> = ({ t, from, until, left, top, width, ko, read, mn, koSize = 84 }) => {
  if (t < from || t >= until) return null;
  const p = interpolate(t, [from, from + 0.13], [0.8, 1], { ...clamp, easing: Easing.out(Easing.back(2.2)) });
  const h = Math.round(koSize * 1.14 + 42 * 1.15 + (mn ? 46 * 1.14 + 4 : 0) + 28 + 12 + 6);
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Glow x={left + width / 2} y={top + h / 2} w={width + 260} h={h + 260} a={0.6} />
      <div style={{ position: 'absolute', left, top, width, height: h, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', transform: `scale(${p}) rotate(-2deg)`, transformOrigin: '50% 100%', textShadow: SH }}>
        <div style={{ fontFamily: KO, fontWeight: 900, fontSize: koSize * 1.12, color: CREAM, lineHeight: 1.14, whiteSpace: 'nowrap' }}>{ko}</div>
        <div style={{ fontFamily: EN, fontWeight: 700, fontSize: 42, color: DIM, lineHeight: 1.15, whiteSpace: 'nowrap', fontStyle: 'italic' }}>{read}</div>
        {mn ? <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 48, color: PINK, lineHeight: 1.14, marginTop: 4, whiteSpace: 'nowrap' }}>{mn}</div> : null}
      </div>
    </div>
  );
};

// 문자 — 깔끔한 알림 꼴(앱 화면을 그리지 않는다)
const Message: React.FC<{ t: number }> = ({ t }) => {
  if (t < MSG_AT || t >= UP_AT) return null;
  const p = interpolate(t, [MSG_AT, MSG_AT + 0.22], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.5)) });
  return (
    <div style={{ position: 'absolute', left: 150, width: 780, top: 250, transform: `translateY(${(1 - p) * -40}px) scale(${0.9 + 0.1 * p})`, opacity: p, transformOrigin: '50% 0%' }}>
      <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 40, color: DIM, marginBottom: 10, marginLeft: 12, textShadow: SH }}>{TEXT.msgFrom}</div>
      <div style={{ background: 'rgba(255,250,240,0.96)', borderRadius: '12px 44px 44px 44px', padding: '14px 30px 20px', boxShadow: '0 10px 26px rgba(16,8,4,0.4)' }}>
        <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 92, color: INK, lineHeight: 1.16, whiteSpace: 'nowrap' }}>{TEXT.msgKo}</div>
        <div style={{ fontFamily: EN, fontWeight: 700, fontSize: 44, color: '#6A584C', lineHeight: 1.15, fontStyle: 'italic' }}>{TEXT.msgRead}</div>
        <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 52, color: MEAN, lineHeight: 1.14, marginTop: 4 }}>{TEXT.msgMn}</div>
      </div>
    </div>
  );
};

const Sounds: React.FC<{ from?: number }> = ({ from = 0 }) => {
  const off = fr(from);
  return (
    <>
      <Sequence from={-off} layout="none">
        <Audio src={staticFile('sfx/bgm.wav')} volume={(f) => MASTER * interpolate(f / FPS, [0, UP_AT - 0.1, UP_AT, NEXT_AT - 0.03, NEXT_AT + 0.05, TOTAL - 0.5, TOTAL], [BGM_LOW, BGM_LOW, BGM_HIGH, BGM_HIGH, BGM_LOW, BGM_LOW, 0], clamp)} />
      </Sequence>
      <Sequence from={-off} layout="none">
        <Audio src={staticFile('sfx/air.wav')} volume={(f) => 0.16 * MASTER * interpolate(f / FPS, [0, TOTAL - 0.4, TOTAL], [1, 1, 0], clamp)} />
      </Sequence>
      {SFX.filter((s) => s.at >= from).map((s, k) => (
        <Sequence key={k} from={fr(s.at) - off} layout="none">
          <Audio src={staticFile(`sfx/${s.file}`)} volume={s.vol * MASTER} />
        </Sequence>
      ))}
      {CELLS.flatMap((c) => c.vo ?? []).filter((v) => v.at >= from).map((v, k) => (
        <Sequence key={`v${k}`} from={fr(v.at) - off} layout="none">
          <Audio src={staticFile(`vo/${v.id}.wav`)} volume={1.1 * MASTER} />
        </Sequence>
      ))}
    </>
  );
};

export const Film: React.FC<{ scene?: boolean }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS + (scene ? SCENE_FROM : 0);
  const i = cellAt(t);
  const c = CELLS[i];
  return (
    <AbsoluteFill style={{ background: '#1d1411' }}>
      <Plate i={i} t={t} />
      {/* 충전되는 순간 번쩍 */}
      {t >= UP_AT - 0.02 && t < UP_AT + 0.35 ? <AbsoluteFill style={{ background: '#FFF4D6', opacity: interpolate(t, [UP_AT - 0.02, UP_AT + 0.03, UP_AT + 0.35], [0, 0.85, 0], clamp) }} /> : null}
      {/* 위쪽 그늘 — 글자가 놓일 자리(상자가 아니라 빛) */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 680, background: 'linear-gradient(to bottom, rgba(20,11,7,0.58) 0%, rgba(20,11,7,0.36) 58%, rgba(20,11,7,0) 100%)' }} />
      <Battery t={t} />
      {!scene && t < 3.2 ? <Hook t={t} /> : null}
      {!scene && t < 3.2 ? <Small t={t} from={0.55} until={3.2} left={330} top={830} width={520} ko={TEXT.openKo} read={TEXT.openRead} mn={TEXT.openMn} tip={[560, 1150]} /> : null}
      {!scene && c.sit ? <Sit text={c.sit} at={c.at} t={t} /> : null}
      {c.bubble ? <Speech b={c.bubble} at={c.at} t={t} /> : null}
      <Message t={t} />
      {/* 몽글 머리 위에서 아래로 — 아래에 두면 몸 · 이불 위 휴대폰을 덮는다 */}
      <Small t={t} from={UP_AT + 0.08} until={KARAOKE_AT} left={250} top={460} width={580} ko={TEXT.goKo} read={TEXT.goRead} mn={TEXT.goMn} tip={[590, 770]} koSize={96} />
      <Small t={t} from={KARAOKE_AT + 0.1} until={NEXT_AT} left={480} top={540} width={560} ko={TEXT.moreKo} read={TEXT.moreRead} mn={TEXT.moreMn} tip={[520, 880]} koSize={92} />
      {/* 꼬리가 몸 안에 묻혀 「꼬리 없는 말풍선이 머리 위에 벽돌처럼」(아르곤 맹검 v7) — 말풍선을 올리고 꼬리를 머리 꼭대기에 */}
      <Small t={t} from={NEXT_AT + 0.33} until={TOTAL + 1} left={300} top={548} width={560} ko="졸려…" read="жоллё" mn="Нойр хүрч байна…" tip={[690, 880]} koSize={92} />
      {!scene && t >= END_AT && t < NEXT_AT ? (
        <div style={{ position: 'absolute', left: 60, right: 60, top: 290, textAlign: 'center', opacity: interpolate(t, [END_AT, END_AT + 0.15], [0, 1], clamp) }}>
          <span style={{ color: CREAM, fontFamily: FONT, fontWeight: 800, fontSize: 60, lineHeight: 1.2, textShadow: SH }}>{TEXT.end}</span>
        </div>
      ) : null}
      <Sounds from={scene ? SCENE_FROM : 0} />
    </AbsoluteFill>
  );
};

export const SceneFilm: React.FC = () => <Film scene />;
