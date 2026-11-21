// LAB 영어 E58 「엄마 동결건조하고 싶다」(11-21 07시 회차) — 판(판/_판짜기.py가 1080×1920으로 짠 그림)을 칸마다 바꾸고, 칸 안에서는 천천히 다가가며
// 몸 한 덩이(몽글 얼어붙음 · 뒷걸음 · 기계 덜덜 · 유리병 톡 · 몽글 덜덜 · 깨달음 · 포옹 흔들 · 통통)만 움직인다(E57 Film.tsx를 본떴다).
// 화면 글: 위 빈 지붕(270~540)에 역 표지판 꼴의 남색 표지(교훈 L02 — 지난 E57 겨자색 목도리 띠 · E48 분홍 띠와 다르게), 대사는 말하는 이 곁 말풍선,
// 몽글의 상상 칸(6.5~11.1초)은 처음부터 얼음빛 그림 + 점선 테 + 💭 표시로 지금 장면과 가른다(교훈 L07).
// 글자는 안전선(가로 65~920 · 세로 269~1428) 안에 둔다(올리기 전 검사 ⑤). 맞음 · 틀림이 없는 편이라 초록 · 빨강을 쓰지 않는다(제작 절차 「맞는 말 · 틀린 말」).
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, random, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from '../lib/fonts';
import { Body, CELLS, FPS, FREEZE, HOP, JAR, Loc, LOCS, REALIZE, RUMBLE, SFX, SHIVER, SLIDE, SLIDEOUT, SWAY, T, TOTAL, VO } from './data';

const fr = (sec: number) => Math.round(sec * FPS);
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const MASTER = 0.8;
export const TOTAL_FRAMES = fr(TOTAL);
export { FPS };

const INK = '#2A2230';
const PAPER = '#FFF8EE';
const NAVY = '#1F2C4D'; // 역 표지판 남색
const AMBER = '#F2B437'; // 표지판 머리 줄
const CREAM = '#FFF3D6';
const MEAN = '#2F4BA0'; // 말풍선 뜻 줄 — 맞음 · 틀림이 아닌 강조라 초록 · 빨강을 피한다
const SKY = '#CFE0FF'; // 표지판 위 영어 줄

const cellAt = (sec: number) => {
  let i = 0;
  CELLS.forEach((c, k) => {
    if (sec >= c.at) i = k;
  });
  return i;
};

const pop = (frame: number, at: number) => interpolate(frame, [fr(at), fr(at) + 6], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.7)) });

// 몸 한 덩이 — img 판의 body 자리를 둥글게 떠서 바닥 줄(baseY)을 기준으로 움직인다(줄이면 밑판 윤곽이 드러나 키우기 · 기울이기 · 옮기기만)
const BodyLayer: React.FC<{ img: string; body: Body; k: number; lift?: number; dx?: number; rot?: number }> = ({ img, body, k, lift = 0, dx = 0, rot = 0 }) => {
  const mask = `radial-gradient(ellipse ${body.rx}px ${body.ry}px at ${body.cx}px ${body.cy}px, #000 74%, transparent 100%)`;
  return (
    <AbsoluteFill style={{ transformOrigin: `${body.cx}px ${body.baseY}px`, transform: `translate(${dx}px, ${-lift}px) rotate(${rot}deg) scale(${k}, ${k})`, WebkitMaskImage: mask, maskImage: mask }}>
      <Img src={staticFile(`img/${img}`)} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920 }} />
    </AbsoluteFill>
  );
};

