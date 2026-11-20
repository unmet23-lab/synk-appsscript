// LAB 몽골 M63 「배달 시킬 때 네 마디」(11-20) — 머리 칸(한밤 원룸 · 잠든 룸메이트 · 폰을 보는 몽글) → 번호 붙은 네 마디(덜 맵게 · 문 앞에 · 벨 누르지 말고 · 문자로)
// → 기사님이 벨 앞에서 손을 멈추고 문 앞에 놓는다 → 폰에 「도착했어요」 → 뚜껑을 열자 김이 룸메이트 코에 → 벌떡 「나도…!」 → 끝 줄.
// 원본 몽골 릴스(가게 이름 다섯)의 뼈대와 「n / 4 · 큰 한글 · 읽는 법 · 뜻」 카드 꼴을 가져왔다(우리 LAB 글 꼴 — 상자 없는 크림 글자 + 그늘).
// 그림은 장면마다 구운 한 장(누끼 없음) — 같은 판을 부드러운 타원 가면으로 겹쳐 그 자리만 움직인다(M64 본뜸).
// 판본 틀: 그 나라 글과 글꼴 · 글자 크기는 판본 꾸러미 p(./판본/<KEY>.json)에서 받는다. 그림 · 한국어 · 소리 · 박자 · 카메라는 그대로다.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { EN, KO } from '../lib/fonts';
import { BGM_END, BGM_LOW, CELLS, END_AT, FINGER, FPS, SHH, KO_LINES, LID_AT, MATE, MATE_MOUTH, MONGLE, MOVE_AT, MSG_AT, NA_AT, Phrase as PhraseData, PHONE, RIDER_AT, SFX, SNIFF_AT, SPICY_AT, STEAM, TOTAL, UP_AT, WAKE_AT } from './data';
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
const DIM = 'rgba(255,248,236,0.94)';
const FULL: React.CSSProperties = { position: 'absolute', inset: 0, width: 1080, height: 1920, objectFit: 'cover' };
const SH = '0 3px 0 rgba(12,10,24,0.5), 0 5px 18px rgba(8,6,16,0.62)';
const Glow: React.FC<{ x: number; y: number; w: number; h: number; a?: number }> = ({ x, y, w, h, a = 0.5 }) => <div style={{ position: 'absolute', left: x - w / 2, top: y - h / 2, width: w, height: h, background: `radial-gradient(ellipse at 50% 50%, rgba(10,8,22,${a}) 0%, rgba(10,8,22,${a * 0.55}) 45%, rgba(10,8,22,0) 72%)` }} />;
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
  const mt = MATE[img];
  // 칸마다 천천히 다가간다(카드가 뜰 때 한 번 톡)
  let z = interpolate(t, [c.at, end], [1.0, 1.06], { ...clamp, easing: Easing.inOut(Easing.quad) });
  let ox = 540;
  let oy = 1200;
  let dx = 0;
  let dy = 0;
  if (c.phrase) z += 0.03 * bump(t, c.at, 0.06, 0.45);
  if (img === 'open.jpg') {
    ox = 540;
    oy = 1350;
  }
  if (img === 'bell.jpg') {
    // 인터폰과 잠든 얼굴 쪽으로
    ox = 420;
    oy = 900;
    z = interpolate(t, [c.at, end], [1.0, 1.09], { ...clamp, easing: Easing.inOut(Easing.quad) });
  }
  if (img === 'rider.jpg') {
    // 쉿 하는 얼굴과 바닥의 봉투 쪽으로 다가간다(벨은 오른쪽에 그대로 보인다)
    z = interpolate(t, [c.at, end], [1.0, 1.12], { ...clamp, easing: Easing.inOut(Easing.cubic) });
    ox = SHH.x;
    oy = SHH.y + 200;
  }
  if (img === 'lid.jpg') {
    // 김이 방을 건너가는 동안 잠든 룸메이트 쪽으로 다가간다
    // 장면 심사 v3(Opus): 첫 칸 위 3분의 1이 빈 천장 — 처음부터 침대 · 탁자 쪽으로 붙여 시작
    z = interpolate(t, [c.at, c.at + 0.5, end], [1.18, 1.18, 1.32], { ...clamp, easing: Easing.inOut(Easing.quad) });
    ox = 300;
    oy = 1250;
  }
  if (img === 'sniff.jpg') {
    z = interpolate(t, [c.at, end], [1.0, 1.06], { ...clamp, easing: Easing.inOut(Easing.quad) });
    ox = 330;
    oy = 1050;
  }
  if (img === 'up.jpg') {
    // 벌떡 — 판이 한 번 튄다
    z = interpolate(t, [UP_AT, UP_AT + 0.1, UP_AT + 0.45, end], [1.1, 1.02, 1.0, 1.04], { ...clamp, easing: Easing.out(Easing.cubic) });
    ox = 480;
    oy = 1050;
    dy = 14 * interpolate(t, [UP_AT, UP_AT + 0.05, UP_AT + 0.4], [0, 1, 0], clamp);
  }
  if (img === 'wake.jpg') {
    // 눈이 번쩍 — 한 번 확 다가간다
    // 첫 컷 v2 「#33 눈에서 턱까지가 화면 1/3 밑」 → 얼굴로 확 다가가 눈~턱이 화면 1/3을 넘게
    z = interpolate(t, [WAKE_AT, WAKE_AT + 0.08, end], [1.55, 1.4, 1.46], { ...clamp, easing: Easing.out(Easing.cubic) });
    ox = 585;
    oy = 1080;
  }
  if (img === 'move.jpg') {
    z = interpolate(t, [c.at, end], [1.0, 1.05], { ...clamp, easing: Easing.inOut(Easing.quad) });
    ox = 500;
    oy = 1150;
  }
  if (img === 'eat.jpg') {
    z = interpolate(t, [c.at, end], [1.02, 1.08], { ...clamp, easing: Easing.inOut(Easing.quad) });
    ox = 560;
    oy = 1150;
  }
  // 몽글 — 늘 둥실(밑단을 축으로 늘였다 줄이기만 — 옮기면 밑의 원래 몸이 두 겹으로 비친다)
  let msx = 1 + 0.012 * Math.sin(t * 5.5);
  let msy = 2 - msx + 0.014 * Math.sin(t * 2.6);
  let mrot = 0;
  for (const v of c.vo ?? []) {
    if (!v.id.startsWith('m')) continue;
    const b = bump(t, v.at, 0.05, 0.3);
    msx += 0.025 * b;
    msy += 0.025 * b;
  }
  if (img === 'spicy.jpg') {
    // 매워서 부들부들
    mrot = 2.2 * Math.sin(t * 38) + 1.5 * Math.sin(t * 11);
    msy += 0.02 * Math.abs(Math.sin((t - SPICY_AT) * 9));
  }
  if (img === 'door.jpg') mrot = -4 * interpolate(t, [c.at, c.at + 0.6], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) }) + 1.2 * Math.sin(t * 2.4);
  if (img === 'bell.jpg') {
    // 숨을 참고 뒤로 살짝
    mrot = 4 * interpolate(t, [c.at + 0.2, c.at + 0.7], [0, 1], { ...clamp, easing: Easing.out(Easing.back(2)) });
    msy -= 0.02 * interpolate(t, [c.at + 0.2, c.at + 0.7], [0, 1], clamp);
  }
  if (img === 'buzz.jpg') {
    // 조심스럽게 끄덕
    mrot = 5 * Math.max(0, Math.sin((t - c.at - 0.5) * 6)) * (t > c.at + 0.5 && t < c.at + 1.6 ? 1 : 0);
  }
  if (img === 'lid.jpg') mrot = 4 * Math.sin((t - LID_AT) * 3.2); // 신나서 흔들흔들
  if (img === 'sniff.jpg') mrot = 12 * interpolate(t, [c.at + 0.2, c.at + 0.6], [0, 1], { ...clamp, easing: Easing.out(Easing.back(2)) }); // 갸웃 — 왜 일어나지?(첫 컷 v2 「갸웃이 안 보임」 → 크게)
  if (img === 'move.jpg') mrot = -8 * interpolate(t, [c.at, c.at + 0.3], [0, 1], { ...clamp, easing: Easing.out(Easing.back(2)) }); // 뒤로 물러남
  if (img === 'up.jpg') {
    // 얼어붙음 — 작게 떨림
    mrot = 1.2 * Math.sin(t * 46);
    msx = 1;
    msy = 1;
  }
  if (img === 'eat.jpg') mrot = -3 * interpolate(t, [c.at, c.at + 0.6], [0, 1], { ...clamp, easing: Easing.out(Easing.quad) }) + 1 * Math.sin(t * 2); // 한숨 쉬듯 기운다
  // 잠든 룸메이트 — 숨 쉬듯 아주 작게
  let ssx = 1 + 0.008 * Math.sin(t * 2.1);
  let ssy = ssx;
  let srot = 0;
  if (img === 'sniff.jpg') {
    // 킁킁 — 코가 김을 따라 두 번 들썩, 몸이 김 쪽으로 끌려 올라간다(늘 1 이상)
    // 첫 컷 v2 「킁킁이 안 보임」 → 0.25초 칸에서도 보이게 크게(두 번 킁 · 킁, 점점 김 쪽으로 끌려 올라감)
    const sn = Math.abs(Math.sin((t - SNIFF_AT) * 6.5));
    srot = -7 * sn - 4 * interpolate(t, [SNIFF_AT, SNIFF_AT + 1.0], [0, 1], clamp);
    ssx = 1 + 0.03 * sn;
    ssy = 1 + 0.05 * sn + 0.04 * interpolate(t, [SNIFF_AT, SNIFF_AT + 1.0], [0, 1], clamp);
  }
  if (img === 'up.jpg') {
    // 벌떡 — 위로 늘었다 내려앉고, 손을 뻗은 채 몸을 들썩인다(늘 1 이상 — 첫 컷 v1 「#26 나도 뒤 자세가 굳음」)
    ssx = 1 + 0.06 * interpolate(t, [UP_AT, UP_AT + 0.12, UP_AT + 0.5], [1, 0.4, 0], { ...clamp, easing: Easing.out(Easing.cubic) });
    ssy = ssx + 0.025 * Math.abs(Math.sin((t - UP_AT) * 6.5));
    srot = 1.5 * Math.sin((t - UP_AT) * 5);
  }
  if (img === 'eat.jpg') {
    // 우물우물 — 볼이 들썩
    // 첫 컷 v2 「먹는 자세가 굳음」 → 0.25초 칸에서도 보이게 크게 우물우물 · 고개 까딱
    const ch = Math.abs(Math.sin((t - END_AT) * 7));
    ssy = 1 + 0.06 * ch;
    ssx = 1 + 0.02 * ch;
    srot = 4 * Math.sin((t - END_AT) * 3.5);
  }
  // 기사 — 발끝으로 서서 윗몸이 살짝 흔들림
  const fdx = img === 'rider.jpg' ? 3 * Math.sin(t * 9) : 0;
  const fdy = img === 'rider.jpg' ? -2 * Math.abs(Math.sin(t * 4.5)) : 0;
  return (
    <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: '#0f0d1c' }}>
      <AbsoluteFill style={{ transform: `translate(${dx}px, ${dy}px) scale(${z})`, transformOrigin: `${ox}px ${oy}px` }}>
        <Img src={staticFile(`img/${img}`)} style={FULL} />
        {mt ? <Patch img={img} cx={mt.cx} cy={mt.cy} rx={mt.rx} ry={mt.ry} sx={ssx} sy={ssy} rot={srot} ox={mt.cx} oy={mt.cy + mt.ry * 0.9} /> : null}
        {m ? <Patch img={img} cx={m.cx} cy={m.cy} rx={m.rx} ry={m.ry} sx={msx} sy={msy} rot={mrot} /> : null}
        {img === 'rider.jpg' ? <Patch img={img} cx={FINGER.cx} cy={FINGER.cy} rx={FINGER.rx} ry={FINGER.ry} dx={fdx} dy={fdy} /> : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// 회상 칸(첫째 마디) — 따뜻한 테두리와 💭 표시로 지금 장면과 가른다(LAB 교훈 L07)
const Memory: React.FC<{ p: LocPack; t: number }> = ({ p, t }) => {
  if (t < SPICY_AT || t >= SPICY_AT + 2.2) return null;
  const a = interpolate(t, [SPICY_AT, SPICY_AT + 0.15], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ opacity: a }}>
      <AbsoluteFill style={{ boxShadow: 'inset 0 0 0 18px rgba(255,214,150,0.55), inset 0 0 160px 60px rgba(120,60,10,0.55)', borderRadius: 0 }} />
      {/* 올리기 전 검사(11-20): 1470px에 두면 아래 앱 글자 자리(1428px 밑)에 걸려 카드 바로 아래 가운데로 올렸다 */}
      <div style={{ position: 'absolute', left: 70, right: 70, top: 748, textAlign: 'center', fontFamily: p.font, fontWeight: 800, fontSize: 56, lineHeight: 1.15, color: '#FFE7C2', textShadow: SH, whiteSpace: 'pre-line' }}>{p.memo}</div>
    </AbsoluteFill>
  );
};

