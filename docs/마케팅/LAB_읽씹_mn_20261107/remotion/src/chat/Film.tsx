// LAB 몽골 M26 「읽씹」 — 채팅 화면 글 틀(M15 「그래 = за」 · M17 「교수님 첫 문자」): 위 띠 · 대화 · 아래 장면.
// 첫 메시지 옆 「1」이 사라짐(읽음!) → 답 없이 새벽 → 「읽씹」 풀이 카드 → 아침에 온 답 「ㅇㅇ」 → 납작 몽글(끝 장치).
// 장면은 GPT 이미지 2.5로 구운 같은 방 네 칸(판/몽글읽씹_081517.png → public/img/room_*.jpg). 소리는 배경음과 효과음뿐.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { EN, KO } from '../lib/fonts';
import { MN } from './data';
import { fr, T } from './timeline';

const C = {
  coral: '#F96859',
  coralShade: '#AE322A',
  red: '#D7261E',
  brown: '#2B1A14',
  paper: '#FBF6EF',
  line: '#EADFD3',
  mintInk: '#1F5C45',
  gray: '#8F8580',
  one: '#E8A800',
  night: '#1E2A44',
};
const MASTER = 0.8;
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE = Easing.bezier(0.16, 1, 0.3, 1);
const EMOJI = "'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";

const useSpringAt = (t: number, cfg: { damping?: number; stiffness?: number; mass?: number } = {}) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: f - fr(t), fps, config: { damping: 15, stiffness: 180, mass: 0.7, ...cfg } });
};

// ── 자리 ──────────────────────────────────────────────────────────
const BAND_H = 380; // 올리기 전 검사: 띠 글이 위 머리 자리(269) 위 → 띠를 50px 키워 글을 아래로
const HEAD = { y: 380, h: 96 };
const CHAT = { y: 476, h: 330 };
const SCENE = { x: 150, y: 826, s: 780 }; // 장면 심사 v1 「그림이 작다」 → 670 → 780 // 같은 방 한 칸을 통째로(창 · 시계 · 책상이 다 보이게)

// ── 위 띠 ─────────────────────────────────────────────────────────
const Band: React.FC = () => {
  const f = useCurrentFrame();
  const s = useSpringAt(T.rule, { damping: 14, stiffness: 190 });
  const on = f >= fr(T.rule);
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: BAND_H, background: C.coral }}>
      <div style={{ position: 'absolute', left: 70, width: 850, top: on ? 274 : 296, textAlign: 'center', fontFamily: EN, fontWeight: 800, fontSize: on ? 36 : 46, lineHeight: 1.12, whiteSpace: 'nowrap', color: C.brown, opacity: on ? 0.78 : 1 }}>
        {MN.band}
      </div>
      <div style={{ position: 'absolute', left: 60, width: 860, top: 318, textAlign: 'center', fontFamily: EN, fontWeight: 800, fontSize: 44, lineHeight: 1.1, whiteSpace: 'nowrap', color: '#FFFFFF', opacity: on ? interpolate(s, [0, 0.5], [0, 1], clamp) : 0, transform: `scale(${0.85 + 0.15 * s})` }}>
        {MN.rule2}
      </div>
    </div>
  );
};

