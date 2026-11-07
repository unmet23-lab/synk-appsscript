// 「달리며 건너뛰는 한국」 영어판 30초 — 바탕 영상(편집/바탕편집.py가 이은 드리미나 판 · 후보정 없음) 위에 LAB 테마 화면 글과 소리를 얹는다.
// 글은 콘티 v2 박표대로: 0~3초 물음 → 6.0초 「0/12」 → 10.0초부터 장소마다 한 칸 → 21.0초 답 카드(박마다 한 줄) → 27.0초 이름 끝말 → 28.5초 보내기.
// 얼굴을 덮지 않는다(첫 컷은 아래 3분의 1, 답 카드는 다리가 솟은 왼쪽을 비우고 오른쪽 단). 영상 위 글은 모두 테두리 있는 라벨(키트 k-window 꼴 — 짙은 테두리 + 단단한 그림자)이라
// 흰 티 · 분홍 벚꽃 · 눈밭 어느 바탕에서도 읽힌다(11-07 첫 시험 판에서 흰 글자가 흰 티 위에 묻히고 코랄 칩이 벚꽃에 묻혀 바꿈).
import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, OffthreadVideo, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Audio } from '@remotion/media';
import { EN, KO, MONO } from '../lib/fonts';
import { ANSWER_IN, BEAT, C, CAM_IN, CAM_OUT, COUNT_AT, COUNTER_IN, CTA_IN, ENDINGS, FINISH_IN, HOOK_END, LESSON_IN, NAME_OUT, PLACES, RACE_IN, RACE_OUT, REC_STOP, ROW_STEP, s, SAFE, TAPE_IN } from './timeline';
import { LAYOUT, SFX } from './layout';

// 키트 kit.css --k-crayon-arrow(크레용 화살표 — 오른쪽 위에서 왼쪽 아래로)
const CRAYON_ARROW = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 110'%3E%3Cfilter id='r'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3CfeDisplacementMap in='SourceGraphic' scale='4'/%3E%3C/filter%3E%3Cg filter='url(%23r)' fill='none' stroke='black' stroke-width='7' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M150 12C112 6 52 22 22 84'/%3E%3Cpath d='M12 56l9 30 30-10'/%3E%3C/g%3E%3C/svg%3E\")";

const ease = Easing.bezier(0.22, 1, 0.36, 1);
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const lerp = (f: number, a: number, b: number, from: number, to: number, e = ease) => interpolate(f, [a, b], [from, to], { ...clamp, easing: e });
const EDGE = (w = 3, d = 6) => `0 0 0 ${w}px ${C.onField}, ${d}px ${d}px 0 ${C.onField}`; // 짙은 갈색 테두리 + 단단한 그림자