// 말풍선 — 말하는 이 곁, 꼬리가 그 사람을 가리킨다(x, y = 꼬리 끝). 말풍선이 위, 꼬리가 아래로.
const Bubble: React.FC<{ at: number; to: number; ko: string; mean: string; font: string; x: number; y: number; tail?: number; maxW?: number; koSize?: number; meanSize?: number; tailLen?: number }> = ({ at, to, ko, mean, font, x, y, tail = 0.5, maxW = 840, koSize = 70, meanSize = 48, tailLen = 30 }) => {
  const frame = useCurrentFrame();
  if (frame < fr(at) || frame >= fr(to)) return null;
  const p = pop(frame, at);
  return (
    <div style={{ position: 'absolute', left: x, top: y, transform: `translate(-${tail * 100}%, -100%) scale(${0.85 + 0.15 * p})`, transformOrigin: `${tail * 100}% 100%`, opacity: Math.min(1, p * 1.5) }}>
      <div style={{ position: 'relative', background: PAPER, borderRadius: 38, padding: '14px 30px 16px', textAlign: 'center', boxShadow: '0 10px 26px rgba(0,0,0,0.3)', border: `5px solid ${INK}`, maxWidth: maxW, marginBottom: tailLen }}>
        <div style={{ fontFamily: KO, fontWeight: 800, fontSize: koSize, color: INK, lineHeight: 1.12, whiteSpace: 'pre' }}>{ko}</div>
        <div style={{ fontFamily: font, fontWeight: 700, fontSize: meanSize, color: MEAN, lineHeight: 1.15, marginTop: 2, whiteSpace: 'pre' }}>{mean}</div>
        <div style={{ position: 'absolute', left: `${tail * 100}%`, bottom: -tailLen, width: 0, height: 0, transform: 'translateX(-50%)', borderLeft: '20px solid transparent', borderRight: '20px solid transparent', borderTop: `${tailLen}px solid ${INK}` }} />
      </div>
    </div>
  );
};

// 역 표지판 — 남색 판 + 아래 호박색 줄 하나(기차역 안내판 꼴). 위 빈 지붕 자리에 가운데로.
const Sign: React.FC<{ at: number; to: number; top?: number; children: React.ReactNode }> = ({ at, to, top = 278, children }) => {
  const frame = useCurrentFrame();
  if (frame < fr(at) || frame >= fr(to)) return null;
  const p = pop(frame, at);
  return (
    <div style={{ position: 'absolute', top, left: 65, width: 855, display: 'flex', justifyContent: 'center', opacity: Math.min(1, p * 1.4), transform: `translateY(${(1 - p) * -24}px)` }}>
      <div style={{ background: NAVY, border: `6px solid ${INK}`, borderBottom: `14px solid ${AMBER}`, borderRadius: 18, padding: '12px 36px 14px', textAlign: 'center', boxShadow: '0 12px 28px rgba(0,0,0,0.35)', maxWidth: 855 }}>{children}</div>
    </div>
  );
};
const SignTop: React.FC<{ font: string; text: string }> = ({ font, text }) => (
  <div style={{ fontFamily: font, fontWeight: 800, fontSize: 42, color: AMBER, lineHeight: 1.1, letterSpacing: 1, whiteSpace: 'nowrap' }}>{text}</div>
);
const SignKo: React.FC<{ text: string; size?: number }> = ({ text, size = 72 }) => (
  <div style={{ fontFamily: KO, fontWeight: 900, fontSize: size, color: CREAM, lineHeight: 1.12, whiteSpace: 'pre' }}>{text}</div>
);
const SignEn: React.FC<{ font: string; text: string; size?: number }> = ({ font, text, size = 48 }) => (
  <div style={{ fontFamily: font, fontWeight: 800, fontSize: size, color: SKY, lineHeight: 1.15, whiteSpace: 'pre-wrap', maxWidth: 840 }}>{text}</div>
);

