// LAB 몽골 M65 「추울 때 네 마디」(11-24) — 머리 칸(편의점 앞 · 밖은 영하 5도 · 덜덜 떠는 친구와 아이스크림을 든 몽글) → 네 번의 「상황(추위가 한 겹 더해짐) → 표현(친구의 한 마디)」,
// 왼쪽 온도계 게이지(친구의 추위 단계)가 칸마다 오른다 → 몽글 「몽골은 영하 30도야~」 → 친구가 이불 밖으로 머리를 내밀고 「삼… 삼십 도?!」, 게이지가 999%로 넘친다 → 이불 산.
// 우리편 M37 「피곤할 때 네 마디」(검증된 틀 ③)의 뼈대와 글 꼴(상자 없는 크림 글자 + 그늘, n / 4 · 한글 · 읽는 법 · 뜻)을 가져왔다. 다른 것: 말하는 쪽이 몽글이 아니라 한국 친구이고,
// 게이지는 배터리 · 가로 막대 대신 왼쪽 세로 온도계(추위가 차오른다), 머리 칸은 끝 모습을 먼저 보이지 않고 지금 순간에서 바로 시작한다(되감기 없음 — LAB 교훈 L07).
// 그림은 장면마다 구운 한 장 — 같은 판을 부드러운 타원 가면으로 겹쳐 그 자리만 움직인다(친구 떨림 · 몽글 둥실).
// 판본 틀: 그 나라 글과 글꼴 · 글자 크기는 판본 꾸러미 p(./판본/<KEY>.json)에서 받는다. 그림 · 한국어 · 소리 · 박자 · 카메라는 그대로다.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { EN, KO } from '../lib/fonts';
import { BGM_DIP, BGM_LOW, BURST_AT, CELLS, END_AT, FPS, FRIEND, KO_LINES, MONG_AT, MONGLE, Phrase as PhraseData, PILE_AT, POP_AT, PULL_AT, SFX, TOTAL } from './data';
import { LocPack } from './판본';

const fr = (sec: number) => Math.round(sec * FPS);
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const MASTER = 0.8; // Remotion은 소리를 16비트로 더해 넘치면 자른다 — 모든 볼륨에 같은 값을 곱한다(현장 노트)
export const TOTAL_FRAMES = fr(TOTAL);
export { FPS };