// 💤 — 잠든 룸메이트 머리 위로 z가 하나씩 떠오른다
const Zzz: React.FC<{ t: number; img: string; at: number }> = ({ t, img, at }) => {
  const mt = MATE[img];
  if (!mt || !['open.jpg', 'door.jpg', 'buzz.jpg', 'lid.jpg'].includes(img)) return null; // 인터폰 칸은 눈 감은 얼굴이 크게 보여 💤를 두지 않는다(인터폰 줄과 겹침)
  const quiet = img === 'lid.jpg' ? interpolate(t, [SNIFF_AT - 0.5, SNIFF_AT - 0.2], [1, 0], clamp) : 1; // 김이 코에 닿으면 💤가 멎는다
  return (
    <>
      {[0, 1, 2].map((k) => {
        const u = (((t - at) * 0.9 + k / 3) % 1 + 1) % 1;
        return <div key={k} style={{ position: 'absolute', left: mt.cx + 60 + 70 * u, top: mt.cy - mt.ry - 30 - 150 * u, opacity: quiet * Math.sin(Math.PI * u), fontFamily: EN, fontWeight: 900, fontSize: 40 + 26 * u, color: '#CFE3FF', textShadow: SH }}>z</div>;
      })}
    </>
  );
};

const Hook: React.FC<{ pk: LocPack; t: number }> = ({ pk, t }) => {
  if (t >= SPICY_AT) return null;
  const p = interpolate(t, [0, 0.2], [0.92, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  return (
    <>
      <Glow x={540} y={470} w={1100} h={560} a={0.55} />
      <div style={{ position: 'absolute', left: 60, right: 60, top: 300, textAlign: 'center', transform: `scale(${p})`, color: CREAM, fontFamily: pk.font, fontWeight: 800, fontSize: pk.hookSize, lineHeight: Math.max(1.14, pk.lineH), whiteSpace: 'pre-line', textShadow: SH }}>{pk.hook}</div>
      {/* 잠든 룸메이트 이름표 — 이해 시험 v3(s · h): 46px는 작아 못 읽고 0.4초에 뒤늦게 떠 깜박이는 듯 보여 처음부터 58px로 */}
      {/* 이해 시험 v3(그록): 「문 옆 이름표가 누구를 가리키나」 — 잠든 얼굴로 내려가는 작은 크림색 화살 */}
      <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0 }}>
        <path d="M 168 912 L 222 912 L 195 952 Z" fill={CREAM} style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))' }} />
      </svg>
      <div style={{ position: 'absolute', left: 50, top: 830, fontFamily: pk.font, fontWeight: 800, fontSize: 58, color: CREAM, textShadow: SH, whiteSpace: 'nowrap' }}>{pk.mate}</div>
    </>
  );
};

