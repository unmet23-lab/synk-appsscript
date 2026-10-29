// 본편 v4(10-29 다시 살림 · 오마주): 원본 YwREufry_yQ(세팅 「GPT 말투」 쇼츠, 19.6초 · 박자 12번)의 뼈대 —
// 위에 고정 제목 두 줄 · 가운데 그림 칸 · 아래 큰 자막 상자, 한 목소리가 칸마다 한 줄을 쉼 없이 읽는다.
// 칸: 훅 → 예시(보낸 말) → 「ChatGPT :」 → 처음 답 세 줄 → 9.65초 반전(내 글 세 줄 + 「이 말투로 다시 써 줘」) → 「ChatGPT :」 → 다시 답 두 줄
// → 16.3초 끝 장치(실제 대화 한 화면으로 물러나 처음 답 아랫부분과 다시 답을 함께) → 17.95초 끝 한마디(노란 종이 세 장을 들어 보이는 사장님). 칸 시각은 원본 박자에서 0.6초 안(../오마주.json).
// 우리 색: 사람 · 로봇 그림은 GPT 이미지 2.5로 새로 구운 우리 그림(../그림/), 답 칸은 실제 ChatGPT 답 화면(../시안/1회_대화_다시그림.jpg — 2026-10-28
// 임시 채팅 페이지를 저장해 휴대폰 폭으로 다시 그린 것)을 한 컷 그대로 보인 뒤 그 줄로 당긴다. 이름표 「SYNK 브리핑」과 청금석 한 점.
// v1~v3(청금석 카드 · 견줌 판)은 src/full/에 그대로 있다.
import { Audio } from '@remotion/media';
import React from 'react';
import { AbsoluteFill, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { clamp, EASE_IN_OUT, EASE_OUT } from '../lib/anim';
import { KO } from '../lib/fonts';

const FPS = 30;
const s2f = (s: number) => Math.round(s * FPS);

// 칸 시작(초) — 원본 0 · 1.7 · 3.3 · 3.8 · 6.0 · 7.8 · 9.3 · 10.3 · 10.9 · 12.2 · 14.7 · 16.3 · 17.8
export const K = [0, 1.85, 3.7, 4.28, 6.15, 7.8, 9.65, 10.62, 11.68, 12.35, 14.7, 16.3, 17.95] as const;
export const END = 19.9;
export const TOTAL4 = s2f(END);
const kf = (i: number) => s2f(K[i]);

// 줄(../public/vo4/wNN.wav)은 칸 시작 0.03초 뒤에 놓는다
const LINES = ['w01', 'w02', 'w03', 'w04', 'w05', 'w06', 'w07', 'w08', 'w09', 'w10', 'w11', 'w12', 'w13'];

// ── 배치(1080×1920) — 글은 y 269~1428 · x 65~920 안(키트 안전선, 오른쪽 단추 자리) ──
const CX = 492; // 글 가운데(오른쪽 160 비움)
const PANEL = { y: 590, h: 830 };
const COL = { ink: '#0a0a0a', white: '#ffffff', yellow: '#ffd84d', lapis: '#3d6bc9', lapisLight: '#9dbcff', red: '#ff4d4d', mark: 'rgba(255,216,77,.42)' };

// ── 실제 화면 안 자리 — 좌표는 1080폭 시안(../../시안/1회_대화_다시그림.jpg) 기준, 그리는 것은 같은 페이지를 2배로 다시 그린 screen2x.jpg(2160×5800, 당겨도 글이 또렷하게) ──
type Rect = { x: number; y: number; w: number; h: number };
type View = { cx: number; cy: number; s: number; py?: number; spot?: Rect }; // spot: 그 칸에서 읽는 줄(나머지는 어둡게 덮는다) // py: 그 자리가 칸 안에서 놓일 높이(아래는 자막 상자)
const SCR_W = 1080;
// 줄 자리는 화면 그림의 밝은 줄을 재서 정했다(10-29): 보낸 말 250~353 · 「글쓰기」 584 · 제목 줄 676~717 · 안녕하세요 782~820 ·
// 디저트 줄 1164~1203 · 🍰 1231~1268 · 감사합니다 1332~1372 · 해시태그 1436~1478(흐림) · 둘째 「글쓰기」 1875 · 다음 주 화요일 1968~2008 ·
// 혹시 2033~2136 · 수요일부터는 2164~2202 · 그때 뵐게요 2229~2267(x 108~326).
const V: Record<string, View> = {
  all1: { cx: 540, cy: 930, s: 0.585, py: 415 }, // 보낸 말 + 처음 답 칸 전체(한 컷 그대로)
  title: { cx: 326, cy: 748, s: 2.3, py: 250, spot: { x: 92, y: 664, w: 470, h: 170 } }, // ☕ 카페 임시 휴무 안내 / 안녕하세요! 🤎
  dessert: { cx: 690, cy: 1192, s: 1.75, py: 260, spot: { x: 100, y: 1152, w: 890, h: 62 } }, // …달콤한 디저트로 찾아뵐게요. ☕ (🍰는 다음 줄 왼쪽이라 칸 밖)
  hash: { cx: 500, cy: 1420, s: 1.2 }, // 감사합니다! 🌿 / #카페공지 …
  all2: { cx: 540, cy: 2075, s: 1.0, py: 300 }, // 세 줄 붙인 뒤 답 칸 전체(한 컷 그대로)
  line1: { cx: 515, cy: 1988, s: 1.25, py: 250, spot: { x: 96, y: 1956, w: 834, h: 62 } }, // 다음 주 화요일(11월 3일)은 하루 쉬어갑니다. + 혹시…
  bye: { cx: 412, cy: 2215, s: 1.75, py: 250, spot: { x: 96, y: 2154, w: 636, h: 124 } }, // 수요일부터는 … / 그때 뵐게요.
  scroll: { cx: 540, cy: 1850, s: 0.8, py: 371 }, // 끝: 처음 답 아랫부분 → 세 줄 붙인 뒤 답(실제 대화 한 화면)
};
// 화면 안 표시(원본 좌표) — 빨간 동그라미 · 테, 노란 형광
const RINGS = [
  { k: 3, x: 135, y: 697, r: 30 }, // ☕
  { k: 3, x: 358, y: 801, r: 28 }, // 🤎
  { k: 4, x: 948, y: 1184, r: 30 }, // ☕
  { k: 4, x: 132, y: 1250, r: 30 }, // 🍰
];
const HASH_BOX = { x: 100, y: 1432, w: 800, h: 50 };
const MARK1 = { x: 104, y: 2010, w: 818, h: 6 }; // 다음 주 화요일(11월 3일)은 하루 쉬어갑니다. 밑줄
const MARK_YEOL = { x: 600, y: 2203, w: 118, h: 6 }; // 열게요.
const MARK_BYE = { x: 196, y: 2268, w: 132, h: 6 }; // 뵐게요.

const Screen: React.FC<{ from: View; to: View; t0: number; t1: number; marks?: React.ReactNode }> = ({ from, to, t0, t1, marks }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [t0, t1], [0, 1], { ...clamp, easing: EASE_IN_OUT });
  const s = from.s + (to.s - from.s) * p;
  const cx = from.cx + (to.cx - from.cx) * p;
  const cy = from.cy + (to.cy - from.cy) * p;
  const py = (from.py ?? 290) + ((to.py ?? 290) - (from.py ?? 290)) * p;
  // 칸이 바뀌면 덮개는 새 줄 자리로 옮겨 가고, 한 컷 그대로(all1 · all2)에서 당길 때는 당김이 끝날 즈음 덮인다
  const sp = to.spot ?? from.spot;
  const spOn = to.spot ? (from.spot ? 1 : interpolate(f, [t1 - 4, t1 + 3], [0, 1], clamp)) : 0;
  const spR = to.spot && from.spot ? { x: from.spot.x + (to.spot.x - from.spot.x) * p, y: from.spot.y + (to.spot.y - from.spot.y) * p, w: from.spot.w + (to.spot.w - from.spot.w) * p, h: from.spot.h + (to.spot.h - from.spot.h) * p } : sp;
  return (
    <AbsoluteFill style={{ background: '#0d0d0d', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 540 - cx * s, top: py - cy * s, width: SCR_W, height: 2900, transform: `scale(${s})`, transformOrigin: '0 0' }}>
        <Img src={staticFile('v4/screen2x.jpg')} style={{ width: SCR_W, height: 2900, display: 'block', filter: `brightness(${1 + 0.35 * spOn})` }} />
        {spR && spOn > 0 ? <div style={{ position: 'absolute', left: spR.x, top: spR.y, width: spR.w, height: spR.h, borderRadius: 14, boxShadow: `0 0 0 4000px rgba(14,14,14,${0.86 * spOn})` }} /> : null}
        {marks}
      </div>
    </AbsoluteFill>
  );
};
// 다시 그린 페이지(시안)에서만 생긴 조각을 페이지 바탕색(#0e0e0e)으로 덮는다 — 둘째 보낸 말 말풍선이 첫 답 칸 아래로 겹쳐 그려진 자리,
// 그리고 답 아래 추천 단추 두 줄(당긴 화면에서 자막 상자 옆으로 삐져나와 글을 가린다). 답 글 · 줄 자리는 그대로다.
const MASKS = { overlap: { x: 0, y: 1611, w: 1080, h: 108 }, chips: { x: 0, y: 2336, w: 1080, h: 230 } };
const Mask: React.FC<{ b: { x: number; y: number; w: number; h: number } }> = ({ b }) => <div style={{ position: 'absolute', left: b.x, top: b.y, width: b.w, height: b.h, background: '#0e0e0e' }} />;

