// LAB 몽골 M45 「잘 자 · 안녕히 주무세요」 — 채팅 화면 글 틀(M15 「그래 = за」 뼈대 · M26 「읽씹」 코드): 위 띠 · 대화 · 아래 장면.
// 밤 23:10, 하숙집 아주머니께 친구처럼 「아주머니, 잘 자~ 😴」 → 「1」이 사라짐 → 「몽글아 ㅎㅎ」 「'안녕히 주무세요' 해야지~」 → 이불 속에서 굳음
// → 잘 자(친구) · 안녕히 주무세요(어른) · 자다 → 주무시다 → 다음 날 밤 「안녕히 주무세요! 🙇」 → 「그래~ 너도 잘 자 💕」 → 웃으며 잠듦(끝 장치).
// 장면은 GPT 이미지 2.5로 구운 같은 방 네 칸(판/몽글잘자_172004.png → public/img/room_*.jpg). 소리는 배경음과 효과음뿐.
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
  gray: '#8F8580',
  one: '#E8A800',
  night: '#1E2A44',
  aunt: '#B5793A',
  green: '#1F8A4C',
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
const BAND_H = 380;
const HEAD = { y: 380, h: 96 };
const CHAT = { y: 476, h: 330 };
const SCENE = { x: 110, y: 826, s: 860 }; // 장면 심사 v1 「그림이 작다」 → 780 → 860

// ── 위 띠 ─────────────────────────────────────────────────────────
const Band: React.FC = () => {
  const f = useCurrentFrame();
  const s = useSpringAt(T.rule, { damping: 14, stiffness: 190 });
  const q = useSpringAt(T.ask, { damping: 14, stiffness: 190 });
  const m = useSpringAt(T.morning, { damping: 14, stiffness: 190 });
  const t = f / 30;
  const ask = f >= fr(T.ask);
  // 다음 날 밤 — 띠도 바뀐다(미학 맹검 v4 「다음 날 밤인데 띠 문구가 8칸 내내 그대로」 · 방 그림 위 시각 알약은 걷음)
  if (t >= T.morning) {
    return (
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: BAND_H, background: C.coral }}>
        <div style={{ position: 'absolute', left: 70, width: 850, bottom: 40, textAlign: 'center', fontFamily: `${EN}, ${EMOJI}`, fontWeight: 800, fontSize: 64, lineHeight: 1.1, color: '#FFFFFF', opacity: interpolate(m, [0, 0.4], [0, 1], clamp), transform: `scale(${0.9 + 0.1 * m})` }}>
          {MN.nextNight}… 🌙
        </div>
      </div>
    );
  }
  // 4.0초 물음 — 첫 줄을 걷고 두 줄로 크게(길어진 몽골어가 한 줄을 넘쳤다)
  if (ask) {
    return (
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: BAND_H, background: C.coral }}>
        <div style={{ position: 'absolute', left: 70, width: 850, bottom: 26, textAlign: 'center', fontFamily: `${EN}, ${EMOJI}`, fontWeight: 800, fontSize: 46, lineHeight: 1.16, color: '#FFFFFF', opacity: interpolate(q, [0, 0.4], [0, 1], clamp), transform: `scale(${0.9 + 0.1 * q})` }}>
          {MN.rule3}
        </div>
      </div>
    );
  }
  // 첫 줄: 처음엔 두 줄 크게 → 0.6초 둘째 줄이 오면 작은 한 줄로 → 1.8초 답이 오면 둘째 줄을 걷고 다시 크게.
  // 미학 맹검 v4 「첫 줄이 한 칸 만에 작아짐」 · 「답이 왔는데 띠는 아직 '답 쓰는 중'」 → 크기를 바꾸지 않고 두 판을 0.25초 겹쳐 바꾼다.
  // 겹쳐 바꾸면 0.25초 동안 두 판 글자가 포개져 어지럽다 → 앞 판이 다 빠진 뒤 다음 판이 든다
  const big = interpolate(t, [T.rule, T.rule + 0.12, T.reply + 0.12, T.reply + 0.25], [1, 0, 0, 1], clamp);
  const small = interpolate(t, [T.rule + 0.12, T.rule + 0.25, T.reply, T.reply + 0.12], [0, 1, 1, 0], clamp);
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: BAND_H, background: C.coral }}>
      <div style={{ position: 'absolute', left: 70, width: 850, bottom: 26, textAlign: 'center', fontFamily: `${EN}, ${EMOJI}`, fontWeight: 800, fontSize: 44, lineHeight: 1.14, color: C.brown, opacity: big }}>
        {MN.band}
      </div>
      <div style={{ position: 'absolute', left: 70, width: 850, top: 274, textAlign: 'center', fontFamily: `${EN}, ${EMOJI}`, fontWeight: 800, fontSize: 32, lineHeight: 1.14, whiteSpace: 'nowrap', color: C.brown, opacity: 0.78 * small }}>
        {MN.band}
      </div>
      <div style={{ position: 'absolute', left: 60, width: 860, top: 318, textAlign: 'center', fontFamily: `${EN}, ${EMOJI}`, fontWeight: 800, fontSize: 44, lineHeight: 1.1, whiteSpace: 'nowrap', color: '#FFFFFF', opacity: interpolate(s, [0, 0.5], [0, 1], clamp) * small, transform: `scale(${0.85 + 0.15 * s})` }}>
        {MN.rule2}
      </div>
    </div>
  );
};