// 네 마디 — 요청 사항 쪽지(종이 판 · 📝 번호 · 큰 한글 · 읽는 법 · 뜻). 이해 시험 v1에서 둘(h · G)이 지난 편 「아무거나」의 「n / 4」 크림 글자 틀과
// 같아 보인다고 짚어, 몽글이 적는 요청 사항을 종이 쪽지로 보인다(v2).
const Card: React.FC<{ pk: LocPack; b: PhraseData; at: number; t: number }> = ({ pk, b, at, t }) => {
  const p = interpolate(t, [at, at + 0.14], [0.86, 1], { ...clamp, easing: Easing.out(Easing.back(2)) });
  const left = b.left ?? 70;
  const width = b.width ?? 840;
  const rot = b.n % 2 ? -1.6 : 1.4;
  return (
    <div style={{ position: 'absolute', top: b.top, left, width, textAlign: 'center', transform: `scale(${p})`, transformOrigin: '50% 0%', opacity: Math.min(1, (p - 0.86) / 0.1) }}>
      <div style={{ display: 'inline-block', background: '#FFF8E8', borderRadius: 22, padding: '14px 34px 20px', boxShadow: '0 12px 30px rgba(8,6,16,0.5), inset 0 -6px 0 rgba(200,170,120,0.25)', transform: `rotate(${rot}deg)`, maxWidth: width }}>
        <div style={{ fontFamily: EN, fontWeight: 800, fontSize: 38, color: '#9A7A56', lineHeight: 1.15, letterSpacing: 1 }}>📝 {b.n}</div>
        <div style={{ fontFamily: KO, fontWeight: 900, fontSize: b.koSize, color: INK, lineHeight: 1.1, whiteSpace: 'pre', marginTop: 2 }}>{b.koShow ?? b.ko}</div>
        <div style={{ fontFamily: EN, fontWeight: 700, fontSize: 50, color: '#6A584C', lineHeight: 1.15, fontStyle: 'italic', whiteSpace: 'pre' }}>{pk.reads[b.n - 1]}</div>
        <div style={{ fontFamily: pk.font, fontWeight: 800, fontSize: pk.meanSize, color: MEAN, lineHeight: Math.max(1.14, pk.lineH), marginTop: 6, whiteSpace: 'pre-line' }}>{pk.means[b.n - 1]}</div>
      </div>
    </div>
  );
};