const CREAM = '#FFFDF7';
const PINK = '#FFC2D0';
const ICE = '#8FD3F5';
const DIM = 'rgba(255,248,236,0.94)';
const FULL: React.CSSProperties = { position: 'absolute', inset: 0, width: 1080, height: 1920, objectFit: 'cover' };
const SH = '0 3px 0 rgba(10,14,24,0.5), 0 5px 18px rgba(6,8,16,0.62)';
const Glow: React.FC<{ x: number; y: number; w: number; h: number; a?: number }> = ({ x, y, w, h, a = 0.5 }) => <div style={{ position: 'absolute', left: x - w / 2, top: y - h / 2, width: w, height: h, background: `radial-gradient(ellipse at 50% 50%, rgba(8,10,20,${a}) 0%, rgba(8,10,20,${a * 0.55}) 45%, rgba(8,10,20,0) 72%)` }} />;
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
  const f = FRIEND[img];
  // 카메라 — 칸마다 천천히 다가간다. 표현 칸은 말이 터질 때 한 번 당기고, 게이지가 오르는 박자에 더 다가간다
  let z = interpolate(t, [c.at, end], [1, 1.05], clamp);
  let ox = 540;
  let oy = 1000;
  let dx = 0;
  let dy = 0;
  if (c.phrase) {
    z += 0.05 * bump(t, c.at, 0.06, 0.45);
    if (t >= c.phrase.riseAt - 0.05) z *= 1.06;
    if (f) {
      ox = f.cx;
      oy = f.cy - f.ry * 0.3;
    }
  }
  if (img === 'gust.jpg') {
    // 돌풍 — 판이 한 번 옆으로 밀린다
    const g = interpolate(t, [c.at, c.at + 0.25, c.at + 1.2], [0, 1, 0], clamp);
    dx = -18 * g * Math.sin((t - c.at) * 30);
    z = interpolate(t, [c.at, end], [1.08, 1.0], { ...clamp, easing: Easing.out(Easing.cubic) });
  }
  if (img === 'mongle.jpg') {
    z = interpolate(t, [c.at, end], [1.0, 1.08], { ...clamp, easing: Easing.inOut(Easing.quad) });
    if (m) {
      ox = m.cx;
      oy = m.cy;
    }
  }
  if (img === 'pop.jpg') {
    // 쏙 — 머리가 나오는 순간 판이 한 번 튄다
    // 왼쪽 끝을 축으로 1.2배 — 친구 얼굴이 오른쪽으로 밀려 왼쪽 온도계와 겹치지 않는다
    z = 1.2 * interpolate(t, [POP_AT, POP_AT + 0.12, POP_AT + 0.5, end], [1.14, 1.02, 1.0, 1.05], { ...clamp, easing: Easing.out(Easing.cubic) });
    ox = 0;
    if (f) oy = f.cy;
    const s = interpolate(t, [BURST_AT, BURST_AT + 0.6], [1, 0], clamp);
    dx = t >= BURST_AT ? 8 * s * Math.sin(t * 70) : 0;
  }
  if (img === 'pull.jpg') {
    // 확 — 이불을 끌어 덮는 순간 판이 한 번 움찔하고, 천천히 다가간다
    z = interpolate(t, [PULL_AT, PULL_AT + 0.1, PULL_AT + 0.4, end], [1.08, 1.0, 1.0, 1.05], { ...clamp, easing: Easing.out(Easing.cubic) });
    oy = 1100;
  }
  if (img === 'mountain.jpg') {
    // 털썩 — 이불이 쏟아져 쌓이고 판이 한 번 내려앉는다
    dy = 20 * interpolate(t, [PILE_AT, PILE_AT + 0.06, PILE_AT + 0.45], [0, 1, 0], clamp);
    z = interpolate(t, [PILE_AT, TOTAL], [1.0, 1.06], clamp);
    oy = 1100;
  }
  // 친구 — 바깥 칸에서는 덜덜 떤다(아주 작게 · 멀미 없게), 이불 산은 부들부들
  let fdx = 0;
  let frot = 0;
  let fs = 1;
  const outdoor = ['open.jpg', 'gust.jpg', 'hug.jpg', 'busstop.jpg', 'hands.jpg', 'snowpile.jpg'].includes(img);
  if (outdoor) {
    fdx = 2.2 * Math.sin(t * 46) + 1.2 * Math.sin(t * 17);
    frot = 0.5 * Math.sin(t * 39);
  }
  if (img === 'frozen.jpg') {
    // 얼어붙음 — 떨다가 0.3초 만에 딱 굳는다
    const still = interpolate(t, [c.at, c.at + 0.3], [1, 0], clamp);
    fdx = 3 * still * Math.sin(t * 50);
  }
  if (img === 'pull.jpg') fdx = 4 * Math.sin(t * 40) + 1.5 * Math.sin(t * 13); // 이불 속에서 덜덜(0.25초 칸에도 보이게 — 첫 컷 v2)
  if (img === 'burrito.jpg') fs =1 + 0.012 * Math.sin((t - c.at) * 3.2); // 이불 속에서 느긋하게 숨 쉰다
  if (img === 'mountain.jpg') {
    const shiver = t < PILE_AT + 0.45 ? 0 : 1;
    fdx = 2.5 * shiver * Math.sin(t * 38);
    fs = 1 + 0.01 * shiver * Math.abs(Math.sin(t * 9));
  }
  if (img === 'pop.jpg') fs = interpolate(t, [POP_AT, POP_AT + 0.1, POP_AT + 0.35], [0.97, 1.05, 1.0], { ...clamp, easing: Easing.out(Easing.back(2)) });
  // 몽글 — 늘 둥실, 말할 때 한 번 부풀었다 돌아온다. 자리를 옮기지 않는다(밑의 원래 몸이 두 겹으로 비치지 않게 밑단을 축으로 늘였다 줄이기만)
  let msx = 1 + 0.012 * Math.sin(t * 5.5);
  let msy = 2 - msx + 0.014 * Math.sin(t * 2.6);
  for (const v of c.vo ?? []) {
    if (!v.id.startsWith('m')) continue;
    const b = bump(t, v.at, 0.05, 0.3);
    msx += 0.03 * b;
    msy += 0.03 * b;
  }
  const mrot = 3 * Math.sin(t * 2.2);
  return (
    <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: '#0e1220' }}>
      <AbsoluteFill style={{ transform: `translate(${dx}px, ${dy}px) scale(${z})`, transformOrigin: `${ox}px ${oy}px` }}>
        <Img src={staticFile(`img/${img}`)} style={FULL} />
        {f ? <Patch img={img} cx={f.cx} cy={f.cy} rx={f.rx} ry={f.ry} sx={fs} sy={fs} dx={fdx} rot={frot} ox={f.cx} oy={f.cy + f.ry * 0.85} /> : null}
        {m ? <Patch img={img} cx={m.cx} cy={m.cy} rx={m.rx} ry={m.ry} sx={msx} sy={msy} rot={mrot} /> : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// 왼쪽 온도계 — 친구의 추위 단계. 3.2초에 0%로 처음 뜨고, 표현 칸마다 25%씩 오르고, 「삼십 도?!」에 위로 넘쳐 999%가 된다
const coldAt = (t: number) => {
  if (t >= BURST_AT) return 1.25;
  let from = 0;
  let to = 0;
  let at = 0;
  CELLS.forEach((c) => {
    if (c.phrase && t >= c.phrase.riseAt) {
      from = to;
      to = c.phrase.cold;
      at = c.phrase.riseAt;
    }
  });
  return interpolate(t, [at, at + 0.4], [from, to], { ...clamp, easing: Easing.out(Easing.cubic) });
};
const Gauge: React.FC<{ p: LocPack; t: number }> = ({ p, t }) => {
  const v = coldAt(t);
  const burst = t >= BURST_AT;
  const shake = burst ? 7 * interpolate(t, [BURST_AT, BURST_AT + 1.0], [1, 0.25], clamp) * Math.sin(t * 80) : 0;
  const grow = 1 + CELLS.reduce((a, c) => a + (c.phrase ? 0.08 * bump(t, c.phrase.riseAt, 0.05, 0.4) : 0), 0) + 0.1 * bump(t, BURST_AT, 0.08, 0.6);
  const X = 74;
  const TOP = 640;
  const H = 440;
  const W = 46;
  const fill = Math.min(1, v) * (H - 12);
  const over = burst ? interpolate(t, [BURST_AT, BURST_AT + 0.25], [0, 70], { ...clamp, easing: Easing.out(Easing.back(2)) }) : 0;
  // 게이지는 추위 %(마디 셈 「n / 4」는 마디 카드가 맡는다 — 장면 심사 v2 「4/4와 999%가 무엇을 재는지 안 읽힘」으로 되돌림)
  const pct = burst ? '999%' : `${Math.round(v * 100)}%`;
  const col = burst ? '#FF6E5E' : v >= 0.99 ? '#4FA8E8' : ICE;
  return (
    <>
      <Glow x={X + 70} y={TOP + H / 2 - 20} w={330} h={H + 380} a={0.55} />
      {/* 11-24 15시 회차 이해 시험(s · h · G 셋이 「게이지가 무엇을 재는지」를 짚음): 이름표를 크게 · 밝게, 위에 🥶, 오를 때마다 「+25%」 */}
      <div style={{ position: 'absolute', left: X - 30, bottom: 1920 - (TOP - 12), width: 330, opacity: interpolate(t, [POP_AT, POP_AT + 0.15], [1, 0], clamp), transform: `translateX(${shake}px) scale(${grow})`, transformOrigin: '20% 100%', fontFamily: p.font, fontWeight: 800, fontSize: p.gaugeSize * 1.2, color: CREAM, whiteSpace: 'pre-line', lineHeight: 1.12, textShadow: SH }}>
        <div style={{ fontSize: 64, lineHeight: 1.05, marginBottom: 4 }}>🥶</div>
        {p.gauge}
      </div>
      {CELLS.map((c) =>
        c.phrase && t >= c.phrase.riseAt && t < c.phrase.riseAt + 1.0 ? (
          <div key={c.at} style={{ position: 'absolute', left: X + 66, top: TOP + H - 6 - c.phrase.cold * (H - 12) - 34 - 46 * interpolate(t, [c.phrase.riseAt, c.phrase.riseAt + 1.0], [0, 1], clamp), opacity: interpolate(t, [c.phrase.riseAt, c.phrase.riseAt + 0.1, c.phrase.riseAt + 0.75, c.phrase.riseAt + 1.0], [0, 1, 1, 0], clamp), fontFamily: EN, fontWeight: 900, fontSize: 46, color: ICE, textShadow: SH }}>+25%</div>
        ) : null,
      )}
      <div style={{ position: 'absolute', left: X, top: TOP, width: W, height: H, transform: `translateX(${shake}px)`, filter: 'drop-shadow(0 4px 10px rgba(6,8,16,0.55))' }}>
        {/* 관 — 크림 테 · 둥근 위 */}
        <div style={{ position: 'absolute', inset: 0, border: `5px solid ${CREAM}`, borderRadius: W / 2, boxSizing: 'border-box', background: 'rgba(8,10,20,0.35)' }} />
        {/* 차오르는 추위(아래에서 위로) */}
        <div style={{ position: 'absolute', left: 9, right: 9, bottom: 6, height: fill, background: col, borderRadius: 14 }} />
        {/* 넘침 — 관 위로 솟는다 */}
        {burst ? <div style={{ position: 'absolute', left: 9, right: 9, top: -over, height: over + 14, background: col, borderRadius: 14 }} /> : null}
        {/* 눈금 넷(25 · 50 · 75 · 100) — 가는 선 */}
        {[0.25, 0.5, 0.75, 1].map((q) => (
          <div key={q} style={{ position: 'absolute', left: W + 6, width: 18, height: 4, borderRadius: 2, top: H - 6 - q * (H - 12) - 2, background: CREAM, opacity: 0.85 }} />
        ))}
      </div>
      {/* 아래 꽉 찬 구슬(고리 아님) */}
      <div style={{ position: 'absolute', left: X - 17, top: TOP + H - 26, width: 80, height: 80, borderRadius: '50%', background: col, border: `5px solid ${CREAM}`, boxSizing: 'border-box', transform: `translateX(${shake}px)`, boxShadow: '0 4px 10px rgba(6,8,16,0.5)' }} />
      <div style={{ position: 'absolute', left: X - 40, top: TOP + H + 66, width: 180, textAlign: 'center', transform: `translateX(${shake}px) scale(${grow})`, fontFamily: EN, fontWeight: 900, fontSize: burst ? 60 : 48, color: burst ? '#FF8A7A' : CREAM, lineHeight: 1, textShadow: SH }}>{pct}</div>
    </>
  );
};

const Hook: React.FC<{ pk: LocPack; t: number }> = ({ pk, t }) => {
  const p = interpolate(t, [0, 0.2], [0.92, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  return (
    <>
      <Glow x={540} y={420} w={1180} h={420} a={0.55} />
      <div style={{ position: 'absolute', left: 70, right: 70, top: 300, textAlign: 'center', transform: `scale(${p})`, color: CREAM, fontFamily: pk.font, fontWeight: 800, fontSize: pk.hookSize, lineHeight: Math.max(1.14, pk.lineH), whiteSpace: 'pre-line', textShadow: SH }}>{pk.hook}</div>
    </>
  );
};

// 온도 — 머리 칸 온도계 곁(0.9~3.2초 — 머리 글과 0.83초 넘게 띄운다, 화면 글 검사 11-24)
const Temp: React.FC<{ pk: LocPack; t: number }> = ({ pk, t }) => {
  if (t < 0.9 || t >= 3.2) return null;
  const p = interpolate(t, [0.9, 1.05], [0.8, 1], { ...clamp, easing: Easing.out(Easing.back(2.2)) });
  return (
    <>
      <Glow x={300} y={680} w={560} h={240} a={0.6} />
      <div style={{ position: 'absolute', left: 60, top: 630, width: 480, transform: `scale(${p}) rotate(-2deg)`, transformOrigin: '0% 50%', color: ICE, fontFamily: pk.font, fontWeight: 900, fontSize: pk.tempSize, lineHeight: 1.1, textShadow: SH, whiteSpace: 'nowrap' }}>{pk.temp}</div>
    </>
  );
};

// 상황 글 — 상황 칸 위(그 칸 내내)
const Sit: React.FC<{ pk: LocPack; n: number; at: number; t: number }> = ({ pk, n, at, t }) => {
  const p = interpolate(t, [at, at + 0.15], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  return (
    <>
      <Glow x={560} y={360} w={1100} h={300} a={0.6 * p} />
      <div style={{ position: 'absolute', left: 230, right: 50, top: 300, textAlign: 'center', opacity: p, transform: `translateY(${(1 - p) * 10}px)`, color: CREAM, fontFamily: pk.font, fontWeight: 800, fontSize: pk.sitSize, lineHeight: Math.max(1.14, pk.lineH), whiteSpace: 'pre-line', textShadow: SH }}>{pk.sits[n]}</div>
    </>
  );
};

// 친구의 네 마디 — n / 4 · 큰 한글 · 읽는 법 · 뜻(M37 꼴)
const Speech: React.FC<{ pk: LocPack; b: PhraseData; at: number; t: number }> = ({ pk, b, at, t }) => {
  const p = interpolate(t, [at, at + 0.13], [0.86, 1], { ...clamp, easing: Easing.out(Easing.back(2)) });
  const left = b.right - b.width;
  const cx = left + b.width / 2;
  return (
    <>
      <Glow x={cx} y={b.bottom - 170} w={b.width + 320} h={680} a={0.8 * Math.min(1, p)} />
      <div style={{ position: 'absolute', bottom: 1920 - b.bottom, left, width: b.width, textAlign: 'center', transform: `scale(${p}) rotate(-2deg)`, transformOrigin: '50% 100%', textShadow: SH }}>
        <div style={{ fontFamily: EN, fontWeight: 800, fontSize: 40, color: DIM, lineHeight: 1, letterSpacing: 2 }}>{b.n} / 4</div>
        <div style={{ fontFamily: KO, fontWeight: 900, fontSize: b.koSize ?? 124, color: CREAM, lineHeight: 1.08, whiteSpace: 'pre' }}>{b.koShow ?? b.ko}</div>
        <div style={{ fontFamily: EN, fontWeight: 700, fontSize: 56, color: DIM, lineHeight: 1.15, marginTop: 2, fontStyle: 'italic', whiteSpace: 'nowrap' }}>{pk.reads[b.n - 1]}</div>
        <div style={{ fontFamily: pk.font, fontWeight: 800, fontSize: pk.meanSize, color: PINK, lineHeight: Math.max(1.14, pk.lineH), marginTop: 8, whiteSpace: 'pre-line', overflowWrap: 'break-word' }}>{pk.means[b.n - 1]}</div>
      </div>
    </>
  );
};

// 작은 말 — 몽글 · 끝 칸 친구(한국어 · 읽기 · 뜻)
const Small: React.FC<{ pk: LocPack; t: number; from: number; until: number; left: number; top: number; width: number; ko: string; read: string; mn: string; koSize?: number; glow?: number; color?: string }> = ({ pk, t, from, until, left, top, width, ko, read, mn, koSize = 88, glow = 0.62, color = CREAM }) => {
  if (t < from || t >= until) return null;
  const p = interpolate(t, [from, from + 0.13], [0.8, 1], { ...clamp, easing: Easing.out(Easing.back(2.2)) });
  const h = Math.round(koSize * 1.12 * 1.14 + 50 * 1.15 + pk.smallSize * 1.14 * mn.split('\n').length + 4 + 40);
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Glow x={left + width / 2} y={top + h / 2} w={width + 260} h={h + 260} a={glow} />
      <div style={{ position: 'absolute', left, top, width, height: h, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', transform: `scale(${p}) rotate(-2deg)`, transformOrigin: '50% 100%', textShadow: SH }}>
        <div style={{ fontFamily: KO, fontWeight: 900, fontSize: koSize * 1.12, color, lineHeight: 1.14, whiteSpace: 'nowrap' }}>{ko}</div>
        <div style={{ fontFamily: EN, fontWeight: 700, fontSize: 50, color: DIM, lineHeight: 1.15, whiteSpace: 'nowrap', fontStyle: 'italic' }}>{read}</div>
        <div style={{ fontFamily: pk.font, fontWeight: 800, fontSize: pk.smallSize, color: PINK, lineHeight: Math.max(1.14, pk.lineH), marginTop: 4, whiteSpace: 'pre-line' }}>{mn}</div>
      </div>
    </div>
  );
};

const Sounds: React.FC = () => (
  <>
    <Audio src={staticFile('sfx/bgm.wav')} volume={(f) => MASTER * interpolate(f / FPS, [0, BURST_AT - 0.3, BURST_AT, PILE_AT, PILE_AT + 0.3, TOTAL - 0.6, TOTAL], [BGM_LOW, BGM_LOW, BGM_DIP, BGM_DIP, BGM_LOW, BGM_LOW, 0], clamp)} />
    <Audio src={staticFile('sfx/wind.wav')} volume={(f) => 0.3 * MASTER * interpolate(f / FPS, [0, 17.0, 17.4, TOTAL], [1, 1, 0, 0], clamp)} />
    <Audio src={staticFile('sfx/room.wav')} volume={(f) => 0.22 * MASTER * interpolate(f / FPS, [0, 17.1, 17.5, TOTAL - 0.4, TOTAL], [0, 0, 1, 1, 0], clamp)} />
    {SFX.map((s, k) => (
      <Sequence key={k} from={fr(s.at)} layout="none">
        <Audio src={staticFile(`sfx/${s.file}`)} volume={s.vol * MASTER} />
      </Sequence>
    ))}
    {CELLS.flatMap((c) => c.vo ?? []).map((v, k) => (
      <Sequence key={`v${k}`} from={fr(v.at)} layout="none">
        <Audio src={staticFile(`vo/${v.id}.wav`)} volume={1.1 * MASTER} />
      </Sequence>
    ))}
  </>
);

export const Film: React.FC<{ p: LocPack }> = ({ p }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const i = cellAt(t);
  const c = CELLS[i];
  return (
    <AbsoluteFill style={{ background: '#0e1220' }}>
      <Plate i={i} t={t} />
      {/* 「삼십 도?!」에 게이지가 넘치는 순간 하얗게 번쩍(얼음빛) */}
      {t >= BURST_AT - 0.02 && t < BURST_AT + 0.4 ? <AbsoluteFill style={{ background: '#DFF3FF', opacity: interpolate(t, [BURST_AT - 0.02, BURST_AT + 0.04, BURST_AT + 0.4], [0, 0.4, 0], clamp) }} /> : null}
      {/* 위쪽 그늘 — 글자가 놓일 자리(상자가 아니라 빛) */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 720, background: 'linear-gradient(to bottom, rgba(6,8,16,0.6) 0%, rgba(6,8,16,0.36) 58%, rgba(6,8,16,0) 100%)' }} />
      {t >= 3.2 && t < PILE_AT ? <div style={{ position: 'absolute', inset: 0, opacity: interpolate(t, [3.2, 3.4], [0, 1], clamp) }}><Gauge p={p} t={t} /></div> : null}
      {t < 3.2 ? <Hook pk={p} t={t} /> : null}
      <Temp pk={p} t={t} />
      {c.sit !== undefined ? <Sit pk={p} n={c.sit} at={c.at} t={t} /> : null}
      {c.phrase ? <Speech pk={p} b={c.phrase} at={c.at} t={t} /> : null}
      <Small pk={p} t={t} from={18.05} until={19.4} left={170} top={700} width={640} ko={KO_LINES.invite} read={p.inviteRead} mn={p.inviteMean} koSize={84} />
      <Small pk={p} t={t} from={MONG_AT} until={POP_AT} left={150} top={290} width={820} ko={KO_LINES.mong} read={p.mongRead} mn={p.mongMean} koSize={86} glow={0.8} />
      <Small pk={p} t={t} from={POP_AT + 0.12} until={PILE_AT} left={300} top={330} width={720} ko={KO_LINES.shock} read={p.shockRead} mn={p.shockMean} koSize={96} glow={0.85} color="#FFE3DE" />
      {t >= END_AT ? (
        <>
          <Glow x={540} y={500} w={1180} h={420} a={0.6 * interpolate(t, [END_AT, END_AT + 0.15], [0, 1], clamp)} />
          <div style={{ position: 'absolute', left: 70, right: 70, top: 400, textAlign: 'center', opacity: interpolate(t, [END_AT, END_AT + 0.15], [0, 1], clamp), transform: `scale(${interpolate(t, [END_AT, END_AT + 0.18], [0.9, 1], { ...clamp, easing: Easing.out(Easing.back(2)) })})` }}>
            <span style={{ color: CREAM, fontFamily: p.font, fontWeight: 800, fontSize: p.endSize, lineHeight: Math.max(1.2, p.lineH), whiteSpace: 'pre-line', textShadow: SH }}>{p.end}</span>
          </div>
        </>
      ) : null}
      <Sounds />
    </AbsoluteFill>
  );
};
