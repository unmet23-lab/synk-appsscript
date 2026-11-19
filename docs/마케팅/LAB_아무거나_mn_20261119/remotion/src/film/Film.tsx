// LAB 몽골 M64 「아무거나~」(11-19) — 머리 칸(참을성 1% · 머리를 감싼 친구 곁 해맑은 몽글) → 네 번의 「상황(친구가 메뉴를 고르자고 함) → 표현(몽글의 한 마디)」, 위 게이지(친구의 참을성)가 칸마다 줄어든다
// → 0%에 친구가 메뉴판을 내밀며 「그럼 네가 골라!」 → 몽글 「…아무거나~」 → 친구가 메뉴판에 엎어진다.
// 우리편 M37 「피곤할 때 네 마디」(검증된 틀 ③)의 뼈대와 글 꼴(상자 없는 크림 글자 + 그늘, n / 4 · 한글 · 읽는 법 · 뜻)을 가져왔다. 다른 것: 친구 말은 흰 말풍선(꼬리가 친구 입 쪽 — 누구 말인지),
// 게이지는 왼쪽 세로 배터리 대신 위 가로 막대(이 편은 친구가 왼쪽에 크게 서는 칸이 많다). 그림은 장면마다 구운 한 장(누끼 없음) — 같은 판을 부드러운 타원 가면으로 겹쳐 그 자리만 움직인다.
// 판본 틀: 그 나라 글과 글꼴 · 글자 크기는 판본 꾸러미 p(./판본/<KEY>.json)에서 받는다. 그림 · 한국어 · 소리 · 박자 · 카메라는 그대로다.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { EN, KO } from '../lib/fonts';
import { Ask as AskData, BGM_DIP, BGM_LOW, BOOM_AT, CELLS, DROP_AT, END_AT, FLOP_AT, FPS, FRIEND, KO_LINES, LAST_AT, LEAN_AT, MENU_AT, MONGLE, Phrase as PhraseData, SFX, SIT_AT, TOTAL } from './data';
import { LocPack } from './판본';

const fr = (sec: number) => Math.round(sec * FPS);
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const MASTER = 0.8; // Remotion은 소리를 16비트로 더해 넘치면 자른다 — 모든 볼륨에 같은 값을 곱한다(현장 노트)
export const TOTAL_FRAMES = fr(TOTAL);
export { FPS };