// ── 첫 3초: 라벨 두 장 + 물음(머리 위 천장 자리 — 걸어오는 얼굴 · 턱을 덮지 않게, v6). 0장부터 다 보인다(키트: 0초 화면이 곧 표지)
const Hook: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const out = s(HOOK_END) - 9;
  const settle = lerp(f, 0, 8, 1.04, 1);
  const chip = spring({ frame: f - BEAT, fps, config: { damping: 12, stiffness: 220, mass: 0.6 } });
  const leave = (k: number) => lerp(f, out + k * 2, out + k * 2 + 7, 0, 1, Easing.in(Easing.cubic));
  const y = LAYOUT.hookY;
  const block = (bg: string, fg: string): React.CSSProperties => ({
    display: 'inline-block', padding: '8px 24px 14px', borderRadius: 18, background: bg, color: fg, boxShadow: EDGE(3, 7),
    font: `800 92px/1 ${EN}`, letterSpacing: '-0.035em',
  });
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: SAFE.left + 4, top: y, transformOrigin: 'left center', transform: `scale(${settle})` }}>
        <div style={{ ...block(C.field, C.onField), transform: `translateX(${-leave(0) * 860}px) rotate(-1.5deg)` }}>I raced a train</div>
        <div style={{ height: 12 }} />
        <div style={{ ...block(C.paper, C.ink), transform: `translateX(${-leave(1) * 860}px)` }}>
          across <span style={{ color: C.acc }}>Korea.</span>
        </div>
        <div style={{ height: 22 }} />
        <div style={{ display: 'inline-flex', alignItems: 'center', padding: '16px 28px 18px', borderRadius: 999, background: C.onField, color: '#fff',
          font: `700 40px/1 ${EN}`, letterSpacing: '-0.02em', boxShadow: '0 14px 28px -14px rgba(0,0,0,.6)',
          opacity: Math.min(1, chip * 1.5), transform: `translateX(${-leave(2) * 860}px) scale(${0.8 + 0.2 * chip})`, transformOrigin: 'left center' }}>
          12 places — can you name them?
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── 테이프 장면(3.0~4.5초): 창에 붙이는 폰을 크레용 화살표로 「our camera」 — 시험관 넷이 「왜 테이프를 붙이는지」를 몰랐다
const TapeNote: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const T = LAYOUT.tape;
  const draw = lerp(f, 4, 12, 0, 1);
  const pop = spring({ frame: f - 2, fps, config: { damping: 12, stiffness: 230, mass: 0.6 } });
  const out = lerp(f, s(CAM_IN - TAPE_IN) - 5, s(CAM_IN - TAPE_IN), 0, 1);
  return (
    <AbsoluteFill style={{ opacity: 1 - out }}>
      <div style={{ position: 'absolute', left: T.arrow.x, top: T.arrow.y, width: 160 * T.arrow.s, height: 110 * T.arrow.s, background: '#fff',
        WebkitMaskImage: CRAYON_ARROW, maskImage: CRAYON_ARROW, WebkitMaskSize: '100% 100%', maskSize: '100% 100%',
        clipPath: `inset(0 0 0 ${(1 - draw) * 100}%)`, filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.45))' }} />
      <div style={{ position: 'absolute', left: T.label.x, top: T.label.y, padding: '10px 20px 14px', borderRadius: 16, background: C.paper, color: C.ink,
        font: `800 42px/1 ${EN}`, letterSpacing: '-0.03em', boxShadow: EDGE(3, 5), transform: `rotate(-2deg) scale(${0.8 + 0.2 * pop})`,
        opacity: Math.min(1, pop * 1.5), transformOrigin: 'left center' }}>
        <span style={{ font: `500 26px/1 ${MONO}`, color: C.acc, letterSpacing: '0.02em', display: 'block', marginBottom: 6 }}>STEP 1</span>tape phone to train
        <span style={{ display: 'block', marginTop: 6, font: `600 30px/1.1 ${EN}`, letterSpacing: '-0.015em', color: '#4f535a' }}>so it films the race</span>
      </div>
    </AbsoluteFill>
  );
};

// ── 폰 시점(4.5~9.96초): 카메라 화면 틀 — 네 귀퉁이 꺾쇠 + 「● REC」 · 경과 시간. 기둥이 화면을 덮는 장에서 끝난다
const CamFrame: React.FC = () => {
  const f = useCurrentFrame();
  const inA = lerp(f, 0, 4, 0, 1) * (1 - lerp(f, s(CAM_OUT - CAM_IN) - 4, s(CAM_OUT - CAM_IN), 0, 1));
  const stopped = f >= s(REC_STOP - CAM_IN);
  const blink = stopped ? 1 : Math.floor(f / 12) % 2 === 0 ? 1 : 0.25;
  const sec = Math.floor((Math.min(f, s(REC_STOP - CAM_IN)) + 2 * 24) / 24);
  const L = 92, W = 6, X0 = 46, X1 = 1080 - 46, Y0 = 236, Y1 = 1296;
  const corner = (x: number, y: number, sx: number, sy: number) => (
    <>
      <div style={{ position: 'absolute', left: sx > 0 ? x : x - L, top: sy > 0 ? y : y - W, width: L, height: W, background: '#fff', borderRadius: 3, boxShadow: '0 1px 4px rgba(0,0,0,.5)' }} />
      <div style={{ position: 'absolute', left: sx > 0 ? x : x - W, top: sy > 0 ? y : y - L, width: W, height: L, background: '#fff', borderRadius: 3, boxShadow: '0 1px 4px rgba(0,0,0,.5)' }} />
    </>
  );
  return (
    <AbsoluteFill style={{ opacity: inA }}>
      {corner(X0, Y0, 1, 1)}{corner(X1, Y0, -1, 1)}{corner(X0, Y1, 1, -1)}{corner(X1, Y1, -1, -1)}
      {/* 도장은 왼쪽 아래(바닥 · 다리 자리) — 오른쪽 위에 두었더니 7.5초 옆얼굴의 입 · 턱을 덮었다(11-07 v2 장면 확인) */}
      <div style={{ position: 'absolute', right: 1080 - SAFE.right, top: LAYOUT.recY, display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px',
        borderRadius: 10, background: 'rgba(11,13,18,.72)', boxShadow: 'inset 0 0 0 2px #6b7385', font: `500 30px/1 ${MONO}`, color: '#fff', letterSpacing: '0.02em' }}>
        <span style={{ width: 16, height: 16, borderRadius: stopped ? 2 : 8, background: stopped ? '#fff' : '#ff3b30', opacity: blink }} />
        {stopped ? 'STOP' : 'REC'} 00:{String(sec).padStart(2, '0')}
      </div>
    </AbsoluteFill>
  );
};

