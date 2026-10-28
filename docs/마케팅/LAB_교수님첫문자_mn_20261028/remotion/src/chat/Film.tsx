// LAB 몽골 M17 「교수님께 첫 문자」 — 채팅 화면(✗ 반말 문자 → ✓ 다시 쓰기 → 교수님 답장) + 풀이 카드(한국어 · 키릴 읽기 · 몽골 뜻). 소리는 배경음과 알림 소리뿐.
// M15 「그래 = за」 Film.tsx를 옮겼다(채팅 · 카드 · 몽글 흔들림은 그대로, ✗ 도장 · 지우기 · 답장 카드를 이 편에 더함).
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { EN, KO } from '../lib/fonts';
import { ITEMS, MN, Msg } from './data';
import { CARD, fr, MSGS, T } from './timeline';

const C = {
  coral: '#F96859',
  bake: '#FA6955', // 구운 몽글 판의 바탕
  coralShade: '#AE322A',
  red: '#D7261E',
  brown: '#2B1A14',
  paper: '#FBF6EF',
  line: '#EADFD3',
  mint: '#D5EFE2',
  mintInk: '#1F5C45',
  gray: '#B9AEA6',
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

// ── 위 띠 · 대화 머리 ───────────────────────────────────────────────
/** 위 띠: 처음엔 「교수님께 처음 문자를 쓸 때」, 다시 쓰기부터 그 아래 규칙 한 줄을 크게 남긴다. */
const Band: React.FC = () => {
  const s = useSpringAt(T.rule, { damping: 14, stiffness: 190 });
  const on = useCurrentFrame() >= fr(T.rule);
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 430, background: C.coral }}>
      <div style={{ position: 'absolute', left: 70, width: 830, top: on ? 274 : 284, textAlign: 'center', fontFamily: EN, fontWeight: 800, fontSize: on ? 34 : 54, lineHeight: 1.12, color: C.brown, opacity: on ? 0.75 : 1 }}>
        {MN.band}
      </div>
      {on ? (
        <div style={{ position: 'absolute', left: 70, width: 840, top: 326, textAlign: 'center', fontFamily: EN, fontWeight: 800, fontSize: 39, lineHeight: 1.06, whiteSpace: 'nowrap', color: '#FFFFFF', opacity: interpolate(s, [0, 0.5], [0, 1], clamp), transform: `scale(${0.85 + 0.15 * s})` }}>
          {MN.rule}
        </div>
      ) : null}
    </div>
  );
};