// 기사 칸 위 한 줄 — 「벨을 누르지 않았다」(이해 시험 v1 셋(G · K · s)이 기사가 벨을 눌렀는지 모르겠다고 짚음)
const RiderNote: React.FC<{ pk: LocPack; t: number }> = ({ pk, t }) => {
  if (t < RIDER_AT + 0.35 || t >= LID_AT) return null;
  const p = interpolate(t, [RIDER_AT + 0.35, RIDER_AT + 0.5], [0.85, 1], { ...clamp, easing: Easing.out(Easing.back(2)) });
  return (
    <>
      <Glow x={490} y={400} w={1000} h={300} a={0.6} />
      <div style={{ position: 'absolute', left: 70, width: 840, top: 340, textAlign: 'center', transform: `scale(${p})`, color: CREAM, fontFamily: pk.font, fontWeight: 800, fontSize: 64, lineHeight: 1.15, textShadow: SH, whiteSpace: 'nowrap' }}>{pk.riderNote}</div>
    </>
  );
};

// 폰에 온 문자 「도착했어요」 — 폰 위로 떠오르는 문자 상자(벨 대신 문자가 왔다)
const Message: React.FC<{ pk: LocPack; t: number }> = ({ pk, t }) => {
  if (t < MSG_AT || t >= SNIFF_AT) return null; // 열기 칸에만(폰이 그 그림의 탁자 위에 있다)
  const p = interpolate(t, [MSG_AT, MSG_AT + 0.18], [0.7, 1], { ...clamp, easing: Easing.out(Easing.back(2)) });
  const shake = 4 * interpolate(t, [MSG_AT, MSG_AT + 0.6], [1, 0], clamp) * Math.sin(t * 90);
  const w = 540; // 머리 줄 「📱 Хүргэгчээс ирсэн мессеж」이 들게 넓힘(오른쪽 끝 920 — 단추 안전선)
  const left = 380;
  const top = 760;
  // 이해 시험 v3(sonnet · haiku): 「도착했어요」가 누구 말인지 모름 — 꼬리를 열기 칸의 확대를 따라 실제 폰 자리로 잇고, 머리에 「기사님이 보낸 문자」 표시
  const li = CELLS.findIndex((c) => c.img === 'lid.jpg');
  const lz = interpolate(t, [CELLS[li].at, CELLS[li].at + 0.5, CELLS[li + 1].at], [1.18, 1.18, 1.32], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const phx = 300 + (PHONE.x - 300) * lz;
  const phy = 1250 + (PHONE.y - 1250) * lz;
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: Math.min(1, (p - 0.7) / 0.15), transform: `translateX(${shake}px)` }}>
      <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0 }}>
        <path d={`M ${phx - 40} ${top + 290} L ${phx} ${phy - 34} L ${phx + 40} ${top + 290} Z`} fill="rgba(255,250,240,0.96)" />
      </svg>
      <div style={{ position: 'absolute', left, top, width: w, boxSizing: 'border-box', background: 'rgba(255,250,240,0.96)', borderRadius: 34, boxShadow: '0 10px 26px rgba(8,6,16,0.45)', padding: '16px 22px 18px', textAlign: 'center', transform: `scale(${p})`, transformOrigin: `${PHONE.x - left}px 100%` }}>
        <div style={{ fontFamily: pk.font, fontWeight: 800, fontSize: 36, color: '#5A483C', lineHeight: 1.15, whiteSpace: 'nowrap' }}>{pk.msgFrom}</div>
        <div style={{ fontFamily: KO, fontWeight: 900, fontSize: 76, color: INK, lineHeight: 1.12, whiteSpace: 'nowrap' }}>{KO_LINES.msg}</div>
        <div style={{ fontFamily: EN, fontWeight: 700, fontSize: 46, color: '#5A483C', lineHeight: 1.15, fontStyle: 'italic', whiteSpace: 'nowrap' }}>{pk.msgRead}</div>
        <div style={{ fontFamily: pk.font, fontWeight: 800, fontSize: pk.smallSize, color: MEAN, lineHeight: Math.max(1.14, pk.lineH), whiteSpace: 'nowrap' }}>{pk.msgMean}</div>
      </div>
    </div>
  );
};