// ── 대화 머리(이름 · 시각) ───────────────────────────────────────────
const clockText = (t: number) => {
  if (t >= T.morning) return '08:03';
  if (t >= T.dawn) return '05:02';
  if (t >= T.clock[2]) return '03:10';
  if (t >= T.clock[1]) return '01:30';
  if (t >= T.clock[0]) return '23:58';
  return '23:52';
};
const Header: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / 30;
  const changes = [T.clock[0], T.clock[1], T.clock[2], T.dawn, T.morning];
  const last = changes.filter((c) => t >= c).pop();
  const pop = last === undefined ? 0 : interpolate(t, [last, last + 0.25], [1, 0], clamp);
  return (
    <div style={{ position: 'absolute', left: 0, top: HEAD.y, width: 1080, height: HEAD.h, background: '#FFFFFF', borderBottom: `2px solid ${C.line}`, display: 'flex', alignItems: 'center', gap: 22, paddingLeft: 40 }}>
      <div style={{ fontFamily: EN, fontSize: 60, color: C.brown, opacity: 0.6, marginTop: -8 }}>‹</div>
      <div style={{ width: 64, height: 64, borderRadius: 32, background: C.mintInk, color: '#FFFFFF', fontFamily: KO, fontWeight: 800, fontSize: 34, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>지</div>
      <div style={{ fontFamily: KO, fontWeight: 700, fontSize: 40, color: C.brown }}>{MN.friend}</div>
      {/* 시각 — 오른쪽 단추 자리(920) 안쪽 */}
      <div style={{ position: 'absolute', left: 640, top: 18, width: 250, height: 60, borderRadius: 30, background: t >= T.morning ? '#FFF3C9' : C.night, color: t >= T.morning ? C.brown : '#FFFFFF', fontFamily: `'Inter Tight', ${EMOJI}`, fontWeight: 800, fontSize: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, transform: `scale(${1 + 0.18 * pop})` }}>
        <span style={{ fontFamily: EMOJI, fontSize: 32 }}>{t >= T.morning ? '☀️' : '🌙'}</span>
        {clockText(t)}
      </div>
    </div>
  );
};

// ── 대화 ──────────────────────────────────────────────────────────
const Bubble: React.FC<{ text: string; me: boolean; one?: number; time?: string; scale?: number; big?: boolean }> = ({ text, me, one = 0, time, scale = 1, big = false }) => (
  <div style={{ display: 'flex', justifyContent: me ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 14, padding: '0 150px 0 70px' }}>
    {me && (one > 0 || time) ? (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginBottom: 6 }}>
        {one > 0 ? <div style={{ fontFamily: EN, fontWeight: 800, fontSize: 60, color: C.one, textShadow: '0 0 0 #000, 0 2px 0 rgba(80,40,0,0.35)', opacity: one, transform: `scale(${0.6 + 0.4 * one})`, lineHeight: 1 }}>1</div> : null}
        {time ? <div style={{ fontFamily: EN, fontWeight: 600, fontSize: 24, color: C.gray, marginTop: 4 }}>{time}</div> : null}
      </div>
    ) : null}
    <div
      style={{
        height: 100,
        padding: '0 32px',
        borderRadius: 32,
        borderBottomLeftRadius: me ? 32 : 10,
        borderBottomRightRadius: me ? 10 : 32,
        background: me ? C.coral : '#FFFFFF',
        boxShadow: '0 4px 10px rgba(80,30,20,0.10)',
        display: 'flex',
        alignItems: 'center',
        fontFamily: `${KO.replace(', sans-serif', '')}, ${EMOJI}`,
        fontWeight: 800,
        fontSize: big ? 76 : 52,
        letterSpacing: big ? 8 : 0,
        color: me ? '#FFFFFF' : C.brown,
        whiteSpace: 'nowrap',
        transform: `scale(${scale})`,
        transformOrigin: me ? 'right center' : 'left center',
      }}
    >
      {text}
    </div>
  </div>
);

/** 「1」 옆 꼬리표 — 처음 «уншаагүй», 사라지면 «уншлаа!» */
const OneTag: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / 30;
  const s = useSpringAt(T.tagIn, { damping: 13, stiffness: 200 });
  const s2 = useSpringAt(T.vanish, { damping: 10, stiffness: 240, mass: 0.6 });
  const gone = interpolate(t, [T.wait - 0.2, T.wait + 0.1], [1, 0], clamp);
  if (t < T.tagIn || gone <= 0) return null;
  const read = t >= T.vanish;
  return (
    <div style={{ position: 'absolute', left: 330, top: CHAT.y + 258, opacity: interpolate(s, [0, 0.4], [0, 1], clamp) * gone, transform: `rotate(-4deg) scale(${(0.7 + 0.3 * s) * (read ? 0.9 + 0.1 * s2 : 1)})`, transformOrigin: 'left center' }}>
      <div style={{ background: read ? C.red : '#FFFFFF', color: read ? '#FFFFFF' : C.brown, border: `4px solid ${read ? C.red : C.one}`, borderRadius: 18, padding: '10px 20px 12px', fontFamily: EN, fontWeight: 800, fontSize: 44, lineHeight: 1, boxShadow: '0 6px 14px rgba(80,30,20,0.18)' }}>
        {read ? <>«1» → <span style={{ opacity: 0.85 }}>∅</span>  {MN.tagRead}</> : <><span style={{ color: C.one }}>«1»</span> = {MN.tagUnread}</>}
      </div>
    </div>
  );
};