const Ring: React.FC<{ x: number; y: number; r: number; at: number }> = ({ x, y, r, at }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [at, at + 6], [0, 1], { ...clamp, easing: EASE_OUT });
  return <div style={{ position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: '50%', border: `6px solid ${COL.red}`, opacity: p, transform: `scale(${1.4 - 0.4 * p})` }} />;
};
const Box: React.FC<{ b: { x: number; y: number; w: number; h: number }; at: number; color?: string; fill?: boolean }> = ({ b, at, color = COL.red, fill }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [at, at + 8], [0, 1], { ...clamp, easing: EASE_OUT });
  return (
    fill ? (
      <div style={{ position: 'absolute', left: b.x, top: b.y, height: b.h, width: b.w * p, opacity: p > 0.02 ? 1 : 0, borderRadius: 4, background: COL.lapisLight }} />
    ) : (
      <div style={{ position: 'absolute', left: b.x - 8, top: b.y - 6, height: b.h + 12, width: (b.w + 16) * p, opacity: p > 0.02 ? 1 : 0, borderRadius: 12, border: `6px solid ${color}` }} />
    )
  );
};

// 그림 칸 — 위쪽 2/3에 주인공이 있게 구웠다(아래는 자막 상자). 원본처럼 칸 안에서 아주 천천히 당긴다.
const Pic: React.FC<{ src: string; t0: number; t1: number; z0?: number; z1?: number; ox?: number; oy?: number }> = ({ src, t0, t1, z0 = 1.0, z1 = 1.045, ox = 50, oy = 30 }) => {
  const f = useCurrentFrame();
  const z = interpolate(f, [t0, t1], [z0, z1], clamp);
  return (
    <AbsoluteFill style={{ background: '#fff', overflow: 'hidden' }}>
      <Img src={staticFile(`v4/${src}`)} style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${ox}% ${oy}%`, transform: `scale(${z})`, transformOrigin: `${ox}% ${oy}%` }} />
    </AbsoluteFill>
  );
};

// 자막 상자 — 검은 판 위 큰 글(흰 기본 글자 없음: 늘 판 위)
const Sub: React.FC<{ lines: string[]; color?: string; label?: string; y?: number; size?: number }> = ({ lines, color = COL.white, label, y = 1150, size = 62 }) => (
  <div style={{ position: 'absolute', left: CX - 440, width: 880, top: y, display: 'flex', justifyContent: 'center' }}>
    <div style={{ background: COL.ink, borderRadius: 18, padding: '18px 30px 20px', fontFamily: KO, fontWeight: 800, fontSize: size, lineHeight: 1.22, color, textAlign: 'center', letterSpacing: '-0.02em', boxShadow: '0 0 0 3px rgba(255,255,255,.08)' }}>
      {label ? <div style={{ fontSize: Math.round(size * 0.62), color: COL.white, fontWeight: 700, marginBottom: 6 }}>{label}</div> : null}
      {lines.map((l, i) => (
        <div key={i} style={{ whiteSpace: 'nowrap' }}>{l}</div>
      ))}
    </div>
  </div>
);

const Title: React.FC = () => (
  <div style={{ position: 'absolute', left: 0, top: 296, width: 2 * CX, textAlign: 'center', fontFamily: KO }}>
    <div style={{ display: 'inline-block', background: COL.lapis, color: COL.white, fontWeight: 700, fontSize: 30, padding: '6px 18px 7px', borderRadius: 999, letterSpacing: '-0.01em' }}>SYNK 브리핑</div>
    <div style={{ marginTop: 14, fontWeight: 900, fontSize: 96, lineHeight: 1.08, color: COL.white, letterSpacing: '-0.035em' }}>공지에서</div>
    <div style={{ fontWeight: 900, fontSize: 96, lineHeight: 1.08, color: COL.lapisLight, letterSpacing: '-0.035em' }}>AI 티 빼기</div>
  </div>
);

// 칸 8: 「내가 쓴 글 세 줄」이 무엇인지 — 실제로 붙인 세 줄(저희가 지은 예시 가게 글, ../자료/실험_답.md)의 앞머리를 노란 종이 세 장에(시험 1 두 시험관이 「노란 메모지가 내 글인지 늦게 앎」).
// 줄 끝을 보인다 — 「~게요」가 다시 답의 「열게요 · 뵐게요」와 닮은 자리(시험 2 sonnet 「결과가 내 말투 같은지 증거가 약함」)
const NOTE_TEXT: [string, string, string][] = [['…다들 와 주셨네요. ', '고마워요', '.'], ['…내일 더 ', '구울게요', '.'], ['…화분 물은 제가 ', '줄게요', '.']];
const Notes: React.FC<{ t0: number }> = ({ t0 }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ position: 'absolute', left: CX - 330, top: PANEL.y + 40, width: 660 }}>
      <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 40, color: COL.white, background: COL.ink, display: 'inline-block', padding: '4px 16px 7px', borderRadius: 10, marginBottom: 12, opacity: interpolate(f, [t0, t0 + 4], [0, 1], clamp) }}>내가 전에 쓴 글 :</div>
      {NOTE_TEXT.map((t, i) => {
        const p = interpolate(f, [t0 + 2 + i * 3, t0 + 7 + i * 3], [0, 1], { ...clamp, easing: EASE_OUT });
        return (
          <div key={i} style={{ background: '#ffe36e', color: '#2a2418', fontFamily: KO, fontWeight: 700, fontSize: 42, padding: '14px 24px 16px', borderRadius: 6, marginBottom: 14, boxShadow: '0 8px 18px rgba(0,0,0,.28)', transform: `translateX(${(1 - p) * 60}px) rotate(${[-1.6, 1.2, -0.8][i]}deg)`, opacity: p }}>
            {t[0]}<span style={{ borderBottom: `6px solid ${COL.lapis}` }}>{t[1]}</span>{t[2]}
          </div>
        );
      })}
    </div>
  );
};

export const Film4: React.FC = () => {
  const f = useCurrentFrame();
  const panel = (() => {
    if (f < kf(1)) return <Pic src="a_upset.jpg" t0={0} t1={kf(1)} oy={25} />;
    if (f < kf(2)) return <Pic src="b_door.jpg" t0={kf(1)} t1={kf(2)} oy={20} />;
    if (f < kf(3)) return <Pic src="c_ai_happy.jpg" t0={kf(2)} t1={kf(3)} oy={22} z0={1.02} z1={1.08} />;
    if (f < kf(5)) {
      // 처음 답: 칸 4에서 한 컷 그대로 보인 뒤 제목 줄로 당기고, 칸 5에서 디저트 줄로(칸 6 해시태그는 스티커 로봇 그림 — 시험 1 「4.3~9.7초 채팅 화면이 길고 글자가 작아 지루」)
      const leg = f < kf(4) ? ['all1', 'title', kf(3) + 10, kf(3) + 20] : ['title', 'dessert', kf(4), kf(4) + 7];
      return (
        <Screen
          from={V[leg[0] as string]}
          to={V[leg[1] as string]}
          t0={leg[2] as number}
          t1={leg[3] as number}
          marks={
            <>
              {RINGS.map((r, i) => (
                <Ring key={i} x={r.x} y={r.y} r={r.r} at={r.k === 3 ? kf(3) + 22 + i * 6 : kf(4) + 9 + (i - 2) * 6} />
              ))}
              <Mask b={MASKS.overlap} />
            </>
          }
        />
      );
    }
    if (f < kf(6)) return <Pic src="f_ai_stickers.jpg" t0={kf(5)} t1={kf(6)} oy={24} z0={1.0} z1={1.06} />;
    if (f < kf(7)) return <Pic src="d_notes.jpg" t0={kf(6)} t1={kf(7)} oy={25} />;
    if (f < kf(8)) return <Pic src="d_notes.jpg" t0={kf(7)} t1={kf(8)} z0={1.32} z1={1.38} ox={72} oy={42} />;
    if (f < kf(9)) return <Pic src="e_ai_calm.jpg" t0={kf(8)} t1={kf(9)} oy={22} z0={1.02} z1={1.06} />;
    if (f < kf(12)) {
      // 다시 답: 칸 10에서 한 컷 그대로 보인 뒤 첫 줄로, 칸 11 끝 줄, 칸 12(끝 장치)에서 실제 대화 한 화면으로 물러나 처음 답 아랫부분(해시태그)과 다시 답을 함께
      const leg = f < kf(10) ? ['all2', 'line1', kf(9) + 10, kf(9) + 20] : f < kf(11) ? ['line1', 'bye', kf(10), kf(10) + 7] : ['bye', 'scroll', kf(11), kf(11) + 8];
      return (
        <Screen
          from={V[leg[0] as string]}
          to={V[leg[1] as string]}
          t0={leg[2] as number}
          t1={leg[3] as number}
          marks={
            <>
              <Box b={MARK1} at={kf(9) + 22} fill />
              <Box b={MARK_YEOL} at={kf(10) + 8} fill />
              <Box b={MARK_BYE} at={kf(10) + 12} fill />
              <Box b={HASH_BOX} at={kf(11) + 9} />
              <Mask b={MASKS.overlap} />
              <Mask b={MASKS.chips} />
            </>
          }
        />
      );
    }
    return <Pic src="g_notes_up.jpg" t0={kf(12)} t1={TOTAL4} oy={24} z0={1.0} z1={1.05} />;
  })();

  const sub = (() => {
    if (f < kf(1)) return null; // 칸 1은 제목을 읽는다
    if (f < kf(2)) return <Sub label="예시 :" lines={['“카페 공지 써 줘,', '화요일 하루 쉬어”']} />;
    if (f < kf(3)) return <Sub lines={['ChatGPT 답 :']} />;
    if (f < kf(4)) return <Sub color={COL.yellow} lines={['☕ 카페 임시 휴무 안내', '안녕하세요! 🤎']} />;
    if (f < kf(5)) return <Sub color={COL.yellow} lines={['…달콤한 디저트로', '찾아뵐게요. ☕🍰']} />;
    if (f < kf(6)) return <Sub color={COL.yellow} size={56} lines={['#카페공지 #임시휴무', '#휴무안내 #카페일상']} />;
    if (f < kf(7)) return <Sub lines={['됐고, 내 글 세 줄!']} />;
    if (f < kf(8)) return <Sub lines={['“이 말투로 다시 써 줘”']} />;
    if (f < kf(9)) return <Sub lines={['ChatGPT 답 :']} />;
    if (f < kf(10)) return <Sub color={COL.lapisLight} lines={['다음 주 화요일은', '하루 쉬어갑니다.']} />;
    if (f < kf(11)) return <Sub color={COL.lapisLight} size={76} lines={['그때 뵐게요.']} />;
    if (f < kf(12)) return <Sub y={1306} size={52} lines={['이모지랑 해시태그, 다 빠졌어요']} />;
    return <Sub y={1160} size={64} lines={['AI 글 티 나면,', '내 글 세 줄']} />;
  })();

  // 칸 7: 노란 종이 세 장 위에 꼬리표(그림에는 글자가 없다)
  const noteTag = f >= kf(6) && f < kf(7) ? (
    <div style={{ position: 'absolute', left: 470, top: 930, fontFamily: KO, fontWeight: 800, fontSize: 44, color: COL.ink, background: COL.yellow, padding: '6px 18px 9px', borderRadius: 12, boxShadow: '0 6px 16px rgba(0,0,0,.25)', opacity: interpolate(f, [kf(6) + 3, kf(6) + 8], [0, 1], clamp) }}>
      내가 전에 쓴 글 세 줄 ↘
    </div>
  ) : null;
  const notes = f >= kf(7) && f < kf(8) ? <Notes t0={kf(7)} /> : null;

  const cta = f >= kf(12) ? (
    <div style={{ position: 'absolute', left: 0, width: 2 * CX, top: 1366, textAlign: 'center', opacity: interpolate(f, [kf(12), kf(12) + 6], [0, 1], clamp) }}>
      <span style={{ display: 'inline-block', fontFamily: KO, fontWeight: 800, fontSize: 36, color: COL.white, background: COL.lapis, padding: '7px 24px 9px', borderRadius: 999 }}>저장해 두고 써 보세요</span>
    </div>
  ) : null;

  return (
    <AbsoluteFill style={{ background: COL.ink }}>
      <Title />
      <div style={{ position: 'absolute', left: 0, top: PANEL.y, width: 1080, height: PANEL.h, overflow: 'hidden', transform: `translate(${[0, 12, -10, 6, -3, 0][Math.max(0, Math.min(5, f - kf(6)))] * (f >= kf(6) && f < kf(6) + 6 ? 1 : 0)}px, 0)` }}>{panel}</div>
      {noteTag}
      {notes}
      {sub}
      {cta}
      {LINES.map((id, i) => (
        <Sequence key={id} from={kf(i) + 1} durationInFrames={TOTAL4 - kf(i) - 1} layout="none">
          <Audio src={staticFile(`vo4/${id}.wav`)} volume={1} />
        </Sequence>
      ))}
      {[
        { at: kf(2), src: 'sfx/pop.wav', v: 0.32 },
        { at: kf(6), src: 'sfx/thud.wav', v: 0.42 },
        { at: kf(8), src: 'sfx/pop.wav', v: 0.32 },
        { at: kf(11), src: 'sfx/snap.wav', v: 0.4 },
      ].map((h, i) => (
        <Sequence key={i} from={h.at} durationInFrames={45} layout="none">
          <Audio src={staticFile(h.src)} volume={h.v} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