// 김 — 떡볶이에서 룸메이트 코까지 방을 건너가는 줄기(그림 속 김 위에 흐르는 결을 더한다)
const Steam: React.FC<{ t: number }> = ({ t }) => {
  if (t < LID_AT + 0.3 || t >= SNIFF_AT) return null; // 열기 칸에만 — 다음 칸들은 그림에 김이 구워져 있다
  const grow = interpolate(t, [LID_AT + 0.3, LID_AT + 1.3], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const fade = 1;
  const [x0, y0] = STEAM.from;
  const [x1, y1] = STEAM.to;
  const d = `M ${x0} ${y0} C ${x0 - 40} ${y0 - 260}, ${(x0 + x1) / 2 + 60} ${y1 - 220}, ${x1} ${y1}`;
  return (
    <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0, opacity: 0.75 * fade, filter: 'blur(5px)' }}>
      <path d={d} stroke="rgba(255,255,255,0.85)" strokeWidth={22} fill="none" strokeLinecap="round" pathLength={1} strokeDasharray={`${grow} 1`} />
      {[0, 1, 2, 3].map((k) => {
        const u = ((t - LID_AT) * 0.55 + k / 4) % 1;
        if (u * 1 > grow) return null;
        const bx = x0 + (x1 - x0) * u + 30 * Math.sin((t + k) * 3);
        const by = y0 + (y1 - y0) * u - 200 * Math.sin(Math.PI * u);
        return <circle key={k} cx={bx} cy={by} r={18 + 10 * Math.sin(Math.PI * u)} fill="rgba(255,255,255,0.7)" />;
      })}
    </svg>
  );
};