const Chat: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / 30;
  const { fps } = useVideoConfig();
  // 「1」: 두근 → 쏙 사라짐
  const pulse = 1; // 검사: 두근거림이 첫 2초 박자(0.6초)로 잡혀 원본(1개 ± 1)을 넘음 → 뺌
  const one = t < T.vanish ? pulse : interpolate(t, [T.vanish, T.vanish + 0.18], [1, 0], clamp);
  const replyS = spring({ frame: f - fr(T.reply), fps, config: { damping: 14, stiffness: 200, mass: 0.7 } });
  const lift = t >= T.reply ? interpolate(replyS, [0, 1], [0, 1], clamp) : 0;
  // 아침 진동 — 대화 화면이 흔들린다
  const buzz = t >= T.morning && t < T.reply ? Math.sin((t - T.morning) * 70) * 7 : 0;
  // 카드가 떠 있는 동안 대화는 흐리게
  const dim = t >= T.cardA - 0.1 && t < T.morning ? 0.25 : 1;
  return (
    <div style={{ position: 'absolute', left: 0, top: CHAT.y, width: 1080, height: CHAT.h, background: C.paper, overflow: 'hidden', transform: `translateX(${buzz}px)` }}>
      <div style={{ position: 'absolute', left: 0, width: 1080, top: 30 - 120 * lift, opacity: dim, transition: 'none' }}>
        <Bubble text="안녕! 나 몽글이야 😊" me one={one} time="23:52" />
        <div style={{ height: 14 }} />
        <Bubble text="우리 친구 할래?" me one={one} time="23:52" />
        {/* v4: 둘째 말풍선 뜻(GPT v2 · v3 「처음 보낸 말 뜻을 모름」) */}
        <div style={{ textAlign: 'right', paddingRight: 160, marginTop: 6, fontFamily: EN, fontWeight: 700, fontSize: 34, color: C.gray }}>= {MN.gloss2}</div>
        <div style={{ height: 24 }} />
        {t >= T.reply ? (
          <div style={{ opacity: interpolate(replyS, [0, 0.4], [0, 1], clamp), transform: `translateY(${(1 - replyS) * 30}px)` }}>
            <Bubble text="ㅇㅇ" big me={false} scale={1 + 0.15 * Math.max(0, 1 - Math.abs(replyS - 1) * 4)} />
          </div>
        ) : null}
      </div>
    </div>
  );
};

// ── 풀이 카드(대화 위에 뜬다) ────────────────────────────────────────
const Card: React.FC<{ from: number; to: number; children: React.ReactNode }> = ({ from, to, children }) => {
  const f = useCurrentFrame();
  const t = f / 30;
  const s = useSpringAt(from, { damping: 16, stiffness: 170 });
  if (t < from || t > to + 0.3) return null;
  const out = interpolate(t, [to, to + 0.25], [0, 1], { ...clamp, easing: EASE });
  return (
    <div style={{ position: 'absolute', left: 70, width: 860, top: CHAT.y + 18, height: CHAT.h - 36, background: '#FFFFFF', borderRadius: 34, boxShadow: '0 14px 34px rgba(80,30,20,0.22)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', opacity: interpolate(s, [0, 0.4], [0, 1], clamp) * (1 - out), transform: `translateY(${(1 - s) * 40 - out * 30}px) scale(${0.92 + 0.08 * s})` }}>
      {children}
    </div>
  );
};