// ── 대화 머리(이름 · 시각) ───────────────────────────────────────────
const clockText = (t: number) => (t >= T.morning ? '23:05' : '23:10');
const Header: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / 30;
  const pop = t >= T.morning ? interpolate(t, [T.morning, T.morning + 0.25], [1, 0], clamp) : 0;
  return (
    <div style={{ position: 'absolute', left: 0, top: HEAD.y, width: 1080, height: HEAD.h, background: '#FFFFFF', borderBottom: `2px solid ${C.line}`, display: 'flex', alignItems: 'center', gap: 22, paddingLeft: 40 }}>
      <div style={{ fontFamily: EN, fontSize: 60, color: C.brown, opacity: 0.6, marginTop: -8 }}>‹</div>
      <div style={{ width: 64, height: 64, borderRadius: 32, background: C.aunt, color: '#FFFFFF', fontFamily: KO, fontWeight: 800, fontSize: 34, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>아</div>
      <div style={{ fontFamily: `${KO}, ${EMOJI}`, fontWeight: 700, fontSize: 40, color: C.brown }}>{MN.friend} 🏠</div>
      {/* 시각 — 오른쪽 단추 자리(920) 안쪽 */}
      <div style={{ position: 'absolute', left: 680, top: 18, width: 210, height: 60, borderRadius: 30, background: C.night, color: '#FFFFFF', fontFamily: `'Inter Tight', ${EMOJI}`, fontWeight: 800, fontSize: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, transform: `scale(${1 + 0.18 * pop})` }}>
        <span style={{ fontFamily: EMOJI, fontSize: 32 }}>🌙</span>
        {clockText(t)}
      </div>
    </div>
  );
};

// ── 대화 ──────────────────────────────────────────────────────────
const Bubble: React.FC<{ text: string; me: boolean; one?: number; time?: string; scale?: number }> = ({ text, me, one = 0, time, scale = 1 }) => (
  <div style={{ display: 'flex', justifyContent: me ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 14, padding: '0 150px 0 70px' }}>
    {me && (one > 0 || time) ? (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginBottom: 6 }}>
        {one > 0 ? <div style={{ fontFamily: EN, fontWeight: 800, fontSize: 60, color: C.one, textShadow: '0 2px 0 rgba(80,40,0,0.35)', opacity: one, transform: `scale(${0.6 + 0.4 * one})`, lineHeight: 1 }}>1</div> : null}
        {time ? <div style={{ fontFamily: EN, fontWeight: 600, fontSize: 24, color: C.gray, marginTop: 4 }}>{time}</div> : null}
      </div>
    ) : null}
    <div
      style={{
        height: 84,
        padding: '0 28px',
        borderRadius: 32,
        borderBottomLeftRadius: me ? 32 : 10,
        borderBottomRightRadius: me ? 10 : 32,
        background: me ? C.coral : '#FFFFFF',
        boxShadow: '0 4px 10px rgba(80,30,20,0.10)',
        display: 'flex',
        alignItems: 'center',
        fontFamily: `${KO.replace(', sans-serif', '')}, ${EMOJI}`,
        fontWeight: 800,
        fontSize: 46,
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
const Gloss: React.FC<{ text: string; me?: boolean }> = ({ text, me }) => (
  <div style={{ textAlign: me ? 'right' : 'left', padding: me ? '0 160px 0 0' : '0 0 0 84px', marginTop: 6, fontFamily: `${EN}, ${EMOJI}`, fontWeight: 800, fontSize: 35, color: '#6B615C', whiteSpace: 'nowrap' }}>{text}</div>
);

/** 「1」 옆 꼬리표 — 처음 «уншаагүй», 사라지면 «уншчихлаа!» */
const OneTag: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / 30;
  const s = useSpringAt(T.tagIn, { damping: 13, stiffness: 200 });
  const s2 = useSpringAt(T.vanish, { damping: 10, stiffness: 240, mass: 0.6 });
  // 미학 맹검 v4 「«1» → ∅ уншчихлаа! 꼬리표가 0.25초 깜박이듯 지나감」 → 읽음 꼬리표는 걷고 「1」과 함께 사라진다(읽음은 위 띠 둘째 줄이 말한다)
  const gone = interpolate(t, [T.vanish, T.vanish + 0.15], [1, 0], clamp);
  if (t < T.tagIn || gone <= 0) return null;
  const read = false;
  void s2;
  return (
    <div style={{ position: 'absolute', left: 230, top: CHAT.y + 226, opacity: interpolate(s, [0, 0.4], [0, 1], clamp) * gone, transform: `rotate(-4deg) scale(${(0.7 + 0.3 * s) * (read ? 0.9 + 0.1 * s2 : 1)})`, transformOrigin: 'left center' }}>
      <div style={{ background: read ? C.red : '#FFFFFF', color: read ? '#FFFFFF' : C.brown, border: `4px solid ${read ? C.red : C.one}`, borderRadius: 18, padding: '10px 20px 12px', fontFamily: EN, fontWeight: 800, fontSize: 44, lineHeight: 1, boxShadow: '0 6px 14px rgba(80,30,20,0.18)' }}>
        {read ? <>«1» → <span style={{ opacity: 0.85 }}>∅</span>  {MN.tagRead}</> : <><span style={{ color: C.one }}>«1»</span> = {MN.tagUnread}</>}
      </div>
    </div>
  );
};

// 「…」 쓰는 중
const Typing: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / 30;
  if (t < T.typing[0] || t >= T.typing[1]) return null;
  return (
    <div style={{ display: 'flex', padding: '0 0 0 70px' }}>
      <div style={{ height: 80, padding: '0 30px', borderRadius: 32, borderBottomLeftRadius: 10, background: '#FFFFFF', boxShadow: '0 4px 10px rgba(80,30,20,0.10)', display: 'flex', alignItems: 'center', gap: 12 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ width: 16, height: 16, borderRadius: 8, background: C.gray, opacity: 0.35 + 0.65 * Math.max(0, Math.sin((t - T.typing[0]) * 8 - i * 0.9)) }} />
        ))}
      </div>
    </div>
  );
};

