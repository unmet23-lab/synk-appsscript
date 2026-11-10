// LAB 몽골 M40 「네. 마침표」 — 채팅 화면 글 틀(우리편 M17 「교수님 첫 문자」 · M26 「읽씹」과 같은 지우): 위 띠 · 대화 · 아래 장면.
// 지우의 「내일 떡볶이 먹을래?」에 몽글이 교과서대로 「네.」 → 그 마침표가 부풀어 펠트 공이 되어 지우 방 침대로 쿵(핵심 장면) → 「혹시… 화났어?」 →
// 한국 채팅에서 「네.」는 차갑게, 「네~」는 따뜻하게 들린다 → 고쳐 보낸 「네~ 좋아!」에 지우가 웃는다 → 다음 날 지우의 「ㅇㅋ.」 마침표가 이번엔 몽글 위로(핵심 장면을 뒤집어 끝에 한 번 더).
// 장면은 GPT 이미지 2.5로 구운 판(판/*.png, 지시문 판/*.txt → public/img/*.jpg), 펠트 공은 흰 바탕에 구워 오렸다(public/img/ball.png). 전부 useCurrentFrame()으로만 움직인다.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { FONT, FRIEND, Lang, TEXT } from './data';
import { fr, T } from './timeline';

const C = { coral: '#F96859', brown: '#2B1A14', paper: '#FBF6EF', line: '#EADFD3', mintInk: '#1F5C45', gray: '#8F8580', ice: '#3E7CB8', iceBg: '#E3F0FB', sun: '#C98A12', sunBg: '#FFF3C9', red: '#D7261E' };
const KO = "'SUIT', 'Inter Tight', sans-serif";
const EMOJI = "'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";
const MASTER = 0.8;
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE = Easing.bezier(0.16, 1, 0.3, 1);

const BAND_H = 380;
const HEAD = { y: 380, h: 96 };
const CHAT = { y: 476, h: 400 }; // 정지 장면: 330이면 셋째 말의 뜻 줄이 잘린다
const SCENE = { x: 120, y: 896, s: 840 }; // 아래 빈 자리를 줄여 그림을 키운다

const useSpringAt = (t: number, cfg: { damping?: number; stiffness?: number; mass?: number } = {}) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: f - fr(t), fps, config: { damping: 15, stiffness: 180, mass: 0.7, ...cfg } });
};

// ── 위 띠 ─────────────────────────────────────────────────────────
const bandText = (t: number, L: (typeof TEXT)['mn']) => (t < T.send ? L.band0 : t < T.rule ? L.band1 : t < T.sum ? L.rule : t < T.morning ? L.sum : t < T.endLine ? L.morning : L.end); // 두 채널 v9 「끝 『응.』이 뭔지」 — 「마침표째!」 띠가 0.6초뿐이라 컷 가운데 장면에 안 잡혔다 → 16.8초까지
const Band: React.FC<{ lang: Lang; scene?: boolean }> = ({ lang, scene }) => {
  const f = useCurrentFrame();
  const t = f / 30;
  const L = TEXT[lang];
  const keys = [T.send, T.rule, T.sum, T.morning, T.endLine];
  const last = keys.filter((k) => t >= k).pop();
  const s = spring({ frame: f - fr(last ?? -1), fps: 30, config: { damping: 14, stiffness: 190 } });
  const big = t >= T.endLine;
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: BAND_H, background: C.coral }}>
      {scene ? null : (
        <div style={{ position: 'absolute', left: 60, width: 840, bottom: 12, textAlign: 'center', fontFamily: `${FONT[lang]}, ${EMOJI}`, fontWeight: 800, fontSize: big || t < T.send ? L.size * 1.2 : L.size * 0.92, lineHeight: 1.14, color: big || (t >= T.rule && t < T.sum) ? '#FFFFFF' : C.brown, transform: `translateY(${(1 - s) * 14}px) scale(${0.94 + 0.06 * s})`, opacity: interpolate(s, [0, 0.4], [0.2, 1], clamp) }}>
          {bandText(t, L)}
        </div>
      )}
    </div>
  );
};