const Header: React.FC = () => (
  <div style={{ position: 'absolute', left: 0, top: 430, width: 1080, height: 110, background: '#FFFFFF', borderBottom: `2px solid ${C.line}`, display: 'flex', alignItems: 'center', gap: 22, paddingLeft: 40 }}>
    <div style={{ fontFamily: EN, fontSize: 64, color: C.brown, opacity: 0.6, marginTop: -8 }}>‹</div>
    <div style={{ width: 70, height: 70, borderRadius: 35, background: C.mintInk, color: '#FFFFFF', fontFamily: KO, fontWeight: 800, fontSize: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>교</div>
    <div style={{ fontFamily: KO, fontWeight: 700, fontSize: 40, color: C.brown }}>{MN.prof}</div>
  </div>
);

// ── 채팅 ──────────────────────────────────────────────────────────
const SLOT = 128; // 말풍선 한 칸 높이(간격 포함)
const BOTTOM = 1000; // 마지막 말풍선 아래 끝(풀이 카드가 인스타 아래 글자 자리 1428px 위에 들게)
const CHAT_TOP = 540;

/** 지금 화면에 보이는 풀이 카드 번호(-1 = 첫 ✗ 카드, 9 = 답장 카드, 3 = 끝 카드). */
const cardAt = (t: number) => {
  if (t >= T.end) return 3;
  if (t >= T.reply && t < T.cards[2]) return 9;
  let k = -1;
  T.cards.forEach((c, i) => {
    if (t >= c) k = i;
  });
  return k;
};

const Typing: React.FC<{ t: number }> = ({ t }) => (
  <div style={{ display: 'flex', gap: 12, padding: '0 6px' }}>
    {[0, 1, 2].map((i) => (
      <div key={i} style={{ width: 18, height: 18, borderRadius: 9, background: C.brown, opacity: 0.35 + 0.45 * Math.max(0, Math.sin(t * 9 - i * 0.9)), transform: `translateY(${-6 * Math.max(0, Math.sin(t * 9 - i * 0.9))}px)` }} />
    ))}
  </div>
);

/** 반말 문자 위의 빨간 ✗ 도장 — 쾅 찍히듯 커졌다 자리 잡는다. */
const Stamp: React.FC = () => {
  const s = useSpringAt(T.stamp, { damping: 9, stiffness: 260, mass: 0.6 });
  return (
    <div style={{ position: 'absolute', right: -26, top: -30, width: 84, height: 84, borderRadius: 42, background: C.red, color: '#FFFFFF', fontFamily: EN, fontWeight: 800, fontSize: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 14px rgba(120,20,10,0.3)', opacity: interpolate(s, [0, 0.3], [0, 1], clamp), transform: `scale(${1.8 - 0.8 * s}) rotate(${(1 - s) * -20}deg)` }}>
      ✕
    </div>
  );
};

const Bubble: React.FC<{ m: Msg; t: number; active: boolean }> = ({ m, t, active }) => {
  const me = m.from === 'me';
  const typingNow = m.typing !== undefined && t < m.at;
  const stamped = m.wrong && t >= T.stamp;
  const dim = stamped ? interpolate(t, [T.stamp, T.stamp + 0.3], [0, 1], clamp) : 0;
  return (
    // 올리기 전 검사: 내 말풍선 글 오른쪽 끝 973px이 인스타 오른쪽 단추 자리(안전선 920)에 닿음 → 오른쪽 여백 70 → 140
    <div style={{ display: 'flex', justifyContent: me ? 'flex-end' : 'flex-start', padding: '0 140px 0 70px' }}>
      <div
        style={{
          position: 'relative',
          minWidth: 120,
          height: 108,
          padding: '0 34px',
          borderRadius: 34,
          borderBottomLeftRadius: me ? 34 : 10,
          borderBottomRightRadius: me ? 10 : 34,
          background: me ? (dim > 0 ? C.gray : C.coral) : '#FFFFFF',
          boxShadow: active ? `0 0 0 6px ${me ? C.coral : C.mintInk}, 0 8px 18px rgba(80,30,20,0.16)` : stamped ? `0 0 0 5px ${C.red}` : '0 4px 10px rgba(80,30,20,0.10)',
          transform: `scale(${active ? 1.06 : 1})`,
          transformOrigin: me ? 'right center' : 'left center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: `${KO.replace(', sans-serif', '')}, ${EMOJI}`,
          fontWeight: 800,
          fontSize: 58,
          letterSpacing: 1,
          color: me ? '#FFFFFF' : C.brown,
          whiteSpace: 'nowrap',
        }}
      >
        {typingNow ? <Typing t={t} /> : m.text}
        {stamped ? <Stamp /> : null}
      </div>
    </div>
  );
};

const Chat: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = f / 30;
  const shown = MSGS.map((m) => {
    const start = m.typing ?? m.at;
    const s = start < 0 ? 1 : spring({ frame: f - fr(start), fps, config: { damping: 17, stiffness: 190, mass: 0.7 } });
    // ✗ 문자는 다시 쓰기에서 지운다(옆으로 밀려 사라짐)
    const gone = m.wrong ? interpolate(t, [T.clear, T.clear + 0.3], [0, 1], { ...clamp, easing: EASE }) : 0;
    return { m, s, gone, live: (start < 0 || t >= start) && gone < 1 };
  }).filter((x) => x.live);
  const card = cardAt(t);
  // 아래에서 위로 쌓는다: 새 말풍선이 들어오는 만큼 앞의 것들이 위로 밀린다(지운 문자는 자리도 줄어든다)
  let push = 0;
  const placed = [...shown].reverse().map((x) => {
    const h = SLOT * x.s * (1 - x.gone);
    const y = BOTTOM - h - push;
    push += h;
    return { ...x, y };
  });
  return (
    <div style={{ position: 'absolute', left: 0, top: CHAT_TOP, width: 1080, height: BOTTOM - CHAT_TOP + 20, overflow: 'hidden', WebkitMaskImage: 'linear-gradient(180deg, transparent 0px, black 90px)' }}>
      {placed.map(({ m, s, y, gone }, i) => (
        <div key={i} style={{ position: 'absolute', left: 0, width: 1080, top: y - CHAT_TOP + (1 - s) * 30, opacity: interpolate(s, [0, 0.5], [0, 1], clamp) * (1 - gone), transform: `translateX(${gone * 300}px)` }}>
          <Bubble m={m} t={t} active={t >= m.at && ((m.item !== undefined && m.item === card) || (m.from === 'prof' && card === 9))} />
        </div>
      ))}
    </div>
  );
};

// 채팅 바탕: 옅은 높임 끝말(요 · 님 · 다) 무늬가 천천히 올라간다(정지 화면이 길어지지 않게)
const Wallpaper: React.FC = () => {
  const f = useCurrentFrame();
  const glyphs = ['요', '님', '다'];
  const rows = 9;
  const shift = (f * 2.4) % 140;
  return (
    <div style={{ position: 'absolute', left: 0, top: 540, width: 1080, height: 1380, background: C.paper, overflow: 'hidden' }}>
      {Array.from({ length: rows * 7 }).map((_, k) => {
        const r = Math.floor(k / 7), c = k % 7;
        return (
          <div key={k} style={{ position: 'absolute', left: c * 160 + (r % 2) * 80 - 20, top: r * 140 - shift, fontFamily: KO, fontWeight: 800, fontSize: 60, color: C.coral, opacity: 0.13 }}>
            {glyphs[(r + c) % 3]}
          </div>
        );
      })}
    </div>
  );
};

// ── 풀이 카드 ────────────────────────────────────────────────────
const CARD_BOX = { x: 60, y: 1022, w: 840, h: 400 };

const CardShell: React.FC<{ from: number; to: number | null; bg: string; children: React.ReactNode; instant?: boolean }> = ({ from, to, bg, children, instant }) => {
  const f = useCurrentFrame();
  const t = f / 30;
  const inS = useSpringAt(from, { damping: 16, stiffness: 170 });
  const s = instant ? 1 : inS;
  if (t < from && !instant) return null;
  const out = to === null ? 0 : interpolate(t, [to, to + 0.28], [0, 1], { ...clamp, easing: EASE });
  if (out >= 1) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: CARD_BOX.x,
        top: CARD_BOX.y,
        width: CARD_BOX.w,
        height: CARD_BOX.h,
        borderRadius: 40,
        background: bg,
        boxShadow: '0 14px 34px rgba(80,30,20,0.16)',
        overflow: 'hidden',
        transform: `translateY(${(1 - s) * 80 - out * 60}px) scale(${0.96 + 0.04 * s})`,
        opacity: Math.min(interpolate(s, [0, 0.5], [0, 1], clamp), 1 - out),
      }}
    >
      {children}
    </div>
  );
};

