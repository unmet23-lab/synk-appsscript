// LAB 몽골 M15 「한국어 '그래' = 몽골어 'за'」 — 채팅 화면 + 「그래」 풀이 카드(친구 말 뜻 · 내 대답 · = за · 키릴 읽기). 소리는 배경음과 알림 소리뿐.
// M2 「한국 친구와 채팅할 때」 Film.tsx를 옮겼다(채팅 · 카드 · 몽글 흔들림은 그대로, 카드 안과 정리 카드를 이 편에 맞춤).
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { EN, KO } from '../lib/fonts';
import { ITEMS, MN, Msg } from './data';
import { CARD, fr, MSGS, T } from './timeline';

const C = {
  coral: '#F96859',
  bake: '#FA6955', // 구운 몽글 판의 바탕
  coralShade: '#AE322A',
  coralSoft: '#FDE3DE',
  brown: '#2B1A14',
  paper: '#FBF6EF',
  line: '#EADFD3',
  mint: '#D5EFE2',
  mintInk: '#1F5C45',
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
/** 위 띠: 처음엔 「한국 친구와 채팅할 때」, 첫 풀이부터 그 아래 규칙 한 줄을 크게 남긴다. */
const Band: React.FC = () => {
  const s = useSpringAt(T.rule, { damping: 14, stiffness: 190 });
  const on = useCurrentFrame() >= fr(T.rule);
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 430, background: C.coral }}>
      <div style={{ position: 'absolute', left: 70, width: 830, top: on ? 274 : 284, textAlign: 'center', fontFamily: EN, fontWeight: 800, fontSize: on ? 34 : 54, lineHeight: 1.12, color: C.brown, opacity: on ? 0.75 : 1 }}>
        {MN.band}
      </div>
      {on ? (
        <div style={{ position: 'absolute', left: 70, width: 830, top: 318, textAlign: 'center', fontFamily: EN, fontWeight: 800, fontSize: 54, lineHeight: 1.06, color: '#FFFFFF', opacity: interpolate(s, [0, 0.5], [0, 1], clamp), transform: `scale(${0.85 + 0.15 * s})` }}>
          {MN.rule}
        </div>
      ) : null}
    </div>
  );
};