// ── 대화 머리 ──────────────────────────────────────────────────────
const Header: React.FC<{ t: number }> = ({ t }) => (
  <div style={{ position: 'absolute', left: 0, top: HEAD.y, width: 1080, height: HEAD.h, background: '#FFFFFF', borderBottom: `2px solid ${C.line}`, display: 'flex', alignItems: 'center', gap: 22, paddingLeft: 40 }}>
    <div style={{ fontFamily: KO, fontSize: 60, color: C.brown, opacity: 0.6, marginTop: -8 }}>‹</div>
    <div style={{ width: 64, height: 64, borderRadius: 32, background: C.mintInk, color: '#FFFFFF', fontFamily: KO, fontWeight: 800, fontSize: 34, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>지</div>
    <div style={{ fontFamily: KO, fontWeight: 700, fontSize: 40, color: C.brown }}>{FRIEND}</div>
    <div style={{ position: 'absolute', left: 660, top: 18, width: 230, height: 60, borderRadius: 30, background: t >= T.morning ? C.sunBg : '#1E2A44', color: t >= T.morning ? C.brown : '#FFFFFF', fontFamily: `'Inter Tight', ${EMOJI}`, fontWeight: 800, fontSize: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
      <span style={{ fontFamily: EMOJI, fontSize: 30 }}>{t >= T.morning ? '☀️' : '🌙'}</span>
      {t >= T.morning ? '08:10' : '21:34'}
    </div>
  </div>
);

// ── 대화 ──────────────────────────────────────────────────────────
type Msg = { at: number; me: boolean; ko: string; gloss?: string; dot?: boolean };
const BH = 100; // 말풍선 높이
const GH = 46; // 뜻 줄 높이
const GAP = 16;
const Bubble: React.FC<{ m: Msg; lang: Lang; t: number; dotScale?: number; dotHide?: boolean }> = ({ m, lang, t, dotScale = 1, dotHide = false }) => {
  const s = interpolate(t, [m.at, m.at + 0.22], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.8)) });
  const text = m.dot ? m.ko.replace(/\.$/, '') : m.ko;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: m.me ? 'flex-end' : 'flex-start', padding: m.me ? '0 150px 0 0' : '0 0 0 70px', marginBottom: GAP, opacity: interpolate(s, [0, 0.3], [0, 1], clamp), transform: `translateY(${(1 - s) * 24}px)` }}>
      <div style={{ height: BH, padding: '0 34px', borderRadius: 32, borderBottomLeftRadius: m.me ? 32 : 10, borderBottomRightRadius: m.me ? 10 : 32, background: m.me ? C.coral : '#FFFFFF', boxShadow: '0 4px 10px rgba(80,30,20,0.10)', display: 'flex', alignItems: 'center', fontFamily: `'SUIT', ${EMOJI}`, fontWeight: 800, fontSize: m.dot ? 72 : 54, color: m.me ? '#FFFFFF' : C.brown, whiteSpace: 'nowrap', transform: `scale(${0.9 + 0.1 * s})`, transformOrigin: m.me ? 'right center' : 'left center' }}>
        {text}
        {m.dot ? <span style={{ display: 'inline-block', color: m.me ? C.brown : C.brown, transform: `scale(${dotScale})`, transformOrigin: '50% 85%', opacity: dotHide ? 0 : 1, fontWeight: 900 }}>.</span> : null}
      </div>
      {m.gloss ? <div style={{ height: GH, lineHeight: `${GH}px`, fontFamily: `${FONT[lang]}, ${EMOJI}`, fontWeight: 700, fontSize: lang === 'mm' ? 40 : 36, color: C.gray, padding: '0 10px' }}>= {m.gloss}</div> : null}
    </div>
  );
};
const msgsFor = (lang: Lang): Msg[] => {
  const L = TEXT[lang];
  return [
    { at: -1, me: false, ko: '내일 떡볶이 먹을래? 😋', gloss: L.gloss1 },
    { at: T.send, me: true, ko: '네.', dot: true },
    { at: T.angry, me: false, ko: '혹시… 화났어? 😥', gloss: L.gloss2 },
    { at: T.resend, me: true, ko: '네~ 좋아! 😆', gloss: L.gloss3 },
    { at: T.relief, me: false, ko: '휴~ 내일 봐! 😊', gloss: L.gloss4 },
  ];
};
const hOf = (m: Msg) => BH + (m.gloss ? GH : 0) + GAP;
const Chat: React.FC<{ lang: Lang; t: number }> = ({ lang, t }) => {
  const L = TEXT[lang];
  const day1 = t < T.morning;
  const list = day1 ? msgsFor(lang).filter((m) => t >= m.at) : [{ at: T.morning, me: false, ko: '응.', gloss: L.ok, dot: true } as Msg];
  // 쌓인 말이 넘치면 위로 민다(부드럽게)
  let total = 30;
  for (const m of list) total += hOf(m);
  const over = Math.max(0, total - CHAT.h + 10);
  const lastAt = list.length ? list[list.length - 1].at : 0;
  const prevOver = Math.max(0, total - hOf(list[list.length - 1] || ({ at: 0, me: true, ko: '' } as Msg)) - CHAT.h + 10);
  const lift = interpolate(t, [lastAt, lastAt + 0.3], [prevOver, over], { ...clamp, easing: EASE });
  // v8 GPT 미학 맹검 「카드 위로 뒤 말풍선 글자가 잘린 채 남는다」 → 풀이 카드가 뜨는 동안 대화를 아예 감춘다(흐리게 두지 않는다)
  const dim = interpolate(t, [T.cold - 0.1, T.cold + 0.1, T.resend - 0.12, T.resend + 0.05], [1, 0, 0, 1], clamp) * interpolate(t, [T.sum - 0.1, T.sum + 0.1, T.morning - 0.12, T.morning + 0.05], [1, 0, 0, 1], clamp);
  // 마침표가 부푼다(첫날 「네.」 · 다음 날 「ㅇㅋ.」), 떨어지기 시작하면 말풍선에서 사라진다
  const g1 = t < T.drop ? interpolate(t, [T.grow, T.drop], [1, 5.5], { ...clamp, easing: Easing.in(Easing.quad) }) : interpolate(t, [T.drop, T.drop + 0.18], [0.4, 1.6], { ...clamp, easing: EASE });
  const g2 = t < T.morning + 0.38 ? interpolate(t, [T.morning + 0.05, T.morning + 0.38], [1, 5.5], { ...clamp, easing: Easing.in(Easing.quad) }) : interpolate(t, [T.morning + 0.38, T.morning + 0.56], [0.4, 1.6], { ...clamp, easing: EASE });
  return (
    <div style={{ position: 'absolute', left: 0, top: CHAT.y, width: 1080, height: CHAT.h, background: C.paper, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, width: 1080, top: 30 - lift, opacity: dim }}>
        {!day1 ? <div style={{ position: 'absolute', left: 0, right: 0, top: -24, textAlign: 'center', fontFamily: `'Inter Tight', ${EMOJI}`, fontWeight: 700, fontSize: 24, color: C.gray }} /> : null}
        {day1 && t < T.send ? (
          <div style={{ position: 'absolute', right: 150, top: hOf(msgsFor(lang)[0]), height: 84, width: 150, borderRadius: 32, borderBottomRightRadius: 10, background: C.coral, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
            {[0, 1, 2].map((i) => <div key={i} style={{ width: 16, height: 16, borderRadius: 8, background: '#FFFFFF', opacity: 0.45 + 0.55 * Math.max(0, Math.sin(t * 10 - i * 0.9)), transform: `translateY(${-6 * Math.max(0, Math.sin(t * 10 - i * 0.9))}px)` }} />)}
          </div>
        ) : null}
        {list.map((m, i) => (
          <Bubble key={i} m={m} lang={lang} t={t} dotScale={m.dot ? (day1 ? g1 : g2) : 1} dotHide={false} />
        ))}
      </div>
    </div>
  );
};

// ── 풀이 카드(대화 위) ─────────────────────────────────────────────
const Card: React.FC<{ t: number; from: number; to: number; children: React.ReactNode }> = ({ t, from, to, children }) => {
  const s = useSpringAt(from, { damping: 16, stiffness: 170 });
  if (t < from || t > to + 0.3) return null;
  const out = interpolate(t, [to, to + 0.25], [0, 1], { ...clamp, easing: EASE });
  return (
    // v8 GPT 미학 맹검 「한 줄 정보에 카드가 너무 크고 아래가 비며 그림자가 두껍다」 → 카드 높이는 보이는 줄만큼, 그림자는 옅게
    <div style={{ position: 'absolute', left: 60, width: 960, top: CHAT.y + 40, background: '#FFFFFF', borderRadius: 30, boxShadow: '0 4px 12px rgba(80,30,20,0.12)', display: 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'center', gap: 14, padding: '26px 30px', boxSizing: 'border-box', opacity: interpolate(s, [0, 0.4], [0, 1], clamp) * (1 - out), transform: `translateY(${(1 - s) * 40 - out * 30}px) scale(${0.92 + 0.08 * s})` }}>
      {children}
    </div>
  );
};
const Row: React.FC<{ t: number; at: number; ko: string; read: string; mean: string; emoji: string; color: string; bg: string; lang: Lang }> = ({ t, at, ko, read, mean, emoji, color, bg, lang }) => {
  const a = interpolate(t, [at, at + 0.25], [0, 1], { ...clamp, easing: EASE });
  if (t < at) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 22, background: bg, borderRadius: 24, padding: '10px 26px', opacity: a, transform: `translateX(${(1 - a) * 30}px)` }}>
      <span style={{ fontFamily: KO, fontWeight: 900, fontSize: 92, color, lineHeight: 1, minWidth: 190 }}>{ko}</span>
      <span style={{ fontFamily: "'Inter Tight', sans-serif", fontWeight: 700, fontSize: 36, color: C.gray }}>[{read}]</span>
      <span style={{ fontFamily: `${FONT[lang]}, ${EMOJI}`, fontWeight: 800, fontSize: TEXT[lang].size * 1.05, color: C.brown, marginLeft: 'auto' }}>= {mean} {emoji}</span>
    </div>
  );
};
const Cards: React.FC<{ lang: Lang; t: number }> = ({ lang, t }) => {
  const L = TEXT[lang];
  return (
    <>
      <Card t={t} from={T.cold} to={T.resend - 0.12}>
        <Row t={t} at={T.cold} ko="네." read={L.read} mean={L.cold} emoji="🥶" color={C.ice} bg={C.iceBg} lang={lang} />
        <Row t={t} at={T.warm} ko="네~" read={`${L.read}~`} mean={L.warm} emoji="😊" color={C.sun} bg={C.sunBg} lang={lang} />
      </Card>
      <Card t={t} from={T.sum} to={T.morning - 0.12}>
        <Row t={t} at={T.sum} ko="네~" read={`${L.read}~`} mean={L.toFriend} emoji="☀️" color={C.sun} bg={C.sunBg} lang={lang} />
        <Row t={t} at={T.sum + 0.35} ko="네." read={L.read} mean={L.toTeacher} emoji="👍" color={C.ice} bg={C.iceBg} lang={lang} />
      </Card>
    </>
  );
};