// 룸메이트 「나도…!」 — 흰 말풍선, 꼬리가 룸메이트 입 쪽(누구 말인지 바로 — LAB 교훈 L21)
const NaBubble: React.FC<{ pk: LocPack; t: number }> = ({ pk, t }) => {
  if (t < NA_AT || t >= MOVE_AT) return null; // 벌떡 칸에만(꼬리가 그 그림의 입을 가리킨다)
  const p = interpolate(t, [NA_AT, NA_AT + 0.16], [0.8, 1], { ...clamp, easing: Easing.out(Easing.back(2)) });
  const left = 430;
  const top = 270;
  const w = 490;
  const [tx, ty] = MATE_MOUTH;
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: Math.min(1, (p - 0.8) / 0.12) }}>
      <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0, filter: 'drop-shadow(0 10px 22px rgba(8,6,16,0.42))' }}>
        <path d={`M ${left + 170} ${top + 230} L ${tx} ${ty} L ${left + 250} ${top + 230} Z`} fill="rgba(255,250,240,0.97)" />
      </svg>
      <div style={{ position: 'absolute', left, top, width: w, height: 240, boxSizing: 'border-box', background: 'rgba(255,250,240,0.97)', borderRadius: 40, boxShadow: '0 10px 26px rgba(8,6,16,0.4)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', transform: `scale(${p})`, transformOrigin: '60% 100%' }}>
        <div style={{ fontFamily: KO, fontWeight: 900, fontSize: 78, color: INK, lineHeight: 1.1, whiteSpace: 'nowrap' }}>{KO_LINES.na}</div>
        <div style={{ fontFamily: EN, fontWeight: 700, fontSize: 46, color: '#5A483C', lineHeight: 1.15, fontStyle: 'italic', whiteSpace: 'nowrap' }}>{pk.naRead}</div>
        <div style={{ fontFamily: pk.font, fontWeight: 800, fontSize: pk.smallSize, color: MEAN, lineHeight: Math.max(1.14, pk.lineH), whiteSpace: 'nowrap' }}>{pk.naMean}</div>
      </div>
    </div>
  );
};

