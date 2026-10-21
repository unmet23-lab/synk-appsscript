// yuhobuilds 「42초 중 24초가 멈춰 있었다」(10-21 둘째 편). 기획·콘티는 ../../기획.md. 움직임 문법은 같은 날 첫째 편(「트렌디하게」 편 p1)과 같다.
//  · 판(창) 자리는 한 편 내내 같고 내용은 컷. 판은 늘 천천히 밀린다(프레임마다 0.07%, 1.08에서 멈춤).
//  · 머리글은 줄 단위 올림 하나, 강조는 처음부터 칠한 낱말 하나(Type.tsx).
//  · 근거는 전부 실제: 음식 사진 편 고치기 전(v3 휴대폰판)·고친 뒤(공개 올림판) 화면, tools/정지구간.js와 같은 셈의 0.5초 칸 값·출력(측정칸.mjs).
//  · 띠에서 「거의 멈춘 칸」만 버터, 나머지는 회색 — 강조색은 한 뜻으로만.
import { Audio } from '@remotion/media';
import React from 'react';
import { AbsoluteFill, Freeze, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { BUTTER, Cursor, DIM, INK, STAGE } from '../film/parts';
import { EN, KO, MONO } from '../lib/fonts';
import { bezier, clamp, mix } from '../lib/motion';
import { PAPER, RULE, UI_INK, UI_MUTED } from '../day1/parts';
import { BINS, TERM, VOICE_ENV } from './bins.generated';
import { EndCard, END_FOLLOW } from './End';
import { at, lineEnd, ORDER, S, TOTAL, VO } from './time';
import { ease, EASE_MOVE, Line } from './Type';

// ───────────── 판(창) ─────────────
const VP = { x: 64, y: 600, w: 952, h: 680, r: 28 };
const W = VP.w;
const H = VP.h;
const FOOD_BG = '#3967C1'; // 음식 사진 편 바탕(재 본 값) — 판 안 영상 둘레
const BAR = 54;
const STILL = 0.15; // tools/정지구간.js 기준값

// ───────────── 판 안 영상 ─────────────
type Crop = { x: number; y: number; s: number };
const Clip: React.FC<{ src: string; from: number; sceneAt: number; crop: Crop; w?: number; h?: number; left?: number; top?: number; hold?: number; rate?: number; bg?: string }> = ({ src, from, sceneAt, crop, w = W, h = H, left = 0, top = 0, hold, rate = 1, bg = FOOD_BG }) => {
  const f = useCurrentFrame();
  const local = f - sceneAt;
  const video = (
    <OffthreadVideo
      src={staticFile(src)}
      trimBefore={Math.round(from * 30)}
      playbackRate={rate}
      muted
      style={{ position: 'absolute', left: (w - 1080 * crop.s) / 2 - crop.x * crop.s, top: -crop.y * crop.s, width: 1080 * crop.s, height: 1920 * crop.s }}
    />
  );
  const stop = hold === undefined ? Infinity : Math.round(hold * 30);
  return (
    <div style={{ position: 'absolute', left, top, width: w, height: h, overflow: 'hidden', background: bg }}>
      <Sequence from={sceneAt} layout="none">
        {local >= stop ? <Freeze frame={stop}>{video}</Freeze> : video}
      </Sequence>
    </div>
  );
};
const ClipBar: React.FC<{ text: string; right?: string }> = ({ text, right }) => (
  <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: BAR, background: '#1C1B19', borderBottom: '1px solid #2E2D2A' }}>
    <div style={{ position: 'absolute', left: 24, top: 21, width: 12, height: 12, borderRadius: 6, background: '#5A5852' }} />
    <div style={{ position: 'absolute', left: 48, top: 0, lineHeight: `${BAR}px`, fontFamily: KO, fontWeight: 620, fontSize: 24, color: '#B6B3AB', whiteSpace: 'nowrap' }}>{text}</div>
    {right ? <div style={{ position: 'absolute', right: 24, top: 0, lineHeight: `${BAR}px`, fontFamily: MONO, fontSize: 21, color: '#8E8B84' }}>{right}</div> : null}
  </div>
);

/** 지금 자리 표시: a에 6프레임 켜지고 b에 6프레임 꺼진다. */
const on = (f: number, a: number, b = Infinity) => ease(f, a, 6) * (b === Infinity ? 1 : 1 - ease(f, b, 6));
/** 지금 자리 테두리. 버터는 「거의 멈춘 칸」과 머리글 강조에만 쓰고, 테두리는 글색으로 그린다(dark: 어두운 판 위). */
const Ring: React.FC<{ k: number; r: number; pad?: number; dark?: boolean }> = ({ k, r, pad = 0, dark }) => {
  if (k <= 0) return null;
  const c = dark ? '244,242,236' : '34,33,30';
  return <div style={{ position: 'absolute', inset: -pad, borderRadius: r + pad, background: `rgba(${c},${0.06 * k})`, boxShadow: `inset 0 0 0 3px rgba(${c},${k})`, pointerEvents: 'none' }} />;
};

