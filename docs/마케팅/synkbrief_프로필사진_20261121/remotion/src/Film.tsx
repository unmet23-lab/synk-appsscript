// synkbrief B68 「셀카 한 장을 프로필 사진으로 바꾸는 명령어」 본편 — 수요 장부 synkbrief 2번(자료 나눔 꼴, 한 사람의 한 가지 일).
// 결: 표지 A 짜임(검정 바탕 · 위 큰 글자 · 아래 결과 사진 · 보낸 사진 작게 · 버터 한 곳 · SUIT 하나)을 첫 화면으로 두고 같은 결로 끝까지 간다.
// 색 꼬리표 · 스티커 · 번호 동그라미 · 색 띠 · 색 상자 · 말풍선 · 고리는 없다. 움직임은 작게(판은 초마다 1% 안팎으로 다가간다).
// 그림은 모두 ChatGPT에서 실제로 받은 결과다(scripts/재료.py). 사진 속 인물은 AI로 만든 예시라 사진 칸마다 위 작은 줄에 적는다.
// 얼굴이 나오는 그림은 두 눈의 자리(src/faces.json)로 놓는다 — 같은 칸에서 그림이 바뀔 때 얼굴은 제자리에 있고 배경 · 옷 · 머리만 바뀐다.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from './lib/fonts';
import faces from './faces.json';
import { S, VO, TAGS, LINES, END_LINES, SOUNDS, FPS, PAIR_LABELS, END, N7_AT, HOOK_SWAP, MORE_WIPE, endSwapOf, totalOf, bgmOf, type Variant } from './timeline';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const sec = (s: number) => Math.round(s * FPS);
const INK = '#0A0A0A';
const BUTTER = '#F5C445';
const X = 84;
const MASTER = 0.8; // Remotion은 합친 소리가 0 dBFS를 넘으면 자른다 — 모든 소리에 같은 값을 곱한다

type Key = keyof typeof faces;
// 그림 한 장을 두 눈 가운데가 (px, py), 두 눈 사이가 D가 되게 놓는다
const Face: React.FC<{ k: Key; px: number; py: number; D: number; opacity?: number }> = ({ k, px, py, D, opacity = 1 }) => {
  const f = faces[k];
  const s = D / f.d;
  return <Img src={staticFile(`img/${k}.jpg`)} style={{ position: 'absolute', left: px - f.ex * s, top: py - f.ey * s, width: f.w * s, height: f.h * s, display: 'block', opacity }} />;
};