const INK = '#2B2522';
const MEAN = '#B8325A';
const CREAM = '#FFFDF7';
const PINK = '#FFC2D0';
const DIM = 'rgba(255,248,236,0.94)'; // 읽는 법 줄이 작고 흐려 못 읽었다(이해 시험 v1 셋) — 키우고 밝게
const FULL: React.CSSProperties = { position: 'absolute', inset: 0, width: 1080, height: 1920, objectFit: 'cover' };
const SH = '0 3px 0 rgba(24,12,8,0.5), 0 5px 18px rgba(16,8,4,0.62)';
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
  // 폭발 칸은 두 자세(폭발2 · 폭발3)를 0.32초마다 번갈아 — 발을 구르며 소리친다(첫 컷 검사 v5 「#26 0.5~2초 자세가 굳음」)
  const img = c.img === 'boom.jpg' && Math.floor((t - BOOM_AT) / 0.32) % 2 === 1 ? 'boom2.jpg' : c.img;
  const m = MONGLE[img];
  const f = FRIEND[img];
  let z = interpolate(t, [c.at, end], [1, 1.05], clamp);
  let ox = 540;
  let oy = 1100;
  let dx = 0;
  let dy = 0;
  // 표현 칸 — 말이 터질 때 한 번 당김, 둘째 말에 몽글에게 더 다가감
  if (c.phrase) {
    z += 0.05 * bump(t, c.at, 0.06, 0.45);
    if (t >= c.phrase.dropAt - 0.05) z *= 1.08; // 게이지가 떨어지는 박자에 몽글에게 더 다가감
    ox = m.cx;
    oy = m.cy;
  }
  // 상황 칸 — 친구 쪽으로 천천히
  if (c.ask && img !== 'boom.jpg') {
    z = interpolate(t, [c.at, end], [1.0, 1.07], { ...clamp, easing: Easing.inOut(Easing.quad) });
    ox = 360;
    oy = 900;
  }
  if (img === 'open.jpg') {
    z = interpolate(t, [0, 3.2], [1.0, 1.1], { ...clamp, easing: Easing.inOut(Easing.quad) });
    ox = 540;
    oy = 1330;
  }
  // 몽글의 움직임 — 늘 둥실 떠 있다
  let msx = 1 + 0.012 * Math.sin(t * 5.5);
  let msy = 2 - msx;
  let mdx = 0;
  // 몽글은 자리를 옮기지 않는다 — 옮기면 밑의 원래 몸(밑단 바느질)이 두 겹으로 비친다. 밑단을 축으로 늘였다 줄이기만 한다
  let mdy = 0;
  msy += 0.014 * Math.sin(t * 2.6);
  let mrot = 0;
  for (const v of c.vo ?? []) {
    if (!v.id.startsWith('m')) continue;
    const b = bump(t, v.at, 0.05, 0.3);
    msx += 0.03 * b;
    msy += 0.03 * b;
  }
  // 친구의 움직임(떨림 · 엎어짐)
  let fdx = 0;
  let fdy = 0;
  let frot = 0;
  let fs = 1;
  if (img === 'open.jpg') mrot = 3 * Math.sin(t * 2.2);
  if (img === 'any.jpg' || img === 'menu2.jpg') mrot = 4 * Math.sin((t - c.at) * 2.4); // 해맑게 흔들흔들
  if (img === 'ttok2.jpg') {
    // 매운 김에 몸을 뒤로 젖힌다
    const back = interpolate(t, [c.at, c.at + 0.3], [0, 1], { ...clamp, easing: Easing.out(Easing.back(2)) });
    mrot = 7 * back;
  }
  if (img === 'chick2.jpg') mrot = 5 * Math.sin((t - c.at) * 3.1); // 두리번
  if (img === 'ramen2.jpg') {
    // 천천히 갸웃
    mrot = -6 * interpolate(t, [c.at, c.at + 1.2], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) }) + 1.5 * Math.sin(t * 1.8);
  }
  if (img === 'ttok1.jpg') dy = 2 * Math.sin(t * 20); // 끓는 판 — 아주 작게
  if (img === 'boom.jpg') {
    // 폭발 — 판이 한 번 크게 다가오고 흔들린다, 친구는 부들부들
    z = interpolate(t, [BOOM_AT, BOOM_AT + 0.12, BOOM_AT + 0.5, end], [1.16, 1.04, 1.0, 1.06], { ...clamp, easing: Easing.out(Easing.cubic) });
    ox = 420;
    oy = 1000;
    const s = interpolate(t, [BOOM_AT, BOOM_AT + 0.7], [1, 0.25], clamp);
    dx = 14 * s * Math.sin(t * 70);
    dy = 10 * s * Math.cos(t * 57);
    // 부들부들 — 0.25초마다 찍힌 칸에서도 보이게 크게(첫 컷 검사 v2 「#26 친구 자세가 굳음」)
    fdx = 9 * Math.sin(t * 48) + 6 * Math.sin(t * 13);
    frot = 2.2 * Math.sin(t * 41) + 2.5 * Math.sin(t * 9);
    // 메뉴판을 확 내민다 — 친구 쪽이 앞으로 튀어나왔다 돌아온다
    // 늘 1 이상으로만 키운다 — 줄이거나 뒤로 빼면 밑의 원래 몸이 비쳐 머리가 둘로 보인다(장면 심사 v3)
    fs = interpolate(t, [BOOM_AT, BOOM_AT + 0.1, BOOM_AT + 0.4], [1.0, 1.07, 1.02], { ...clamp, easing: Easing.out(Easing.cubic) });
    // 소리치며 발을 구르듯 들썩 — 발밑을 축으로 키웠다 줄인다(늘 1 이상, 첫 컷 검사 v3 「#26 0.5~2초 자세가 굳음」)
    fs += 0.045 * Math.abs(Math.sin((t - BOOM_AT) * 7.5));
  }
  if (img === 'menu1.jpg') {
    // 메뉴판 앞 — 몽글이 음식 그림을 한참 본다(좌우로 훑듯 아주 작게)
    z = interpolate(t, [MENU_AT, end], [1.0, 1.04], { ...clamp, easing: Easing.inOut(Easing.quad) });
    ox = 540;
    oy = 900;
    mrot = 3 * Math.sin((t - MENU_AT) * 7);
  }
  if (img === 'menu2.jpg') {
    // 그리고 해맑게 「…아무거나~」 — 몽글이 톡
    z = interpolate(t, [c.at, end], [1.04, 1.12], { ...clamp, easing: Easing.inOut(Easing.quad) });
    ox = m.cx;
    oy = m.cy - 160;
    msy *= 1 + 0.05 * bump(t, LAST_AT, 0.08, 0.5);
  }
  if (img === 'drop.jpg') {
    // 털썩 — 떨어지는 몸이 조금 더 내려간다(늘 아래로 — 밑의 원래 몸이 비치지 않게 작게)
    fdy = 22 * interpolate(t, [DROP_AT, SIT_AT], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
  }
  if (img === 'sit.jpg') {
    // 의자에 앉은 순간 판이 한 번 내려앉고, 넋 나간 머리가 천천히 흔들린다
    dy = 16 * interpolate(t, [SIT_AT, SIT_AT + 0.06, SIT_AT + 0.3], [0, 1, 0], clamp);
    // 첫 컷 v7 「#26 앉은 뒤 0.75초 자세가 굳음」 → 넋 나간 머리를 더 크게 흔들고(너무 빠르면 28.6초 엎어짐 컷이 나란히 검사의 박자에서 묻힌다), 한숨 쉬듯 몸이 부풀었다 꺼진다
    frot = 4 * Math.sin((t - SIT_AT) * 3.8);
    fs = 1 + 0.03 * Math.abs(Math.sin((t - SIT_AT) * 5.5));
    z = interpolate(t, [SIT_AT, LEAN_AT], [1.0, 1.04], clamp);
    ox = 400;
    oy = 1100;
  }
  if (img === 'lean.jpg') {
    // 앞으로 쓰러진다 — 남은 0.35초 동안 조금 더 기운다
    frot = 3 * interpolate(t, [LEAN_AT, FLOP_AT], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) }); // 크게 기울이면 28.6초 엎어짐 컷이 나란히 검사 박자에서 묻힌다
    z = 1.04;
    ox = 400;
    oy = 1100;
  }
  if (img === 'flop.jpg') {
    // 엎어진 뒤 몽글은 신나서 통통 — 끝 글만 새로 뜨지 않게 행동을 남긴다(첫 컷 검사 v3 「LAB 뜻풀이 · L07」)
    // 첫 컷 v7 「몽글이 거의 같은 높이」 → 늘었다 줄었다를 키우고 빠르기를 0.25초 간격과 엇갈리게
    const hop = t < FLOP_AT + 0.3 ? 0 : Math.abs(Math.sin((t - FLOP_AT - 0.3) * 5.3)); // 쿵 뒤 0.3초부터 — 엎어지는 순간이 먼저 보이게
    msy = 1 + 0.13 * hop;
    msx = 1 + 0.05 * (1 - hop);
    mrot = t < FLOP_AT + 0.3 ? 0 : 7 * Math.sin((t - FLOP_AT - 0.3) * 5.3);
    // 쿵 — 판이 한 번 튄다, 친구가 한 번 더 눌린다
    dy = 22 * interpolate(t, [FLOP_AT, FLOP_AT + 0.05, FLOP_AT + 0.45], [0, 1, 0], clamp);
    z = interpolate(t, [FLOP_AT, TOTAL], [1.02, 1.1], clamp);
    ox = 600;
    oy = 1100;
    fdy = 10 * interpolate(t, [FLOP_AT, FLOP_AT + 0.08, FLOP_AT + 0.4], [0, 1, 0], clamp);
  }
  return (
    <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: '#1b1310' }}>
      <AbsoluteFill style={{ transform: `translate(${dx}px, ${dy}px) scale(${z})`, transformOrigin: `${ox}px ${oy}px` }}>
        <Img src={staticFile(`img/${img}`)} style={FULL} />
        {f ? <Patch img={img} cx={f.cx} cy={f.cy} rx={f.rx} ry={f.ry} sx={fs} sy={fs} dx={fdx} dy={fdy} rot={frot} ox={f.cx} oy={f.cy + f.ry * 0.85} /> : null}
        <Patch img={img} cx={m.cx} cy={m.cy} rx={m.rx} ry={m.ry} sx={msx} sy={msy} dx={mdx} dy={mdy} rot={mrot} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// 엎어진 친구 머리 위 먹구름에서 떨어지는 빗방울(펠트 물방울 빛깔) — 엎어진 뒤 0.5초부터