// ───────────── 0.5초 칸 띠 ─────────────
/** values: 칸 값. upto: 몇 칸까지 칠했나(재생 위치). dark: 어두운 판 위. */
const Strip: React.FC<{ values: readonly number[]; upto?: number; w: number; h: number; left: number; top: number; dark?: boolean; ring?: [number, number, number] }> = ({ values, upto = values.length, w, h, left, top, dark, ring }) => {
  const n = values.length;
  const gap = 2;
  const cw = (w - gap * (n - 1)) / n;
  const moving = dark ? '#4A4843' : '#CFCBC2';
  const empty = dark ? '#262521' : '#ECEAE4';
  return (
    <div style={{ position: 'absolute', left, top, width: w, height: h }}>
      {values.map((v, i) => (
        <div key={i} style={{ position: 'absolute', left: i * (cw + gap), top: 0, width: cw, height: h, borderRadius: 2, background: i < upto ? (v < STILL ? BUTTER : moving) : empty }} />
      ))}
      {ring && ring[2] > 0 ? (
        <div style={{ position: 'absolute', left: ring[0] * (cw + gap) - 6, top: -8, width: (ring[1] - ring[0]) * (cw + gap) - gap + 12, height: h + 16, borderRadius: 8, boxShadow: `0 0 0 3px rgba(${dark ? '244,242,236' : '34,33,30'},${ring[2]})` }} />
      ) : null}
    </div>
  );
};
const B = BINS.before.values;
const A = BINS.after.values;

// ───────────── 장면 ─────────────
/** 1. 고치기 전 판을 16배로 훑으며 띠가 찬다. */
const HOOK_RATE = 16;
const HookView: React.FC<{ f: number; sceneStart: number }> = ({ f, sceneStart }) => {
  const local = f - sceneStart;
  const sec = Math.min(42, (local / 30) * HOOK_RATE);
  const upto = Math.min(B.length, Math.floor(sec * 2) + 1);
  const still = B.slice(0, upto).filter((v) => v < STILL).length * 0.5;
  const top = BAR;
  const clipH = 470;
  return (
    <>
      <Clip src="clip/before.mp4" from={0} rate={HOOK_RATE} hold={42 / HOOK_RATE - 0.05} sceneAt={sceneStart} crop={{ x: 0, y: 250, s: 0.5 }} top={top} h={clipH} />
      <ClipBar text="고치기 전 · 42초를 16배로" right={`${sec.toFixed(1)}초`} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: top + clipH, bottom: 0, background: '#141412' }}>
        <Strip values={B} upto={upto} w={W - 64} h={56} left={32} top={30} dark />
        <div style={{ position: 'absolute', left: 32, top: 104, fontFamily: KO, fontWeight: 650, fontSize: 28, color: INK }}>
          거의 멈춤 <span style={{ fontFamily: EN, fontWeight: 700, color: BUTTER }}>{still.toFixed(1)}초</span>
        </div>
        <div style={{ position: 'absolute', right: 32, top: 108, fontFamily: KO, fontWeight: 560, fontSize: 23, color: '#8E8B84' }}>0.5초 칸 84개</div>
      </div>
    </>
  );
};