// 사진 칸 — 둥근 모서리, 들어올 때 1.03배에서 내려앉고 아주 천천히 다가간다
const BOX = { left: 88, top: 744, w: 904, h: 1096 };
const Box: React.FC<{ rect?: { left: number; top: number; w: number; h: number }; drift?: number; origin?: string; children: React.ReactNode }> = ({ rect = BOX, drift = 0.01, origin = '50% 45%', children }) => {
  const f = useCurrentFrame();
  const z = interpolate(f, [0, 8], [1.03, 1], { ...clamp, easing: EASE_OUT }) * (1 + (f / FPS) * drift);
  return (
    <div style={{ position: 'absolute', left: rect.left, top: rect.top, width: rect.w, height: rect.h, overflow: 'hidden', borderRadius: 18, boxShadow: '0 26px 60px rgba(0,0,0,0.55)', background: '#1a1a1a' }}>
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${z})`, transformOrigin: origin }}>{children}</div>
    </div>
  );
};
const fadeIn = (f: number, at: number, n = 8) => interpolate(f, [at, at + n], [0, 1], clamp);

// ── 0 훅: 첫 프레임은 표지와 같은 화면(받은 프로필 사진이 크게 · 보낸 셀카가 작게). r3(이해 시험관 둘 · 볼 이유 심사가 「0~2.5초가 거의 멈춤」)부터
// 0.2초에 판이 두 눈 자리를 중심으로 1.25배 다가가며 같은 자리에서 보낸 셀카(방 · 맨투맨)로 바뀌고, 「프로필 사진이」(1.44초)에 받은 사진으로 돌아온다.
// 셀카는 1.25배여야 왼쪽 끝까지 덮는다(1배면 왼쪽 110px가 빈다). 작은 셀카 사진은 큰 판이 셀카가 되는 동안 사라진다.
const HERO = { top: 660, h: 1260, px: 578, py: 555, D: 239 };
const HERO_ZOOM = 1.25;
const Hook: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const H = HOOK_SWAP;
  const zoom = 1 + (HERO_ZOOM - 1) * interpolate(t, [H.zoomFrom, H.zoomTo], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const drift = 1 + Math.max(0, t - H.zoomTo) * 0.03;
  const selfie = interpolate(t, [H.inFrom, H.inTo, H.outFrom, H.outTo], [0, 1, 1, 0], clamp);
  const card = interpolate(t, [H.zoomFrom, H.inTo], [1, 0], clamp);
  const ox = (HERO.px / 1080) * 100;
  const oy = (HERO.py / HERO.h) * 100;
  return (
    <AbsoluteFill style={{ background: INK }}>
      <div style={{ position: 'absolute', left: 0, top: HERO.top, width: 1080, height: HERO.h, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, transform: `scale(${zoom * drift})`, transformOrigin: `${ox}% ${oy}%` }}>
          <Face k="tidy" px={HERO.px} py={HERO.py} D={HERO.D} />
          {selfie > 0 ? <Face k="selfie" px={HERO.px} py={HERO.py} D={HERO.D} opacity={selfie} /> : null}
        </div>
      </div>
      <AbsoluteFill style={{ pointerEvents: 'none', background: 'linear-gradient(180deg, rgba(10,10,10,1) 0px, rgba(10,10,10,1) 770px, rgba(10,10,10,0) 1050px)' }} />
      <div style={{ position: 'absolute', left: X, top: 796, fontFamily: KO, fontWeight: 500, fontSize: 30, lineHeight: 1.4, color: '#fff', opacity: 0.8, whiteSpace: 'nowrap', textShadow: '0 1px 8px rgba(0,0,0,0.5)' }}>
        <div>예시 셀카는 AI로 만든 가상 인물이에요</div>
      </div>
      {card > 0 ? (
        <Img
          src={staticFile('img/selfie.jpg')}
          style={{ position: 'absolute', left: 70, top: 1236, width: 270, height: 360, boxSizing: 'border-box', objectFit: 'cover', border: '9px solid #fff', borderRadius: 10, boxShadow: '0 22px 50px rgba(0,0,0,0.5)', opacity: card, transform: `rotate(-4deg) scale(${1 - 0.08 * (1 - card)})` }}
        />
      ) : null}
    </AbsoluteFill>
  );
};

// 표지 제목 — 아래 판이 보낸 셀카로 바뀌는 자리에서 걷힌다
const HookTitle: React.FC = () => {
  const f = useCurrentFrame();
  if (f >= sec(S.sent)) return null;
  const o = interpolate(f, [sec(S.sent) - 3, sec(S.sent)], [1, 0], clamp);
  return (
    <div style={{ position: 'absolute', left: 79, top: 352, opacity: o, fontFamily: KO, fontWeight: 800, fontSize: 124, letterSpacing: '-0.045em', lineHeight: 1.1, color: '#fff', whiteSpace: 'nowrap' }}>
      <div>셀카 한 장을</div>
      <div>프로필 사진으로</div>
      <div style={{ color: BUTTER }}>바꾸는 명령어</div>
    </div>
  );
};

// 화면 가득 판 — top부터 화면 아래 끝까지 좌우를 꽉 채운다(위 가장자리는 검정으로 녹인다)
const Bleed: React.FC<{ top?: number; drift?: number; origin?: string; fade?: number; children: React.ReactNode }> = ({ top = 744, drift = 0.01, origin = '50% 50%', fade = 70, children }) => {
  const f = useCurrentFrame();
  const z = interpolate(f, [0, 8], [1.03, 1], { ...clamp, easing: EASE_OUT }) * (1 + (f / FPS) * drift);
  return (
    <div style={{ position: 'absolute', left: 0, top, width: 1080, height: 1920 - top, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${z})`, transformOrigin: origin }}>{children}</div>
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: fade, background: `linear-gradient(to bottom, rgba(10,10,10,1) 0px, rgba(10,10,10,0) ${fade}px)` }} />
    </div>
  );
};