const Rain: React.FC<{ t: number }> = ({ t }) => {
  if (t < FLOP_AT + 0.45) return null;
  // 방울마다 떨어지는 시각 · 빠르기 · 자리를 다르게 — 0.25초 간격으로 찍어도 같은 높이에 떠 보이지 않게(첫 컷 v6 「#17 방울이 같은 높이에 떠 있다」)
  const drops = [[0, 0.62], [0.19, 0.48], [0.43, 0.71], [0.6, 0.53], [0.86, 0.66], [1.03, 0.5], [1.29, 0.69], [1.47, 0.57]];
  return (
    <>
      {drops.map(([d, dur], k) => {
        const u = (t - FLOP_AT - 0.45 - d) / dur;
        if (u < 0 || u > 1) return null;
        const x = 410 + ((k * 41) % 90);
        const y = 755 + 175 * u * u; // 머리카락 위에서 사라진다 — 목깃까지 내려오면 2D 얼룩처럼 비친다(카본 맹검 11-19)
        return <div key={k} style={{ position: 'absolute', left: x, top: y, width: 26, height: 38, borderRadius: '50% 50% 50% 50% / 62% 62% 38% 38%', background: 'radial-gradient(circle at 40% 35%, #DDF2FF 0%, #7FB8E0 60%, #5C93BF 100%)', opacity: 1 - 0.6 * u, boxShadow: '0 2px 4px rgba(10,20,40,0.35)' }} />;
      })}
    </>
  );
};