/** 2. 약속: 재는 법 · 기준 둘 · 고치는 셋(글은 가림). */
const PROMISE = [
  { t: '재는 법', s: 'AI한테 시킬 요청문 한 장' },
  { t: '기준 둘', s: '멈춘 시간 15% 이하 · 1.5초 넘는 정지 없게' },
  { t: '고치는 셋', s: '당기기 · 낱말마다 한 곳 · 빈 화면 없애기' },
] as const;
const CardHead: React.FC<{ save?: number }> = ({ save = 0 }) => (
  <>
    <div style={{ position: 'absolute', left: 38, top: 32, fontFamily: KO, fontWeight: 760, fontSize: 40, color: UI_INK, letterSpacing: '-0.03em' }}>멈춘 시간 점검</div>
    <div style={{ position: 'absolute', left: 40, top: 90, fontFamily: KO, fontWeight: 560, fontSize: 23, color: UI_MUTED }}>올리기 전에 한 번</div>
    <svg width={46} height={58} viewBox="0 0 46 58" style={{ position: 'absolute', right: 38, top: 34 }}>
      <path d="M5 4 Q5 2 7 2 L39 2 Q41 2 41 4 L41 54 L23 41 L5 54 Z" fill={save > 0.5 ? BUTTER : 'none'} stroke={save > 0.5 ? BUTTER : UI_INK} strokeWidth={3.5} strokeLinejoin="round" />
    </svg>
    <div style={{ position: 'absolute', left: 0, right: 0, top: 134, height: 1, background: RULE }} />
  </>
);
const PromiseCard: React.FC<{ f: number }> = ({ f }) => {
  const k = on(f, at('h2', '드릴') - 2);
  return (
    <>
      <CardHead />
      <div style={{ position: 'absolute', left: 16, right: 16, top: 150, height: 3 * 150 - 10 }}>
        <Ring k={k} r={18} />
      </div>
      {PROMISE.map((p, i) => (
        <div key={i} style={{ position: 'absolute', left: 40, right: 40, top: 168 + i * 150, height: 130 }}>
          <div style={{ fontFamily: KO, fontWeight: 740, fontSize: 40, color: UI_INK, letterSpacing: '-0.02em' }}>{p.t}</div>
          <div style={{ marginTop: 10, fontFamily: KO, fontWeight: 560, fontSize: 27, color: UI_MUTED, filter: 'blur(7px)', opacity: 0.8, whiteSpace: 'nowrap' }}>{p.s}</div>
          {i < 2 ? <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 1, background: RULE }} /> : null}
        </div>
      ))}
    </>
  );
};

/** 3. 터미널: 실제 도구 출력이 한 줄씩. */
const TerminalView: React.FC<{ f: number; sceneStart: number }> = ({ f, sceneStart }) => {
  const lines = TERM.before.lines;
  // 명령은 빨리 쳐지고(약 0.5초), 재는 동안 0.5초 칸 84개가 실제 값 색으로 차고, 출력이 한 줄씩 — 정지 구간 1차 렌더에서 7~9초가 멈춤으로 잡혀 바꿨다
  const typeAt = sceneStart + 3;
  const typed = Math.min(TERM.before.cmd.length, Math.max(0, Math.floor((f - typeAt) * 2.6)));
  const scanAt = typeAt + Math.ceil(TERM.before.cmd.length / 2.6) + 3;
  const scanLen = 24;
  const scanned = Math.max(0, Math.min(B.length, Math.floor(((f - scanAt) / scanLen) * B.length)));
  const outAt = scanAt + scanLen + 2;
  const step = 3;
  const sumK = on(f, at('b1', '쟀어요') - 2);
  return (
    <>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: BAR, background: '#1C1B19', borderBottom: '1px solid #2E2D2A' }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ position: 'absolute', left: 24 + i * 22, top: 21, width: 12, height: 12, borderRadius: 6, background: '#3E3C38' }} />
        ))}
        <div style={{ position: 'absolute', left: 110, top: 0, lineHeight: `${BAR}px`, fontFamily: KO, fontWeight: 620, fontSize: 24, color: '#B6B3AB' }}>터미널 · 실제 출력</div>
      </div>
      <div style={{ position: 'absolute', left: 32, top: BAR + 24, right: 32, fontFamily: MONO, fontSize: 25, lineHeight: 1.55, color: '#D9D6CE', whiteSpace: 'pre' }}>
        <div>
          <span style={{ color: '#8E8B84' }}>$ </span>
          {TERM.before.cmd.slice(0, typed)}
          {f < scanAt ? <span style={{ display: 'inline-block', width: 12, height: 26, background: '#D9D6CE', verticalAlign: 'middle', opacity: Math.floor(f / 8) % 2 }} /> : null}
        </div>
        {f >= scanAt ? (
          <div style={{ position: 'relative', height: 40, marginTop: 8 }}>
            <Strip values={B} upto={scanned} w={W - 64} h={26} left={0} top={6} dark />
          </div>
        ) : null}
        {lines.map((ln, i) => {
          if (f < outAt + i * step) return null;
          if (i === 0) {
            return (
              <div key={i} style={{ position: 'relative', marginTop: 10, marginBottom: 6, padding: '4px 10px', marginLeft: -10, whiteSpace: 'normal', fontFamily: KO, fontWeight: 650, fontSize: 28, lineHeight: 1.4, color: INK }}>
                <Ring k={sumK} r={10} dark />
                <span style={{ position: 'relative' }}>{ln}</span>
              </div>
            );
          }
          return (
            <div key={i} style={{ color: ln.includes('끝 화면') ? '#8E8B84' : '#D9D6CE' }}>
              {ln}
            </div>
          );
        })}
      </div>
    </>
  );
};