const Cards: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / 30;
  const sub = (a: number) => ({ opacity: interpolate(t, [a, a + 0.2], [0, 1], clamp), transform: `translateY(${interpolate(t, [a, a + 0.25], [16, 0], { ...clamp, easing: EASE })}px)` });
  return (
    <>
      <Card from={T.cardA} to={T.cardB - 0.15}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 22 }}>
          <span style={{ fontFamily: KO, fontWeight: 800, fontSize: 120, color: C.red, lineHeight: 1 }}>{MN.word.ko}</span>
          <span style={{ fontFamily: EN, fontWeight: 700, fontSize: 40, color: C.gray, ...sub(T.cardA + 0.3) }}>[{MN.word.read}]</span>
        </div>
        <div style={{ fontFamily: EN, fontWeight: 800, fontSize: 46, color: C.brown, marginTop: 18, lineHeight: 1.15, ...sub(T.cardA + 0.6) }}>= {MN.word.mn}</div>
      </Card>
      <Card from={T.cardB} to={T.cardC - 0.15}>
        {/* v4: 「읽다 + 씹다」 풀이 대신 그림 공식(이해 시험 v2 · v3 셋이 「씹다가 왜 무시인지」 — 낱말 풀이는 캡션으로) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 28, fontFamily: `'Inter Tight', ${EMOJI}`, fontWeight: 800, fontSize: 62, color: C.brown }}>
          <span>👀 {MN.readNoReply.read} <span style={{ color: '#1F8A4C' }}>✓</span></span>
          <span style={{ color: C.gray, ...sub(T.cardB + 0.35) }}>→</span>
          <span style={sub(T.cardB + 0.6)}>💬 {MN.readNoReply.reply} <span style={{ color: C.red }}>✗</span></span>
        </div>
        <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 96, color: C.red, marginTop: 14, lineHeight: 1, ...sub(T.cardB + 1.0) }}>= {MN.word.ko}</div>
      </Card>
      <Card from={T.cardC} to={T.morning - 0.1}>
        <div style={{ fontFamily: EN, fontWeight: 800, fontSize: 52, color: C.brown, lineHeight: 1.2 }}>
          <div style={sub(T.cardC)}>{MN.formula.a}</div>
          <div style={sub(T.cardC + 0.1)}>+ {MN.formula.b}</div>
        </div>
        <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 100, color: C.red, marginTop: 8, lineHeight: 1, ...sub(T.cardC + 0.2) }}>= {MN.formula.ko}</div>
      </Card>
    </>
  );
};

// ── 아래 장면(같은 방) ────────────────────────────────────────────
const ROOMS: { at: number; src: string }[] = [
  { at: -1, src: 'img/room_night.jpg' },
  { at: T.vanish + 0.05, src: 'img/room_read.jpg' },
  { at: T.wait, src: 'img/room_night.jpg' },
  { at: T.dawn, src: 'img/room_dawn.jpg' },
  { at: T.flat, src: 'img/room_flat.jpg' },
];
const Scene: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / 30;
  const { fps } = useVideoConfig();
  const k = ROOMS.reduce((acc, r, i) => (t >= r.at ? i : acc), 0);
  const cur = ROOMS[k];
  const prev = k > 0 ? ROOMS[k - 1] : null;
  const fade = k > 0 ? interpolate(t, [cur.at, cur.at + 0.06], [0, 1], clamp) : 1; // 장면 심사 v1 「겹쳐 바뀔 때 몽글이 반투명해 깨진 듯」 → 거의 끊어 바꾼다
  // 장면마다 천천히 다가간다(같은 그림이 멈춰 있지 않게), 읽음 · 납작은 한 번 튄다
  const since = t - Math.max(0, cur.at);
  // 볼 이유 v2 「6~14초 같은 그림이 8초」 → 「읽다 + 씹다」 동안 처진 몽글 얼굴로 다가가고, 끝 납작 몽글은 크게(「끝 장면이 작다」)
  const io = { ...clamp, easing: Easing.bezier(0.65, 0, 0.35, 1) };
  const toFace = cur.src.includes('dawn') ? interpolate(t, [T.cardB, T.cardB + 0.35, T.morning - 0.2, T.morning + 0.15], [0, 1, 1, 0], io) : 0; // 검사: 칸 수 14(원본 10) → 얼굴 확대를 아침까지 이어 칸 하나 줄임
  const faceGo = interpolate(t, [T.cardB, T.morning], [0, 1], clamp); // 검사: 얼굴 안에서 멈춘 2.5초 → 계속 다가간다
  const toFlat = cur.src.includes('flat') ? interpolate(t, [T.flat + 0.3, T.flat + 0.9], [0, 1], io) : 0;
  // 올리기 전 검사: 정지 18% · 5~12.5초 한 구성 7.5초 → 장면은 늘 천천히 다가가고(멈추지 않게), 「읽씹」 두 카드 사이에 처진 얼굴로 크게 들어갔다 나온다
  const zoom = (1 + 0.03 * since) * (1 + (0.55 + 0.35 * faceGo) * toFace) * (1 + 0.3 * toFlat + 0.06 * Math.max(0, t - T.flat - 0.9)); // 검사: 정지 24%(끝 납작 장면 3.4초) → 늘 다가간다
  const pop = (cur.src.includes('read') || cur.src.includes('flat')) ? spring({ frame: f - fr(cur.at), fps, config: { damping: 9, stiffness: 220, mass: 0.6 } }) : 1;
  const popSc = 1 + 0.05 * Math.sin(Math.min(1, pop) * Math.PI);
  return (
    <div style={{ position: 'absolute', left: SCENE.x, top: SCENE.y, width: SCENE.s, height: SCENE.s, borderRadius: 40, overflow: 'hidden', boxShadow: '0 16px 36px rgba(60,30,20,0.28)', background: '#3A2A22' }}>
      {prev && fade < 1 ? <Img src={staticFile(prev.src)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
      <Img src={staticFile(cur.src)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: fade, transform: `scale(${zoom * popSc})`, transformOrigin: toFlat > 0 ? '46% 86%' : toFace > 0 ? '40% 72%' : '45% 70%' }} />
      {/* 장면 심사 v1 「시간이 흐른 것이 작은 알약에서만 보인다」 → 그림 위에 크게 */}
      <div style={{ position: 'absolute', left: 24, top: 24, padding: '8px 22px 10px', borderRadius: 30, background: t >= T.morning ? 'rgba(255,243,201,0.92)' : 'rgba(18,22,40,0.74)', color: t >= T.morning ? C.brown : '#FFFFFF', fontFamily: `'Inter Tight', ${EMOJI}`, fontWeight: 800, fontSize: 52, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontFamily: EMOJI, fontSize: 42 }}>{t >= T.morning ? '☀️' : '🌙'}</span>
        {clockText(t)}
        {/* v4 시험: 둘이 「시계가 왜 넘어가는지」 → 시간이 넘어가는 동안 빨리 감기 표시 */}
        {(t >= T.wait && t < T.dawn + 0.4) || (t >= T.morning - 0.3 && t < T.morning + 0.4) ? <span style={{ fontFamily: EMOJI, fontSize: 40, opacity: 0.6 + 0.4 * Math.abs(Math.sin(t * 9)) }}>⏩</span> : null}
      </div>
    </div>
  );
};