const Header: React.FC = () => (
  <div style={{ position: 'absolute', left: 0, top: 430, width: 1080, height: 110, background: '#FFFFFF', borderBottom: `2px solid ${C.line}`, display: 'flex', alignItems: 'center', gap: 22, paddingLeft: 40 }}>
    <div style={{ fontFamily: EN, fontSize: 64, color: C.brown, opacity: 0.6, marginTop: -8 }}>‹</div>
    <div style={{ width: 70, height: 70, borderRadius: 35, background: C.coral, color: '#FFFFFF', fontFamily: KO, fontWeight: 800, fontSize: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>민</div>
    <div style={{ fontFamily: KO, fontWeight: 700, fontSize: 40, color: C.brown }}>{MN.friend}</div>
    <div style={{ width: 14, height: 14, borderRadius: 7, background: '#4CC17A', marginLeft: -6, marginTop: 4 }} />
  </div>
);

// ── 채팅 ──────────────────────────────────────────────────────────
const SLOT = 128; // 말풍선 한 칸 높이(간격 포함)
const BOTTOM = 1000; // 마지막 말풍선 아래 끝(풀이 카드가 인스타 아래 글자 자리 1428px 위에 들게)
const CHAT_TOP = 540;

/** 지금 화면에 보이는 풀이 카드 번호(-1 = 첫 질문 카드, 3 = 정리 · 끝 카드). */
const cardAt = (t: number) => {
  if (t >= T.land) return 3;
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

const Bubble: React.FC<{ m: Msg; t: number; active: boolean }> = ({ m, t, active }) => {
  const me = m.from === 'me';
  const typingNow = m.typing !== undefined && t < m.at;
  const glow = active ? 1 : 0;
  return (
    <div style={{ display: 'flex', justifyContent: me ? 'flex-end' : 'flex-start', padding: '0 70px 0 60px' }}>
      <div
        style={{
          minWidth: 120,
          height: 108,
          padding: '0 34px',
          borderRadius: 34,
          borderBottomLeftRadius: me ? 34 : 10,
          borderBottomRightRadius: me ? 10 : 34,
          background: me ? C.coral : '#FFFFFF',
          boxShadow: active ? `0 0 0 6px ${C.coral}, 0 8px 18px rgba(80,30,20,0.16)` : '0 4px 10px rgba(80,30,20,0.10)',
          transform: `scale(${1 + 0.06 * glow})`,
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
    return { m, s, live: start < 0 || t >= start };
  }).filter((x) => x.live);
  const card = cardAt(t);
  // 아래에서 위로 쌓는다: 새 말풍선이 들어오는 만큼 앞의 것들이 위로 밀린다
  let push = 0;
  const placed = [...shown].reverse().map((x) => {
    const y = BOTTOM - SLOT * x.s - push;
    push += SLOT * x.s;
    return { ...x, y };
  });
  return (
    <div style={{ position: 'absolute', left: 0, top: CHAT_TOP, width: 1080, height: BOTTOM - CHAT_TOP + 20, overflow: 'hidden', WebkitMaskImage: 'linear-gradient(180deg, transparent 0px, black 90px)' }}>
      {placed.map(({ m, s, y }, i) => (
        <div key={i} style={{ position: 'absolute', left: 0, width: 1080, top: y - CHAT_TOP + (1 - s) * 30, opacity: interpolate(s, [0, 0.5], [0, 1], clamp) }}>
          <Bubble m={m} t={t} active={m.item !== undefined && m.item === card && t >= m.at} />
        </div>
      ))}
    </div>
  );
};

// 채팅 바탕: 옅은 「그 · 래 · за」 무늬가 천천히 올라간다(정지 화면이 길어지지 않게)
const Wallpaper: React.FC = () => {
  const f = useCurrentFrame();
  const glyphs = ['그', '래', 'за'];
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

/** 풀이 카드 오른쪽 위의 몽글 딱지 — 카드마다 그 장면의 몽글(맞장구 · 토닥 · 잘 자). */
const MongleBadge: React.FC<{ src: string; phase: number; hop?: boolean }> = ({ src, phase, hop }) => (
  <div style={{ position: 'absolute', right: 16, top: 16, width: 200, height: 200, borderRadius: 100, background: C.bake, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <Mongle src={src} size={250} phase={phase} hop={hop} />
  </div>
);

const HookCard: React.FC = () => (
  <CardShell from={0} to={T.cards[0]} bg={C.bake} instant>
    <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
      <div style={{ width: 360, height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Mongle src="img/mongle_curious.jpg" size={400} />
      </div>
      <div style={{ flex: 1, paddingRight: 36, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontFamily: EN, fontWeight: 800, fontSize: 112, lineHeight: 1, color: C.brown }}>
          'За' <span style={{ color: '#FFFFFF' }}>= ?</span>
        </div>
        <div style={{ fontFamily: EN, fontWeight: 800, fontSize: 54, lineHeight: 1.08, color: C.brown }}>{MN.hookQ}</div>
      </div>
    </div>
  </CardShell>
);

const ItemCard: React.FC<{ i: number }> = ({ i }) => {
  const c = T.cards[i];
  const next = i < T.cards.length - 1 ? T.cards[i + 1] : T.land;
  const it = ITEMS[i];
  const glossS = useSpringAt(c + CARD.gloss);
  const replyS = useSpringAt(c + CARD.reply, { damping: 11, stiffness: 210, mass: 0.6 });
  const zaS = useSpringAt(c + CARD.za, { damping: 11, stiffness: 210, mass: 0.6 });
  const readS = useSpringAt(c + CARD.read);
  return (
    <CardShell from={c} to={next} bg="#FFFFFF">
      <MongleBadge src={it.mongle} phase={i * 0.7} hop={i === 0} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: 4, paddingLeft: 52 }}>
        {/* 친구가 한 말의 뜻 — 몽글 딱지 왼쪽 */}
        <div style={{ maxWidth: 560, fontFamily: EN, fontWeight: 700, fontSize: 38, lineHeight: 1.12, color: C.coralShade, opacity: interpolate(glossS, [0, 0.5], [0, 1], clamp) }}>
          💬 “{it.gloss}”
        </div>
        {/* 내 대답 그래 [гырэ] */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 22, marginTop: 6, transformOrigin: 'left center', opacity: interpolate(replyS, [0, 0.4], [0, 1], clamp), transform: `scale(${0.8 + 0.2 * replyS})` }}>
          <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 112, lineHeight: 1, color: C.coral, letterSpacing: 2 }}>{it.reply}</div>
          <div style={{ fontFamily: EN, fontWeight: 600, fontSize: 42, color: C.coralShade, opacity: interpolate(readS, [0, 0.5], [0, 1], clamp) }}>[{MN.read}]</div>
        </div>
        {/* = за */}
        <div style={{ fontFamily: EN, fontWeight: 800, fontSize: 104, lineHeight: 1.05, color: C.brown, transformOrigin: 'left center', opacity: interpolate(zaS, [0, 0.4], [0, 1], clamp), transform: `translateY(${(1 - zaS) * 30}px)` }}>
          <span style={{ opacity: 0.45 }}>= </span>
          {it.za}
        </div>
      </div>
    </CardShell>
  );
};

/** 정리 카드 — 「그래」는 친구에게, 선생님 · 어른께는 그래 대신 「네」(관문: 반말 경고는 화면 한 줄로).
 *  v2 「12초 흰 카드에 글자만 빽빽」 → v3 제목을 뺌 → v3 「12초 칸이 빠르고 글이 많다」: 친구 줄은 작게, 「그래 ✗ → 네 ✓」 하나를 크게. */
const LandCard: React.FC = () => {
  const s1 = useSpringAt(T.land + 0.1);
  const s2 = useSpringAt(T.land + 0.6);
  const row = (s: number): React.CSSProperties => ({ opacity: interpolate(s, [0, 0.5], [0, 1], clamp), transform: `translateX(${(1 - s) * -30}px)` });
  return (
    <CardShell from={T.land} to={T.end} bg={C.mint}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 18, paddingLeft: 56 }}>
        <div style={{ ...row(s1), display: 'flex', alignItems: 'baseline', gap: 16 }}>
          <div style={{ fontFamily: EN, fontWeight: 700, fontSize: 38, color: C.mintInk, opacity: 0.8 }}>👫 {MN.landFriend}:</div>
          <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 52, lineHeight: 1, color: C.mintInk, opacity: 0.8 }}>그래 ✓</div>
        </div>
        <div style={row(s2)}>
          <div style={{ fontFamily: EN, fontWeight: 800, fontSize: 50, color: C.mintInk }}>⚠ {MN.landElder}:</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 20, marginTop: 4 }}>
            <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 76, lineHeight: 1.1, color: C.mintInk, opacity: 0.4, textDecoration: 'line-through', textDecorationThickness: 7 }}>그래</div>
            <div style={{ fontFamily: EN, fontWeight: 800, fontSize: 64, color: C.mintInk }}>→</div>
            <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 116, lineHeight: 1, color: C.coralShade }}>네</div>
            <div style={{ fontFamily: EN, fontWeight: 700, fontSize: 46, color: C.mintInk }}>[{MN.neRead}] ✓</div>
          </div>
        </div>
      </div>
    </CardShell>
  );
};