/** 4. 기준 둘: 57% 막대(15% 눈금) + 띠에서 6초 구간. */
const longest = (() => {
  let best: [number, number] = [0, 0];
  let s = -1;
  B.forEach((v, i) => {
    if (v < STILL) {
      if (s < 0) s = i;
      if (i + 1 - s > best[1] - best[0]) best = [s, i + 1];
    } else s = -1;
  });
  return best;
})();
const GaugeView: React.FC<{ f: number }> = ({ f }) => {
  const k15 = on(f, at('b2', '십오') - 2, at('b2', '일') - 2);
  const k6 = on(f, at('b2', '일') - 2);
  const ratio = BINS.before.still / BINS.before.length;
  const gw = W - 80;
  return (
    <>
      <div style={{ position: 'absolute', left: 38, top: 32, fontFamily: KO, fontWeight: 760, fontSize: 38, color: UI_INK, letterSpacing: '-0.03em' }}>제 기준 둘</div>
      <div style={{ position: 'absolute', left: 40, top: 86, fontFamily: KO, fontWeight: 560, fontSize: 23, color: UI_MUTED }}>고치기 전 판을 잰 값</div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 134, height: 1, background: RULE }} />
      {/* ① 합계 */}
      <div style={{ position: 'absolute', left: 40, top: 160, fontFamily: KO, fontWeight: 700, fontSize: 30, color: UI_INK }}>① 멈춘 시간 합 — 15% 아래</div>
      <div style={{ position: 'absolute', left: 40, top: 214, width: gw, height: 64, borderRadius: 14, background: '#ECEAE4', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: gw * ratio, background: BUTTER }} />
        <div style={{ position: 'absolute', left: 20, top: 0, lineHeight: '64px', fontFamily: EN, fontWeight: 700, fontSize: 34, color: '#141412' }}>{Math.round(ratio * 100)}%</div>
        <div style={{ position: 'absolute', left: gw * ratio + 16, top: 0, lineHeight: '64px', fontFamily: KO, fontWeight: 600, fontSize: 24, color: UI_MUTED }}>{BINS.before.still.toFixed(1)}초 / {BINS.before.length}초</div>
      </div>
      <div style={{ position: 'absolute', left: 40 + gw * 0.15 - 2, top: 200, width: 4, height: 92, borderRadius: 2, background: UI_INK }} />
      <div style={{ position: 'absolute', left: 40 + gw * 0.15 - 60, top: 296, width: 120, textAlign: 'center', padding: '2px 0', fontFamily: KO, fontWeight: 700, fontSize: 24, color: UI_INK }}>
        <Ring k={k15} r={10} />
        기준 15%
      </div>
      {/* ② 가장 긴 정지 */}
      <div style={{ position: 'absolute', left: 40, top: 380, fontFamily: KO, fontWeight: 700, fontSize: 30, color: UI_INK }}>② 한 번에 1.5초 넘게 멈춤 — 없게</div>
      <Strip values={B} w={gw} h={64} left={40} top={444} ring={[longest[0], longest[1], k6]} />
      <div style={{ position: 'absolute', left: 40 + (longest[0] / B.length) * gw - 20, top: 532, fontFamily: KO, fontWeight: 700, fontSize: 26, color: UI_INK, opacity: Math.max(0.35, k6) }}>
        {((longest[1] - longest[0]) / 2).toFixed(1)}초 그대로
      </div>
      <div style={{ position: 'absolute', left: 40, top: 600, fontFamily: KO, fontWeight: 560, fontSize: 22, color: UI_MUTED }}>노랑 = 거의 멈춘 0.5초 칸</div>
    </>
  );
};

/** 5. 멈춘 화면 + 흐르는 목소리. */
const WAVE_N = 46;
const FreezeVoice: React.FC<{ f: number }> = ({ f }) => {
  const local = f - VO.b3;
  const level = (i: number) => {
    const idx = local - (WAVE_N - 1 - i);
    if (idx < 0 || idx >= VOICE_ENV.length) return 0;
    return Math.max(0, Math.min(1, (VOICE_ENV[idx] + 50) / 38));
  };
  return (
    <>
      <Clip src="clip/before.mp4" from={26.0} hold={0} sceneAt={VO.b3 - 2} crop={{ x: 0, y: 330, s: 0.62 }} top={BAR} h={H - BAR - 150} />
      <ClipBar text="고치기 전 · 24.5~30.5초 · 거의 멈춤 6.0초" />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 150, background: '#141412' }}>
        <div style={{ position: 'absolute', left: 32, top: 22, fontFamily: KO, fontWeight: 620, fontSize: 24, color: '#B6B3AB' }}>목소리</div>
        <div style={{ position: 'absolute', left: 32, right: 32, top: 60, height: 70, display: 'flex', alignItems: 'center', gap: 6 }}>
          {Array.from({ length: WAVE_N }, (_, i) => (
            <div key={i} style={{ flex: 1, height: Math.max(4, 70 * level(i)), borderRadius: 3, background: '#D9D6CE' }} />
          ))}
        </div>
      </div>
    </>
  );
};