// ── 아래 장면 ──────────────────────────────────────────────────────
// 장면 — 올리기 전 검사 「4.0~9.5초 · 9.5~15.0초 한 구성 5.5초」(카드만 바뀌고 그림이 그대로) → 칸마다 그림이나 구도를 바꾼다
const ROOMS: { at: number; src: string; focus: string; z?: number }[] = [
  { at: -1, src: 'mongle_send', focus: '40% 55%' },
  { at: T.drop, src: 'jiu_before', focus: '55% 50%' },
  { at: T.hit, src: 'jiu_shock', focus: '50% 50%' },
  { at: T.rule, src: 'mongle_confused', focus: '40% 55%' },
  { at: T.cold, src: 'cold_warm', focus: '22% 55%', z: 1.55 }, // 「네.」 = 얼음 낀 마침표 공
  { at: T.warm, src: 'cold_warm', focus: '78% 55%', z: 1.55 }, // 「네~」 = 따뜻한 물결 방석
  { at: T.resend, src: 'mongle_happy', focus: '40% 55%' },
  { at: T.relief, src: 'jiu_relief', focus: '45% 50%' },
  { at: T.sum, src: 'jiu_relief', focus: '30% 38%', z: 1.5 }, // 웃는 지우 얼굴로 확 다가간다
  { at: T.morning, src: 'mongle_morning', focus: '40% 55%' },
  { at: T.flat, src: 'mongle_flat', focus: '40% 70%' },
];
const Scene: React.FC<{ t: number }> = ({ t }) => {
  const k = ROOMS.reduce((acc, r, i) => (t >= r.at ? i : acc), 0);
  const cur = ROOMS[k];
  const since = t - Math.max(0, cur.at);
  const hitK = (at: number) => (t >= at && t < at + 0.5 ? Math.sin((t - at) * 60) * 14 * (1 - (t - at) / 0.5) : 0);
  const shake = hitK(T.hit) + hitK(T.flat);
  const squirm = cur.src === 'mongle_flat' && t > T.flat + 0.5 ? Math.sin((t - T.flat) * 13) * 3 * (0.6 + 0.4 * Math.sin((t - T.flat) * 2.3)) : 0;
  const zoom = (cur.z ?? 1.02) + (cur.at === T.sum ? 0.08 : 0.025) * since + (cur.src === 'mongle_flat' ? 0.06 * Math.min(1, since * 2) : 0); // 검사: 12.5~14.5초 정지 → 정리 칸은 더 빨리 다가간다
  const pop = cur.at > 0 ? interpolate(t, [cur.at, cur.at + 0.08, cur.at + 0.3], [1, 1.05, 1], clamp) : 1;
  return (
    <div style={{ position: 'absolute', left: SCENE.x, top: SCENE.y, width: SCENE.s, height: SCENE.s, borderRadius: 40, overflow: 'hidden', boxShadow: '0 6px 14px rgba(60,30,20,0.14)', background: '#3A2A22', transform: `translateY(${shake}px)` }}>
      <Img src={staticFile(`img/${cur.src}.jpg`)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: `translateX(${squirm}px) scale(${zoom * pop}, ${zoom * pop * (1 - Math.abs(squirm) * 0.002)})`, transformOrigin: cur.focus }} />
      {/* 지우가 굳는다 — 얼음빛 */}
      {cur.src === 'jiu_shock' ? <div style={{ position: 'absolute', inset: 0, opacity: 0.4 * interpolate(t, [T.hit + 0.15, T.hit + 0.45], [0, 1], clamp), background: 'radial-gradient(ellipse 210px 260px at 260px 360px, rgba(205,232,255,0.9) 0%, rgba(205,232,255,0.3) 60%, transparent 100%)', mixBlendMode: 'screen' }} /> : null}
    </div>
  );
};