// 게이지가 떨어지는 박자에 막대 오른쪽 위로 「−25%」가 튀어 오른다 — 몽글의 한 마디 → 친구의 참을성이 준다(이해 시험 v1 넷 가운데 셋 「게이지가 왜 줄어드는지」)
const Minus: React.FC<{ t: number }> = ({ t }) => {
  let prev = 1;
  let out: React.ReactNode = null;
  CELLS.forEach((c, k) => {
    if (!c.phrase) return;
    const d = c.phrase.dropAt;
    const drop = Math.round((prev - c.phrase.patience) * 100);
    prev = c.phrase.patience;
    if (t < d || t > d + 1.3) return;
    const u = interpolate(t, [d, d + 0.18, d + 1.0, d + 1.3], [0, 1, 1, 0], clamp);
    const [hx, hy] = c.phrase.head;
    out = <div key={k} style={{ position: 'absolute', left: hx - 90, top: hy - 70 * interpolate(t, [d, d + 1.3], [0, 1], clamp), width: 180, textAlign: 'center', opacity: u, transform: `scale(${0.7 + 0.3 * u})`, fontFamily: EN, fontWeight: 900, fontSize: 64, color: '#FF7A6A', textShadow: SH, whiteSpace: 'nowrap' }}>−{drop}%</div>;
  });
  return <>{out}</>;
};