/** 6·7. 전·후 나란히(같은 순간). */
const Pair: React.FC<{ f: number; sceneStart: number; from: number; label: string; kAt: number }> = ({ f, sceneStart, from, label, kAt }) => {
  const half = W / 2;
  const k = on(f, kAt - 2);
  const crop: Crop = { x: 0, y: 300, s: 0.44 };
  const tag = (text: string, good: boolean): React.ReactNode => (
    <div style={{ position: 'absolute', bottom: 16, left: 14, padding: '5px 14px', borderRadius: 12, background: good && k > 0.5 ? INK : '#1C1B19', color: good && k > 0.5 ? '#141412' : INK, fontFamily: KO, fontWeight: 700, fontSize: 24 }}>{text}</div>
  );
  return (
    <>
      <div style={{ position: 'absolute', left: 0, top: 0, width: half - 1, height: H, overflow: 'hidden' }}>
        <Clip src="clip/before.mp4" from={from} sceneAt={sceneStart} crop={crop} w={half - 1} top={BAR} h={H - BAR} />
        {tag('전', false)}
      </div>
      <div style={{ position: 'absolute', left: half - 1, top: BAR, width: 2, height: H - BAR, background: '#1C1B19' }} />
      <div style={{ position: 'absolute', left: half + 1, top: 0, width: half - 1, height: H, overflow: 'hidden' }}>
        <Clip src="clip/after.mp4" from={from} sceneAt={sceneStart} crop={crop} w={half - 1} top={BAR} h={H - BAR} />
        {tag('후', true)}
        <div style={{ position: 'absolute', left: 0, right: 0, top: BAR, bottom: 0 }}>
          <Ring k={k} r={0} dark />
        </div>
      </div>
      <ClipBar text={label} />
    </>
  );
};

/** 9. 띠 둘: 전 24초 · 후 2초. */
const TwoStrips: React.FC<{ f: number }> = ({ f }) => {
  const two = at('b5', '이', 7); // 「이 초가」(앞의 「이십사」 다음 낱말부터 찾는다)
  const kB = on(f, at('b5', '이십사') - 2, two - 2);
  const kA = on(f, two - 2);
  const gw = W - 80;
  const row = (title: string, values: readonly number[], still: number, top: number, k: number) => (
    <div style={{ position: 'absolute', left: 40, top, width: gw, height: 200 }}>
      <div style={{ fontFamily: KO, fontWeight: 700, fontSize: 30, color: UI_INK }}>{title}</div>
      <Strip values={values} w={gw} h={70} left={0} top={58} />
      <div style={{ position: 'absolute', left: -10, top: 146, padding: '2px 10px', fontFamily: KO, fontWeight: 650, fontSize: 28, color: UI_INK }}>
        <Ring k={k} r={10} />
        거의 멈춤 <span style={{ fontFamily: EN, fontWeight: 700 }}>{still.toFixed(1)}초</span>
        <span style={{ color: UI_MUTED, fontWeight: 560, fontSize: 24 }}> · {Math.round((still / 42) * 100)}%</span>
      </div>
    </div>
  );
  return (
    <>
      <div style={{ position: 'absolute', left: 38, top: 32, fontFamily: KO, fontWeight: 760, fontSize: 38, color: UI_INK, letterSpacing: '-0.03em' }}>같은 말 · 같은 42초</div>
      <div style={{ position: 'absolute', left: 40, top: 86, fontFamily: KO, fontWeight: 560, fontSize: 23, color: UI_MUTED }}>노랑 = 거의 멈춘 0.5초 칸</div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 134, height: 1, background: RULE }} />
      {row('고치기 전', B, BINS.before.still, 166, kB)}
      {row('고친 뒤', A, BINS.after.still, 400, kA)}
    </>
  );
};