// ── 떨어지는 마침표 공(말풍선의 「.」 자리 → 장면 속 자리) ─────────────
// 공에 붙어 다니는 쪽지 「. = цэг」 — 말풍선의 점이 이 공이라는 것(v3 · v4 시험 「검은 공이 무엇인가」), 떨어진 뒤에도 그 자리에 잠깐 남는다
const DotTag: React.FC<{ t: number; lang: Lang; from: number; to: number; until: number; x0: number; y0: number; x1: number; y1: number; d1: number }> = ({ t, lang, from, to, until, x0, y0, x1, y1, d1 }) => {
  if (t < from + 0.05 || t >= until) return null;
  const p = interpolate(t, [from, to], [0, 1], clamp);
  const x = x0 + (x1 - x0) * p;
  const y = y0 + (y1 - y0) * p * p;
  const a = interpolate(t, [from + 0.05, from + 0.2], [0, 1], { ...clamp, easing: Easing.out(Easing.back(2)) });
  const off = 30 + (d1 / 2) * Math.min(1, p * 1.4);
  const left = Math.min(x + off, 900);
  return (
    // v8 GPT 미학 맹검 「굵은 검정 테두리 · 그림자 쪽지가 기본 밈 스티커 같고 공을 가린다」 → 테두리 없는 종이 꼬리표, 그림자 옅게, 덜 기울게
    <div style={{ position: 'absolute', left, top: y - 40, transform: `scale(${a}) rotate(-2deg)`, transformOrigin: 'left center', background: C.paper, borderRadius: 12, padding: '6px 20px 9px', boxShadow: '0 3px 8px rgba(40,20,10,0.18)', fontFamily: `${FONT[lang]}, ${EMOJI}`, fontWeight: 800, fontSize: 50, color: C.brown, whiteSpace: 'nowrap' }}>
      {TEXT[lang].dot}
    </div>
  );
};
const Ball: React.FC<{ t: number; from: number; to: number; x0: number; y0: number; x1: number; y1: number; d0: number; d1: number }> = ({ t, from, to, x0, y0, x1, y1, d0, d1 }) => {
  if (t < from || t >= to) return null;
  const p = interpolate(t, [from, to], [0, 1], clamp);
  const x = x0 + (x1 - x0) * p;
  const y = y0 + (y1 - y0) * p * p; // 떨어지며 빨라진다
  const d = d0 + (d1 - d0) * Math.min(1, p * 1.4);
  return <Img src={staticFile('img/ball.png')} style={{ position: 'absolute', left: x - d / 2, top: y - d / 2, width: d, height: d, objectFit: 'contain', transform: `rotate(${p * 200}deg)`, filter: 'drop-shadow(0 8px 8px rgba(0,0,0,0.2))' }} />; // v8 맹검 「공 둘레 회색 후광」 → 그림자를 줄이고 오린 가장자리 흰 테는 소리/만들기.py에서 걷어냄
};