// ── 1 보낸 셀카 한 장 — 표지의 작은 사진이 커진 꼴(흰 테 · 살짝 기울임) ──
const CARD = { w: 640, h: 853, cx: 540, cy: 1262 };
const Sent: React.FC = () => {
  const f = useCurrentFrame();
  const p = interpolate(f, [0, 9], [0, 1], { ...clamp, easing: EASE_OUT });
  const z = (1.05 - 0.05 * p) * (1 + (f / FPS) * 0.022);
  return (
    <AbsoluteFill style={{ background: INK }}>
      <Img
        src={staticFile('img/selfie.jpg')}
        style={{ position: 'absolute', left: CARD.cx - CARD.w / 2, top: CARD.cy - CARD.h / 2, width: CARD.w, height: CARD.h, boxSizing: 'border-box', objectFit: 'cover', border: '12px solid #fff', borderRadius: 14, boxShadow: '0 30px 70px rgba(0,0,0,0.6)', transform: `rotate(${-3.2 + 1.2 * p}deg) scale(${z})` }}
      />
    </AbsoluteFill>
  );
};

// ── 2 보낸 명령어 — 셀카를 화면 가득 가까이(번들거림 · 잔머리 · 방이 보인다) ──
const Ask: React.FC = () => (
  <AbsoluteFill style={{ background: INK }}>
    <Bleed drift={0.012} origin="46% 50%"><Face k="selfie" px={500} py={600} D={300} /></Bleed>
  </AbsoluteFill>
);

// ── 2-1 사진 칸 — 셀카가 같은 자리에서 받은 사진으로(얼굴은 제자리, 방 · 옷 · 빛이 바뀐다) ──
// r3: 위에 명령어 뒷부분이 작은 글로 붙어 칸을 내린다. r5: 2회 시험관 둘(GPT · 그록)이 작은 글을 못 읽었다고 해 50px 네 줄로 키웠고,
// r6: 3회에도 GPT가 다시 짚어 56px 네 줄(700~978px)로 키우고 칸을 1005px부터 둔다
// r8: 독립 검수 — 얼굴(입 88% · 턱 92%)이 앱 아래 글 자리(아래 20%)에 걸렸다. 칸을 좁혀 얼굴을 줄이고 올린다(턱 80% 안쪽),
// 9.6~11.85초 말 없는 자리에 판이 멈춰 보여 다가감을 키운다(턱 높이를 중심으로)
const F_WIDE = { px: 326, py: 300, D: 170 };
const BOX_LOW = { left: 160, top: 1005, w: 760, h: 835 };
const AskBox: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: INK }}>
      <Box rect={BOX_LOW} drift={0.06} origin="45% 64%">
        <Face k="selfie" {...F_WIDE} />
        {f >= 3 ? <Face k="main" {...F_WIDE} opacity={fadeIn(f, 3, 9)} /> : null}
      </Box>
    </AbsoluteFill>
  );
};