// 위 게이지 — 친구의 참을성. 머리 칸은 1%(저녁 끝), 3.2초에 100%로 돌아가 표현 칸마다 줄고, 폭발에 0%로 터진다.
const patienceAt = (t: number) => {
  if (t < 3.2) return 1;
  if (t >= BOOM_AT) return 0;
  let from = 1;
  let to = 1;
  let at = 0;
  CELLS.forEach((c) => {
    if (c.phrase && t >= c.phrase.dropAt) {
      from = to;
      to = c.phrase.patience;
      at = c.phrase.dropAt;
    }
  });
  return interpolate(t, [at, at + 0.4], [from, to], { ...clamp, easing: Easing.out(Easing.cubic) });
};
const Gauge: React.FC<{ p: LocPack; t: number }> = ({ p, t }) => {
  const v = patienceAt(t);
  const low = v < 0.08;
  const blink = low && t < BOOM_AT ? (Math.sin(t * 9) > -0.1 ? 1 : 0.35) : 1;
  const burst = bump(t, BOOM_AT, 0.08, 0.6);
  const shake = t >= BOOM_AT ? 6 * interpolate(t, [BOOM_AT, BOOM_AT + 0.8], [1, 0], clamp) * Math.sin(t * 80) : 0;
  const grow = 1 + 0.12 * burst + CELLS.reduce((a, c) => a + (c.phrase ? 0.1 * bump(t, c.phrase.dropAt, 0.05, 0.4) : 0), 0);
  const col = v > 0.5 ? '#9CCB8E' : v > 0.2 ? '#F0C060' : '#F0766A';
  const W = 470;
  const H = 34;
  return (
    <>
      <Glow x={330} y={330} w={720} h={250} a={0.6} />
      <div style={{ position: 'absolute', left: 90, top: 278, transform: `translateX(${shake}px) scale(${grow})`, transformOrigin: '0% 50%', filter: 'drop-shadow(0 4px 10px rgba(16,8,4,0.55))' }}>
        <div style={{ fontFamily: p.font, fontWeight: 800, fontSize: p.gaugeSize, color: DIM, whiteSpace: 'pre-line', lineHeight: 1.12, textShadow: SH, letterSpacing: 1, marginBottom: 8 }}>{p.gauge}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, position: 'relative' }}>
          <div style={{ position: 'relative', width: W, height: H, border: `4px solid ${CREAM}`, borderRadius: 18, boxSizing: 'border-box', overflow: 'hidden', background: 'rgba(22,12,8,0.3)' }}>
            <div style={{ position: 'absolute', left: 4, top: 4, bottom: 4, width: Math.max(0, v) * (W - 16), background: col, borderRadius: 9, opacity: blink }} />
          </div>
          <div style={{ fontFamily: EN, fontWeight: 900, fontSize: 46, color: t >= BOOM_AT ? '#FF8A7A' : CREAM, lineHeight: 1, textShadow: SH, minWidth: 110 }}>{Math.round(v * 100)}%</div>
        </div>
      </div>
    </>
  );
};