// ── 소리 ─────────────────────────────────────────────────────────
const Sfx: React.FC<{ file: string; at: number; vol: number }> = ({ file, at, vol }) => (
  <Sequence from={Math.max(0, fr(at))} layout="none">
    <Audio src={staticFile(`sfx/${file}`)} volume={vol * MASTER} />
  </Sequence>
);
const Vo: React.FC<{ id: string; at: number; vol?: number }> = ({ id, at, vol = 1 }) => (
  <Sequence from={fr(at)} layout="none">
    <Audio src={staticFile(`vo/${id}.wav`)} volume={vol * MASTER} />
  </Sequence>
);
// 음악은 공이 떨어지는 순간만 반쯤 낮췄다가 바로 돌아온다(바탕 방 소리는 그대로 — 음악층 ⑲)
const bgmVol = (f: number) => {
  const t = f / 30;
  const k = interpolate(t, [0, T.hit - 0.05, T.hit + 0.05, T.hit + 0.5, T.hit + 0.9, T.flat - 0.05, T.flat + 0.05, T.flat + 0.5, T.flat + 0.9, T.total - 0.5, T.total], [1, 1, 0.5, 0.5, 1, 1, 0.5, 0.5, 1, 1, 0], clamp);
  return 0.3 * MASTER * k;
};
const Sound: React.FC = () => (
  <>
    <Audio src={staticFile('sfx/bgm.wav')} volume={bgmVol} />
    <Audio src={staticFile('sfx/room.wav')} volume={(f) => 0.18 * MASTER * interpolate(f / 30, [0, T.total - 0.4, T.total], [1, 1, 0], clamp)} />
    {[0.05, 0.17, 0.29, 0.4].map((x, i) => <Sfx key={`k${i}`} file="tap.wav" at={x} vol={0.3} />)}
    <Sfx file="send.wav" at={T.send} vol={0.4} />
    <Sfx file="grow.wav" at={T.grow} vol={0.4} />
    <Sfx file="fall.wav" at={T.drop} vol={0.45} />
    <Sfx file="thump.wav" at={T.hit} vol={0.8} />
    <Sfx file="freeze.wav" at={T.hit + 0.2} vol={0.4} />
    <Sfx file="ding.wav" at={T.angry} vol={0.45} />
    <Sfx file="pop.wav" at={T.rule} vol={0.2} />
    <Sfx file="pop.wav" at={T.cold} vol={0.25} />
    <Vo id="n_cold" at={T.cold + 0.15} />
    <Sfx file="pop.wav" at={T.warm} vol={0.25} />
    <Vo id="n_warm" at={T.warm + 0.15} />
    {[8.25, 8.38, 8.5].map((x, i) => <Sfx key={`r${i}`} file="tap.wav" at={x} vol={0.3} />)}
    <Sfx file="send.wav" at={T.resend} vol={0.4} />
    <Sfx file="ding.wav" at={T.relief} vol={0.45} />
    <Sfx file="sparkle.wav" at={T.relief + 0.1} vol={0.35} />
    <Sfx file="pop.wav" at={T.sum} vol={0.25} />
    <Sfx file="ding.wav" at={T.morning} vol={0.45} />
    <Sfx file="grow.wav" at={T.morning + 0.1} vol={0.35} />
    <Sfx file="fall.wav" at={T.morning + 0.45} vol={0.4} />
    <Sfx file="thump.wav" at={T.flat} vol={0.85} />
    <Sfx file="squish.wav" at={T.flat + 0.08} vol={0.45} />
    <Sfx file="squish.wav" at={T.flat + 1.3} vol={0.25} />
    <Sfx file="squish.wav" at={T.flat + 2.4} vol={0.22} />
  </>
);