// ── 3 한 줄 더 — 화면 가득 머리. 같은 자리에서 잔머리만 정리된 판으로 ──
// r4: 겹쳐 바꾸면 잔머리 차이가 안 보인다는 지적(2회 시험관 둘 · 볼 이유 심사)에 위에서 아래로 쓸어내리듯 바꾼다(경계는 60px 부드럽게)
// r6: 3회에도 둘 · 심사가 「휴대폰 크기에서 차이가 안 보인다」고 해, 바꾸기 전에 정수리와 옆머리 쪽으로 1.45배 다가간다(0.6~1.5초)
// r8: 독립 검수 — 1.45배로는 볼 옆 가닥이 화면 끝에 걸려 차이가 약하고 입이 아래 글 자리에 걸렸다.
// 머리 전체(정수리 잔머리 · 볼 옆 가닥)가 다 보이는 크기에 두고, 머리 위쪽을 중심으로 1.1배만 다가간다(입은 81% 안팎)
// r9: 다시 검수 — 다가간 뒤 입 83% · 턱 86%. 한 번 다가감을 빼고, 얼굴을 올려 두 눈 자리를 중심으로 끝까지 천천히 다가간다(입 77% 안팎).
// 그림은 화면 폭을 겨우 덮는 크기라 더 줄이지 못한다(D 220 아래면 양옆이 빈다). 위 그늘을 24px로 줄여 정수리 잔머리가 어둡게 묻히지 않게 한다
const F_NEAR = { px: 532, py: 505, D: 220 };
const HAIR = { x: 540, y: 60, zoom: 1, from: 0.3, to: 1.4 };
const More: React.FC = () => {
  const f = useCurrentFrame();
  const sw = sec(S.moreSwap) - sec(S.more);
  const p = interpolate(f, [sw, sw + sec(MORE_WIPE)], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const edge = -60 + p * (1176 + 120); // Bleed 높이(1920 − 744) 위에서 아래로
  const mask = `linear-gradient(to bottom, #000 ${edge - 60}px, transparent ${edge + 60}px)`;
  const zoom = 1 + (HAIR.zoom - 1) * interpolate(f / FPS, [HAIR.from, HAIR.to], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  return (
    <AbsoluteFill style={{ background: INK }}>
      <Bleed drift={0.025} origin="49% 43%" fade={24}>
        <div style={{ position: 'absolute', inset: 0, transform: `scale(${zoom})`, transformOrigin: `${HAIR.x}px ${HAIR.y}px` }}>
          <Face k="main" {...F_NEAR} />
          {f >= sw ? (
            <div style={{ position: 'absolute', inset: 0, WebkitMaskImage: mask, maskImage: mask }}>
              <Face k="tidy" {...F_NEAR} />
            </div>
          ) : null}
        </div>
      </Bleed>
    </AbsoluteFill>
  );
};

// ── 4 얼굴 견줌 — 보낸 셀카(왼쪽 위)와 받은 사진(오른쪽 아래)의 얼굴을 같은 크기로 나란히 ──
// r8: 독립 검수 — 받은 사진의 점이 가로 87%(앱 오른쪽 단추 줄 옆)라 칸을 좁히고 얼굴을 왼쪽으로 옮긴다
const CELL = { w: 450, h: 700 };
const PairCell: React.FC<{ x: number; y: number; label: string; k: Key; delay: number }> = ({ x, y, label, k, delay }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [delay, delay + 8], [0, 1], { ...clamp, easing: EASE_OUT });
  const z = 1 + (f / FPS) * 0.028;
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, opacity: p, transform: `translateY(${(1 - p) * 24}px)` }}>
      <div style={{ position: 'absolute', left: Math.max(x + 6, 70), top: y - 60, fontFamily: KO, fontWeight: 600, fontSize: 38, color: '#fff', opacity: 0.86, whiteSpace: 'nowrap' }}>{label}</div>
      <div style={{ position: 'absolute', left: x, top: y, width: CELL.w, height: CELL.h, overflow: 'hidden', borderRadius: 18, boxShadow: '0 26px 60px rgba(0,0,0,0.55)' }}>
        <div style={{ position: 'absolute', inset: 0, transform: `scale(${z})`, transformOrigin: '70% 50%' }}>
          <Face k={k} px={190} py={270} D={250} />
        </div>
      </div>
    </div>
  );
};
const Pair: React.FC = () => (
  <AbsoluteFill style={{ background: INK }}>
    <PairCell x={40} y={780} label={PAIR_LABELS[0]} k="selfie" delay={0} />
    <PairCell x={505} y={880} label={PAIR_LABELS[1]} k="tidy" delay={3} />
  </AbsoluteFill>
);

// ── 5 하나씩만 바꾸는 명령어 셋의 결과 — 칸마다 크기 · 높이를 다르게(넓게 · 옷이 보이게 · 가까이) ──
const Vary: React.FC<{ k: Key; px: number; py: number; D: number; origin?: string }> = ({ k, px, py, D, origin }) => (
  <AbsoluteFill style={{ background: INK }}>
    <Box drift={0.026} origin={origin}><Face k={k} px={px} py={py} D={D} /></Box>
  </AbsoluteFill>
);