/** 10~11. 요청문: 입력창에 쳐지고 → 보냄 → 카드. */
// 도구(tools/정지구간.js)의 셈 그대로 — 기준값·단위·크기를 다 적어야 어느 AI에 붙여도 같은 %가 나온다(Opus 완성본 검수 P1-2).
export const REQUEST = "이 영상을 가로 270픽셀로 줄인 뒤, 프레임마다 앞 프레임과의 픽셀 밝기 차이(0~255)를 평균 내 줘. 그 값을 0.5초 칸마다 다시 평균 내고, 0.15보다 작은 칸을 '거의 멈춤'으로 봐 줘. 거의 멈춘 칸이 이어지는 구간을 표로 보여 주고, 전체에서 그 시간이 몇 %인지, 1.5초 넘는 구간이 어디인지 알려 줘. 끝 화면은 따로 표시해 줘.";
const TYPE_CPS = 2.8; // 프레임당 글자(약 84자/초)
const RequestView: React.FC<{ f: number; sceneStart: number }> = ({ f, sceneStart }) => {
  const n = Math.max(0, Math.min(REQUEST.length, Math.floor((f - sceneStart - 6) * TYPE_CPS)));
  const done = n >= REQUEST.length;
  const doneAt = sceneStart + 6 + Math.ceil(REQUEST.length / TYPE_CPS);
  const sent = f >= doneAt + 8;
  const save = ease(f, SAVE_AT + 1, 5);
  return (
    <>
      <CardHead save={save} />
      <div style={{ position: 'absolute', left: 40, top: 160, fontFamily: KO, fontWeight: 700, fontSize: 28, color: UI_INK }}>① 재는 법 — 영상 파일을 열 수 있는 AI한테</div>
      <div style={{ position: 'absolute', left: 32, right: 32, top: 206, height: 276, wordBreak: 'keep-all', borderRadius: 20, background: sent ? '#2B2A26' : '#FFFFFF', boxShadow: sent ? undefined : `inset 0 0 0 1.5px ${RULE}`, padding: '18px 24px', fontFamily: KO, fontWeight: 560, fontSize: 29, lineHeight: 1.45, color: sent ? '#F4F2EC' : UI_INK, letterSpacing: '-0.01em' }}>
        {REQUEST.slice(0, n)}
        {!done ? <span style={{ display: 'inline-block', width: 3, height: 30, background: UI_INK, verticalAlign: 'middle', marginLeft: 2 }} /> : null}
      </div>
      <div style={{ position: 'absolute', left: 40, top: 512, fontFamily: KO, fontWeight: 700, fontSize: 26, color: UI_INK, opacity: ease(f, doneAt + 4, 8) }}>② 기준 — 멈춘 시간 15% 이하 · 끝 화면 말고 1.5초 넘는 정지 없게</div>
      <div style={{ position: 'absolute', left: 40, top: 562, fontFamily: KO, fontWeight: 700, fontSize: 26, color: UI_INK, opacity: ease(f, doneAt + 10, 8) }}>③ 고치기 — 당기기 · 낱말마다 한 곳 · 빈 화면 없애기</div>
    </>
  );
};
const SAVE_AT = VO.cta + 2;
const SAVE_XY: [number, number] = [893, 64];
const CursorLayer: React.FC<{ f: number }> = ({ f }) => {
  const s0 = SAVE_AT - 17;
  if (f < s0 - 4 || f > SAVE_AT + 16) return null;
  const from: [number, number] = [700, 380];
  const t = ease(f, s0, SAVE_AT - 1 - s0, EASE_MOVE);
  const mid: [number, number] = [mix(from[0], SAVE_XY[0], 0.5) + 70, mix(from[1], SAVE_XY[1], 0.5) + 50];
  const [cx, cy] = bezier(from, mid, SAVE_XY, t);
  const press = interpolate(f, [SAVE_AT - 2, SAVE_AT, SAVE_AT + 4], [0, 1, 0], clamp);
  const o = ease(f, s0 - 4, 5) * (1 - ease(f, SAVE_AT + 8, 6));
  const r = interpolate(f, [SAVE_AT, SAVE_AT + 12], [0, 1], clamp);
  return (
    <>
      {r > 0 && r < 1 ? <div style={{ position: 'absolute', left: SAVE_XY[0] - 10 - 46 * r, top: SAVE_XY[1] - 10 - 46 * r, width: 20 + 92 * r, height: 20 + 92 * r, borderRadius: '50%', border: '3px solid rgba(17,17,17,0.45)', opacity: 1 - r }} /> : null}
      <Cursor x={cx} y={cy} press={press} ring={0} opacity={o} />
    </>
  );
};

// ───────────── 장면표 ─────────────
type K = 'hook' | 'promise' | 'term' | 'gauge' | 'freeze' | 'f1' | 'f2' | 'f3' | 'two' | 'req';
type Scene = { k: K; at: number; bg: string; o: [number, number] };
const SCENES: Scene[] = [
  { k: 'hook', at: 0, bg: '#141412', o: [476, 200] },
  { k: 'promise', at: VO.h2 - 2, bg: PAPER, o: [476, 300] },
  { k: 'term', at: VO.b1 - 2, bg: '#141412', o: [300, 300] },
  { k: 'gauge', at: VO.b2 - 2, bg: PAPER, o: [300, 300] },
  { k: 'freeze', at: VO.b3 - 2, bg: '#141412', o: [476, 300] },
  { k: 'f1', at: VO.f1 - 2, bg: '#141412', o: [700, 340] },
  { k: 'f2', at: VO.f2 - 2, bg: '#141412', o: [700, 340] },
  { k: 'f3', at: VO.f3 - 2, bg: '#141412', o: [700, 340] },
  { k: 'two', at: VO.b5 - 2, bg: PAPER, o: [476, 400] },
  { k: 'req', at: VO.c0 - 2, bg: PAPER, o: [476, 300] },
];
const sceneAt = (f: number) => {
  let i = 0;
  for (let j = 0; j < SCENES.length; j++) if (f >= SCENES[j].at) i = j;
  return i;
};