// 상상 테 — 점선 테 + 💭 알약(교훈 L07 「회상 · 상상 칸은 처음부터 색과 표시로 가른다」). bare면 낱말 없이 💭만.
const DreamFrame: React.FC<{ font: string; label: string; what: string; bare?: boolean }> = ({ font, label, what, bare }) => {
  const frame = useCurrentFrame();
  const p = frame >= fr(T.dream) ? 1 : 0; // 첫 상상 칸부터 바로(첫 컷 다른 눈 v3 L07 「0.00초 얼음빛 화면에 점선 테와 표시가 없다」)
  return (
    <>
      <div style={{ position: 'absolute', left: 30, top: 30, right: 30, bottom: 30, border: `8px dashed ${CREAM}`, borderRadius: 60, opacity: 0.9 * p, boxShadow: 'inset 0 0 80px rgba(160,180,255,0.45)' }} />
      <div style={{ position: 'absolute', left: 90, top: 290, opacity: p, background: '#E9E4FF', border: `5px solid ${INK}`, borderRadius: 28, padding: '6px 28px 10px', textAlign: 'center', fontFamily: font, fontWeight: 800, fontSize: 44, color: INK, whiteSpace: 'nowrap', boxShadow: '0 8px 20px rgba(0,0,0,0.25)' }}>
        💭{bare ? '' : ` ${label}`}
        {bare ? null : <div style={{ fontWeight: 900, fontSize: 46, lineHeight: 1.1, color: MEAN }}>{what}</div>}
      </div>
      <div style={{ position: 'absolute', left: 790, top: 280, width: 170, height: 170, borderRadius: 34, border: `6px solid ${INK}`, overflow: 'hidden', opacity: p, boxShadow: '0 8px 20px rgba(0,0,0,0.3)', backgroundImage: `url(${staticFile('img/p2.jpg')})`, backgroundSize: '486px 864px', backgroundPosition: '-189px -339px' }} />
    </>
  );
};

// 기계 이름표 — 상상 칸의 기계 윗변에 「동결건조기 / FREEZE-DRYER」(이해 시험 v3 s · h · G 「왜 엄마가 병에 들어가는지 모르겠다」 — 몽글이 낱말 그대로 떠올린 기계라는 것을 판에 적는다)
const MACHINE_AT: Record<string, [number, number]> = { 'p5.jpg': [790, 600], 'p5b.jpg': [790, 600], 'p6.jpg': [540, 560], 'p7.jpg': [540, 560], 'p7b.jpg': [700, 540] }; // 9.2초 이름표가 상상 알약을 덮지 않게(볼 이유 v6)
const MachineLabel: React.FC<{ img: string; font: string; en: string }> = ({ img, font, en }) => {
  const at = MACHINE_AT[img];
  if (!at) return null;
  return (
    <div style={{ position: 'absolute', left: at[0], top: at[1], transform: 'translate(-50%, -50%) rotate(-2deg)', background: PAPER, border: `5px solid ${INK}`, borderRadius: 16, padding: '4px 24px 8px', textAlign: 'center', boxShadow: '0 8px 18px rgba(0,0,0,0.3)' }}>
      <div style={{ fontFamily: KO, fontWeight: 900, fontSize: 60, color: INK, lineHeight: 1.05, whiteSpace: 'nowrap' }}>동결건조기</div>
      <div style={{ fontFamily: font, fontWeight: 800, fontSize: 40, color: MEAN, lineHeight: 1.1, whiteSpace: 'nowrap' }}>{en}</div>
    </div>
  );
};

// 유리병 꼬리표 — 뚜껑에서 늘어진 짧은 끈 끝에 「엄마 / MOM」
const JarTag: React.FC<{ font: string; en: string }> = ({ font, en }) => {
  const frame = useCurrentFrame();
  if (frame < fr(T.tag) || frame >= fr(T.dreamTo)) return null;
  const p = pop(frame, T.tag);
  const sway = 3 * Math.sin(((frame - fr(T.tag)) / FPS) * Math.PI * 2);
  return (
    <>
      <div style={{ position: 'absolute', left: 345, top: 774, width: 130, height: 6, background: INK, borderRadius: 3, transform: 'rotate(-6deg)', transformOrigin: '100% 50%', opacity: Math.min(1, p * 1.5) }} />
      <div style={{ position: 'absolute', left: 250, top: 780, transform: `translate(-50%, -50%) rotate(${-6 + sway}deg) scale(${0.8 + 0.2 * p})`, opacity: Math.min(1, p * 1.5), background: PAPER, border: `5px solid ${INK}`, borderRadius: 20, padding: '6px 26px 10px', textAlign: 'center', boxShadow: '0 8px 20px rgba(0,0,0,0.3)' }}>
        <div style={{ fontFamily: KO, fontWeight: 900, fontSize: 74, color: INK, lineHeight: 1.05 }}>엄마</div>
        <div style={{ fontFamily: font, fontWeight: 800, fontSize: 40, color: MEAN, lineHeight: 1.1 }}>{en}</div>
      </div>
    </>
  );
};