// 장면 심사용(scene)에는 위 띠 글 · 풀이 카드를 빼고 장면 · 대화 · 소리만
// 카메라 — 「네.」를 보내는 순간 그 말풍선으로 확 다가가(원본 0.7초 박자 · 나란히 「첫 2초」) 점이 부푸는 것을 크게 보이고, 공이 떨어질 때 물러난다
const useCam = (t: number) => {
  const io = { ...clamp, easing: Easing.bezier(0.65, 0, 0.35, 1) };
  const inS = interpolate(t, [T.send, T.send + 0.12], [0, 1], { ...clamp, easing: EASE });
  const outS = interpolate(t, [T.drop - 0.15, T.drop + 0.25], [0, 1], io);
  const in2 = interpolate(t, [T.morning, T.morning + 0.12], [0, 1], { ...clamp, easing: EASE });
  const out2 = interpolate(t, [T.morning + 0.36, T.flat + 0.05], [0, 1], io);
  const k1 = inS * (1 - outS);
  const k2 = in2 * (1 - out2);
  const k = Math.max(k1, k2);
  const s = 1 + 0.28 * k;
  const cx = k2 > k1 ? 230 : 860, cy = k2 > k1 ? 560 : 700;
  return s === 1 ? undefined : `translate(${(1 - s) * cx}px, ${(1 - s) * cy}px) scale(${s})`;
};