// ── 끝(납작 몽글 위) ───────────────────────────────────────────────
const EndCard: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / 30;
  const s = useSpringAt(T.flat, { damping: 14, stiffness: 180 });
  const g = useSpringAt(T.reply, { damping: 13, stiffness: 200 }); // v4 시험: 둘이 「ㅇㅇ 풀이가 늦다」 → 답과 같은 순간
  if (t < T.reply) return null;
  return (
    <>
      {/* 「ㅇㅇ」 풀이 — 답이 오는 순간 크게(이해 시험 v2 셋이 「ㅇㅇ이 눈 모양 · 풀이가 2초 늦다」, ③ Fable 「응응을 같이」) */}
      <div style={{ position: 'absolute', left: 290, top: CHAT.y + 30 + 268 - 120 + 46, opacity: interpolate(g, [0, 0.4], [0, 1], clamp), transform: `scale(${0.8 + 0.2 * g})`, transformOrigin: 'left center', display: 'flex', alignItems: 'baseline', gap: 14, background: '#FFFFFF', borderRadius: 24, padding: '10px 22px', boxShadow: '0 6px 16px rgba(80,30,20,0.16)', border: `4px solid ${C.red}` }}>
        <span style={{ fontFamily: KO, fontWeight: 800, fontSize: 54, color: C.red, letterSpacing: 4 }}>{MN.reply.ko}</span>
        <span style={{ fontFamily: KO, fontWeight: 800, fontSize: 46, color: C.brown }}>= {MN.reply.full}</span>
        <span style={{ fontFamily: EN, fontWeight: 700, fontSize: 32, color: C.gray }}>[{MN.reply.read}]</span>
        <span style={{ fontFamily: EN, fontWeight: 800, fontSize: 46, color: C.brown }}>= {MN.reply.mn}</span>
      </div>
      {/* 끝: 위 띠 자리를 끝 글 한 줄로(이해 시험 v2 haiku 9번 「끝 질문이 지난 편과 같다」 → 댓글 질문은 캡션 · 첫 댓글로) */}
      {t >= T.flat ? (
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: BAND_H, background: C.coral, opacity: interpolate(s, [0, 0.3], [0, 1], clamp), display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 34 }}>
          <div style={{ fontFamily: `'Inter Tight', 'SUIT', ${EMOJI}`, fontWeight: 800, fontSize: 64, color: '#FFFFFF', transform: `translateY(${(1 - s) * 20}px)` }}>{MN.endBig}</div>
        </div>
      ) : null}
    </>
  );
};