const Hook: React.FC<{ pk: LocPack; t: number }> = ({ pk, t }) => {
  const p = interpolate(t, [0, 0.2], [0.92, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  return <div style={{ position: 'absolute', left: 70, right: 70, top: 420, textAlign: 'center', transform: `scale(${p})`, color: CREAM, fontFamily: pk.font, fontWeight: 800, fontSize: pk.hookSize, lineHeight: Math.max(1.14, pk.lineH), whiteSpace: 'pre-line', textShadow: SH }}>{pk.hook}</div>;
};

// 몽글의 네 마디 — n / 4 · 큰 한글 · 읽는 법 · 뜻(M37 꼴)
const Speech: React.FC<{ pk: LocPack; b: PhraseData; at: number; t: number }> = ({ pk, b, at, t }) => {
  const p = interpolate(t, [at, at + 0.13], [0.86, 1], { ...clamp, easing: Easing.out(Easing.back(2)) });
  const left = b.right - b.width;
  const cx = left + b.width / 2;
  return (
    <>
      <Glow x={cx} y={b.bottom - 160} w={b.width + 320} h={640} a={0.8 * Math.min(1, p)} />
      <div style={{ position: 'absolute', bottom: 1920 - b.bottom, left, width: b.width, textAlign: 'center', transform: `scale(${p}) rotate(-2deg)`, transformOrigin: '50% 100%', textShadow: SH }}>
        <div style={{ fontFamily: EN, fontWeight: 800, fontSize: 40, color: DIM, lineHeight: 1, letterSpacing: 2 }}>{b.n} / 4</div>
        <div style={{ fontFamily: KO, fontWeight: 900, fontSize: b.koSize ?? 124, color: CREAM, lineHeight: 1.08, whiteSpace: 'pre' }}>{b.koShow ?? b.ko}</div>
        <div style={{ fontFamily: EN, fontWeight: 700, fontSize: 58, color: DIM, lineHeight: 1.15, marginTop: 2, fontStyle: 'italic', whiteSpace: 'nowrap' }}>{pk.reads[b.n - 1]}</div>
        <div style={{ fontFamily: pk.font, fontWeight: 800, fontSize: pk.meanSize, color: PINK, lineHeight: Math.max(1.14, pk.lineH), marginTop: 8, whiteSpace: 'pre-line', overflowWrap: 'break-word' }}>{pk.means[b.n - 1]}</div>
      </div>
    </>
  );
};

// 친구의 말 — 흰 말풍선, 꼬리가 친구 입 쪽으로(누구 말인지 바로 — LAB 교훈 L21)
const AskBubble: React.FC<{ pk: LocPack; a: AskData; at: number; t: number }> = ({ pk, a, at, t }) => {
  const p = interpolate(t, [at, at + 0.16], [0.82, 1], { ...clamp, easing: Easing.out(Easing.back(1.8)) });
  const big = a.n === 4;
  const read = big ? pk.boomRead : pk.askReads[a.n];
  const mean = big ? pk.boomMean : pk.asks[a.n];
  const koSize = big ? 100 : 84;
  const h = Math.round(koSize * 1.16 + 52 * 1.15 + pk.askSize * Math.max(1.14, pk.lineH) * mean.split('\n').length + 46);
  const [tx, ty] = a.tail;
  const baseX = Math.min(Math.max(tx + 60, a.left + 60), a.left + a.width - 80);
  const shake = big ? 5 * interpolate(t, [at, at + 0.6], [1, 0], clamp) * Math.sin(t * 75) : 0;
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: Math.min(1, (p - 0.82) / 0.1), transform: `translateX(${shake}px)` }}>
      <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0, filter: 'drop-shadow(0 10px 22px rgba(16,8,4,0.42))' }}>
        <path d={`M ${baseX - 34} ${a.top + h - 6} L ${tx} ${ty} L ${baseX + 30} ${a.top + h - 6} Z`} fill={big ? '#FFF1EC' : 'rgba(255,250,240,0.97)'} />
      </svg>
      <div style={{ position: 'absolute', left: a.left, top: a.top, width: a.width, height: h, boxSizing: 'border-box', background: big ? '#FFF1EC' : 'rgba(255,250,240,0.97)', border: big ? '5px solid #E2456B' : 'none', borderRadius: 40, boxShadow: '0 10px 26px rgba(16,8,4,0.4)', padding: '12px 26px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', transform: `scale(${p})`, transformOrigin: `${tx - a.left}px ${a.top + h - a.top}px` }}>
        <div style={{ fontFamily: KO, fontWeight: 900, fontSize: koSize, color: big ? '#C8243F' : INK, lineHeight: 1.16, whiteSpace: 'nowrap' }}>{a.ko}</div>
        <div style={{ fontFamily: EN, fontWeight: 700, fontSize: 52, color: '#5A483C', lineHeight: 1.15, fontStyle: 'italic', whiteSpace: 'nowrap' }}>{read}</div>
        <div style={{ fontFamily: pk.font, fontWeight: 800, fontSize: pk.askSize, color: MEAN, lineHeight: Math.max(1.14, pk.lineH), marginTop: 2, whiteSpace: 'pre-line' }}>{mean}</div>
      </div>
    </div>
  );
};