// ── 출발(6.0~8.5초): 숫자 칩 아래 「Race the train!」 — 「6~10초 준비가 퀴즈와 무슨 관계인지」를 알려 준다
const RaceChip: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k = spring({ frame: f - 4, fps, config: { damping: 12, stiffness: 220, mass: 0.6 } });
  const out = lerp(f, s(RACE_OUT - RACE_IN) - 6, s(RACE_OUT - RACE_IN), 0, 1, Easing.in(Easing.cubic));
  return (
    <div style={{ position: 'absolute', left: SAFE.left + 6, top: LAYOUT.raceY, padding: '12px 22px 16px', borderRadius: 16, background: C.paper, color: C.ink,
      font: `800 46px/1 ${EN}`, letterSpacing: '-0.03em', boxShadow: EDGE(3, 5), opacity: Math.min(1, k * 1.5) * (1 - out),
      transform: `translateX(${-out * 60}px) rotate(-1.5deg) scale(${0.8 + 0.2 * k})`, transformOrigin: 'left center' }}>
      <span style={{ font: `500 26px/1 ${MONO}`, color: C.acc, letterSpacing: '0.02em', display: 'block', marginBottom: 6 }}>STEP 2</span>keep up with the train!
    </div>
  );
};

// ── 첫 장소(10.0~12.0초): 숫자 칩 아래 「Name each place!」 — 퀴즈가 여기서 시작된다는 신호
const NameChip: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k = spring({ frame: f - 3, fps, config: { damping: 12, stiffness: 230, mass: 0.6 } });
  const out = lerp(f, s(NAME_OUT - COUNTER_IN) - 5, s(NAME_OUT - COUNTER_IN), 0, 1, Easing.in(Easing.cubic));
  return (
    <div style={{ position: 'absolute', left: SAFE.left + 6, top: LAYOUT.nameY, padding: '12px 22px 16px', borderRadius: 16, background: C.paper, color: C.ink,
      font: `800 44px/1 ${EN}`, letterSpacing: '-0.03em', boxShadow: EDGE(3, 5), opacity: Math.min(1, k * 1.5) * (1 - out),
      transform: `translateX(${-out * 60}px) rotate(-1.5deg) scale(${0.8 + 0.2 * k})`, transformOrigin: 'left center' }}>
      Name each place!
    </div>
  );
};

// ── 다리가 솟는 1초(20.0~21.0초): 「made it… sort of」 — 시험관 셋이 다이빙의 뜻을 몰랐다
const FinishChip: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k = spring({ frame: f - 3, fps, config: { damping: 11, stiffness: 240, mass: 0.6 } });
  const out = lerp(f, s(ANSWER_IN - FINISH_IN) - 4, s(ANSWER_IN - FINISH_IN) + 2, 0, 1);
  return (
    <div style={{ position: 'absolute', left: LAYOUT.finish.x, top: LAYOUT.finish.y, padding: '12px 22px 16px', borderRadius: 16, background: C.field, color: C.onField,
      font: `800 46px/1 ${EN}`, letterSpacing: '-0.03em', boxShadow: EDGE(3, 6), opacity: Math.min(1, k * 1.5) * (1 - out),
      transform: `rotate(-3deg) scale(${0.75 + 0.25 * k})`, transformOrigin: 'left center' }}>
      Finish line!
    </div>
  );
};