// 기차 창 서리 — 굳은 자세의 엄마를 실은 창에 흰 서리가 귀퉁이부터 번진다(이해 시험 v6 「이렇게?」의 뜻을 그림으로)
const WindowFrost: React.FC<{ t: number }> = ({ t }) => {
  const u = interpolate(t, [24.9, 25.8], [0, 1], clamp);
  const r = 120 + 260 * u;
  const g = (x: number, y: number) => `radial-gradient(circle ${r}px at ${x}px ${y}px, rgba(255,255,255,0.85), rgba(235,245,255,0.55) 55%, transparent 100%)`;
  return <AbsoluteFill style={{ background: [g(150, 640), g(930, 640), g(150, 1300), g(930, 1300)].join(', '), opacity: 0.9 }} />;
};

// 몽글 이름표 — 몽글 가까이 칸(p2)에서 몽글 머리 왼쪽 위에 이름 알약, 짧은 선이 몽글로
const NameTag: React.FC<{ font: string; name: string }> = ({ font, name }) => {
  const frame = useCurrentFrame();
  if (frame < fr(T.name) || frame >= fr(T.nameTo)) return null;
  const p = pop(frame, T.name);
  return (
    <>
      <div style={{ position: 'absolute', left: 330, top: 735, width: 190, height: 6, background: INK, borderRadius: 3, transform: 'rotate(22deg)', transformOrigin: '0 50%', opacity: Math.min(1, p * 1.5) }} />
      <div style={{ position: 'absolute', left: 300, top: 720, transform: `translate(-50%, -50%) scale(${0.8 + 0.2 * p})`, opacity: Math.min(1, p * 1.5), background: '#FFE3DC', border: `5px solid ${INK}`, borderRadius: 999, padding: '4px 30px 8px', fontFamily: font, fontWeight: 900, fontSize: 58, color: INK, whiteSpace: 'nowrap', boxShadow: '0 8px 18px rgba(0,0,0,0.3)' }}>{name}</div>
    </>
  );
};

// 통화 머리 줄 — 폰 화면 속 사람이 누구인지(교훈 L21 「문자 · 알림 상자는 보낸 사람을 머리 줄로」)
const CallHeader: React.FC<{ font: string; text: string; x: number; y: number }> = ({ font, text, x, y }) => (
  <div style={{ position: 'absolute', left: x, top: y, transform: 'translate(-50%, -50%)', background: PAPER, border: `5px solid ${INK}`, borderRadius: 999, padding: '4px 26px 8px', fontFamily: font, fontWeight: 800, fontSize: 50, color: INK, whiteSpace: 'nowrap', boxShadow: '0 8px 18px rgba(0,0,0,0.3)' }}>📱 {text}</div>
);