const Content: React.FC<{ k: K; f: number; sceneStart: number }> = ({ k, f, sceneStart }) => {
  switch (k) {
    case 'hook':
      return <HookView f={f} sceneStart={sceneStart} />;
    case 'promise':
      return <PromiseCard f={f} />;
    case 'term':
      return <TerminalView f={f} sceneStart={sceneStart} />;
    case 'gauge':
      return <GaugeView f={f} />;
    case 'freeze':
      return <FreezeVoice f={f} />;
    case 'f1':
      // 06 「결과 1」(20.1초~): 전은 사진이 그대로, 후는 같은 사진이 천천히 당겨진다(Opus 완성본 검수 P1-1 — 12.6초에서 시작하면 1.4초 뒤 요청문 장면으로 넘어갔다)
      return <Pair f={f} sceneStart={sceneStart} from={20.1} label="음식 사진 편 · 같은 순간" kAt={at('f1', '당기기')} />;
    case 'f2':
      // 07 「확인 셋」: 전은 작은 칸 셋이 그대로, 후는 「양」·「재료」·「색」마다 그 자리로 당겨 들어간다
      return <Pair f={f} sceneStart={sceneStart} from={24.6} label="음식 사진 편 · 같은 순간" kAt={at('f2', '한')} />;
    case 'f3':
      // 전은 11.6~11.9초에 글자 없는 파란 화면, 후는 같은 순간 이미 「만들지 말고,」와 사진(Opus 완성본 검수 P2-2)
      return <Pair f={f} sceneStart={sceneStart} from={10.6} label="음식 사진 편 · 장면 사이" kAt={at('f3', '빈')} />;
    case 'two':
      return <TwoStrips f={f} />;
    case 'req':
      return <RequestView f={f} sceneStart={sceneStart} />;
    default:
      return null;
  }
};

// ───────────── 판 + 밀기 ─────────────
const push = (f: number, i: number) => {
  const cap = SCENES[i].k === 'req' ? 0.12 : 0.08; // 요청문 장면은 길어 1.08에 닿은 뒤 1.5초 멈췄다(Opus 완성본 검수 P3)
  const drift = Math.min(cap, 0.0007 * Math.max(0, f - SCENES[i].at));
  const punch = interpolate(f - SAVE_AT, [0, 3, 10], [0, 0.015, 0], clamp);
  return 1 + drift + punch;
};
const Panel: React.FC = () => {
  const f = useCurrentFrame();
  const i = sceneAt(f);
  const sc = SCENES[i];
  const p = push(f, i);
  const fadeOut = 1 - ease(f, S.end - 8, 8);
  if (fadeOut <= 0) return null;
  const dark = sc.bg !== PAPER;
  return (
    <div
      style={{
        position: 'absolute',
        left: VP.x,
        top: VP.y,
        width: W,
        height: H,
        borderRadius: VP.r,
        overflow: 'hidden',
        background: sc.bg,
        boxShadow: dark ? '0 0 0 1.5px rgba(255,255,255,0.16), 0 26px 70px rgba(0,0,0,0.5)' : '0 0 0 1px rgba(255,255,255,0.07), 0 26px 70px rgba(0,0,0,0.5)',
        opacity: fadeOut,
        transform: `scale(${p})`,
        transformOrigin: `${sc.o[0]}px ${sc.o[1]}px`,
      }}
    >
      <Content k={sc.k} f={f} sceneStart={sc.at} />
      {sc.k === 'req' ? <CursorLayer f={f} /> : null}
    </div>
  );
};