// ── 끝: 화면 가득. r3(이해 시험관 둘이 「같은 얼굴에 글만 바뀌어 흐지부지」)부터 보낸 셀카로 시작해 「얼굴이 바뀌었는지」에 같은 자리에서 받은 사진으로 바뀐다.
// 판을 내리고 빈 위쪽은 같은 그림 윗부분을 뒤집어 흐리게 채운 뒤 위 그늘 ──
const F_END = { px: 540, py: 1090, D: 300 };
const EndLayer: React.FC<{ k: Key; opacity?: number }> = ({ k, opacity = 1 }) => {
  const top = F_END.py - faces[k].ey * (F_END.D / faces[k].d);
  return (
    <div style={{ position: 'absolute', inset: 0, opacity }}>
      <div style={{ position: 'absolute', inset: 0, transform: `translateY(${top * 2}px) scaleY(-1)`, transformOrigin: '50% 0%', filter: 'blur(34px) brightness(0.8)' }}>
        <Face k={k} {...F_END} />
      </div>
      <Face k={k} {...F_END} />
    </div>
  );
};
const End: React.FC<{ v: Variant }> = ({ v }) => {
  const f = useCurrentFrame();
  const z = interpolate(f, [0, 8], [1.03, 1], { ...clamp, easing: EASE_OUT }) * (1 + (f / FPS) * 0.022);
  const sw = endSwapOf(v);
  const after = interpolate(f / FPS, [sw.from, sw.to], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ background: INK, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${z})`, transformOrigin: '50% 57%' }}>
        <EndLayer k="selfie" />
        {after > 0 ? <EndLayer k="tidy" opacity={after} /> : null}
      </div>
      <AbsoluteFill style={{ background: 'linear-gradient(to bottom, rgba(10,10,10,0.97) 0px, rgba(10,10,10,0.95) 610px, rgba(10,10,10,0.45) 800px, rgba(10,10,10,0) 990px)' }} />
    </AbsoluteFill>
  );
};

// 줄 안의 [ ] = 버터 글자
const rich = (l: string) => l.split(/(\[[^\]]+\])/).map((p, k) => (p.startsWith('[') ? <span key={k} style={{ color: BUTTER }}>{p.slice(1, -1)}</span> : <React.Fragment key={k}>{p}</React.Fragment>));

// 큰 글자가 곧 말 — 첫 줄은 구성이 바뀌는 첫 프레임부터 서 있고, 다음 줄부터 28px 올라오며 뜬다
// small = 말로 읽지 않는 뒷부분 — 큰 글 아래 14px 띄워 50px 흰 글(조금 옅게)로 한 번에 뜬다
const BigBlock: React.FC<{ lines: string[]; at: number[]; size: number; small?: string[]; smallAt?: number; smallStep?: number }> = ({ lines, at, size, small, smallAt, smallStep = 0 }) => {
  const f = useCurrentFrame();
  const psAt = (k: number) => (small && smallAt !== undefined ? interpolate(f, [sec(smallAt + k * smallStep) - 2, sec(smallAt + k * smallStep) + 5], [0, 1], { ...clamp, easing: EASE_OUT }) : 0);
  const ps = psAt(0);
  return (
    <div style={{ position: 'absolute', left: X, top: 352, fontFamily: KO, fontWeight: 800, fontSize: size, letterSpacing: '-0.045em', lineHeight: size >= 120 ? 1.1 : 1.16, color: '#fff', whiteSpace: 'nowrap', textShadow: size >= 120 ? '0 2px 18px rgba(0,0,0,0.55)' : undefined }}>
      {lines.map((s, k) => {
        const a = sec(at[k]);
        const p = k === 0 ? 1 : interpolate(f, [a - 2, a + 4], [0, 1], { ...clamp, easing: EASE_OUT });
        return <div key={k} style={{ opacity: p, transform: `translateY(${(1 - p) * 28}px)` }}>{rich(s)}</div>;
      })}
      {small && ps > 0 ? (
        <div style={{ marginTop: 14, fontWeight: 650, fontSize: 56, letterSpacing: '-0.035em', lineHeight: 1.24, textShadow: '0 2px 12px rgba(0,0,0,0.6)' }}>
          {small.map((s, k) => {
            const p = psAt(k);
            return <div key={k} style={{ opacity: 0.94 * p, transform: `translateY(${(1 - p) * 18}px)` }}>{s}</div>;
          })}
        </div>
      ) : null}
    </div>
  );
};
const Big: React.FC<{ v: Variant }> = ({ v }) => {
  const f = useCurrentFrame();
  const ctaAt = N7_AT + END[v].ctaAt;
  if (f >= sec(ctaAt)) return <BigBlock lines={END[v].cta} at={[ctaAt, ctaAt + 0.35]} size={END[v].ctaSize} />;
  if (f >= sec(S.end)) return <BigBlock lines={END_LINES.lines} at={END_LINES.at} size={END_LINES.size} small={END_LINES.small} smallAt={END_LINES.smallAt} />;
  const l = LINES.find((x) => f >= sec(x.from) && f < sec(x.to));
  return l ? <BigBlock lines={l.lines} at={l.at} size={l.size} small={l.small} smallAt={l.smallAt} smallStep={l.smallStep} /> : null;
};

// 위 작은 줄 — 굵은 낱말 + 옅은 설명. bar = 둘 사이에 가는 선(한 문장으로 붙어 읽히지 않게)
const Tag: React.FC = () => {
  const f = useCurrentFrame();
  const g = TAGS.find((x) => f >= sec(x.from) && f < sec(x.to));
  if (!g) return null;
  const size = g.size ?? 40;
  return (
    <div style={{ position: 'absolute', left: X, top: size === 34 ? 292 : 286, fontFamily: KO, fontWeight: 700, fontSize: size, letterSpacing: '0.01em', lineHeight: 1.2, color: '#fff', whiteSpace: 'nowrap' }}>
      {g.b}
      {g.bar ? <span style={{ display: 'inline-block', width: 2, height: 30, margin: '0 20px', background: 'rgba(255,255,255,0.42)', verticalAlign: '-3px' }} /> : null}
      {g.i ? <span style={{ fontWeight: 500, opacity: size === 34 ? 0.7 : 0.74, marginLeft: g.bar ? 0 : 16 }}>{g.i}</span> : null}
    </div>
  );
};

const Sound: React.FC<{ v: Variant }> = ({ v }) => {
  const total = totalOf(v);
  const bgm = bgmOf(total);
  return (
    <>
      <Audio src={staticFile('bgm.wav')} volume={(fr) => interpolate(fr, bgm.t.map(sec), bgm.v, clamp) * MASTER} />
      {[...VO, { id: END[v].vo, t: N7_AT } as (typeof VO)[number]].map((o, i) => (
        <Sequence key={i} from={sec(o.t)} durationInFrames={o.to !== undefined ? sec(o.to - (o.from ?? 0)) : undefined}>
          <Audio src={staticFile(`vo/${o.id}.wav`)} volume={MASTER} trimBefore={o.from ? sec(o.from) : undefined} />
        </Sequence>
      ))}
      {SOUNDS.map((s, i) => (
        <Sequence key={`s${i}`} from={Math.max(0, sec(s.t))} durationInFrames={45}><Audio src={staticFile(s.src)} volume={s.vol * MASTER} /></Sequence>
      ))}
      <Sequence from={sec(N7_AT + END[v].ctaAt + 0.35)} durationInFrames={45}><Audio src={staticFile('sfx/thud.wav')} volume={0.26 * MASTER} /></Sequence>
    </>
  );
};

const Seq: React.FC<{ a: number; b: number; children: React.ReactNode }> = ({ a, b, children }) => (
  <Sequence from={sec(a)} durationInFrames={sec(b) - sec(a)}>{children}</Sequence>
);

export const Film: React.FC<{ v: Variant }> = ({ v }) => (
  <AbsoluteFill style={{ background: INK }}>
    <Seq a={S.hook} b={S.sent}><Hook /></Seq>
    <Seq a={S.sent} b={S.ask}><Sent /></Seq>
    <Seq a={S.ask} b={S.askBox}><Ask /></Seq>
    <Seq a={S.askBox} b={S.more}><AskBox /></Seq>
    <Seq a={S.more} b={S.face}><More /></Seq>
    <Seq a={S.face} b={S.bg}><Pair /></Seq>
    <Seq a={S.bg} b={S.clothes}><Vary k="bg" px={391} py={466} D={200} /></Seq>
    <Seq a={S.clothes} b={S.cafe}><Vary k="clothes" px={420} py={346} D={215} origin="50% 70%" /></Seq>
    <Seq a={S.cafe} b={S.end}><Vary k="cafe" px={452} py={500} D={260} origin="50% 40%" /></Seq>
    <Seq a={S.end} b={totalOf(v)}><End v={v} /></Seq>
    <HookTitle />
    <Big v={v} />
    <Tag />
    <Sound v={v} />
  </AbsoluteFill>
);