// 다음 날 밤 입력 칸 — 치는 글자 수(초 → 글자): 「잘 자~」를 치고 · 지우고 · 「안녕히 주무세요! 🙇」를 천천히(볼 이유 v2)
const typed = (t: number): string => {
  const A = [...'잘 자~'];
  const B = [...'안녕히 주무세요! 🙇'];
  if (t < T.type1[0]) return '';
  if (t < T.erase[0]) return A.slice(0, Math.round(interpolate(t, T.type1, [0, A.length], clamp))).join('');
  if (t < T.type2[0]) return A.slice(0, Math.round(interpolate(t, T.erase, [A.length, 0], clamp))).join('');
  if (t < T.myReply) return B.slice(0, Math.round(interpolate(t, T.type2, [0, B.length], clamp))).join('');
  return '';
};
const InputBox: React.FC<{ text: string; t: number }> = ({ text, t }) => {
  const caret = Math.floor(t * 3) % 2 === 0;
  return (
    // 미학 맹검 v4 「입력 칸에 보내기 단추 하나 없이 회색 줄 사이 글자만」 → 메신저 입력 줄 꼴(더하기 · 칸 · 보내기)
    <div style={{ position: 'absolute', left: 70, right: 70, bottom: 12, height: 96, display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ width: 64, height: 64, borderRadius: 32, background: '#EFE7E1', color: C.gray, fontFamily: "'Inter Tight', sans-serif", fontWeight: 700, fontSize: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>+</div>
      <div style={{ flex: 1, height: 88, borderRadius: 44, background: '#FFFFFF', border: `3px solid ${C.coral}`, boxShadow: '0 4px 12px rgba(80,30,20,0.12)', display: 'flex', alignItems: 'center', padding: '0 30px', fontFamily: `${KO.replace(', sans-serif', '')}, ${EMOJI}`, fontWeight: 800, fontSize: 46, color: C.brown, whiteSpace: 'nowrap', overflow: 'hidden' }}>
        {text}
        <span style={{ display: 'inline-block', width: 4, height: 50, marginLeft: 4, background: caret ? C.coral : 'transparent' }} />
      </div>
      <div style={{ width: 76, height: 76, borderRadius: 38, background: text ? C.coral : '#E6DCD6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width={40} height={40} viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7" stroke="#FFFFFF" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </div>
    </div>
  );
};

const Chat: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / 30;
  const { fps } = useVideoConfig();
  const one = t < T.vanish ? 1 : interpolate(t, [T.vanish, T.vanish + 0.18], [1, 0], clamp);
  const r1 = spring({ frame: f - fr(T.reply), fps, config: { damping: 14, stiffness: 200, mass: 0.7 } });
  const r2 = spring({ frame: f - fr(T.reply2), fps, config: { damping: 14, stiffness: 200, mass: 0.7 } });
  // 답이 오면 대화가 위로 밀린다(아주머니의 첫 「잘 자~」가 위로 나간다)
  const lift = t >= T.reply ? interpolate(r1, [0, 1], [0, 1], clamp) : 0;
  const dim = t >= T.cardA - 0.1 && t < T.morning ? 0 : 1; // 카드 밑으로 흐린 뜻 줄이 비쳐 어지러웠다
  const appear = (s: number) => ({ opacity: interpolate(s, [0, 0.4], [0, 1], clamp), transform: `translateY(${(1 - s) * 30}px)` });
  // 다음 날 밤 — 아주머니 「몽글아 잘 자~」 → 입력 칸에서 치고 · 지우고 · 다시 쳐서 「안녕히 주무세요!」 → 「아이고, 예뻐라~」
  if (t >= T.morning) {
    const ms = spring({ frame: f - fr(T.morning), fps, config: { damping: 14, stiffness: 200, mass: 0.7 } });
    const mr = spring({ frame: f - fr(T.myReply), fps, config: { damping: 14, stiffness: 200, mass: 0.7 } });
    const r3 = spring({ frame: f - fr(T.reply3), fps, config: { damping: 14, stiffness: 200, mass: 0.7 } });
    const one2 = interpolate(t, [T.myReply + 0.3, T.myReply + 0.45], [1, 0], clamp);
    const lift2 = t >= T.reply3 ? interpolate(r3, [0, 1], [0, 1], clamp) : 0;
    const sent = t >= T.myReply;
    return (
      <div style={{ position: 'absolute', left: 0, top: CHAT.y, width: 1080, height: CHAT.h, background: C.paper, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, width: 1080, top: 16 - 96 * lift2 }}>
          <div style={appear(ms)}>
            <Bubble text="몽글아 잘 자~ 😊" me={false} />
          </div>
          <div style={{ height: 12 }} />
          {sent ? (
            <div style={appear(mr)}>
              <Bubble text="안녕히 주무세요! 🙇" me one={one2} time="23:05" scale={1 + 0.1 * Math.max(0, 1 - Math.abs(mr - 1) * 4)} />
            </div>
          ) : null}
          <div style={{ height: 12 }} />
          {t >= T.reply3 ? (
            <div style={appear(r3)}>
              <Bubble text="아이고, 예뻐라~ 💕" me={false} scale={1 + 0.12 * Math.max(0, 1 - Math.abs(r3 - 1) * 4)} />
              <Gloss text={MN.reply3Gloss} />
            </div>
          ) : null}
        </div>
        {!sent ? <InputBox text={typed(t)} t={t} /> : null}
      </div>
    );
  }
  return (
    <div style={{ position: 'absolute', left: 0, top: CHAT.y, width: 1080, height: CHAT.h, background: C.paper, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, width: 1080, top: 14 - 96 * lift, opacity: dim }}>
        <Bubble text="몽글아 잘 자~ 😊" me={false} />
        <div style={{ height: 12 }} />
        <Bubble text="아주머니도 잘 자~ 😴" me one={one} time="23:10" />
        <div style={{ height: 12 }} />
        <Typing />
        {t >= T.reply ? (
          <div style={appear(r1)}>
            <Bubble text="몽글아 ㅎㅎ" me={false} />
          </div>
        ) : null}
        <div style={{ height: 10 }} />
        {t >= T.reply2 ? (
          <div style={{ opacity: interpolate(r2, [0, 0.4], [0, 1], clamp) }}>{/* 미학 맹검 v4 「올라오는 뜻 줄 아랫절반이 대화 칸 아래에서 잘림」 → 올라오지 않고 제자리에서 뜬다 */}
            <Bubble text="어른께는 '안녕히 주무세요'~" me={false} />
            <Gloss text={MN.replyGloss} />
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
    <div style={{ position: 'absolute', left: 50, width: 900, top: CHAT.y + 8, height: CHAT.h - 16, background: '#FFFFFF', borderRadius: 34, boxShadow: '0 14px 34px rgba(80,30,20,0.22)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', opacity: interpolate(s, [0, 0.4], [0, 1], clamp) * (1 - out), transform: `translateY(${(1 - s) * 40 - out * 30}px) scale(${0.92 + 0.08 * s})` }}>
      {children}
    </div>
  );
};

/** 카드 한 칸 — 누가 누구에게 · 한국어 · 읽기 · 뜻(좌우 두 칸) */
const Col: React.FC<{ w: { who: string; ko: string; read: string; mn: string }; at: number; color: string; size: number }> = ({ w, at, color, size }) => {
  const f = useCurrentFrame();
  const t = f / 30;
  const s = interpolate(t, [at, at + 0.22], [0, 1], { ...clamp, easing: EASE });
  return (
    <div style={{ width: 420, opacity: s, transform: `translateY(${(1 - s) * 16}px)`, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ fontFamily: `${EN}, ${EMOJI}`, fontWeight: 800, fontSize: 36, color: '#6B615C', lineHeight: 1.05, whiteSpace: 'nowrap' }}>{w.who}</div>
      <div style={{ fontFamily: KO, fontWeight: 800, fontSize: size, color, lineHeight: 1.05, marginTop: 6, whiteSpace: 'nowrap' }}>{w.ko}</div>
      <div style={{ fontFamily: EN, fontWeight: 700, fontSize: 30, color: C.gray, marginTop: 2, whiteSpace: 'nowrap' }}>[{w.read}]</div>
      <div style={{ fontFamily: EN, fontWeight: 800, fontSize: 36, color: C.brown, marginTop: 4, whiteSpace: 'nowrap' }}>= {w.mn}</div>
    </div>
  );
};

const Cards: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / 30;
  // 「자다 → 주무시다」가 한 칸 만에 툭 뜬다(미학 맹검 v4) → 커지며 튀어 들어온다
  const pv = useSpringAt(T.verbIn, { damping: 11, stiffness: 200, mass: 0.7 });
  const sub = (a: number) => ({ opacity: interpolate(t, [a, a + 0.2], [0, 1], clamp), transform: `translateY(${interpolate(t, [a, a + 0.25], [12, 0], { ...clamp, easing: EASE })}px) scale(${t < a ? 0.6 : 0.6 + 0.4 * pv})` });
  return (
    <Card from={T.cardA} to={T.morning - 0.1}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: 20 }}>
        <Col w={MN.down} at={T.cardA} color={C.coral} size={58} />
        <div style={{ width: 3, alignSelf: 'stretch', background: C.line, borderRadius: 2 }} />
        <Col w={MN.up} at={T.cardAup} color={C.red} size={46} />
      </div>
      <div style={{ marginTop: 16, display: 'flex', alignItems: 'baseline', gap: 14, ...sub(T.verbIn) }}>
        <span style={{ fontFamily: KO, fontWeight: 800, fontSize: 42, color: C.red, whiteSpace: 'nowrap' }}>
          자다<span style={{ fontFamily: "'Inter Tight', sans-serif", fontWeight: 700 }}> → </span>주무시다
        </span>
        <span style={{ fontFamily: EN, fontWeight: 800, fontSize: 32, color: C.brown, whiteSpace: 'nowrap' }}>{MN.verb.mn2}</span>
      </div>
    </Card>
  );
};

// ── 아래 장면(같은 방) ────────────────────────────────────────────
const ROOMS: { at: number; src: string }[] = [
  { at: -1, src: 'img/room_smile.jpg' },
  { at: T.frozen, src: 'img/room_frozen.jpg' },
  { at: T.morning, src: 'img/room_smile.jpg' },
  { at: T.erase[0], src: 'img/room_frozen.jpg' },
  { at: T.myReply, src: 'img/room_bow.jpg' },
  { at: T.reply3 + 0.3, src: 'img/room_smile.jpg' },
  { at: T.flat, src: 'img/room_sleep.jpg' },
];
const Scene: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / 30;
  const { fps } = useVideoConfig();
  const k = ROOMS.reduce((acc, r, i) => (t >= r.at ? i : acc), 0);
  const cur = ROOMS[k];
  const prev = k > 0 ? ROOMS[k - 1] : null;
  // 미학 맹검 v4 「정지 그림 두 장을 단순 교체해 휴대폰 · 벽등 · 창이 통째로 튐」 → 0.22초 겹쳐 바꾸고, 앞 그림도 그때의 크기로 둔다
  const fade = k > 0 ? interpolate(t, [cur.at, cur.at + 0.22], [0, 1], { ...clamp, easing: EASE }) : 1;
  const prevZoom = prev ? 1 + 0.03 * Math.max(0, cur.at - Math.max(0, prev.at)) : 1;
  // 숨결 — 같은 그림이 박제처럼 서 있지 않게(2.4초에 한 번 0.6%)
  const breath = 1 + 0.006 * Math.sin((t * 2 * Math.PI) / 2.4);
  const since = t - Math.max(0, cur.at);
  const io = { ...clamp, easing: Easing.bezier(0.65, 0, 0.35, 1) };
  // 카드 동안 굳은 얼굴로 다가가고(같은 그림이 멈춰 있지 않게), 끝 잠든 몽글은 크게
  const toFace = cur.src.includes('frozen') && t < T.morning ? interpolate(t, [T.cardA + 1.2, T.cardA + 1.55, T.morning - 0.2, T.morning + 0.05], [0, 1, 1, 0], io) : 0;
  const faceGo = interpolate(t, [T.cardA + 1.2, T.morning], [0, 1], clamp);
  const toEnd = cur.src.includes('sleep') ? interpolate(t, [T.flat + 0.3, T.flat + 0.9], [0, 1], io) : 0;
  // 굳은 얼굴로 다가가는 배율 0.45~0.75 → 0.3~0.45(미학 맹검 v4 「확대될수록 펠트 화질만 무뎌짐」)
  const zoom = (1 + 0.03 * since) * (1 + (0.3 + 0.15 * faceGo) * toFace) * (1 + 0.22 * toEnd + 0.05 * Math.max(0, t - T.flat - 0.9));
  const pop = cur.src.includes('frozen') || cur.src.includes('sleep') ? spring({ frame: f - fr(cur.at), fps, config: { damping: 9, stiffness: 220, mass: 0.6 } }) : 1;
  const popSc = 1 + 0.05 * Math.sin(Math.min(1, pop) * Math.PI);
  // 방 그림 위 시각 알약은 걷었다 — 대화 머리의 시각과 겹치고 창 속 달을 덮었다(미학 맹검 v4 K40). 다음 날 밤은 위 띠가 말한다.
  return (
    <div style={{ position: 'absolute', left: SCENE.x, top: SCENE.y, width: SCENE.s, height: SCENE.s, borderRadius: 40, overflow: 'hidden', boxShadow: '0 16px 36px rgba(60,30,20,0.28)', background: '#3A2A22' }}>
      {prev && fade < 1 ? <Img src={staticFile(prev.src)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${prevZoom * breath})`, transformOrigin: '45% 55%' }} /> : null}
      <Img src={staticFile(cur.src)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: fade, transform: `scale(${zoom * popSc * breath})`, transformOrigin: toEnd > 0 ? '48% 60%' : toFace > 0 ? '42% 42%' : '45% 55%' }} />
    </div>
  );
};

// ── 끝(잠든 몽글 위) — 위 띠를 두 줄로 ────────────────────────────────
const EndCard: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / 30;
  const s = useSpringAt(T.flat, { damping: 14, stiffness: 180 });
  const s2 = useSpringAt(T.flat + 0.35, { damping: 14, stiffness: 180 });
  if (t < T.flat) return null;
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: BAND_H, background: C.coral, opacity: interpolate(s, [0, 0.3], [0, 1], clamp), display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 30, gap: 6 }}>
      <div style={{ fontFamily: `'Inter Tight', 'SUIT', ${EMOJI}`, fontWeight: 800, fontSize: 46, color: C.brown, transform: `translateY(${(1 - s) * 20}px)` }}>{MN.endA}</div>
      <div style={{ fontFamily: `'Inter Tight', 'SUIT', ${EMOJI}`, fontWeight: 800, fontSize: 72, color: '#FFFFFF', opacity: interpolate(s2, [0, 0.4], [0, 1], clamp), transform: `translateY(${(1 - s2) * 20}px)` }}>{MN.endB}</div>
    </div>
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
    <Sfx file="pop.wav" at={T.vanish} vol={0.45} />
    {[0, 0.3, 0.6].map((d, i) => <Sfx key={i} file="tick.wav" at={T.typing[0] + d} vol={0.22} />)}
    <Sfx file="ding1.wav" at={T.reply} vol={0.45} />
    <Sfx file="ding1.wav" at={T.reply2} vol={0.4} />
    <Sfx file="boing.wav" at={T.frozen + 0.05} vol={0.32} />
    <Sfx file="pop.wav" at={T.ask} vol={0.3} />
    <Sfx file="tok.wav" at={T.cardA} vol={0.35} />
    <Sfx file="tok.wav" at={T.verbIn} vol={0.3} />
    <Sfx file="ding1.wav" at={T.morning} vol={0.4} />
    {[0, 0.2, 0.4].map((d, i) => <Sfx key={`a${i}`} file="tick.wav" at={T.type1[0] + d} vol={0.25} />)}
    {[0, 0.15, 0.3].map((d, i) => <Sfx key={`e${i}`} file="tick.wav" at={T.erase[0] + d} vol={0.2} />)}
    {[0, 0.2, 0.4, 0.6, 0.8, 1.0].map((d, i) => <Sfx key={`b${i}`} file="tick.wav" at={T.type2[0] + d} vol={0.25} />)}
    <Sfx file="pop.wav" at={T.myReply} vol={0.4} />
    <Sfx file="ding1.wav" at={T.reply3} vol={0.5} />
    <Sfx file="sparkle.wav" at={T.flat} vol={0.4} />
  </>
);

// 카메라 — 처음엔 대화의 「1」에 크게 다가가 있다가 「1」이 사라지면 물러나며 방을 보인다(M26과 같은 길)
const useCam = () => {
  const f = useCurrentFrame();
  const t = f / 30;
  const io = { ...clamp, easing: Easing.bezier(0.65, 0, 0.35, 1) };
  const keys: [number, number, number, number][] = [
    [0, 1.14, 560, 560],
    [T.zoomOut[0], 1.14, 560, 560],
    [T.zoomOut[1], 1.04, 540, 700],
    [T.frozen - 0.02, 1.04, 540, 700],
    [T.frozen + 0.2, 1.1, 540, 1300],
    [T.ask - 0.02, 1.14, 540, 1300],
    [T.ask + 0.18, 1, 540, 960],
    [T.cardA - 0.02, 1, 540, 960],
    [T.verbIn - 0.02, 1, 540, 960],
    [T.verbIn + 0.14, 1.04, 540, 700],
    [T.morning - 0.02, 1.04, 540, 700],
    [T.morning + 0.2, 1, 540, 960],
    [T.type1[0], 1, 540, 380],
    // 입력 칸으로 다가갈 때 대화 머리가 위 띠 밑으로 밀려 잘렸다(미학 맹검 v4 K5) → 머리 윗선(380)을 축으로 키운다
    [T.type1[0] + 0.25, 1.08, 540, 380],
    [T.myReply - 0.02, 1.08, 540, 380],
    [T.myReply + 0.2, 1, 540, 380],
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
      {plain ? null : <Band />}
      {plain ? null : <EndCard />}
      <Sound />
    </AbsoluteFill>
  );
};