// ── 「n/12」 칩 + 열두 칸(6.0초부터 왼쪽 위). 장소가 바뀔 때마다 숫자가 올라오고 칩이 한 번 눌린다
const Counter: React.FC = () => {
  const f = useCurrentFrame() + s(COUNTER_IN);
  const { fps } = useVideoConfig();
  const ats = COUNT_AT.map(s);
  const n = ats.filter((a) => f >= a).length;
  const last = n ? ats[n - 1] : s(COUNTER_IN);
  const pop = n ? spring({ frame: f - last, fps, config: { damping: 11, stiffness: 260, mass: 0.6 } }) : 1;
  const enter = spring({ frame: f - s(COUNTER_IN), fps, config: { damping: 14, stiffness: 210, mass: 0.7 } });
  const exit = lerp(f, s(ANSWER_IN) - 7, s(ANSWER_IN) + 2, 0, 1, Easing.in(Easing.cubic));
  const roll = lerp(f, last - 1, last + 2, 0, 1);   // 0.5초 컷에서 숫자가 컷과 같이 바뀌게(5장 굴림은 0.2초 늦어 보였다)
  const prev = Math.max(0, n - 1);
  const scale = (0.8 + 0.2 * enter) * (n ? 1 + 0.1 * (1 - pop) : 1);
  return (
    <div style={{ position: 'absolute', left: SAFE.left + 6, top: LAYOUT.counterY, opacity: Math.min(1, enter * 1.4),
      transform: `translateX(${-exit * 480}px) scale(${scale})`, transformOrigin: 'left center' }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', height: 80, padding: '0 26px', borderRadius: 999, background: C.field, boxShadow: EDGE(3, 5) }}>
        {/* 숫자는 Inter Tight 고정폭 숫자 — DM Mono의 0은 빗금이 있어 「Ø/12」로 읽혔다(Fable v2 P2) */}
        <div style={{ position: 'relative', height: 50, width: n >= 10 ? 56 : 29, overflow: 'hidden', font: `800 48px/50px ${EN}`, fontVariantNumeric: 'tabular-nums', color: C.onField }}>
          {n > 0 && roll < 1 && <span style={{ position: 'absolute', right: 0, top: -roll * 52, opacity: 1 - roll }}>{prev}</span>}
          <span style={{ position: 'absolute', right: 0, top: n ? (1 - roll) * 52 : 0 }}>{n}</span>
        </div>
        <span style={{ font: `800 48px/50px ${EN}`, fontVariantNumeric: 'tabular-nums', color: C.onField, opacity: 0.55 }}>/12</span>
        <span style={{ marginLeft: 14, font: `700 34px/48px ${EN}`, letterSpacing: '-0.02em', color: C.onField }}>places</span>
      </div>
      <div style={{ display: 'flex', gap: 5, marginTop: 14, marginLeft: 4 }}>
        {Array.from({ length: 12 }, (_, i) => {
          const on = i < n;
          const k = on && i === n - 1 ? roll : on ? 1 : 0;
          return <div key={i} style={{ width: 20, height: 10, borderRadius: 3, background: k > 0 ? C.field : 'rgba(255,255,255,.55)',
            boxShadow: `0 0 0 2px ${C.onField}`, transform: `scaleY(${1 + 0.5 * k * (1 - k) * 4})` }} />;
        })}
      </div>
    </div>
  );
};

// 이름 안 끝말 글자에 노란 형광펜(27.0초부터) — 「한라산」의 「산」. 키트: 흰 종이 위 강조는 형광펜(--mark #ffe07a)
const Name: React.FC<{ ko: string; suf: string; lit: number }> = ({ ko, suf, lit }) => {
  if (!suf || !ko.endsWith(suf)) return <>{ko}</>;
  const head = ko.slice(0, ko.length - suf.length);
  return (
    <>
      {head}
      <span style={{ background: `linear-gradient(#ffe07a,#ffe07a) no-repeat 0 82%/${lit * 100}% 0.46em`, padding: '0 0.05em', margin: '0 -0.05em' }}>{suf}</span>
    </>
  );
};

// ── 답 카드(21.0초): 흰 종이(머리 줄만)가 올라와 앉고, 박마다 한 줄씩 영수증처럼 아래로 자란다 — 다 자란 카드가 처음부터 서 있으면 21~22.5초 다리를 가렸다(Fable v6 P2).
//    왼쪽은 다리 장난이 보이게 비운다
const Answers: React.FC = () => {
  const f = useCurrentFrame() + s(ANSWER_IN) - 6;
  const { fps } = useVideoConfig();
  // v10(Fable v9 P3): 내려앉을 때 13px 되튀던 것이 01행이 자라기 시작하는 21.17~21.29초와 겹쳐 되튐을 뺀다(감쇠 15 → 26)
  const land = spring({ frame: f - (s(ANSWER_IN) - 6), fps, config: { damping: 26, stiffness: 150, mass: 0.9 } });
  const lit = lerp(f, s(LESSON_IN) + 4, s(LESSON_IN) + 14, 0, 1);
  const L = LAYOUT.card;
  const gone = lerp(f, s(LAYOUT.cardsOut), s(LAYOUT.cardsOut) + 7, 0, 1, Easing.in(Easing.cubic));
  // 카드 높이 = 위아래 여백 48 + 머리 84 + 들어온 줄만큼(줄마다 그 줄의 스프링 몫) — 아래로 자라며 안은 잘린다
  const grown = PLACES.reduce((a, _, i) => a + L.row * Math.min(1, spring({ frame: f - (s(ANSWER_IN) + i * ROW_STEP) + 2, fps, config: { damping: 18, stiffness: 240, mass: 0.6 } })), 0);
  return (
    <div style={{ position: 'absolute', left: L.x, top: L.y, width: L.w, height: 48 + 84 + grown, overflow: 'hidden', boxSizing: 'border-box', padding: '26px 28px 22px', borderRadius: 30, background: C.paper,
      boxShadow: EDGE(3, 8), transform: `translate(${gone * 760}px, ${(1 - land) * 180}px) rotate(${(1 - land) * 4 + gone * 6}deg)`, opacity: Math.min(1, land * 1.8),
      transformOrigin: 'right bottom' }}>
      <div style={{ font: `500 24px/1 ${MONO}`, color: C.acc, letterSpacing: '0.02em' }}>ANSWERS</div>
      <div style={{ margin: '8px 0 14px', font: `800 38px/1 ${EN}`, letterSpacing: '-0.035em', color: C.ink, whiteSpace: 'nowrap' }}>How many did you get?</div>
      {PLACES.map((p, i) => {
        const at = s(ANSWER_IN) + i * ROW_STEP;
        const k = spring({ frame: f - at, fps, config: { damping: 15, stiffness: 260, mass: 0.55 } });
        const on = f >= at;
        // 장소 작은 그림(그 장소가 화면에 나온 순간) — 시험관 셋이 「이름과 풍경을 짝지을 수 없다」
        return (
          <div key={p.ko} style={{ display: 'flex', alignItems: 'center', height: L.row, opacity: on ? Math.min(1, k * 1.5) : 0,
            transform: `translateX(${(1 - k) * 26}px)` }}>
            <div style={{ width: 38, font: `700 25px/1 ${EN}`, fontVariantNumeric: 'tabular-nums', color: C.acc }}>{String(i + 1).padStart(2, '0')}</div>
            <Img src={staticFile(`clips/thumbs/t${String(i + 1).padStart(2, '0')}.jpg`)} style={{ width: L.thumb, height: L.thumb, borderRadius: 10, objectFit: 'cover',
              boxShadow: `0 0 0 2px ${C.ink}`, marginRight: 14 }} />
            <div>
              <div style={{ font: `800 37px/1.04 ${KO}`, letterSpacing: '-0.04em', color: C.ink }}><Name ko={p.ko} suf={p.suf} lit={lit} /></div>
              <div style={{ marginTop: 1, font: `600 26px/1.08 ${EN}`, letterSpacing: '-0.005em', color: '#4f535a' }}>{p.ro}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ── 이름 끝말(23.5초): 코랄 면 한 장 — 왼쪽 위 하늘 자리. 답 카드의 끝말 글자에 형광펜이 같이 그어진다
const Lesson: React.FC = () => {
  const f = useCurrentFrame() + s(LESSON_IN);
  const { fps } = useVideoConfig();
  const k = spring({ frame: f - s(LESSON_IN), fps, config: { damping: 14, stiffness: 170, mass: 0.8 } });
  const L = LAYOUT.lesson;
  const gone = lerp(f, s(LAYOUT.cardsOut), s(LAYOUT.cardsOut) + 7, 0, 1, Easing.in(Easing.cubic));
  return (
    <div style={{ position: 'absolute', left: L.x, top: L.y, width: L.w, padding: '22px 24px 14px', borderRadius: 26, background: C.field, boxShadow: EDGE(3, 7),
      transform: `translate(${-gone * 460}px, ${(1 - k) * 70}px) rotate(${(1 - k) * -3 - gone * 6}deg)`, opacity: Math.min(1, k * 1.8) }}>
      <div style={{ font: `500 24px/1.2 ${MONO}`, letterSpacing: '0.02em', color: C.onField, opacity: 0.8, marginBottom: 10 }}>NAME ENDINGS</div>
      {ENDINGS.map((e, i) => {
        const r = spring({ frame: f - s(LESSON_IN) - 4 - i * 3, fps, config: { damping: 16, stiffness: 230, mass: 0.6 } });
        return (
          <div key={e.ko} style={{ display: 'flex', alignItems: 'baseline', height: 52, opacity: Math.min(1, r * 1.5), transform: `translateX(${(1 - r) * -16}px)` }}>
            <span style={{ width: 128, font: `800 36px/1 ${KO}`, letterSpacing: '-0.03em', color: C.onField }}>
              -<span style={{ background: 'linear-gradient(#ffe07a,#ffe07a) no-repeat 0 82%/100% 0.46em', padding: '0 0.05em' }}>{e.ko}</span>
            </span>
            <span style={{ font: `700 30px/1 ${EN}`, letterSpacing: '-0.02em', color: C.onField }}>{e.en}</span>
          </div>
        );
      })}
    </div>
  );
};

// ── 보내기(28.0초 — 다리가 꽃 속으로 사라진 한 박 뒤)
const Cta: React.FC = () => {
  const f = useCurrentFrame() + s(CTA_IN);
  const { fps } = useVideoConfig();
  const k = spring({ frame: f - s(CTA_IN), fps, config: { damping: 12, stiffness: 210, mass: 0.7 } });
  const L = LAYOUT.cta;
  return (
    <div style={{ position: 'absolute', left: L.x, top: L.y, display: 'inline-flex', alignItems: 'center', gap: 18, padding: '18px 28px 20px', borderRadius: 24,
      background: C.onField, boxShadow: '0 16px 30px -14px rgba(0,0,0,.65)', font: `800 38px/1.12 ${EN}`, letterSpacing: '-0.025em', color: '#fff',
      opacity: Math.min(1, k * 1.5), transform: `scale(${0.84 + 0.16 * k})`, transformOrigin: 'left center', maxWidth: L.w }}>
      <span>Send this to your<br />Korea trip buddy</span>
      <span style={{ font: `800 46px/1 ${EN}`, color: C.field }}>→</span>
    </div>
  );
};

// 소리는 편집/소리편집.py가 곡 + 효과음을 표본 단위로 섞은 한 줄(mix.wav)이다. SFX는 Remotion에서 더 얹을 소리가 생길 때만 쓴다(지금은 비어 있음)
const Sound: React.FC = () => (
  <>
    <Audio src={staticFile('audio/mix.wav')} volume={1} />
    {SFX.map((x, i) => (
      <Sequence key={i} from={s(x.at)} durationInFrames={Math.max(1, s(x.len ?? 2))}>
        <Audio src={staticFile(`audio/${x.src}`)} volume={x.v} />
      </Sequence>
    ))}
  </>
);

export const Film: React.FC<{ withSound?: boolean }> = ({ withSound = true }) => (
  <AbsoluteFill style={{ background: '#000' }}>
    <OffthreadVideo src={staticFile('clips/base.mp4')} muted style={{ width: '100%', height: '100%' }} />
    <Sequence durationInFrames={s(HOOK_END)}>
      <Hook />
    </Sequence>
    <Sequence from={s(TAPE_IN)} durationInFrames={s(CAM_IN) - s(TAPE_IN)}>
      <TapeNote />
    </Sequence>
    <Sequence from={s(CAM_IN)} durationInFrames={s(CAM_OUT) - s(CAM_IN)}>
      <CamFrame />
    </Sequence>
    <Sequence from={s(COUNTER_IN)} durationInFrames={s(ANSWER_IN) - s(COUNTER_IN) + 4}>
      <Counter />
    </Sequence>
    <Sequence from={s(RACE_IN)} durationInFrames={s(RACE_OUT) - s(RACE_IN)}>
      <RaceChip />
    </Sequence>
    <Sequence from={s(COUNTER_IN)} durationInFrames={s(NAME_OUT) - s(COUNTER_IN)}>
      <NameChip />
    </Sequence>
    <Sequence from={s(FINISH_IN)} durationInFrames={s(ANSWER_IN) - s(FINISH_IN) + 2}>
      <FinishChip />
    </Sequence>
    <Sequence from={s(ANSWER_IN) - 6}>
      <Answers />
    </Sequence>
    <Sequence from={s(LESSON_IN)}>
      <Lesson />
    </Sequence>
    <Sequence from={s(CTA_IN)}>
      <Cta />
    </Sequence>
    {withSound && <Sound />}
  </AbsoluteFill>
);