const Sounds: React.FC = () => (
  <>
    <Audio src={staticFile('sfx/bgm.wav')} volume={(f) => MASTER * interpolate(f / FPS, [0, UP_AT - 0.2, UP_AT + 0.2, TOTAL - 0.6, TOTAL], [BGM_LOW, BGM_LOW, BGM_END, BGM_END, 0], clamp)} />
    <Audio src={staticFile('sfx/air.wav')} volume={(f) => 0.22 * MASTER * interpolate(f / FPS, [0, TOTAL - 0.4, TOTAL], [1, 1, 0], clamp)} />
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
    <AbsoluteFill style={{ background: '#0f0d1c' }}>
      <Plate i={i} t={t} />
      <Steam t={t} />
      <Zzz t={t} img={c.img} at={c.at} />
      <Memory p={p} t={t} />
      {/* 위쪽 그늘 — 글자가 놓일 자리(상자가 아니라 빛) */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 760, background: 'linear-gradient(to bottom, rgba(10,8,22,0.5) 0%, rgba(10,8,22,0.3) 58%, rgba(10,8,22,0) 100%)' }} />
      <Hook pk={p} t={t} />
      {c.phrase ? <Card pk={p} b={c.phrase} at={c.at} t={t} /> : null}
      <RiderNote pk={p} t={t} />
      {t >= WAKE_AT + 0.1 && t < UP_AT ? (
        // 얼굴 가까이 칸 — 냄새로 깼다(이해 시험 v2 둘이 이 칸이 무슨 장면인지 짚음)
        <div style={{ position: 'absolute', left: 70, width: 840, top: 330, textAlign: 'center', transform: `scale(${interpolate(t, [WAKE_AT + 0.1, WAKE_AT + 0.22], [0.8, 1], { ...clamp, easing: Easing.out(Easing.back(2.5)) })})`, color: CREAM, fontFamily: p.font, fontWeight: 900, fontSize: 84, textShadow: SH, whiteSpace: 'nowrap' }}>{p.smell}</div>
      ) : null}
      <Message pk={p} t={t} />
      <NaBubble pk={p} t={t} />
      {t >= END_AT ? (
        <div style={{ position: 'absolute', left: 70, right: 70, top: 330, textAlign: 'center', opacity: interpolate(t, [END_AT, END_AT + 0.15], [0, 1], clamp), transform: `scale(${interpolate(t, [END_AT, END_AT + 0.18], [0.9, 1], { ...clamp, easing: Easing.out(Easing.back(2)) })})` }}>
          <Glow x={470} y={110} w={1000} h={420} a={0.7} />
          <span style={{ position: 'relative', color: CREAM, fontFamily: p.font, fontWeight: 800, fontSize: p.endSize, lineHeight: Math.max(1.2, p.lineH), whiteSpace: 'pre-line', textShadow: SH }}>{p.end}</span>
        </div>
      ) : null}
      <Sounds />
    </AbsoluteFill>
  );
};