// ── 소리 ─────────────────────────────────────────────────────────
const Sfx: React.FC<{ file: string; at: number; vol: number }> = ({ file, at: t, vol }) => (
  <Sequence from={fr(t)} layout="none">
    <Audio src={staticFile(`sfx/${file}`)} volume={vol * MASTER} />
  </Sequence>
);
const Sound: React.FC = () => (
  <>
    <Audio src={staticFile('bgm.wav')} volume={(i) => 0.42 * MASTER * interpolate(i, [fr(T.total) - 30, fr(T.total)], [1, 0], clamp)} />
    <Sfx file="tick.wav" at={T.pulse} vol={0.35} />
    <Sfx file="tick.wav" at={T.pulse + 0.25} vol={0.35} />
    <Sfx file="pop.wav" at={T.vanish} vol={0.45} />
    <Sfx file="sparkle.wav" at={T.vanish + 0.08} vol={0.4} />
    {[0, 0.5, 1.0, 1.5].map((d, i) => <Sfx key={i} file="tick.wav" at={T.wait + d} vol={0.28} />)}
    <Sfx file="tok.wav" at={T.dawn} vol={0.3} />
    <Sfx file="tok.wav" at={T.cardA} vol={0.35} />
    <Sfx file="tok.wav" at={T.cardB} vol={0.35} />
    <Sfx file="tok.wav" at={T.cardC} vol={0.35} />
    {[0, 0.12, 0.24, 0.36].map((d, i) => <Sfx key={`b${i}`} file="tick.wav" at={T.morning + d} vol={0.45} />)}
    <Sfx file="ding1.wav" at={T.reply} vol={0.5} />
    <Sfx file="boing.wav" at={T.flat} vol={0.45} />
  </>
);

// 카메라 — 처음엔 대화의 「1」에 크게 다가가 있다가(조금씩 더 다가감), 「1」이 사라지면 물러나며 방을 보인다(장면 심사 v1 「1이 작아 사라지는 순간이 안 보임」)
const useCam = () => {
  const f = useCurrentFrame();
  const t = f / 30;
  // 장면 심사 v2: 「2초에 펠트 그림을 작은 카드로 줄이지 말고 꽉 차게」 → 「1」에서 물러난 뒤 방 그림 쪽으로 크게, 첫 카드(5.1) 앞에서 제자리
  const io = { ...clamp, easing: Easing.bezier(0.65, 0, 0.35, 1) };
  const keys: [number, number, number, number][] = [
    [0, 1.36, 950, 690], // 검사: 1.3 → 1.36 가속 다가감이 0.6초 박자로 잡힘 → 처음 1.3초는 같은 배율 // 올리기 전 검사: 확대된 말풍선이 오른쪽 단추 자리(920)에 닿음 → 중심을 오른쪽으로
    [T.vanish, 1.36, 950, 690],
    [T.zoomOut[0], 1.36, 950, 690],
    [T.zoomOut[1], 1.22, 540, 1216],
    [T.cardA - 0.3, 1.25, 540, 1216],
    [T.cardA, 1, 540, 960],
    // 원본 박자 7.1 · 12.5에 화면이 한 번에 바뀌게(나란히 v1 박자 56%) — 카드 쪽으로 톡 다가갔다가 다음 카드에서 제자리
    [7.08, 1, 540, 960],
    [7.22, 1.05, 540, 820],
    [T.cardB - 0.02, 1.05, 540, 820],
    [T.cardB + 0.15, 1, 540, 960],
    [12.48, 1, 540, 960],
    [12.62, 1.06, 540, 700],
    [T.morning - 0.02, 1.06, 540, 700],
    [T.morning + 0.2, 1, 540, 960],
  ];
  const k = keys.findIndex((_, i) => i === keys.length - 1 || t < keys[i + 1][0]);
  const a = keys[k], b = keys[Math.min(k + 1, keys.length - 1)];
  const p = b[0] === a[0] ? 1 : interpolate(t, [a[0], b[0]], [0, 1], io);
  const [s, cx, cy] = [1, 2, 3].map((j) => a[j] + (b[j] - a[j]) * p);
  return s === 1 ? undefined : `translate(${(1 - s) * cx}px, ${(1 - s) * cy}px) scale(${s})`;
};

export const Film: React.FC<{ plain?: boolean }> = ({ plain = false }) => {
  const cam = useCam();
  return (
    <AbsoluteFill style={{ backgroundColor: C.paper }}>
      <AbsoluteFill style={{ transformOrigin: '0 0', transform: cam }}>
        <Scene />
        <Chat />
        {plain ? null : <OneTag />}
        {plain ? null : <Cards />}
        <Header />
      </AbsoluteFill>
      {/* 위 띠는 카메라 밖에 고정(확대 때 글이 잘리지 않게) */}
      {plain ? <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: BAND_H, background: C.coral }} /> : <Band />}
      {plain ? null : <EndCard />}
      <Sound />
    </AbsoluteFill>
  );
};