export const Film: React.FC<{ lang: Lang; scene?: boolean }> = ({ lang, scene }) => {
  const frame = useCurrentFrame();
  const t = frame / 30;
  const cam = useCam(t);
  return (
    <AbsoluteFill style={{ backgroundColor: C.paper }}>
      <AbsoluteFill style={{ transformOrigin: '0 0', transform: cam }}>
        <Scene t={t} />
        <Chat lang={lang} t={t} />
        {scene ? null : <Cards lang={lang} t={t} />}
        <Header t={t} />
      </AbsoluteFill>
      <Band lang={lang} scene={scene} />
      {/* 첫날 「네.」의 마침표 → 지우 방 침대(구운 그림 속 공 자리) · 다음 날 「ㅇㅋ.」의 마침표 → 몽글 위 */}
      <Ball t={t} from={T.drop} to={T.hit} x0={872} y0={CHAT.y + 30 + BH + GH + GAP + 50} x1={715} y1={1365} d0={70} d1={308} />
      {scene ? null : <DotTag t={t} lang={lang} from={T.drop} to={T.hit} until={T.rule} x0={872} y0={CHAT.y + 30 + BH + GH + GAP + 50} x1={715 - 330} y1={1365 - 120} d1={308} />}
      {scene ? null : <DotTag t={t} lang={lang} from={T.morning + 0.38} to={T.flat} until={T.total + 1} x0={235} y0={CHAT.y + 30 + 60} x1={439 + 40} y1={1190 - 300} d1={571} />}
      <Ball t={t} from={T.morning + 0.38} to={T.flat} x0={235} y0={CHAT.y + 30 + 60} x1={439} y1={1190} d0={70} d1={571} />
      <Sound />
    </AbsoluteFill>
  );
};