const EndCard: React.FC = () => {
  const s2 = useSpringAt(T.end + 0.5);
  const s3 = useSpringAt(T.end + 1.1);
  return (
    <CardShell from={T.end} to={null} bg={C.bake}>
      <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
        <div style={{ width: 300, height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Mongle src="img/mongle_yes.jpg" size={350} hop />
        </div>
        <div style={{ flex: 1, paddingRight: 30, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ fontFamily: EN, fontWeight: 800, fontSize: 54, lineHeight: 1.05, color: C.brown }}>{MN.endQ}</div>
          {/* v3: 「댓글에 무엇을 쓰라는지 모름」 — 답의 꼴(횟수)을 보기 둘로 */}
          <div style={{ display: 'flex', gap: 12, fontFamily: EN, fontWeight: 800, fontSize: 44, color: C.brown }}>
            {['10?', '100?'].map((x) => (
              <span key={x} style={{ background: 'rgba(255,255,255,0.55)', borderRadius: 14, padding: '2px 16px 4px' }}>{x}</span>
            ))}
          </div>
          <div style={{ alignSelf: 'flex-start', whiteSpace: 'nowrap', background: '#FFFFFF', borderRadius: 18, padding: '10px 18px 12px', fontFamily: EN, fontWeight: 800, fontSize: 40, lineHeight: 1.2, color: C.coralShade, opacity: interpolate(s2, [0, 0.5], [0, 1], clamp), transform: `scale(${0.8 + 0.2 * s2})`, transformOrigin: 'left center' }}>
            {MN.endC} <span style={{ fontFamily: EMOJI, fontWeight: 400 }}>👇</span>
          </div>
          <div style={{ fontFamily: EN, fontWeight: 600, fontSize: 30, lineHeight: 1.15, color: C.brown, paddingRight: 10, opacity: interpolate(s3, [0, 0.5], [0, 1], clamp) }}>{MN.endS}</div>
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
    {T.cards.map((c, i) => (
      <Sfx key={`c${i}`} file="tick.wav" at={c + CARD.za} vol={0.35} />
    ))}
    <Sfx file="sparkle.wav" at={T.rule} vol={0.3} />
    <Sfx file="ding1.wav" at={T.land} vol={0.35} />
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
    <LandCard />
    <EndCard />
    <Sound />
  </AbsoluteFill>
);