const Sound: React.FC = () => (
  <>
    <Audio src={staticFile('bgm.wav')} volume={(i) => 0.2 * MASTER * interpolate(i, [fr(TOTAL) - 24, fr(TOTAL)], [1, 0], clamp)} />
    <Audio src={staticFile('sfx/station.wav')} volume={MASTER * 0.25} endAt={fr(TOTAL)} />
    {VO.map(([t, v]) => (
      <Sequence key={v} from={fr(t)} layout="none">
        <Audio src={staticFile(`${v}.wav`)} volume={MASTER} />
      </Sequence>
    ))}
    {SFX.map(([t, f, v]) => (
      <Sequence key={`${t}-${f}`} from={fr(t)} layout="none">
        <Audio src={staticFile(`sfx/${f}`)} volume={v * MASTER} />
      </Sequence>
    ))}
  </>
);

export const Film: React.FC<{ loc: Loc; bare?: boolean }> = ({ loc, bare }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const L = LOCS[loc];
  const i = cellAt(t);
  const cell = CELLS[i];
  const next = i + 1 < CELLS.length ? CELLS[i + 1].at : TOTAL;
  const range = cell.push || [1.0, 1.03];
  const push = interpolate(t, [cell.at, next], range, { ...clamp, easing: Easing.inOut(Easing.quad) });
  let body: React.ReactNode = null;
  if (t >= FREEZE.at && t < FREEZE.at + FREEZE.dur && cell.img === FREEZE.img) {
    const u = (t - FREEZE.at) / FREEZE.dur;
    // 움찔 위로 늘었다가 굳는다
    const k = interpolate(u, [0, 0.3, 0.6, 1], [1, 1.1, 1.05, 1.06], clamp);
    body = <BodyLayer img={FREEZE.img} body={FREEZE.body} k={k} />;
  } else if (t >= FREEZE.at + FREEZE.dur && cell.img === FREEZE.img) {
    body = <BodyLayer img={FREEZE.img} body={FREEZE.body} k={1.06} />;
  }
  if (t >= SLIDE.from && t < SLIDE.to && cell.img === SLIDE.img) {
    const u = (t - SLIDE.from) / (SLIDE.to - SLIDE.from);
    const dx = SLIDE.dx * Easing.out(Easing.cubic)(Math.min(1, u * 1.6)) + (random(`sl-${Math.floor(frame / 2)}`) - 0.5) * 4;
    body = <BodyLayer img={SLIDE.img} body={SLIDE.body} k={1.0} dx={dx} rot={-6 * Math.min(1, u * 2)} />;
  }
  RUMBLE.forEach((r) => {
    if (t >= r.from && t < r.to && cell.img === r.img) {
      const dx = (random(`rb-${Math.floor(frame / 2)}`) - 0.5) * 2 * r.px;
      const rot = (random(`rr-${Math.floor(frame / 2)}`) - 0.5) * 1.2;
      body = <BodyLayer img={r.img} body={r.body} k={1.004 + 0.02 * Math.abs(Math.sin(frame * 1.3))} dx={dx} rot={rot * 2} />;
    }
  });
  if (t >= SLIDEOUT.from && t < SLIDEOUT.to && cell.img === SLIDEOUT.img) {
    const u = (t - SLIDEOUT.from) / (SLIDEOUT.to - SLIDEOUT.from);
    const e = Easing.out(Easing.cubic)(Math.min(1, u * 1.4));
    body = <BodyLayer img={SLIDEOUT.img} body={SLIDEOUT.body} k={1 + 0.12 * e} lift={-30 * e} rot={3 * Math.sin(u * Math.PI * 3) * (1 - u)} />;
  }
  if (t >= JAR.at && t < JAR.at + JAR.dur && cell.img === JAR.img) {
    const u = (t - JAR.at) / JAR.dur;
    const lift = Math.abs(Math.sin(Math.PI * u * 2)) * 36 * (1 - 0.4 * u); // 톡 · 톡 두 번(v1 #26 「병 속 엄마가 같은 자세」)
    const rot = 5 * Math.sin(u * Math.PI * 4) * (1 - u);
    body = <BodyLayer img={JAR.img} body={JAR.body} k={1.0 + 0.04 * Math.sin(Math.PI * u)} lift={lift} rot={rot} />;
  }
  if (t >= SHIVER.from && t < SHIVER.to && cell.img === SHIVER.img) {
    const dx = (random(`sv-${Math.floor(frame / 2)}`) - 0.5) * 2 * SHIVER.px;
    const k = 1.01 + 0.02 * Math.abs(Math.sin(frame * 1.7));
    body = <BodyLayer img={SHIVER.img} body={SHIVER.body} k={k} dx={dx} rot={(random(`sr-${Math.floor(frame / 2)}`) - 0.5) * 2} />;
  }
  if (t >= REALIZE.at && t < REALIZE.at + REALIZE.dur && cell.img === REALIZE.img) {
    const u = (t - REALIZE.at) / REALIZE.dur;
    const k = interpolate(u, [0, 0.3, 1], [1, 1.1, 1.05], clamp);
    body = <BodyLayer img={REALIZE.img} body={REALIZE.body} k={k} />;
  } else if (t >= REALIZE.at + REALIZE.dur && cell.img === REALIZE.img) {
    body = <BodyLayer img={REALIZE.img} body={REALIZE.body} k={1.05} />;
  }
  if (t >= SWAY.from && t < SWAY.to && cell.img === SWAY.img) {
    const u = (t - SWAY.from) / (SWAY.to - SWAY.from);
    body = <BodyLayer img={SWAY.img} body={SWAY.body} k={1.0} rot={2.2 * Math.sin(u * Math.PI * 2.5)} />;
  }
  if (t >= HOP.at && t < HOP.at + HOP.dur && cell.img === HOP.img) {
    const u = (t - HOP.at) / HOP.dur;
    const lift = Math.sin(Math.PI * u) * 30;
    body = <BodyLayer img={HOP.img} body={HOP.body} k={interpolate(u, [0, 0.2, 0.6, 1], [1, 1.05, 1.02, 1], clamp)} lift={lift} />;
  }
  const inDream = !!cell.dream;
  return (
    <AbsoluteFill style={{ backgroundColor: '#e9d3b3', overflow: 'hidden' }}>
      <AbsoluteFill style={{ transformOrigin: cell.origin || '50% 50%', transform: `scale(${push})` }}>
        <Img src={staticFile(`img/${cell.img}`)} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920 }} />
        {body}
      </AbsoluteFill>
      {cell.img === 'p18f.jpg' ? <WindowFrost t={t} /> : null}
      {inDream ? <DreamFrame font={L.font} label={L.dream} what={L.dreamWhat} bare={bare} /> : null}
      {!bare && inDream ? <JarTag font={L.font} en={L.jar} /> : null}
      {!bare && inDream ? <MachineLabel img={cell.img} font={L.font} en={L.machine} /> : null}
      {!bare ? <NameTag font={L.font} name={L.name} /> : null}
      {/* 몽글 「동결… 건조?」 — 뒷걸음질하는 몽글 머리 위 */}
      <Bubble at={T.m0} to={T.m0To} ko="동결… 건조?" mean={L.m0} font={L.font} x={760} y={1140} tail={0.75} koSize={72} meanSize={50} />
      {/* 훅 — 「Korean slang」 표지 + 딸의 말풍선(꼬리가 딸 머리로) */}
      {!bare ? (
        <>
          <Sign at={0} to={T.f1To}>
            <SignTop font={L.font} text={L.slang} />
          </Sign>
          <Sign at={T.f1To} to={T.slangTo}>
            <SignTop font={L.font} text={L.slang} />
            <SignKo text="엄마 동결건조하고 싶다" size={64} />
            <SignEn font={L.font} text={L.slangMean} size={42} />
          </Sign>
        </>
      ) : null}
      <Bubble at={T.f1} to={T.f1To} ko={'엄마\n동결건조하고 싶다…'} mean={L.f1} font={L.font} x={590} y={800} tail={0.62} koSize={76} meanSize={44} />
      {/* 몽글 질겁 — 몽글 머리 위 */}
      <Bubble at={T.m1} to={T.m1To} ko="엄마를… 말린다고?!" mean={L.m1} font={L.font} x={560} y={760} tail={0.5} koSize={80} meanSize={54} />
      {/* 엄마 「간식 챙겨 가~」 — 엄마 머리 위 */}
      <Bubble at={T.mo1} to={T.mo1To} ko="간식 챙겨 가~" mean={L.mo1} font={L.font} x={240} y={770} tail={0.28} koSize={70} meanSize={48} />
      {/* 딸 「봐, 동결건조 딸기. 그대로지?」 — 딸 머리 위 */}
      <Bubble at={T.f2} to={T.f2To} ko={'봐, 동결건조 딸기.\n그대로지?'} mean={L.f2} font={L.font} x={430} y={720} tail={0.45} koSize={64} meanSize={44} />
      {!bare ? (
        <Sign at={T.fd} to={T.fdTo}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 18, whiteSpace: 'nowrap' }}>
            <SignKo text="동결건조" size={80} />
            <SignEn font={L.font} text={`· ${L.fdTop}`} size={52} />
          </div>
          <SignEn font={L.font} text={L.fdMean} size={46} />
        </Sign>
      ) : null}
      {/* 몽글 「잠깐…」 — 몽글 머리 위 */}
      <Bubble at={T.m2} to={T.m2To} ko="잠깐…" mean={L.m2} font={L.font} x={640} y={790} tail={0.55} koSize={80} meanSize={54} />
      {/* 딸 「엄마, 늙지 마…」 — 딸 머리 위 */}
      <Bubble at={T.f3} to={T.f3To} ko="엄마, 늙지 마…" mean={L.f3} font={L.font} x={720} y={850} tail={0.62} koSize={72} meanSize={56} />
      {/* 엄마 「얘는 참…」 — 안긴 엄마 머리 위 */}
      <Bubble at={T.mo2} to={T.mo2To} ko="얘는 참…" mean={L.mo2} font={L.font} x={400} y={690} tail={0.4} koSize={70} meanSize={48} />
      {/* 엄마 「이렇게?」 — 기차 창 속 엄마 머리 위 */}
      <Bubble at={T.mo3} to={T.mo3To} ko="이렇게?" mean={L.mo3} font={L.font} x={545} y={655} tail={0.5} koSize={78} meanSize={48} />
      {!bare ? (
        <Sign at={T.real} to={T.realTo}>
          <SignTop font={L.font} text={L.realTop} />
          <SignKo text="엄마 동결건조하고 싶다" size={62} />
          <SignEn font={L.font} text={L.realMean} size={46} />
        </Sign>
      ) : null}
      {!bare && cell.img === 'p19.jpg' ? <CallHeader font={L.font} text={L.call} x={540} y={600} /> : null}
      {/* 몽글 「엄마~!」 — 벤치의 몽글 머리 위 */}
      <Bubble at={T.m4} to={T.m4To} ko="엄마~!" mean={L.m4} font={L.font} x={880} y={905} tail={0.9} koSize={74} meanSize={52} />
      {!bare && cell.img === 'p20.jpg' ? <CallHeader font={L.font} text={L.call} x={540} y={365} /> : null}
      {/* 몽글 「엄마, 동결건조하고 싶어!」 — 화면 앞 아래 몽글 쪽으로 꼬리 */}
      <Bubble at={T.m3} to={T.m3To} ko={'엄마,\n동결건조하고 싶어!'} mean={L.m3} font={L.font} x={540} y={1570} tail={0.5} koSize={70} meanSize={46} tailLen={150} />
      {!bare ? (
        <Sign at={T.card} to={TOTAL + 1}>
          <SignKo text={L.cardKo} size={58} />
          <SignEn font={L.font} text={L.cardMean} size={50} />
        </Sign>
      ) : null}
      <Sound />
    </AbsoluteFill>
  );
};
