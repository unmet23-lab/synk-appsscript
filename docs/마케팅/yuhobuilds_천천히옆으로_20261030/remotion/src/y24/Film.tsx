// yuhobuilds Y24(10-30) 「AI 영상한테 '조금만 옆으로' 시켰더니 사진에 없던 집 — 카메라는 고정, 움직임은 편집에서」.
// 원본 wS9rrwRImTg(38.9초) 뼈대: 흔한 방식에 빨간 ✕ → 출처 화면 → 방법 화면 → 이름 공개 → 큰 숫자 → 하나씩 쌓이는 설명 → 도형 →
// 실제 결과 → 첫 지시를 다시 꺼내 줄 긋기(반전) → 얻는 것 → 끝. 진행자 얼굴 자리는 우리 실제 영상으로 바꿨다.
// 영상 두 판(public/clip)은 제미나이 앱 「동영상 만들기」가 실제로 낸 것 그대로, 흰 선 · 붉은 덮개는 ../../사진밖재기.py가 잰 테두리(data.generated).
// 무대는 지난 편들(Y23 붉은 기 검정 잠금 화면 · 색 판 자막, Y19 · Y9 채팅 말풍선 · 흰 자막창)과 다르게: 지시는 채팅 말풍선이 아니라 촬영 슬레이트,
// 밝은 회청색 판 위 머리글 + 붉은 상자 · 검정 영상 판 · 판 없는 큰 자막.
// r5(10-30): r4 시험 — 세 시험관이 같이 짚은 「3%와 5분의 1」 → 같은 단위 「3% → 17%」, 첫 2초에 결과(볼 이유 심사), 채팅 글씨 작음 → 확대,
// 도식 작음 → 띠 하나로 크게, 드롭다운 같은 칩 → 체크 목록, 18~28초 같은 사진만 → 결과를 위아래 비교로, 끝은 기와집을 크게.
import React from 'react';
import { Audio } from '@remotion/media';
import { AbsoluteFill, Img, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from '../lib/fonts';
import { clamp, IN_OUT, mix, prog as ease } from '../lib/motion';
import { QUADS } from './data.generated';
import { at, B, lineEnd, ORDER, TOTAL, VO, words, type Spoken } from './time';

const MASTER = 0.8;
const LIGHT = '#E9EEF3';
const INK = '#14171C';
const BLACK = '#0B0C0F';
const SLATE = '#1B1E24';
const BLUE = '#2F6BFF';
const BLUE_T = '#5B8CFF';
const RED = '#F0453A';
const GREEN = '#17A974';
const AMBER = '#FFC24B';
const WHITE = '#FFFFFF';

/** 영상 판 자리(16:9, 화면 폭 그대로). */
const PY = 560;
const PW = 1080;
const PH = 608;
/** V1 끝(사진 밖이 가장 넓은 때). */
const T_END = 9.95;

// ───────────── 공용 ─────────────
const Scene: React.FC<{ a: number; b: number; zoom?: number; children: React.ReactNode }> = ({ a, b, zoom = 0.0006, children }) => {
  const f = useCurrentFrame();
  if (f < a || f >= b) return null;
  const k = f - a;
  return <div style={{ position: 'absolute', inset: 0, transform: `scale(${1 + zoom * k})`, transformOrigin: '50% 45%' }}>{children}</div>;
};

/** 밀어 넘김: a부터 len 동안 오른쪽에서 들어오며 가로 번짐. */
const whipIn = (f: number, a: number, len = 6) => {
  const p = ease(f, a, len);
  return { transform: `translateX(${mix(420, 0, p)}px)`, filter: `blur(${mix(18, 0, p)}px)`, opacity: mix(0.2, 1, p) };
};

/** V1(24fps) 시각 → 넣은 사진 테두리. */
const quadAt = (t: number) => QUADS[Math.max(0, Math.min(QUADS.length - 1, Math.round(t * 24)))];

/** 넣은 사진 테두리: 흰 선 + 밖은 붉게(red 0~1). */
const Edge: React.FC<{ t: number; red: number; line?: number; w?: number; h?: number }> = ({ t, red, line = 1, w = PW, h = PH }) => {
  const q = quadAt(t).map(([x, y]) => [x * w, y * h] as const);
  const poly = q.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const path = `M-4,-4 H${w + 4} V${h + 4} H-4 Z M${q.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L')} Z`;
  return (
    <svg width={w} height={h} style={{ position: 'absolute', left: 0, top: 0 }}>
      <path d={path} fill={`rgba(232,52,44,${0.5 * red})`} fillRule="evenodd" />
      <polygon points={poly} fill="none" stroke={WHITE} strokeWidth={Math.max(4, (6 * w) / PW)} opacity={line} />
    </svg>
  );
};

/** V1을 판 크기(w×h)로 — t0초부터 rate배로, 테두리 · 붉은 덮개 · (선택) 오른쪽 확대. */
const V1Panel: React.FC<{ from: number; t0?: number; rate: number; w?: number; h?: number; red?: number; zoom?: number }> = ({ from, t0 = 0, rate, w = PW, h = PH, red = 0.75, zoom = 1 }) => {
  const f = useCurrentFrame();
  const t = Math.min(T_END, t0 + ((f - from) * rate) / 30);
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${zoom})`, transformOrigin: '100% 45%' }}>
        <Sequence from={from} layout="none">
          <OffthreadVideo src={staticFile('clip/V1.mp4')} muted playbackRate={rate} trimBefore={Math.round(t0 * 30)} style={{ width: w, height: h }} />
        </Sequence>
        <Edge t={t} red={red} w={w} h={h} />
      </div>
    </div>
  );
};

/** 판 위 짧은 글(칩). */
const Chip: React.FC<{ text: string; bg?: string; fg?: string; size?: number }> = ({ text, bg = WHITE, fg = INK, size = 40 }) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', padding: `${size * 0.34}px ${size * 0.6}px`, borderRadius: size * 0.5, background: bg, color: fg, fontFamily: KO, fontWeight: 800, fontSize: size, letterSpacing: '-0.02em', whiteSpace: 'nowrap', boxShadow: '0 10px 28px rgba(0,0,0,0.22)' }}>
    {text}
  </div>
);

/** 촬영 슬레이트 — 영상 AI에 준 지시(채팅 말풍선 대신). rows: [이름, 값], show: 줄마다 0~1. */
const Slate: React.FC<{ rows: [string, string][]; show?: number[]; dim?: number; width?: number }> = ({ rows, show, dim = 0, width = 900 }) => (
  <div style={{ width, borderRadius: 22, overflow: 'hidden', background: SLATE, boxShadow: '0 18px 44px rgba(10,14,22,0.28)', opacity: mix(1, 0.6, dim) }}>
    <div style={{ height: 46, background: 'repeating-linear-gradient(120deg, #F4F5F7 0 38px, #1B1E24 38px 76px)' }} />
    <div style={{ padding: '22px 34px 28px', fontFamily: KO }}>
      <div style={{ fontWeight: 800, fontSize: 26, color: '#8E96A3', letterSpacing: '0.12em' }}>영상 AI에 준 지시</div>
      {rows.map(([k, v], i) => (
        <div key={i} style={{ display: 'flex', gap: 22, marginTop: 14, alignItems: 'baseline', opacity: show ? show[i] : 1, transform: `translateY(${mix(10, 0, show ? show[i] : 1)}px)` }}>
          <div style={{ width: 120, flexShrink: 0, fontWeight: 800, fontSize: 32, color: BLUE_T }}>{k}</div>
          <div style={{ fontWeight: 800, fontSize: 42, lineHeight: 1.3, color: WHITE, letterSpacing: '-0.02em', wordBreak: 'keep-all' }}>{v}</div>
        </div>
      ))}
    </div>
  </div>
);
const ASKED: [string, string][] = [['카메라', '아주 천천히 오른쪽으로, 조금만(화면 폭의 3%)']];
const FIXED: [string, string][] = [
  ['카메라', '완전히 고정, 전혀 안 움직임'],
  ['움직임', '감나무 잎만 바람에 살짝'],
];

const Cross: React.FC<{ p: number; size?: number }> = ({ p, size = 120 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ transform: `scale(${mix(1.6, 1, p)})`, opacity: p }}>
    <circle cx="50" cy="50" r="44" fill={WHITE} stroke={RED} strokeWidth="8" />
    <path d="M32 32 68 68 M68 32 32 68" stroke={RED} strokeWidth="9" strokeLinecap="round" />
  </svg>
);

// ───────────── 장면 ─────────────
/** 0~2.4초 — 지시 슬레이트 + 빨간 ✕, 아래는 그 지시로 나온 영상(오른쪽 끝이 붉어지기 시작), 1.4초 붉은 도장 「없던 집을 지었다」.
 *  r6: 머리글 + 강조 상자는 haiku가 r5에 「지난 편과 같은 머리 글」, 집을 첫 화면에 다 보이면 공개가 맥 빠진다(볼 이유 심사 r5) — 도장으로 약속만. */
const Hook: React.FC = () => {
  const f = useCurrentFrame();
  const ps = ease(f, B.bubble, 8);
  const px = ease(f, B.cross, 6);
  const dim = 0.5 * ease(f, B.dim, 20);
  const st = ease(f, B.bubble, 10);
  return (
    <AbsoluteFill style={{ background: LIGHT }}>
      <div style={{ position: 'absolute', top: 300, left: 90, opacity: ps, transform: `translateY(${mix(26, 0, ps)}px)` }}>
        <Slate rows={ASKED} dim={dim} />
        <div style={{ position: 'absolute', right: -40, top: -40 }}>
          <Cross p={px} />
        </div>
      </div>
      <div style={{ position: 'absolute', left: 0, top: 690, width: PW, height: PH, overflow: 'hidden' }}>
        <V1Panel from={0} t0={9.3} rate={0.25} red={0.35} zoom={1.45} />
        <svg width={PW} height={PH} style={{ position: 'absolute', left: 0, top: 0 }}>
          <ellipse cx={930} cy={300} rx={140} ry={250} fill="none" stroke={WHITE} strokeWidth={8} strokeDasharray={1400} strokeDashoffset={1400 * (1 - ease(f, B.cross, 12))} />
        </svg>
      </div>
      <div style={{ position: 'absolute', top: 1150, left: 120, opacity: st, transform: `rotate(-5deg) scale(${mix(1.5, 1, st)})`, transformOrigin: '0% 50%' }}>
        <div style={{ padding: '10px 28px 14px', border: `8px solid ${RED}`, borderRadius: 14, color: RED, background: 'rgba(255,255,255,0.92)', fontFamily: KO, fontWeight: 900, fontSize: 64, letterSpacing: '-0.03em' }}>없던 집을 지었다</div>
      </div>
    </AbsoluteFill>
  );
};

/** 2.4~4.7초 — 실제 요청 화면 한 컷 그대로(원본 출처 화면) + 그 아래 그 요청으로 나온 실제 영상을 크게.
 *  r7: 작은 채팅 화면만 2초 넘게 두면 넘긴다(r4~r6 시험관 셋 · 볼 이유 심사 「3초 안에 실제 결과를 화면 가득」). */
const REAL_RATE = 1.5;
const Real: React.FC = () => {
  const f = useCurrentFrame();
  const call = ease(f, B.real, 8);
  return (
    <AbsoluteFill style={{ background: BLACK }}>
      <div style={{ position: 'absolute', top: 272, left: 64, opacity: ease(f, B.real, 6) }}>
        <Chip text="제가 실제로 보낸 요청" bg="rgba(255,255,255,0.14)" fg="#E3E6EA" size={34} />
      </div>
      <div style={{ position: 'absolute', left: 160, top: 350, width: 760, ...whipIn(f, B.real) }}>
        <Img src={staticFile('real/V1요청.png')} style={{ width: 760, borderRadius: 22, display: 'block' }} />
        <div style={{ position: 'absolute', left: 14, top: 187, width: 719, height: 131, borderRadius: 50, border: `5px solid ${BLUE_T}`, opacity: call }} />
      </div>
      <div style={{ position: 'absolute', left: 60, top: 700, width: 960, height: 540, borderRadius: 10, overflow: 'hidden', opacity: ease(f, B.real, 6) }}>
        <V1Panel from={B.real} rate={REAL_RATE} red={0} w={960} h={540} />
      </div>
    </AbsoluteFill>
  );
};

/** 4.7~9.1초 — V1을 빨리 감아 돌리고, 흰 선(넣은 사진 끝)이 안으로 들어온다(원본 저장소 화면 · 6.2초 컷). */
/** Real이 B.real부터 REAL_RATE로 돌린 자리에서 이어, B.whip2까지 V1 끝(9.9초)에 닿게. */
const T_PLAY0 = ((B.whip - B.real) * REAL_RATE) / 30;
const RATE = ((9.9 - T_PLAY0) * 30) / (B.whip2 - B.whip);
const Play: React.FC = () => {
  const f = useCurrentFrame();
  const t = T_PLAY0 + ((f - B.whip) * RATE) / 30;
  const lab = ease(f, B.label, 10);
  const out = ease(f, B.label + 30, 16);
  const q = quadAt(t);
  const edgeX = Math.max(q[1][0], q[2][0]) * PW;
  return (
    <AbsoluteFill style={{ background: BLACK }}>
      <div style={{ position: 'absolute', top: 270, left: 90, transform: 'scale(0.8)', transformOrigin: '0 0', opacity: ease(f, B.whip, 8) }}>
        <Slate rows={ASKED} />
      </div>
      <div style={{ position: 'absolute', left: 0, top: PY, width: PW, height: PH, ...whipIn(f, B.whip) }}>
        <V1Panel from={B.whip} t0={T_PLAY0} rate={RATE} red={interpolate(f, [B.label, B.whip2], [0.3, 0.75], clamp)} />
        <div style={{ position: 'absolute', top: 24, left: Math.min(edgeX + 18, 900), opacity: out }}>
          <Chip text="사진 밖" bg={RED} fg={WHITE} size={38} />
        </div>
      </div>
      <div style={{ position: 'absolute', top: PY + PH + 26, left: Math.min(edgeX, 900) - 200, opacity: lab, transform: `translateY(${mix(14, 0, lab)}px)` }}>
        <Chip text="여기까지가 넣은 사진" size={34} />
      </div>
      <div style={{ position: 'absolute', top: PY - 66, right: 64, opacity: ease(f, B.play + 6, 8) }}>
        <Chip text="▶ 실제 결과 · 빨리 감기" bg="rgba(255,255,255,0.14)" fg="#E3E6EA" size={36} />
      </div>
    </AbsoluteFill>
  );
};

/** 9.1~12.0초 — 사진에 없던 기와집(원본 이름 공개). 덮개 없이 카메라가 밀리며 집이 드러나는 순간을 그대로(오른쪽 확대),
 *  「기와집」에서 흰 선(넣은 사진 끝) · 엷은 붉은 덮개 · 원(r5 볼 이유 심사 「덮개에 가려 작게 지나간다」). */
const REVEAL_T0 = 7.6;
const Reveal: React.FC = () => {
  const f = useCurrentFrame();
  const k = at('v3', '기와집');
  const ring = ease(f, k - 4, 10);
  const z = interpolate(f, [B.whip2, k], [1.15, 1.4], clamp);
  return (
    <AbsoluteFill style={{ background: BLACK }}>
      <div style={{ position: 'absolute', left: 0, top: PY - 60, width: PW, height: PH + 120, overflow: 'hidden', ...whipIn(f, B.whip2) }}>
        <div style={{ position: 'absolute', left: 0, top: 60, width: PW, height: PH }}>
          <V1Panel from={B.whip2} t0={REVEAL_T0} rate={0.8} red={0.4 * ring} zoom={z} />
        </div>
        <svg width={PW} height={PH + 120} style={{ position: 'absolute', left: 0, top: 0 }}>
          <ellipse cx={958} cy={300} rx={112} ry={220} fill="none" stroke={WHITE} strokeWidth={8} strokeDasharray={1200} strokeDashoffset={1200 * (1 - ring)} />
        </svg>
      </div>
      <div style={{ position: 'absolute', top: 300, right: 64, opacity: ring, transform: `translateY(${mix(16, 0, ring)}px)` }}>
        <Chip text="사진에 없던 집" bg={RED} fg={WHITE} size={56} />
      </div>
      <div style={{ position: 'absolute', top: 314, left: 64, opacity: ease(f, B.reveal, 8) * (1 - ring) }}>
        <Chip text="▶ 실제 결과" bg="rgba(255,255,255,0.14)" fg="#E3E6EA" size={38} />
      </div>
    </AbsoluteFill>
  );
};

/** 12.0~13.2초 — 큰 글 「3% → 17%」(원본 큰 숫자 칸). 같은 단위(화면 폭)로, 끝 장면 위에 넣은 사진 끝 → 화면 끝을 자로 잰다
 *  (r4 「3%와 5분의 1이 안 맞음」, r6 「17%를 어떻게 쟀나」 — 시험관 둘씩). */
const Big: React.FC = () => {
  const f = useCurrentFrame();
  const z = ease(f, B.bigZoom, 10);
  const q = quadAt(T_END);
  const ex = Math.min(q[1][0], q[2][0]) * PW;
  const ry = 860;
  return (
    <AbsoluteFill style={{ background: BLACK }}>
      <div style={{ position: 'absolute', left: 0, top: 640, width: PW, height: PH, overflow: 'hidden', opacity: 0.85 }}>
        <Img src={staticFile('clip/v1_end.png')} style={{ width: PW, height: PH }} />
        <Edge t={T_END} red={0.6} />
      </div>
      <svg width={PW} height={1920} style={{ position: 'absolute', left: 0, top: 0 }}>
        <line x1={ex} y1={ry} x2={PW - 4} y2={ry} stroke={WHITE} strokeWidth={8} />
        <line x1={ex} y1={ry - 30} x2={ex} y2={ry + 30} stroke={WHITE} strokeWidth={8} />
        <line x1={PW - 4} y1={ry - 30} x2={PW - 4} y2={ry + 30} stroke={WHITE} strokeWidth={8} />
      </svg>
      <div style={{ position: 'absolute', top: 280, width: '100%', textAlign: 'center', fontFamily: KO }}>
        <div style={{ fontWeight: 800, fontSize: 42, color: '#AEB4BE' }}>시킨 것 · 화면 폭의 <span style={{ textDecoration: 'line-through', textDecorationColor: RED, textDecorationThickness: 8 }}>3%</span></div>
        <div style={{ marginTop: 10, fontWeight: 800, fontSize: 44, color: WHITE }}>카메라가 실제로 간 거리</div>
        <div style={{ fontWeight: 900, fontSize: 190, lineHeight: 1.0, color: WHITE, letterSpacing: '-0.04em', transform: `scale(${mix(0.88, 1.05, z)})` }}>17%</div>
      </div>
      <div style={{ position: 'absolute', top: 640 + PH + 24, right: 40 }}>
        <Chip text="넣은 사진 끝 → 화면 끝" bg={WHITE} fg={INK} size={34} />
      </div>
    </AbsoluteFill>
  );
};

/** 13.2초~ 「그래서」 — 넣은 사진 / 10초 뒤 위아래(원본 문서 카드 + 배지). r6: 흰 틀 도식을 r5 시험관 둘이 못 읽어, 핵심 칸 시안(haiku가 한 번에 읽음)의 꼴로. */
const WW = 840;
const WH = Math.round((WW * 9) / 16);
const Why: React.FC = () => {
  const f = useCurrentFrame();
  const end = at('v5', '그래서');
  const b = ease(f, B.why + 10, 12);
  const fill = ease(f, at('v5', '채울') - 10, 20);
  const x0 = (1080 - WW) / 2;
  return (
    <AbsoluteFill style={{ background: BLACK, opacity: interpolate(f, [end - 6, end + 12], [1, 0], clamp) }}>
      <div style={{ position: 'absolute', left: x0, top: 300, width: WW, height: WH, borderRadius: 8, overflow: 'hidden' }}>
        <Img src={staticFile('clip/v2_first.png')} style={{ width: WW, height: WH }} />
        <div style={{ position: 'absolute', left: 16, top: 14 }}>
          <Chip text="넣은 사진" bg="rgba(11,12,15,0.78)" fg={WHITE} size={36} />
        </div>
      </div>
      <div style={{ position: 'absolute', left: x0, top: 300 + WH + 22, width: WW, height: WH, borderRadius: 8, overflow: 'hidden', opacity: b }}>
        <Img src={staticFile('clip/v1_end.png')} style={{ width: WW, height: WH }} />
        <Edge t={T_END} red={0.3 + 0.55 * fill} w={WW} h={WH} />
        <div style={{ position: 'absolute', left: 16, top: 14 }}>
          <Chip text="10초 뒤" bg="rgba(11,12,15,0.78)" fg={WHITE} size={36} />
        </div>
        <div style={{ position: 'absolute', right: 14, bottom: 14, opacity: fill }}>
          <Chip text="AI가 채운 곳" bg={RED} fg={WHITE} size={34} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 「그래서」~21.2초 — 고친 지시(슬레이트) + V2(고정), 줄이 말에 맞춰 하나씩. */
const FY = 720;
const Fix: React.FC = () => {
  const f = useCurrentFrame();
  const a = at('v5', '그래서');
  const s1 = ease(f, at('v5', '고정') - 10, 20);
  const s2 = ease(f, at('v5', '나뭇잎만') - 10, 20);
  const pin = ease(f, a - 6, 18);
  return (
    <AbsoluteFill style={{ background: BLACK, opacity: pin }}>
      <div style={{ position: 'absolute', left: 90, top: 290 }}>
        <Slate rows={FIXED} show={[s1, s2]} />
      </div>
      <div style={{ position: 'absolute', left: 0, top: FY, width: PW, height: PH, overflow: 'hidden' }}>
        <Sequence from={a - 6} layout="none">
          <OffthreadVideo src={staticFile('clip/V2.mp4')} muted style={{ width: PW, height: PH, transform: `scale(${1 + 0.0005 * (f - a)})` }} />
        </Sequence>
        <div style={{ position: 'absolute', inset: 0, border: `6px solid ${WHITE}`, boxSizing: 'border-box' }} />
        <div style={{ position: 'absolute', left: 70, top: 22, opacity: s1 }}>
          <Chip text="사진 밖 0%" bg={GREEN} fg={WHITE} size={40} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 21.2~24.6초 — 편집에서 자르는 창, 22.5초에 옆으로(원본 도형 · 22.5초 바뀜). */
const WIN = 0.8;
const Window: React.FC = () => {
  const f = useCurrentFrame();
  const show = ease(f, B.window, 8);
  const s = ease(f, B.slide, B.result - 6 - B.slide);
  const ww = PW * WIN;
  const wh = PH * WIN;
  const x = mix(0, PW - ww, s);
  const y = (PH - wh) / 2;
  return (
    <AbsoluteFill style={{ background: BLACK }}>
      <div style={{ position: 'absolute', left: 0, top: PY, width: PW, height: PH, overflow: 'hidden' }}>
        <Sequence from={B.window} layout="none">
          <OffthreadVideo src={staticFile('clip/V2.mp4')} muted trimBefore={Math.round(7.4 * 30)} style={{ width: PW, height: PH }} />
        </Sequence>
        <svg width={PW} height={PH} style={{ position: 'absolute', left: 0, top: 0, opacity: show }}>
          <path d={`M0,0 H${PW} V${PH} H0 Z M${x},${y} h${ww} v${wh} h${-ww} Z`} fill="rgba(8,9,12,0.62)" fillRule="evenodd" />
          <rect x={x} y={y} width={ww} height={wh} fill="none" stroke={WHITE} strokeWidth={6} />
          {[[x, y, 1, 1], [x + ww, y, -1, 1], [x, y + wh, 1, -1], [x + ww, y + wh, -1, -1]].map(([cx, cy, sx, sy], i) => (
            <path key={i} d={`M${cx},${cy + sy * 54} V${cy} H${cx + sx * 54}`} stroke={BLUE_T} strokeWidth={14} fill="none" />
          ))}
        </svg>
      </div>
      <div style={{ position: 'absolute', top: PY - 100, left: 64, opacity: show }}>
        <Chip text="① 조금 키우기" bg={BLUE} fg={WHITE} size={36} />
      </div>
      <div style={{ position: 'absolute', top: PY - 100, right: 64, opacity: ease(f, B.slide, 6) }}>
        <Chip text="② 왼쪽 끝 → 오른쪽 끝" bg={BLUE} fg={WHITE} size={36} />
      </div>
      <svg width={PW} height={90} style={{ position: 'absolute', left: 0, top: PY + PH + 24, opacity: show }}>
        <line x1={100} y1={45} x2={980} y2={45} stroke="rgba(255,255,255,0.35)" strokeWidth={6} />
        {[100, 980].map((x, i) => (
          <rect key={i} x={x - 22} y={23} width={44} height={44} transform={`rotate(45 ${x} 45)`} fill={i === 0 || s > 0.98 ? BLUE_T : 'rgba(255,255,255,0.25)'} />
        ))}
        <circle cx={mix(100, 980, s)} cy={45} r={10} fill={WHITE} />
      </svg>
    </AbsoluteFill>
  );
};

/** 24.6~29.4초 — 위아래 비교: 「조금만 옆으로」 시킨 판(사진 밖이 붉게 늘어남) / 고정 + 편집 판(같이 옆으로 가지만 사진 밖 없음). */
const CW = 920;
const CH = Math.round((CW * 9) / 16);
const Result: React.FC = () => {
  const f = useCurrentFrame();
  const s = interpolate(f, [B.result, B.back - 6], [0, 1], { ...clamp, easing: IN_OUT });
  const z = 1 / WIN;
  const top = ease(f, B.result, 10);
  const bot = ease(f, B.result + 4, 10);
  return (
    <AbsoluteFill style={{ background: BLACK }}>
      <div style={{ position: 'absolute', left: 80, top: 270, width: CW, height: CH, borderRadius: 8, overflow: 'hidden', opacity: top }}>
        <V1Panel from={B.result} t0={2.0} rate={1.6} w={CW} h={CH} red={0.8} />
        <div style={{ position: 'absolute', left: 18, top: 16 }}>
          <Chip text="「조금만 옆으로」" bg={RED} fg={WHITE} size={36} />
        </div>
      </div>
      <div style={{ position: 'absolute', left: 80, top: 270 + CH + 18, width: CW, height: CH, borderRadius: 8, overflow: 'hidden', opacity: bot }}>
        <Sequence from={B.result} layout="none">
          <OffthreadVideo src={staticFile('clip/V2.mp4')} muted trimBefore={Math.round(2.0 * 30)} style={{ position: 'absolute', width: CW * z, height: CH * z, left: -mix(0, CW * z - CW, s), top: -(CH * z - CH) / 2 }} />
        </Sequence>
        <div style={{ position: 'absolute', inset: 0, border: `5px solid ${WHITE}`, borderRadius: 8, boxSizing: 'border-box' }} />
        <div style={{ position: 'absolute', left: 18, top: 16 }}>
          <Chip text="고정 + 편집" bg={GREEN} fg={WHITE} size={36} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 29.4~33.1초 — 첫 지시가 다시, 줄이 그어짐(원본 반전). */
const Back: React.FC = () => {
  const f = useCurrentFrame();
  const pin = ease(f, B.back, 8);
  const strike = interpolate(f, [at('v8', '아니었던') - 10, at('v8', '아니었던') + 6], [0, 1], { ...clamp, easing: IN_OUT });
  return (
    <AbsoluteFill style={{ background: BLACK }}>
      <Img src={staticFile('clip/v1_end.png')} style={{ position: 'absolute', left: 0, top: 1010, width: PW, height: PH, opacity: 0.35 }} />
      <div style={{ position: 'absolute', top: 470, left: 90, opacity: pin, transform: `scale(${mix(0.94, 1, pin)})` }}>
        <Slate rows={ASKED} dim={strike * 0.5} />
        <svg width={900} height={260} style={{ position: 'absolute', left: 0, top: 0 }}>
          <line x1={150} y1={178} x2={150 + 720 * strike} y2={178} stroke={RED} strokeWidth={14} strokeLinecap="round" />
        </svg>
      </div>
    </AbsoluteFill>
  );
};

/** 33.1~35.1초 — 얻는 것(원본 반론 칩 목록) — 체크 목록. */
const GainRow: React.FC<{ p: number; text: string; top: number }> = ({ p, text, top }) => (
  <div style={{ position: 'absolute', left: 150, top, display: 'flex', alignItems: 'center', gap: 26, opacity: p, transform: `translateX(${mix(-30, 0, p)}px)`, fontFamily: KO }}>
    <div style={{ width: 84, height: 84, borderRadius: 42, background: GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={48} height={48} viewBox="0 0 24 24">
        <path d="M5 12.5 10 17 19 7" stroke={WHITE} strokeWidth={3.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
    <div style={{ fontWeight: 900, fontSize: 70, color: WHITE, letterSpacing: '-0.03em' }}>{text}</div>
  </div>
);
const Gains: React.FC = () => {
  const f = useCurrentFrame();
  const g1 = ease(f, B.gains + 2, 8);
  const g2 = ease(f, B.gains + 6, 10);
  return (
    <AbsoluteFill style={{ background: BLACK }}>
      <Img src={staticFile('clip/v2_first.png')} style={{ position: 'absolute', left: 0, top: 1010, width: PW, height: PH, opacity: 0.35 }} />
      <GainRow p={g1} text="없던 집은 줄고" top={500} />
      <GainRow p={g2} text="다시 뽑기도 줄고" top={660} />
    </AbsoluteFill>
  );
};

/** 35.1초~ 끝 — 가장 센 장면을 크게 다시: 사진에 없던 기와집(오른쪽 확대 · 원), 끝 줄. 정지 카드 없이 영상은 아주 느리게 흐른다. */
const End: React.FC = () => {
  const f = useCurrentFrame();
  const a = ease(f, B.end, 12);
  const line = ease(f, VO.v10 - 2, 10);
  // 끝 줄 뒤 사진 밖이 어두워지며 집이 사라진다 — 고정으로 뽑으면 없을 집(r8 볼 이유 심사 「집이 사라지는 한 컷으로 닫으면 여운」)
  const gone = interpolate(f, [lineEnd('v10') + 6, lineEnd('v10') + 36], [0, 1], { ...clamp, easing: IN_OUT });
  const EH = 860;
  const EW = Math.round((EH * 16) / 9);
  return (
    <AbsoluteFill style={{ background: BLACK }}>
      <div style={{ position: 'absolute', left: PW - EW, top: 290, width: EW, height: EH, opacity: a }}>
        <V1Panel from={B.end} t0={9.5} rate={0.12} w={EW} h={EH} red={0.75} />
        <svg width={EW} height={EH} style={{ position: 'absolute', left: 0, top: 0 }}>
          <ellipse cx={EW * 0.9} cy={EH * 0.45} rx={EW * 0.095} ry={EH * 0.31} fill="none" stroke={WHITE} strokeWidth={8} opacity={1 - gone} />
          <path d={`M-4,-4 H${EW + 4} V${EH + 4} H-4 Z M${quadAt(T_END).map(([x, y]) => `${(x * EW).toFixed(1)},${(y * EH).toFixed(1)}`).join(' L')} Z`} fill={BLACK} fillRule="evenodd" opacity={gone} />
        </svg>
      </div>
      <div style={{ position: 'absolute', top: 300, left: 64, opacity: a * (1 - gone) }}>
        <Chip text="사진에 없던 집" bg={RED} fg={WHITE} size={44} />
      </div>
      <div style={{ position: 'absolute', top: 1190, width: '100%', textAlign: 'center', fontFamily: KO, fontWeight: 900, fontSize: 72, color: WHITE, letterSpacing: '-0.035em', lineHeight: 1.2, opacity: line, transform: `translateY(${mix(16, 0, line)}px)` }}>
        카메라는,
        <br />
        <span style={{ color: BLUE_T }}>고정으로만 뽑으세요.</span>
      </div>
    </AbsoluteFill>
  );
};

// ───────────── 자막(판 없이 단색 바탕 위, 파란 낱말) ─────────────
const KEY = ['조금', '3%만', '17%를', '기와집이', '옆으로', '고정,', '나뭇잎만.', '편집에서,', '없죠.', '줄어요.', '아니었던'];
/** 통째로 한 덩어리(두 줄)로 두는 줄 — 반전 · 얻는 것 칸은 원본에서 한 번만 바뀐다. */
const WHOLE: Spoken[] = ['v6', 'v8', 'v9'];
/** 한 줄을 마침표 · 10자 넘은 쉼표(또는 20자) 덩어리로 나눠, 지금 말하는 덩어리만 크게(원본 하단 큰 자막). 잘게 나누면 바뀔 때마다 박자로 잡혀 원본 칸 수를 넘었다(r1 · r2). */
const chunks = (id: Spoken) => {
  const ws = words(id);
  const out: { a: number; text: (readonly [string, number, number])[] }[] = [];
  let cur: (readonly [string, number, number])[] = [];
  let len = 0;
  ws.forEach((w, i) => {
    cur.push(w);
    len += w[0].length;
    const brk = !WHOLE.includes(id) && (/[.]$/.test(w[0]) || (/,$/.test(w[0]) && len >= 10) || len >= 20);
    if (brk || i === ws.length - 1) {
      out.push({ a: VO[id] + Math.round(cur[0][1] * 30), text: cur });
      cur = [];
      len = 0;
    }
  });
  return out;
};
// v1은 첫 화면 머리글이, v4는 큰 글이, v10은 끝 장면이 크게 쓴다
// 첫 자막(v2)은 말보다 조금 먼저, 장면이 바뀌는 2.4초에 함께 뜬다 — 따로 뜨면 원본에 없는 박자가 된다(r7)
const CHUNKS = ORDER.filter((id) => id !== 'v1' && id !== 'v4' && id !== 'v10').flatMap((id) => chunks(id).map((c, k) => ({ ...c, a: id === 'v2' && k === 0 ? B.real : c.a, id })));
const Caption: React.FC = () => {
  const f = useCurrentFrame();
  let i = -1;
  for (let k = 0; k < CHUNKS.length; k++) if (f >= CHUNKS[k].a - 1) i = k;
  if (i < 0) return null;
  const c = CHUNKS[i];
  if (f >= B.end) return null; // 줄 사이에 자막이 꺼졌다 켜지면 그것도 박자가 된다 — 다음 덩어리가 올 때까지 남긴다
  if (f >= B.big && f < VO.v5) return null; // 큰 글 · 17% 띠 칸(v4는 큰 글이 쓴다)
  const light = f < B.real;
  const inFix = f >= at('v5', '그래서') && f < B.window;
  const inResult = f >= B.result && f < B.back;
  const inWindow = f >= B.window && f < B.result;
  const y = light ? 1040 : inFix ? 1395 : inResult ? 1340 : inWindow ? 1296 : f >= B.back ? 830 : 1290;
  const small = inFix || inResult || inWindow;
  // v2 끝과 v3 사이 말 없는 자리에 자막을 남기지 않는다(r8 haiku 「자막이 되풀이돼 지루」) — 천천히 지워 박자가 되지 않게
  const quiet = c.id === 'v2' ? 1 - ease(f, lineEnd('v2') + 4, 24) : 1;
  const p = ease(f, c.a - 1, 4) * quiet;
  return (
    <div style={{ position: 'absolute', left: 70, width: 850, top: inFix ? y - 40 : y, textAlign: 'center', fontFamily: KO, fontWeight: 900, fontSize: small ? 56 : 62, lineHeight: 1.22, letterSpacing: '-0.03em', wordBreak: 'keep-all', opacity: p, transform: `translateY(${mix(10, 0, p)}px)` }}>
      {c.text.map((w, k) => (
        <span key={k} style={{ color: KEY.some((x) => w[0].includes(x.replace(/[,.]$/, ''))) ? (light ? '#B7791F' : AMBER) : light ? INK : WHITE }}>
          {w[0].replace(/[,.]$/, '')}
          {k < c.text.length - 1 ? ' ' : ''}
        </span>
      ))}
    </div>
  );
};

// ───────────── 소리 ─────────────
type Hit = { at: number; src: string; v: number };
const HITS: Hit[] = [
  { at: B.bubble, src: 'sfx/tok.wav', v: 0.16 },
  { at: B.cross, src: 'sfx/thud.wav', v: 0.26 },
  { at: B.real, src: 'sfx/swish.wav', v: 0.12 },
  { at: B.whip, src: 'sfx/swish.wav', v: 0.14 },
  { at: B.label, src: 'sfx/tick.wav', v: 0.14 },
  { at: B.whip2, src: 'sfx/swish.wav', v: 0.14 },
  { at: B.reveal + 20, src: 'sfx/thud.wav', v: 0.22 },
  { at: B.big, src: 'sfx/snap.wav', v: 0.16 },
  { at: B.why, src: 'sfx/tok.wav', v: 0.14 },
  { at: B.window, src: 'sfx/tick2.wav', v: 0.16 },
  { at: B.slide, src: 'sfx/swish.wav', v: 0.1 },
  { at: B.result, src: 'sfx/calm.wav', v: 0.22 },
  { at: B.back, src: 'sfx/tok.wav', v: 0.16 },
  { at: B.gains, src: 'sfx/tick.wav', v: 0.14 },
  { at: B.end, src: 'sfx/thud.wav', v: 0.2 },
];

// ───────────── 본편 ─────────────
export const CameraFilm: React.FC<{ bgm?: boolean }> = ({ bgm = true }) => {
  const voice = ORDER.map((id) => [VO[id], lineEnd(id)] as [number, number]);
  const bgmVolume = (fr: number) => {
    const tail = Math.min(1, (TOTAL - fr) / 15);
    const v = Math.max(0, ...voice.map(([a, b]) => interpolate(fr, [a - 10, a, b, b + 10], [0, 1, 1, 0], clamp)));
    return (0.34 - 0.14 * v) * tail * MASTER;
  };
  const fix = at('v5', '그래서');
  return (
    <AbsoluteFill style={{ background: BLACK }}>
      <Scene a={0} b={B.real} zoom={0}>
        <Hook />
      </Scene>
      <Scene a={B.real} b={B.whip} zoom={0}>
        <Real />
      </Scene>
      <Scene a={B.whip} b={B.whip2} zoom={0}>
        <Play />
      </Scene>
      <Scene a={B.whip2} b={B.big} zoom={0.0009}>
        <Reveal />
      </Scene>
      <Scene a={B.big} b={B.why} zoom={0}>
        <Big />
      </Scene>
      <Scene a={B.why} b={fix + 12} zoom={0.0005}>
        <Why />
      </Scene>
      <Scene a={fix - 6} b={B.window} zoom={0}>
        <Fix />
      </Scene>
      <Scene a={B.window} b={B.result} zoom={0}>
        <Window />
      </Scene>
      <Scene a={B.result} b={B.back} zoom={0}>
        <Result />
      </Scene>
      <Scene a={B.back} b={B.gains} zoom={0.0006}>
        <Back />
      </Scene>
      <Scene a={B.gains} b={B.end} zoom={0.0008}>
        <Gains />
      </Scene>
      <Scene a={B.end} b={TOTAL} zoom={0.0005}>
        <End />
      </Scene>
      <Caption />
      {ORDER.map((id) => (
        <Sequence key={id} from={VO[id]} layout="none">
          <Audio src={staticFile(`vo/${id}.wav`)} volume={MASTER} />
        </Sequence>
      ))}
      {HITS.map((x, i) => (
        <Sequence key={i} from={x.at} durationInFrames={60} layout="none">
          <Audio src={staticFile(x.src)} volume={x.v * MASTER} />
        </Sequence>
      ))}
      {bgm ? <Audio src={staticFile('bgm.wav')} volume={bgmVolume} /> : null}
    </AbsoluteFill>
  );
};

/** 표지: 사진에 없던 집 + 머리글. */
export const CoverStill: React.FC = () => {
  const EH = 860;
  const EW = Math.round((EH * 16) / 9);
  return (
    <AbsoluteFill style={{ background: BLACK }}>
      <div style={{ position: 'absolute', left: PW - EW, top: 600, width: EW, height: EH, overflow: 'hidden' }}>
        <Img src={staticFile('clip/v1_end.png')} style={{ width: EW, height: EH }} />
        <Edge t={T_END} red={0.75} w={EW} h={EH} />
      </div>
      <div style={{ position: 'absolute', top: 300, width: '100%', textAlign: 'center', fontFamily: KO, fontWeight: 900, fontSize: 70, color: WHITE, letterSpacing: '-0.035em', lineHeight: 1.22 }}>
        3%만 옆으로 가랬더니
        <br />
        <span style={{ color: RED }}>없던 집을 지었다</span>
      </div>
    </AbsoluteFill>
  );
};