// ───────────── 머리글 ─────────────
type Head = { at: number; lines: string[]; accent?: string; size?: number };
const HEADS = (): Head[] => [
  { at: -1, lines: ['42초 쇼츠를 재 보니,', '24초가 멈춰 있었어요'], accent: '24초가', size: 74 },
  { at: VO.h2 - 3, lines: ['멈춘 시간 재는 법,', '고치는 셋까지'], accent: '재는 법' },
  { at: VO.b1 - 3, lines: ['0.5초마다', '화면 변화를 쟀어요'], accent: '0.5초마다' },
  { at: VO.b2 - 3, lines: ['기준 둘: 15% 아래,', '1.5초 넘는 정지 없게'], accent: '15%', size: 74 },
  { at: VO.b3 - 3, lines: ['만들 땐 몰라요,', '목소리가 계속 나오니까'], accent: '몰라요', size: 74 },
  { at: VO.f1 - 3, lines: ['하나, 멈춘 사진은', '천천히 당기기'], accent: '당기기' },
  { at: VO.f2 - 3, lines: ['둘, 말하는 낱말마다', '화면 한 곳'], accent: '한 곳' },
  { at: VO.f3 - 3, lines: ['셋, 장면 사이', '빈 화면 없애기'], accent: '없애기' },
  { at: VO.b5 - 3, lines: ['같은 말, 같은 길이,', '24초에서 2.5초로'], accent: '2.5초로' },
  { at: VO.c0 - 3, lines: ['재는 건', 'AI한테 이렇게'], accent: '이렇게' },
  { at: VO.cta - 3, lines: ['저장해 두고', '올리기 전에 한 번'], accent: '저장해' },
];
const Heads: React.FC = () => {
  const hs = HEADS();
  return (
    <>
      {hs.map((h, i) => (
        <Line key={i} lines={h.lines} accent={h.accent} at={h.at} until={i + 1 < hs.length ? hs[i + 1].at : S.end} fade={i + 1 === hs.length} size={h.size} />
      ))}
    </>
  );
};

// ───────────── 판 아래 표시 ─────────────
const LABEL: Record<K, string> = {
  hook: '끝에 재는 법·고치는 셋을 드려요',
  promise: '끝에 드리는 한 장',
  term: '실제 도구 출력',
  gauge: '실제 잰 값',
  freeze: '목소리는 흐르는데 화면은 그대로',
  f1: '왼쪽 고치기 전 · 오른쪽 고친 뒤',
  f2: '왼쪽 고치기 전 · 오른쪽 고친 뒤',
  f3: '왼쪽 고치기 전 · 오른쪽 고친 뒤',
  two: '같은 도구로 잰 값',
  req: '저장해 두고 그대로 붙여 넣기',
};
const Label: React.FC = () => {
  const f = useCurrentFrame();
  const o = 1 - ease(f, S.end - 8, 8);
  if (o <= 0) return null;
  const k = SCENES[sceneAt(f)].k;
  return <div style={{ position: 'absolute', left: 72, top: VP.y + VP.h + 64, fontFamily: KO, fontWeight: 560, fontSize: 25, letterSpacing: '-0.01em', color: DIM, opacity: o }}>{LABEL[k]}</div>;
};

// ───────────── 소리 ─────────────
type Hit = { at: number; src: string; v: number };
const hits = (): Hit[] => [
  { at: SAVE_AT, src: 'sfx/tok.wav', v: 0.3 },
  { at: END_FOLLOW, src: 'sfx/tok.wav', v: 0.42 },
];

export const StillFilm: React.FC<{ bgm?: boolean }> = ({ bgm = true }) => {
  const ranges = ORDER.map((id) => [VO[id], lineEnd(id)] as [number, number])
    .sort((p, q) => p[0] - q[0])
    .reduce<[number, number][]>((acc, [a, b]) => {
      const last = acc[acc.length - 1];
      if (last && a - last[1] < 20) last[1] = Math.max(last[1], b);
      else acc.push([a, b]);
      return acc;
    }, []);
  const bgmVolume = (fr: number) => {
    const tail = Math.min(1, (TOTAL - fr) / 20);
    const voice = Math.max(0, ...ranges.map(([a, b]) => interpolate(fr, [a - 10, a, b, b + 10], [0, 1, 1, 0], clamp)));
    return (0.42 - 0.14 * voice) * tail;
  };
  return (
    <AbsoluteFill style={{ background: STAGE }}>
      <Panel />
      <Label />
      <Heads />
      <EndGate />
      {ORDER.map((id) => (
        <Sequence key={id} from={VO[id]} layout="none">
          <Audio src={staticFile(`vo/${id}.wav`)} />
        </Sequence>
      ))}
      {hits().map((x, i) => (
        <Sequence key={i} from={x.at} durationInFrames={60} layout="none">
          <Audio src={staticFile(x.src)} volume={x.v} />
        </Sequence>
      ))}
      {bgm ? <Audio src={staticFile('bgm_cut.wav')} volume={bgmVolume} /> : null}
    </AbsoluteFill>
  );
};

const EndGate: React.FC = () => {
  const f = useCurrentFrame();
  if (f < S.end) return null;
  return (
    <AbsoluteFill style={{ opacity: ease(f, S.end, 8) }}>
      <EndCard />
    </AbsoluteFill>
  );
};