/** 구운 몽글 장면. 살짝 흔들려 카드가 서 있는 동안에도 화면이 멈추지 않는다(털 질감이 커서 작은 움직임도 잡힌다). */
const Mongle: React.FC<{ src: string; size: number; phase?: number; hop?: boolean }> = ({ src, size, phase = 0, hop }) => {
  const f = useCurrentFrame();
  const t = f / 30 + phase;
  return (
    <Img
      src={staticFile(src)}
      style={{
        width: size,
        height: size,
        objectFit: 'cover',
        objectPosition: '50% 55%',
        WebkitMaskImage: 'radial-gradient(circle at 50% 52%, black 56%, transparent 72%)',
        transform: hop ? `translateY(${-Math.abs(Math.sin(t * 5.2)) * 16}px) rotate(${Math.sin(t * 2.6) * 4}deg)` : `translateY(${Math.sin(t * 5.6) * 11}px) rotate(${Math.sin(t * 3.6) * 5}deg)`,
      }}
    />
  );
};

/** 풀이 카드 오른쪽 위의 몽글 딱지. */
const MongleBadge: React.FC<{ src: string; phase: number; hop?: boolean }> = ({ src, phase, hop }) => (
  <div style={{ position: 'absolute', right: 16, top: 16, width: 196, height: 196, borderRadius: 98, background: C.bake, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <Mongle src={src} size={244} phase={phase} hop={hop} />
  </div>
);

/** 첫 카드 — 땀 흘리는 몽글 + 「교수님께 이렇게 쓰면 안 돼요!」(몽골어) + 왜(친구에게만 쓰는 말투) + 반말 문자의 뜻.
 *  v1 이해 시험 3점: 0~2초에 「X와 빨간 카드가 정신없이 겹쳐」 넘김 · 「왜 틀렸는지 설명이 없다」 · 인용문이 작다
 *  → 흰 카드로 위 띠 · 말풍선의 코랄과 떼고, 까닭 한 줄을 더하고, 글을 키운다. */
const HookCard: React.FC = () => {
  const s = useSpringAt(T.stamp, { damping: 12, stiffness: 220, mass: 0.6 });
  return (
    <CardShell from={0} to={T.cards[0]} bg="#FFFFFF" instant>
      <div style={{ position: 'absolute', left: 14, top: 100, width: 220, height: 220, borderRadius: 110, background: C.bake, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Mongle src="img/mongle_oops.jpg" size={276} />
      </div>
      <div style={{ position: 'absolute', left: 256, right: 30, top: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12 }}>
        {/* 올릴 파일 시험: 「0~2초 몽골어가 작다」 — 반말 문자의 뜻 줄(36px)은 빼고(캡션에 있음) 제목 · 까닭을 키운다 */}
        <div style={{ fontFamily: EN, fontWeight: 800, fontSize: 62, lineHeight: 1.03, color: C.red }}>
          <span style={{ display: 'inline-block', marginRight: 12, transform: `scale(${0.6 + 0.4 * s})`, opacity: interpolate(s, [0, 0.3], [0, 1], clamp) }}>✕</span>
          {MN.hookNo}
        </div>
        <div style={{ fontFamily: `${EN.replace(', sans-serif', '')}, ${EMOJI}`, fontWeight: 800, fontSize: 50, lineHeight: 1.06, color: C.brown }}>{MN.hookWhy}</div>
      </div>
    </CardShell>
  );
};

const ItemCard: React.FC<{ i: number }> = ({ i }) => {
  const c = T.cards[i];
  const next = i === 1 ? T.reply : i < T.cards.length - 1 ? T.cards[i + 1] : T.end;
  const it = ITEMS[i];
  const koS = useSpringAt(c + CARD.ko, { damping: 11, stiffness: 210, mass: 0.6 });
  const readS = useSpringAt(c + CARD.read);
  const mnS = useSpringAt(c + CARD.mn, { damping: 11, stiffness: 210, mass: 0.6 });
  const noteS = useSpringAt(c + CARD.note);
  return (
    <CardShell from={c} to={next} bg="#FFFFFF">
      <MongleBadge src={it.mongle} phase={i * 0.7} hop={i === 2} />
      <div style={{ position: 'absolute', left: 52, top: 44, right: 230 }}>
        {/* 한국어 한 줄 — 채팅에 보낸 그대로 */}
        <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 66, lineHeight: 1.08, color: C.coral, whiteSpace: 'nowrap', transformOrigin: 'left center', opacity: interpolate(koS, [0, 0.4], [0, 1], clamp), transform: `scale(${0.8 + 0.2 * koS})` }}>{it.ko}</div>
        {/* 키릴 읽기 */}
        <div style={{ fontFamily: EN, fontWeight: 600, fontSize: 38, marginTop: 10, color: C.coralShade, opacity: interpolate(readS, [0, 0.5], [0, 1], clamp) }}>[{it.read}]</div>
      </div>
      {/* = 몽골 뜻 */}
      <div style={{ position: 'absolute', left: 52, right: 30, top: 232, fontFamily: EN, fontWeight: 800, fontSize: 52, lineHeight: 1.06, color: C.brown, opacity: interpolate(mnS, [0, 0.4], [0, 1], clamp), transform: `translateY(${(1 - mnS) * 30}px)` }}>
        <span style={{ opacity: 0.45 }}>= </span>
        {it.mn}
      </div>
      {it.note ? (
        <div style={{ position: 'absolute', left: 40, top: 300, whiteSpace: 'nowrap', fontFamily: `${KO.replace(', sans-serif', '')}, ${EMOJI}`, fontWeight: 800, fontSize: 42, color: C.mintInk, background: C.mint, borderRadius: 14, padding: '4px 16px 6px', opacity: interpolate(noteS, [0, 0.5], [0, 1], clamp) }}>
          {it.note}
        </div>
      ) : null}
    </CardShell>
  );
};

/** 답장 카드 — 예의 바르게 쓰니 교수님이 바로 답했다(결과). 몽골어만. */
const ReplyCard: React.FC = () => {
  const s2 = useSpringAt(T.reply + 0.45);
  return (
    <CardShell from={T.reply} to={T.cards[2]} bg={C.mint}>
      <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
        <div style={{ width: 320, height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Mongle src="img/mongle_happy.jpg" size={370} hop />
        </div>
        <div style={{ flex: 1, paddingRight: 30, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontFamily: EN, fontWeight: 800, fontSize: 66, lineHeight: 1.04, color: C.mintInk }}>
            {MN.replyTitle} <span style={{ fontFamily: EMOJI, fontWeight: 400 }}>🎉</span>
          </div>
          <div style={{ fontFamily: EN, fontWeight: 800, fontSize: 54, color: C.brown, opacity: interpolate(s2, [0, 0.5], [0, 1], clamp) }}>{MN.replyGloss}</div>
        </div>
      </div>
    </CardShell>
  );
};

const EndCard: React.FC = () => {
  const s2 = useSpringAt(T.end + 0.5);
  return (
    <CardShell from={T.end} to={null} bg={C.bake}>
      <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
        <div style={{ width: 300, height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Mongle src="img/mongle_happy.jpg" size={350} hop />
        </div>
        <div style={{ flex: 1, minWidth: 0, paddingRight: 30, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ fontFamily: EN, fontWeight: 800, fontSize: 56, lineHeight: 1.04, color: C.brown }}>{MN.endQ}</div>
          {/* v1 이해 시험: 끝 카드 아래 글씨가 작고 짧게 지나감 — 키우고 끝 카드를 3.8초로 · 올릴 파일 시험: 셋째 줄(친구에게 보내기)은 캡션으로만 */}
          <div style={{ alignSelf: 'flex-start', whiteSpace: 'nowrap', background: '#FFFFFF', borderRadius: 18, padding: '8px 16px 10px', fontFamily: EN, fontWeight: 800, fontSize: 40, lineHeight: 1.2, color: C.coralShade, opacity: interpolate(s2, [0, 0.5], [0, 1], clamp), transform: `scale(${0.8 + 0.2 * s2})`, transformOrigin: 'left center' }}>
            {MN.endC} <span style={{ fontFamily: EMOJI, fontWeight: 400 }}>👇</span>
          </div>
        </div>
      </div>
    </CardShell>
  );
};

// ── 소리 ─────────────────────────────────────────────────────────
const Sfx: React.FC<{ file: string; at: number; vol: number }> = ({ file, at: t, vol }) =>
  t < 0 ? null : (
    <Sequence from={fr(t)} layout="none">
      <Audio src={staticFile(`sfx/${file}`)} volume={vol * MASTER} />
    </Sequence>
  );

const Sound: React.FC = () => (
  <>
    <Audio src={staticFile('bgm.wav')} volume={(i) => 0.42 * MASTER * interpolate(i, [fr(T.total) - 40, fr(T.total)], [1, 0], clamp)} />
    {MSGS.map((m, i) => (
      <Sfx key={i} file={m.from === 'me' ? 'tok.wav' : 'pop.wav'} at={m.at} vol={m.from === 'me' ? 0.45 : 0.5} />
    ))}
    <Sfx file="boing.wav" at={T.stamp} vol={0.35} />
    {T.cards.map((c, i) => (
      <Sfx key={`c${i}`} file="tick.wav" at={c + CARD.mn} vol={0.35} />
    ))}
    <Sfx file="sparkle.wav" at={T.rule} vol={0.3} />
    <Sfx file="ding1.wav" at={T.reply} vol={0.38} />
    <Sfx file="ding1.wav" at={T.end} vol={0.3} />
  </>
);

export const Film: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: C.paper }}>
    <Wallpaper />
    <Chat />
    <Header />
    <Band />
    <HookCard />
    {ITEMS.map((_, i) => (
      <ItemCard key={i} i={i} />
    ))}
    <ReplyCard />
    <EndCard />
    <Sound />
  </AbsoluteFill>
);