// 작은 말 — 머리 칸 · 끝 칸의 몽글(한국어 · 읽기 · 뜻)
const Small: React.FC<{ pk: LocPack; t: number; from: number; until: number; left: number; top: number; width: number; ko: string; read: string; mn: string; koSize?: number; glow?: number }> = ({ pk, t, from, until, left, top, width, ko, read, mn, koSize = 88, glow = 0.62 }) => {
  if (t < from || t >= until) return null;
  const p = interpolate(t, [from, from + 0.13], [0.8, 1], { ...clamp, easing: Easing.out(Easing.back(2.2)) });
  const h = Math.round(koSize * 1.12 * 1.14 + 50 * 1.15 + pk.smallSize * 1.14 + 4 + 40);
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Glow x={left + width / 2} y={top + h / 2} w={width + 260} h={h + 260} a={glow} />
      <div style={{ position: 'absolute', left, top, width, height: h, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', transform: `scale(${p}) rotate(-2deg)`, transformOrigin: '50% 100%', textShadow: SH }}>
        <div style={{ fontFamily: KO, fontWeight: 900, fontSize: koSize * 1.12, color: CREAM, lineHeight: 1.14, whiteSpace: 'nowrap' }}>{ko}</div>
        <div style={{ fontFamily: EN, fontWeight: 700, fontSize: 50, color: DIM, lineHeight: 1.15, whiteSpace: 'nowrap', fontStyle: 'italic' }}>{read}</div>
        <div style={{ fontFamily: pk.font, fontWeight: 800, fontSize: pk.smallSize, color: PINK, lineHeight: Math.max(1.14, pk.lineH), marginTop: 4, whiteSpace: 'nowrap' }}>{mn}</div>
      </div>
    </div>
  );
};

const Sounds: React.FC = () => (
  <>
    <Audio src={staticFile('sfx/bgm.wav')} volume={(f) => MASTER * interpolate(f / FPS, [0, BOOM_AT - 0.3, BOOM_AT, MENU_AT, MENU_AT + 0.3, TOTAL - 0.6, TOTAL], [BGM_LOW, BGM_LOW, BGM_DIP, BGM_DIP, BGM_LOW, BGM_LOW, 0], clamp)} />
    <Audio src={staticFile('sfx/air.wav')} volume={(f) => 0.2 * MASTER * interpolate(f / FPS, [0, TOTAL - 0.4, TOTAL], [1, 1, 0], clamp)} />
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
    <AbsoluteFill style={{ background: '#1b1310' }}>
      <Plate i={i} t={t} />
      <Rain t={t} />
      {/* 참을성이 터지는 순간 붉게 번쩍 */}
      {t >= BOOM_AT - 0.02 && t < BOOM_AT + 0.4 ? <AbsoluteFill style={{ background: '#FF5A4A', opacity: interpolate(t, [BOOM_AT - 0.02, BOOM_AT + 0.04, BOOM_AT + 0.4], [0, 0.45, 0], clamp) }} /> : null}
      {/* 위쪽 그늘 — 글자가 놓일 자리(상자가 아니라 빛) */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 720, background: 'linear-gradient(to bottom, rgba(20,11,7,0.6) 0%, rgba(20,11,7,0.38) 58%, rgba(20,11,7,0) 100%)' }} />
      {/* 머리 칸(0~3.2초)에는 게이지를 두지 않는다 — 1%에서 100%로 뛰는 까닭을 넷 · 둘이 v1 · v3에서 다시 짚었다. 30분 전으로 감는 3.2초에 100%로 처음 뜬다 */}
      {t >= 3.2 ? <div style={{ position: 'absolute', inset: 0, opacity: interpolate(t, [3.2, 3.4], [0, 1], clamp) }}><Gauge p={p} t={t} /></div> : null}
      <Minus t={t} />
      {t < 3.2 ? <Hook pk={p} t={t} /> : null}
      {/* ⏪ 30분 전 — 머리 칸(저녁 끝, 1%)에서 처음으로 감는다(이해 시험 v1 넷 가운데 셋 「1%에서 왜 100%로 뛰나」 · LAB 교훈 L07 회상 표시) */}
      {t >= 3.2 && t < 4.9 ? <div style={{ position: 'absolute', left: 80, width: 380, top: 395, textAlign: 'left', opacity: interpolate(t, [3.2, 3.32, 4.6, 4.9], [0, 1, 1, 0], clamp), color: CREAM, fontFamily: p.font, fontWeight: 800, fontSize: 50, lineHeight: 1.12, whiteSpace: 'pre-line', textShadow: SH }}>{p.rewind}</div> : null}
      <Small pk={p} t={t} from={0.55} until={3.2} left={420} top={890} width={450} ko={KO_LINES.open} read={p.openRead} mn={p.openMean} koSize={80} />
      {c.ask ? <AskBubble pk={p} a={c.ask} at={c.at + 0.08} t={t} /> : null}
      {c.phrase ? <Speech pk={p} b={c.phrase} at={c.at} t={t} /> : null}
      <Small pk={p} t={t} from={LAST_AT} until={SIT_AT} left={300} top={400} width={620} ko={KO_LINES.last} read={p.lastRead} mn={p.lastMean} koSize={92} glow={0.85} />
      {t >= END_AT ? (
        <div style={{ position: 'absolute', left: 70, right: 70, top: 470, textAlign: 'center', opacity: interpolate(t, [END_AT, END_AT + 0.15], [0, 1], clamp), transform: `scale(${interpolate(t, [END_AT, END_AT + 0.18], [0.9, 1], { ...clamp, easing: Easing.out(Easing.back(2)) })})` }}>
          <span style={{ color: CREAM, fontFamily: p.font, fontWeight: 800, fontSize: p.endSize, lineHeight: Math.max(1.2, p.lineH), whiteSpace: 'pre-line', textShadow: SH }}>{p.end}</span>
        </div>
      ) : null}
      <Sounds />
    </AbsoluteFill>
  );
};
