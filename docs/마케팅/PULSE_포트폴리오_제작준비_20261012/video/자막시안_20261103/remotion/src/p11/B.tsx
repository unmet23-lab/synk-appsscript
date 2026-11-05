// 11번 첨벙댕 B급 판(2026-11-04) — 유호님 「B급처럼 재밌게」 · 「폼잡고 멋있는 이런 컨셉이 아니잖아」 · 「"번쩍"이라는 워딩이 들어가면 모션그래픽이든 cg든 번쩍이란 글을 강조」.
// 내레이션(Kevin)은 그대로 진지하게 두고 화면만 말이 안 되게. 강한 낱말은 뜻대로 움직이고 소리가 난다(pet-ad B급소리.py). 시각은 전부 timing.ts의 낱말 자리.
// 화면은 git 밖 public/p11/picture_b.mp4(pet-ad 최종편집.py b_picture · CUTS_B와 컷 경계가 같다). 장면에 붙는 CG는 Scene(카메라와 같이 움직임), 글자는 화면에 고정.
import React from 'react';
import { AbsoluteFill, Img, OffthreadVideo, staticFile, useCurrentFrame } from 'remotion';
import { Audio } from '@remotion/media';
import { EN, KO } from '../lib/fonts';
import { life, pop, ramp } from '../lib/motion';
import { LINES } from './timing';

export const P11B_FRAMES = 621;   // 물 컷 563장 + 우주 48장 + 검정 10장(11-05 유호님 「집게 컷으로」)
const FPS = 24;
const INK = '#0E1320', PAPER = '#F6F3EA', LEMON = '#FFD43B', NAVY = '#17224D', ALIEN = '#B8FF3C';
const abs = (x: number, y: number, w?: number, h?: number): React.CSSProperties => ({ position: 'absolute', left: x, top: y, width: w, height: h });
const w = (li: number, wi: number) => LINES[li].words[wi].t;
const last = <T,>(a: T[]): T | undefined => a[a.length - 1];
const noDot = (s: string) => s.replace(/\.$/, '');
const splitAt = (words: { w: string }[]) => {
  const full = words.map((x) => x.w).join(' ');
  if (full.length <= 18) return words.length;
  let best = 1, gap = 1e9, acc = 0;
  words.forEach((x, i) => { acc += x.w.length + 1; const d = Math.abs(acc - full.length / 2); if (i < words.length - 1 && d < gap) { gap = d; best = i + 1; } });
  return best;
};
const lineAt = (t: number) => last(LINES.filter((l) => t >= l.at - 0.05 && t < l.end + 0.35));
const lerpTable = (table: number[][], f: number) => {   // [장, x, y] 표 사이를 잇는다
  if (f <= table[0][0]) return table[0].slice(1);
  for (let i = 1; i < table.length; i++) {
    if (f <= table[i][0]) {
      const k = (f - table[i - 1][0]) / (table[i][0] - table[i - 1][0]);
      return table[i].slice(1).map((v, j) => table[i - 1][j + 1] + (v - table[i - 1][j + 1]) * k);
    }
  }
  return last(table)!.slice(1);
};

// 컷 경계(pet-ad 최종편집.py CUTS_B와 같은 값)
const CUT_MOON = 52 / 24;   // 귀 → 달 중력
const CUT_RUN = 91 / 24;    // 달 중력 → 솟아 떠 있는 개 · 두 사람
const CUT_BOX = 163 / 24;   // → 염력 상자
const CUT_WRAP = 185 / 24;  // → 조끼가 날아와 붙고 촉수가 나오는 판(p11-b04e)
const SHOOT = CUT_WRAP;    // 조끼가 날아가기 시작(「특별한」)
const VEST_SLAM = 191 / 24;   // 조끼가 개에게 철썩 · 촉수
const TENT_END = 216 / 24; // 촉수가 다 들어갔다(「준비했어요」 끝)
const CUT_OWL = 280 / 24;  // → 고개 도는 컷
const CALLOUT_FROM = [466, 985], CALLOUT_AT = [530, 790];   // 가격 말풍선 — 당긴 화면의 조끼 오른쪽에서
const SPIN_STOP = 318 / 24;   // 고개가 뚝 멈춘다
const CUT_CLAW = 330 / 24;  // → 뽑기 집게
const CUT_GLAM = 371 / 24;  // → 샴푸 광고 · 떠오름
const CUT_DROP = 453 / 24;  // → 물 · 떨어짐
const BEAM_ON = w(7, 0) - 0.04;   // 띠가 열리고 납치 빔이 켜진다
const BEAM_OFF = CUT_DROP + 30 / 24;   // 빔이 꺼진다 — 그래서 p11-b11 31장부터 떨어진다
const SPACE_AT = 563 / FPS;   // → 궤도 집게 컷(574장까지 두니 끝이 두 번이었다 — 맹검 둘)
const BLACK_AT = 611 / FPS;   // → 검정으로 끝. 로고를 다시 넣지 않는다
const SPACE_MISS = 0.46;   // 집게가 놓치는 자리(우주 컷 머리에서 초, p11-s1 32장 = 21장부터 11장 — B급소리.py와 같은 값)

// 큰 낱말 결 — 고른 테두리를 쓰지 않는다(유호님 11-03 「흰 굵은 글자 + 검은 테」는 촌스럽다, 아르곤 11-04 「무료 앱 프리셋」). 낱말마다 뜻대로 그린다
const big = (size: number, color: string): React.CSSProperties => ({ fontFamily: KO, fontWeight: 900, fontSize: size, lineHeight: 1, letterSpacing: '-0.045em', color });
const softShadow = (size: number) => `0 ${size * 0.035}px ${size * 0.16}px #0E132099`;
const chipBg = '#0E1320e8';
// 외계 글자 — 초록에 색 어긋남
const GlitchLetter: React.FC<{ c: string; size: number; t: number; i: number; style?: React.CSSProperties }> = ({ c, size, t, i, style }) => {
  const off = Math.floor(t * 12 + i * 3) % 5 === 0 ? size * 0.03 : size * 0.008;
  const ghost = (color: string, dx: number): React.CSSProperties => ({ position: 'absolute', left: dx, top: 0, color, opacity: 0.85, textShadow: 'none' });
  return (
    <span style={{ position: 'relative', display: 'inline-block', isolation: 'isolate', ...big(size, ALIEN), ...style }}>
      <span style={{ ...ghost('#27E7FF', -off), zIndex: -1 }}>{c}</span>
      <span style={{ ...ghost('#FF3DCB', off), zIndex: -1 }}>{c}</span>
      <span style={{ position: 'relative', textShadow: softShadow(size) }}>{c}</span>
    </span>
  );
};
const shake = (t: number, at: number, amp: number, d = 0.32): [number, number] => {
  const x = (t - at) / d;
  if (x < 0 || x > 1) return [0, 0];
  const k = amp * (1 - x);
  return [Math.sin(t * 97) * k, Math.cos(t * 73) * k];
};

// 햇살 — 가운데서 뻗는 쐐기(hole 안쪽은 비워 물건이 빛에 안 씻기게)
const Rays: React.FC<{ cx: number; cy: number; n: number; r: number; color: string; opacity: number; rot: number; hole?: number; blend?: React.CSSProperties['mixBlendMode'] }> = ({ cx, cy, n, r, color, opacity, rot, hole = 0, blend = 'screen' }) => {
  const step = 360 / n;
  const ps = Array.from({ length: n }, (_, i) => {
    const a0 = ((i * step + rot) * Math.PI) / 180, a1 = (((i + 0.5) * step + rot) * Math.PI) / 180;
    return `M${cx} ${cy}L${cx + r * Math.cos(a0)} ${cy + r * Math.sin(a0)}L${cx + r * Math.cos(a1)} ${cy + r * Math.sin(a1)}Z`;
  }).join('');
  const mask = hole ? `radial-gradient(circle at ${cx}px ${cy}px, transparent ${hole}px, #000 ${hole + 120}px)` : undefined;
  return <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0, opacity, mixBlendMode: blend, WebkitMaskImage: mask, maskImage: mask }}><path d={ps} fill={color} /></svg>;
};

// 집중선 — 만화 효과선
const Speed: React.FC<{ cx: number; cy: number; t: number; opacity: number; color?: string }> = ({ cx, cy, t, opacity, color = '#ffffff' }) => {
  const seed = Math.floor(t * 12);
  const ps = Array.from({ length: 44 }, (_, i) => {
    const r0 = 420 + ((i * 37 + seed * 53) % 170), a = (i / 44) * Math.PI * 2 + ((seed * 13 + i * 7) % 10) * 0.012, d = 0.018 + ((i * 11 + seed) % 5) * 0.004, R = 1700;
    return `M${cx + r0 * Math.cos(a)} ${cy + r0 * Math.sin(a)}L${cx + R * Math.cos(a - d)} ${cy + R * Math.sin(a - d)}L${cx + R * Math.cos(a + d)} ${cy + R * Math.sin(a + d)}Z`;
  }).join('');
  return <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0, opacity }}><path d={ps} fill={color} /></svg>;
};

// 반짝이 네 갈래 별
const Star: React.FC<{ x: number; y: number; s: number; color?: string; rot?: number }> = ({ x, y, s, color = '#fff', rot = 0 }) => (
  <svg width={s * 2} height={s * 2} viewBox="-1 -1 2 2" style={{ position: 'absolute', left: x - s, top: y - s, transform: `rotate(${rot}deg)` }}><path d="M0 -1C.08 -.25 .25 -.08 1 0C.25 .08 .08 .25 0 1C-.08 .25 -.25 .08 -1 0C-.25 -.08 -.08 -.25 0 -1Z" fill={color} /></svg>
);
const twinkle = (t: number, at: number, d = 0.5) => { const x = (t - at) / d; return x <= 0 || x >= 1 ? 0 : Math.sin(x * Math.PI); };

// ── 낱말 하나씩
// 개의 시스템 메시지 — 말과 어긋나게 끝까지 진지한 농담 한 줄. 신호가 끊겨 떨어지고, 착륙에 성공한다
const HUD: [number, number, string][] = [
  [0.06, CUT_MOON, '지구 신호 수신 중'],
  [CUT_MOON + 0.04, CUT_RUN, '중력 1/6 모드'],
  [CUT_RUN + 0.04, w(1, 3), '인간 반응 관찰 중'],
  [w(1, 3) + 0.6, CUT_BOX, '인간 도주 확인'],
  [CUT_BOX + 0.1, SHOOT, '조끼 원격 조종 중'],
  [VEST_SLAM + 0.12, TENT_END, '촉수 정리 중'],
  [TENT_END, CUT_OWL, '착용 완료'],
  [CUT_OWL + 0.2, SPIN_STOP, '목 회전 점검 중'],
  [SPIN_STOP, CUT_CLAW, '이상 없음'],
  [CUT_CLAW + 0.04, w(5, 5), '회수 장치 가동'],
  [BEAM_ON, BEAM_OFF, '귀환 빔 작동 중'],
  [BEAM_OFF, w(8, 3) + 1.2, '신호 끊김'],
  [21.95, SPACE_AT, '수면 착륙 성공'],
  [SPACE_AT + SPACE_MISS, BLACK_AT, '궤도 부력 정상'],
];
const Hud: React.FC<{ t: number }> = ({ t }) => {
  const cur = HUD.find(([a, b]) => t >= a && t < b);
  if (!cur) return null;
  const [a, , txt] = cur;
  const err = txt === '신호 끊김';
  const n = err ? txt.length : Math.min(txt.length, Math.floor((t - a) * 26) + 1);
  const dot = Math.floor(t * 4) % 2 === 0;
  const [sx, sy] = err ? shake(t, a, 12, 0.5) : [0, 0];
  return (
    <div style={{ ...abs(0, 64, 1080), zIndex: 26, textAlign: 'center', transform: `translate(${sx}px,${sy}px)` }}>
      <span style={{ display: 'inline-block', fontFamily: KO, fontWeight: 700, fontSize: 40, letterSpacing: '-0.01em', color: err ? '#fff' : ALIEN, background: err ? '#E5262A' : '#0E1320e6', padding: '11px 26px 12px', borderRadius: 12 }}>
        <span style={{ display: 'inline-block', width: 18, height: 18, borderRadius: 9, marginRight: 14, background: err ? '#fff' : dot ? '#FF4B4B' : '#5a2020', verticalAlign: 1 }} />
        {txt.slice(0, n)}{n < txt.length ? '▌' : ''}
      </span>
    </div>
  );
};

const Alien: React.FC<{ t: number }> = ({ t }) => {   // 외계인 — 초록으로 일렁이고 색이 어긋난다
  const b = w(0, 4) - 0.02;
  if (t >= b) return null;
  const o = 1 - ramp(t, b - 0.08, 0.08);
  return (
    <div style={{ ...abs(0, 1230, 1080), zIndex: 20, textAlign: 'center', opacity: o }}>
      {'외계인'.split('').map((c, i) => {
        const ph = t * 7.5 + i * 1.5, s = Math.min(1.08, pop(t, i * 0.09, 0.3));
        return <GlitchLetter key={i} c={c} size={240} t={t} i={i} style={{ transform: `translateY(${Math.sin(ph) * 14}px) rotate(${Math.sin(ph * 0.8) * 6}deg) scale(${s})` }} />;
      })}
    </div>
  );
};

const Moon: React.FC<{ t: number }> = ({ t }) => {   // 뛰어노는 걸 — 글자도 달 중력으로, 그림자는 모래에 남는다
  const a = w(0, 5) - 0.05;
  if (t < a || t >= CUT_RUN) return null;
  return (
    <div style={{ ...abs(0, 1272, 1080), zIndex: 20, textAlign: 'center', whiteSpace: 'nowrap' }}>
      {'뛰어노는 걸'.split('').map((c, i) => {
        if (c === ' ') return <span key={i} style={{ display: 'inline-block', width: 44 }} />;
        const k = t - a - i * 0.07, h = k <= 0 ? 0 : Math.abs(Math.sin(k * 2.3));
        return (
          <span key={i} style={{ position: 'relative', display: 'inline-block', opacity: k > 0 ? 1 : 0 }}>
            <span style={{ position: 'absolute', left: '10%', right: '10%', top: 148, height: 24, borderRadius: '50%', background: INK, opacity: 0.36 - 0.24 * h, transform: `scale(${1 - 0.45 * h})`, filter: 'blur(6px)' }} />
            <span style={{ display: 'inline-block', ...big(158, INK), transform: `translateY(${-h * 130}px) rotate(${Math.sin(k * 1.7 + i) * 7}deg)` }}>{c}</span>
          </span>
        );
      })}
    </div>
  );
};

// 조준 표시 — 개의 시선. 찰칵 잠기며 깜박인다
const LockMark: React.FC<{ x: number; y: number; r: number; t: number; at: number }> = ({ x, y, r, t, at }) => {
  if (t < at) return null;
  const k = t - at, u = ramp(t, at, 0.16), sc = 1 + 0.8 * (1 - u), rot = (1 - u) * 50;
  const c = r * 0.4, d = `M${-r} ${-r + c}V${-r}H${-r + c}M${r - c} ${-r}H${r}V${-r + c}M${r} ${r - c}V${r}H${r - c}M${-r + c} ${r}H${-r}V${r - c}`;
  const blink = k < 0.28 && Math.floor(k * 25) % 2 === 1 ? 0.35 : 1;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${sc})`} opacity={blink}>
      <path d={d} fill="none" stroke="#0E1320" strokeOpacity={0.55} strokeWidth={15} />
      <path d={d} fill="none" stroke={ALIEN} strokeWidth={8} />
    </g>
  );
};
const LockLabel: React.FC<{ x: number; y: number; t: number; at: number; text: string }> = ({ x, y, t, at, text }) => {
  if (t < at) return null;
  return <div style={{ ...abs(x, y), zIndex: 22, opacity: ramp(t, at + 0.1, 0.12), background: chipBg, color: ALIEN, fontFamily: KO, fontWeight: 700, fontSize: 40, padding: '10px 22px 11px', borderRadius: 12, whiteSpace: 'nowrap' }}>{text}</div>;
};

const HumanScan: React.FC<{ t: number }> = ({ t }) => {   // 얼어붙은 두 사람 — 개가 조준해 당황 수치를 잰다(기본 물음표는 성의 없어 보인다 — 아르곤)
  const a = 4.62, b = w(1, 3);
  if (t < a || t >= b) return null;
  return (
    <>
      <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0, zIndex: 21 }}>
        <LockMark x={385} y={622} r={72} t={t} at={a} />
        <LockMark x={640} y={602} r={72} t={t} at={a + 0.28} />
      </svg>
      <LockLabel x={232} y={468} t={t} at={a} text="당황 98%" />
      <LockLabel x={600} y={448} t={t} at={a + 0.28} text="당황 99%" />
    </>
  );
};

const Kkam: React.FC<{ t: number }> = ({ t }) => {   // 깜짝 — 집중선 + 터짐, 넘어지는 건 보이게 일찍 빠진다
  const a = w(1, 3), b = 6.3;
  if (t < a || t >= b) return null;
  const s = pop(t, a, 0.26), [sx, sy] = shake(t, a, 26, 0.4);
  const out = ramp(t, b - 0.16, 0.16);
  return (
    <>
      <Speed cx={470} cy={640} t={t} opacity={0.85 * (1 - ramp(t, a + 0.4, 0.3))} />
      <div style={{ ...abs(0, 1180, 1080), zIndex: 21, textAlign: 'center', opacity: 1 - out, transform: `translate(${sx}px,${sy + out * 40}px) rotate(-6deg) scale(${(1.7 - 0.7 * Math.min(1, s)) * Math.min(1, s * 1.4)})` }}><span style={{ display: 'inline-block', ...big(226, INK), background: LEMON, padding: '20px 48px 30px', borderRadius: 28, boxShadow: `12px 16px 0 ${INK}` }}>깜짝!</span></div>
    </>
  );
};

// 염력 컷 — 조끼 자리(p11-b04c 장, 중심 x, 중심 y): 노랑 덩이를 장마다 잰 값. 판은 14장부터 ×2.68로 돌려 73장에서 p11-b04e로 넘어간다
const VEST = [[0, 567, 1012], [24, 567, 1009], [32, 575, 990], [40, 582, 963], [48, 585, 939], [56, 586, 906], [64, 583, 841], [73, 581, 803]];
const EYE = [[0, 328, 863], [40, 330, 858], [73, 312, 827]];
const boxFrame = (t: number) => Math.min(73, 14 + (t - CUT_BOX) * FPS * (59 / 22));
const Telekinesis: React.FC<{ t: number }> = ({ t }) => {   // 눈에서 나간 초록 파동이 조끼를 들어 올린다 — 장면에 붙는다. 조끼가 붙는 순간 꺼진다
  if (t < CUT_BOX || t >= VEST_SLAM) return null;
  const f = boxFrame(t);
  const [ex, ey] = lerpTable(EYE, f), [vx, vy] = lerpTable(VEST, f);
  const on = ramp(t, CUT_BOX + 0.06, 0.12);
  const ang = Math.atan2(vy - ey, vx - ex);
  const reach = Math.hypot(vx - ex, vy - ey);
  const arcs = t >= SHOOT ? [] : Array.from({ length: 5 }, (_, i) => {
    const k = ((t * 1.9 + i / 5) % 1);
    const r = 34 + k * Math.max(60, reach - 120);
    const sp = 0.42 + k * 0.22;
    const x0 = ex + r * Math.cos(ang - sp), y0 = ey + r * Math.sin(ang - sp), x1 = ex + r * Math.cos(ang + sp), y1 = ey + r * Math.sin(ang + sp);
    return <path key={i} d={`M${x0} ${y0}A${r} ${r} 0 0 1 ${x1} ${y1}`} fill="none" stroke={ALIEN} strokeWidth={8 - k * 3} strokeLinecap="round" opacity={on * Math.sin(k * Math.PI) * 0.95} />;
  });
  return (
    <>
      <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0 }}>{arcs}</svg>
      <div style={{ ...abs(ex - 58, ey - 58, 116, 116), borderRadius: '50%', opacity: on, background: `radial-gradient(circle, #F4FFD0 0 13%, ${ALIEN} 22%, ${ALIEN}55 42%, ${ALIEN}00 70%)`, mixBlendMode: 'screen' }} />
    </>
  );
};

const HolyLight: React.FC<{ t: number }> = ({ t }) => {   // 조끼 뒤로 부드러운 빛 — 방사선은 번쩍에만 쓴다(여기서는 사진이 벽지처럼 바랬다 — Fable)
  const a = CUT_BOX + 0.12, b = SHOOT;
  if (t < a || t >= b) return null;
  const [vx, vy] = lerpTable(VEST, boxFrame(t));
  const o = ramp(t, a, 0.25);
  return (
    <>
      <div style={{ ...abs(vx - 300, vy - 300, 600, 600), borderRadius: '50%', opacity: 0.8 * o, mixBlendMode: 'screen', background: 'radial-gradient(closest-side, #FFF1B800 44%, #FFF1B880 58%, #FFE9A000 100%)' }} />
      {[[-200, -120, 0.0], [210, -170, 0.15], [-110, -260, 0.3], [250, 50, 0.42]].map(([x, y, d], i) => (
        <Star key={i} x={vx + x} y={vy + y} s={44 * twinkle(t - a, d, 0.4)} color="#FFF6CF" rot={t * 60} />
      ))}
    </>
  );
};

const PriceCallout: React.FC<{ t: number }> = ({ t }) => {   // 값도 — 조끼를 스캔한 결과. 끝까지 진지하게
  const a = w(4, 0);
  if (t < a - 0.02 || t >= CUT_OWL) return null;
  const q = ramp(t, a, 0.16);
  return (
    <>
      <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0, zIndex: 20, opacity: q }}>
        <circle cx={CALLOUT_FROM[0]} cy={CALLOUT_FROM[1]} r={10} fill={ALIEN} />
        <path d={`M${CALLOUT_FROM[0]} ${CALLOUT_FROM[1]}L${CALLOUT_AT[0] + 16} ${CALLOUT_AT[1] + 112}`} stroke={ALIEN} strokeWidth={5} />
      </svg>
      <div style={{ ...abs(CALLOUT_AT[0], CALLOUT_AT[1]), zIndex: 21, opacity: q, transform: `translateY(${(1 - q) * 10}px)`, background: chipBg, borderRadius: 16, padding: '13px 24px 16px', fontFamily: KO }}>
        <div style={{ fontWeight: 600, fontSize: 32, color: ALIEN }}>가격 스캔</div>
        <div style={{ fontWeight: 800, fontSize: 50, color: '#fff', letterSpacing: '-0.03em', whiteSpace: 'nowrap' }}>지구 화폐 기준 껌값</div>
      </div>
    </>
  );
};

const Halo: React.FC<{ t: number }> = ({ t }) => {   // 착하고 — 착하니까 개 머리 위에 천사 고리
  const a = w(4, 1);
  if (t < a - 0.02 || t >= CUT_OWL) return null;
  const s = Math.min(1.06, pop(t, a, 0.22));
  const y = 700 + Math.sin(t * 6) * 6;
  return (
    <>
      <svg width={300} height={110} viewBox="0 0 340 120" style={{ position: 'absolute', left: 295 - 150, top: y - 55, transform: `scale(${s})`, filter: 'drop-shadow(0 0 20px #FFE27Add)' }}>
        <ellipse cx={170} cy={60} rx={140} ry={38} fill="none" stroke="#FFE27A" strokeWidth={20} />
        <ellipse cx={170} cy={60} rx={140} ry={38} fill="none" stroke="#FFF8D6" strokeWidth={6} />
      </svg>
      {[[170, 760, 0.08], [430, 720, 0.28], [120, 900, 0.5], [470, 880, 0.7]].map(([x, yy, d], i) => <Star key={i} x={x} y={yy} s={34 * twinkle(t, a + d, 0.5)} color="#FFF6CF" rot={t * 80} />)}
    </>
  );
};

const Product: React.FC<{ t: number }> = ({ t }) => {   // 첨벙댕 구명조끼 — 스티커 두 장을 철썩. 조끼가 붙는 순간
  const a = w(3, 0), b = w(4, 0) - 0.07;
  if (t < a || t >= b) return null;
  const p = pop(t, a, 0.24), q = pop(t, w(3, 1), 0.24), [sx, sy] = shake(t, w(3, 1), 20);
  return (
    <div style={{ ...abs(46, 1346, 990), zIndex: 21, transform: `translate(${sx}px,${sy}px) rotate(-3deg)`, transformOrigin: 'left bottom' }}>
      <div style={{ position: 'relative', zIndex: 1, display: 'inline-block', ...big(88, '#FFFFFF'), background: INK, padding: '12px 26px 18px', borderRadius: 18, marginBottom: -6, transform: `scale(${Math.min(1, p)})`, transformOrigin: 'left bottom' }}>첨벙댕</div>
      <br />
      {t >= w(3, 1) && <div style={{ display: 'inline-block', ...big(180, INK), background: LEMON, padding: '16px 36px 26px', borderRadius: 26, boxShadow: `10px 14px 0 ${INK}`, transform: `scale(${1.22 - 0.22 * Math.min(1, q)})`, transformOrigin: 'left center' }}>구명조끼!</div>}
    </div>
  );
};

const Tough: React.FC<{ t: number }> = ({ t }) => {   // 튼튼 — 딱지가 조끼 위에 쿵 떨어져 불꽃이 튀고 튕긴다. 조끼도 개도 꿈쩍 안 한다
  const a = w(4, 2), b = w(5, 0);
  if (t < a || t >= b) return null;
  const land = a + 0.1, k = t - land;
  let y = 0, rot = 2;
  if (k < 0) { const u = (t - a) / 0.1; y = (1 - u * u) * -760; rot = -3; }
  else if (k < 0.26) { const u = k / 0.26; y = -120 * 4 * u * (1 - u); rot = 2 + Math.sin(u * Math.PI) * 5; }
  else if (k < 0.42) { const u = (k - 0.26) / 0.16; y = -30 * 4 * u * (1 - u); rot = 2 - Math.sin(u * Math.PI) * 2; }
  const [sx, sy] = shake(t, land, 30, 0.35);
  const sparks = k >= 0 && k < 0.38 ? [[600, 706], [790, 712], [985, 704]].flatMap(([x0, y0], g) => Array.from({ length: 7 }, (_, i) => {
    const ang = -Math.PI * (0.12 + 0.76 * ((i + g * 0.37) / 6.4)), v = 620 + ((i * 53 + g * 29) % 260);
    const at = (u: number) => [x0 + Math.cos(ang) * v * u, y0 + Math.sin(ang) * v * u + 1500 * u * u];
    const [x1, y1] = at(k), [x2, y2] = at(Math.max(0, k - 0.035));
    return <line key={`${g}${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#FFE9A8" strokeWidth={5} strokeLinecap="round" opacity={1 - k / 0.38} />;
  })) : [];
  return (
    <>
      <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0, zIndex: 20 }}>{sparks}</svg>
      <div style={{ ...abs(0, 430 + y, 1040), zIndex: 21, textAlign: 'right', transform: `translate(${sx}px,${sy}px) rotate(${rot}deg)`, transformOrigin: '780px 270px' }}>
        <span style={{ display: 'inline-block', ...big(226, INK), background: LEMON, padding: '20px 48px 30px', borderRadius: 28, boxShadow: `12px 16px 0 ${INK}` }}>튼튼</span>{/* 깜짝!과 같은 딱지 — 은색 입체 글자는 편에서 혼자 결이 달라 「옛날 예능 자막」으로 읽혔다(11-05 맹검 둘, 점검표 16번) */}
      </div>
    </>
  );
};

const Handles: React.FC<{ t: number }> = ({ t }) => {   // 손잡이 두 개 — 조준 표시가 찰칵 잠긴다
  const a = w(5, 1), a2 = w(5, 2), b = CUT_CLAW;
  if (t < a || t >= b) return null;
  return (
    <>
      <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0, zIndex: 21 }}>
        <LockMark x={650} y={692} r={76} t={t} at={a} />
        <LockMark x={838} y={688} r={76} t={t} at={a2} />
      </svg>
      <LockLabel x={470} y={480} t={t} at={a} text="손잡이 1" />
      <LockLabel x={770} y={480} t={t} at={a2} text="손잡이 2" />
    </>
  );
};

const ClawLight: React.FC<{ t: number; f: number }> = ({ t, f }) => {   // 번쩍의 빛줄기는 하늘에만 — 개 · 집게 · 바다는 앞판(집게앞판.py)이 그 위에 온다
  const a = w(5, 5), b = CUT_GLAM;
  if (t < a - 0.01 || t >= b) return null;
  const rayO = (1 - ramp(t, b - 0.25, 0.25)) * Math.min(1, (t - a) / 0.05);
  return (
    <>
      <Rays cx={570} cy={560} n={16} r={1800} color="#FFE27A" opacity={0.6 * rayO} rot={(t - a) * 70} />
      <Img src={staticFile(`p11/claw_fg/${String(f - 330).padStart(3, '0')}.png`)} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920 }} />
    </>
  );
};

const Bbeon: React.FC<{ t: number }> = ({ t }) => {   // 번쩍 — 정말로 번쩍. 글자 위로 빛이 세 번 훑고 지나간다
  const a = w(5, 5), b = CUT_GLAM;
  if (t < a - 0.01 || t >= b) return null;
  const flash = Math.max(1 - ramp(t, a, 0.16, (x) => x), 0.42 * twinkle(t, a + 0.22, 0.14), 0.22 * twinkle(t, a + 0.46, 0.12));
  const p = pop(t, a, 0.24), [sx, sy] = shake(t, a, 28, 0.5);
  const k = t - a, sweep = ((k / 0.34) % 1) * 170 - 35;
  return (
    <>
      {[[150, 470, 0.05], [930, 500, 0.15], [200, 900, 0.3], [900, 860, 0.4], [760, 240, 0.5], [320, 240, 0.62], [176, 1420, 0.12], [930, 1660, 0.34]].map(([x, y, d], i) => <Star key={i} x={x} y={y} s={(i > 5 ? 130 : 95) * twinkle(t, a + d, 0.42)} color="#fff" rot={t * 90} />)}
      <div style={{ ...abs(0, 1362, 1080), zIndex: 22, textAlign: 'center', transform: `translate(${sx}px,${sy}px) rotate(-4deg) scale(${(1.9 - 0.9 * Math.min(1, p)) * Math.min(1, p * 1.5)})`, filter: 'drop-shadow(0 0 30px #FFD43Bb0) drop-shadow(8px 12px 0 #17224D)' }}>
        <span style={{ ...big(320, 'transparent'), backgroundImage: `linear-gradient(105deg, #FFB800 ${sweep - 20}%, #FFF3B0 ${sweep - 7}%, #FFFFFF ${sweep}%, #FFF3B0 ${sweep + 7}%, #FFB800 ${sweep + 20}%)`, WebkitBackgroundClip: 'text', backgroundClip: 'text', paddingRight: 20 }}>번쩍!</span>
      </div>
      <AbsoluteFill style={{ zIndex: 23, background: '#fff', opacity: flash }} />
    </>
  );
};

const Glam: React.FC<{ t: number }> = ({ t }) => {   // 멋있게 — 명품 향수 광고 흉내: 검은 띠가 닫히고, 띠가 열리면 개가 떠 있다
  const a = w(6, 2), b = w(7, 0);
  if (t < CUT_GLAM || t >= b + 0.2) return null;
  const open = ramp(t, CUT_GLAM, 0.22) * (1 - ramp(t, b, 0.18));
  const o = ramp(t, a, 0.4) * (1 - ramp(t, b - 0.12, 0.12));
  const sweep = ramp(t, CUT_GLAM + 0.1, 1.4, (x) => x);
  return (
    <>
      <AbsoluteFill style={{ background: `linear-gradient(115deg, #fff0 ${sweep * 130 - 30}%, #ffffffb0 ${sweep * 130 - 22}%, #fff0 ${sweep * 130 - 14}%)`, mixBlendMode: 'screen', opacity: 0.8 * (1 - ramp(t, b - 0.3, 0.3)) }} />
      {[[300, 500, 0.1], [810, 430, 0.45], [420, 620, 0.8], [720, 700, 1.1], [540, 300, 1.35]].map(([x, y, d], i) => <Star key={i} x={x} y={y} s={70 * twinkle(t, CUT_GLAM + d, 0.55)} color="#fff" rot={t * 40} />)}
      <div style={{ ...abs(0, -190 + open * 190, 1080, 190), zIndex: 20, background: '#000' }} />
      <div style={{ ...abs(0, 1920 - open * 440, 1080, 440), zIndex: 20, background: '#000' }} />
      <div style={{ ...abs(0, 118, 1080), zIndex: 21, textAlign: 'center', opacity: o, fontFamily: KO, fontWeight: 500, fontSize: 44, color: '#ffffffe0' }}>※ 고글 별매</div>
      <div style={{ ...abs(0, 1508, 1080), zIndex: 21, textAlign: 'center', opacity: o, color: '#fff' }}>
        <div style={{ fontFamily: KO, fontWeight: 200, fontSize: 118, lineHeight: 1.05, letterSpacing: `${0.2 + ramp(t, a, 1, (x) => x) * 0.1}em`, textIndent: '0.2em' }}>멋있게</div>
        <div style={{ fontFamily: EN, fontSize: 32, letterSpacing: '0.46em', textIndent: '0.46em', marginTop: 10, color: '#ffffffcc' }}>POUR CHIEN</div>
      </div>
    </>
  );
};

const AlienQ: React.FC<{ t: number }> = ({ t }) => {   // 외계인? — 뜬 발이 보이게 수건 아래쪽에 가로로, 처음 그 초록 글자를 다시 부른다
  const a = w(7, 1), b = CUT_DROP + 0.3;
  if (t < a || t >= b) return null;
  return (
    <div style={{ ...abs(0, 1548, 1080), zIndex: 21, textAlign: 'center', whiteSpace: 'nowrap', opacity: 1 - ramp(t, b - 0.06, 0.06) }}>
      <span style={{ display: 'inline-block', background: chipBg, borderRadius: 22, padding: '10px 34px 18px', transform: `scale(${Math.min(1.04, pop(t, a, 0.26))})` }}>
        {'외계인?'.split('').map((c, i) => {
          const k = t - a - i * 0.1;
          return <GlitchLetter key={i} c={c} size={132} t={t} i={i} style={{ opacity: k > 0 ? 1 : 0, transform: `translateY(${Math.sin(t * 5 + i) * 6}px) rotate(${i === 3 ? Math.sin(k * 5) * 18 : Math.sin(t * 3 + i) * 4}deg)` }} />;
        })}
      </span>
    </div>
  );
};

const Splash: React.FC<{ t: number }> = ({ t }) => {   // 첨벙댕 — 말 그대로 첨벙, 글자마다 물이 튀고 차올라 출렁인다. 판을 깔지 않는다
  const a = w(8, 3);
  if (t < a || t >= SPACE_AT) return null;
  const at = [a, a + 0.27, a + 0.54];
  const tag = a + 1.36, joke = a + 1.66;   // 22.05 — Kevin 끝 줄 「우주」
  const q = ramp(t, tag, 0.3), r = ramp(t, joke, 0.3);
  const [sx, sy] = shake(t, a, 24, 0.5);
  const W = 268, H = 330, FS = 300;
  const glyph: React.CSSProperties = { fontFamily: KO, fontWeight: 900, fontSize: FS };
  return (
    <>
      <div style={{ ...abs(0, 158, 1080), zIndex: 21, textAlign: 'center', whiteSpace: 'nowrap', transform: `translate(${sx}px,${sy}px)` }}>
        {'첨벙댕'.split('').map((c, i) => {
          const k = t - at[i];
          const s = k < 0 ? 0 : Math.min(1.12, pop(t, at[i], 0.26));
          const level = H - (H - 118) * ramp(t, at[i] + 0.05, 0.9) + Math.sin(t * 5 + i * 1.7) * 5;
          const pts = Array.from({ length: 31 }, (_, n) => { const x = (n * W) / 30; return `${x} ${level + Math.sin(x / 42 + t * 6.5 + i) * 9}`; }).join('L');
          const drops = k >= 0 && k < 0.55 ? Array.from({ length: 9 }, (_, n) => {
            const ang = -Math.PI * (0.1 + 0.8 * (n / 8)), v = 420 + ((n * 67 + i * 31) % 300);
            return <circle key={n} cx={W / 2 + Math.cos(ang) * v * k} cy={H * 0.75 + Math.sin(ang) * v * k + 1300 * k * k} r={5 + (n % 3) * 3} fill="#7FE7EE" opacity={1 - k / 0.55} />;
          }) : null;
          return (
            <svg key={i} width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'inline-block', overflow: 'visible', opacity: k < 0 ? 0 : 1, transform: `translateY(${Math.sin(t * 3.2 + i * 1.4) * 8}px) rotate(${Math.sin(t * 2.4 + i) * 2.5 + (1 - Math.min(1, s)) * 18}deg) scale(${s})`, filter: 'drop-shadow(0 8px 12px #0E132040)' }}>
              <defs><clipPath id={`waterGlyph${i}`}><text x={W / 2} y={262} textAnchor="middle" style={glyph}>{c}</text></clipPath></defs>
              <text x={W / 2} y={262} textAnchor="middle" fill={NAVY} style={glyph}>{c}</text>
              <g clipPath={`url(#waterGlyph${i})`}>
                <path d={`M${pts}L${W} ${H + 20}L0 ${H + 20}Z`} fill="#12B5C4" />
                <path d={`M${pts}`} fill="none" stroke="#A6F3F8" strokeWidth={7} />
              </g>
              {drops}
            </svg>
          );
        })}
      </div>
      {t >= tag && <div style={{ ...abs(0, 492, 1080), zIndex: 21, textAlign: 'center', opacity: q, transform: `translateY(${(1 - q) * 14}px)`, ...big(62, NAVY) }}>반려견 구명조끼</div>}
      {t >= joke && <div style={{ ...abs(0, 1540, 1080), zIndex: 21, textAlign: 'center', opacity: r, transform: `translateY(${(1 - r) * 12}px)` }}><span style={{ fontFamily: KO, fontWeight: 700, fontSize: 56, letterSpacing: '-0.02em', color: PAPER, background: '#0E1320e0', padding: '10px 26px 12px', borderRadius: 10 }}>※ 우주에서도 뜹니다</span></div>}
    </>
  );
};

const Beam: React.FC<{ t: number }> = ({ t }) => {   // 천장에서 내려오는 납치 빔 — 띠가 열리면 켜져 있고, 뚝 꺼지면 개가 떨어진다. 개 색을 덮지 않게 빛으로만(screen) 얹는다
  const a = BEAM_ON;
  if (t < a || t >= BEAM_OFF) return null;
  const on = Math.min(1, (t - a) / 0.12) * (0.88 + 0.12 * Math.sin(t * 46));
  const cx = 560, x0 = 130, x1 = 440, H = 1920;   // 위 · 아래 반폭
  const halfAt = (y: number) => x0 + ((x1 - x0) * y) / H;
  const edge = `M${cx - x0} -40L${cx - x1} ${H}M${cx + x0} -40L${cx + x1} ${H}`;
  const rings = [0, 1, 2].map((i) => {
    const k = (t * 0.7 + i / 3) % 1, y = 1500 - k * 1250, rx = halfAt(y) * 0.86, ry = rx * 0.14, o = Math.sin(k * Math.PI);
    return (
      <g key={i} opacity={o}>
        <path d={`M${cx - rx} ${y}A${rx} ${ry} 0 0 1 ${cx + rx} ${y}`} fill="none" stroke="#EAFFB0" strokeWidth={4} opacity={0.28} />
        <path d={`M${cx - rx} ${y}A${rx} ${ry} 0 0 0 ${cx + rx} ${y}`} fill="none" stroke="#F2FFC8" strokeWidth={8} opacity={0.8} />
      </g>
    );
  });
  const dots = Array.from({ length: 22 }, (_, i) => {
    const y = 1760 - ((t * 260 + i * 97) % 1700), h = halfAt(y), x = cx + (((i * 137) % 200) / 100 - 1) * h * 0.82 + Math.sin(t * 3 + i) * 12;
    return <circle key={i} cx={x} cy={y} r={3 + (i % 3) * 1.8} fill="#F8FFE0" opacity={0.75} />;
  });
  return (
    <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0, opacity: on, mixBlendMode: 'screen' }}>
      <defs>
        <filter id="beamWide" x="-30%" y="-10%" width="160%" height="120%"><feGaussianBlur stdDeviation="30" /></filter>
        <filter id="beamEdge" x="-30%" y="-10%" width="160%" height="120%"><feGaussianBlur stdDeviation="16" /></filter>
        <filter id="beamRing" x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="2.2" /></filter>
      </defs>
      <path d={`M${cx - x0} -40L${cx + x0} -40L${cx + x1} ${H}L${cx - x1} ${H}Z`} fill="#BFF06A" opacity={0.13} filter="url(#beamWide)" />
      <path d={edge} stroke="#CFFF7A" strokeWidth={46} opacity={0.62} fill="none" filter="url(#beamEdge)" />
      <g filter="url(#beamRing)">{rings}{dots}</g>
    </svg>
  );
};

const GOG = [[84, 655, 867], [90, 674, 875], [96, 671, 860], [102, 654, 851], [108, 637, 865], [114, 626, 869], [120, 621, 875]];   // p11-b11 장, 주황 테 중심
const LensGlow: React.FC<{ t: number }> = ({ t }) => {   // 끝 한 방 — 물에 뜬 무표정한 개의 고글이 초록으로 켜진다
  const a = 22.07;   // Kevin 「우주」에서 켜진다
  if (t < a || t >= BLACK_AT) return null;
  const on = ramp(t, a, 0.12, (x) => x) * (0.84 + 0.16 * Math.sin(t * 22));
  const glow = (x: number, y: number, w: number, h: number, i: number) => (
    <div key={i} style={{ ...abs(x - w / 2, y - h / 2, w, h), borderRadius: '50%', opacity: on, mixBlendMode: 'screen', background: `radial-gradient(closest-side, #F4FFD0 0%, ${ALIEN} 26%, ${ALIEN}66 52%, ${ALIEN}00 100%)` }} />
  );
  // 우주에서도 켜진 채 — 물에서 켜진 초록이 우주 판에서 파랑으로 돌아가 「가장 큰 불일치」였다(11-05 Fable). p11-s1 판의 개는 제자리라 렌즈 자리를 한 번 잰 값으로 둔다
  if (t >= SPACE_AT) return <>{[[805, 996], [918, 1001]].map(([x, y], i) => glow(x, y, 150, 120, i))}</>;
  const [gx, gy] = lerpTable(GOG, (t - CUT_DROP) * FPS);
  return <>{[[-126, 30], [98, 25]].map(([dx, dy], i) => glow(gx + dx, gy + dy, 270, 220, i))}</>;
};

// ── 카메라(판 전체를 움직인다)
const camera = (t: number) => {
  let s = 1, ox = 540, oy = 760;
  const kk = w(1, 3);
  if (t >= kk && t < CUT_BOX) { s = 1 + 0.3 * ramp(t, kk, 0.1) * (1 - ramp(t, kk + 0.34, 0.5)); ox = 470; oy = 300; }   // 깜짝 — 두 사람으로 확 당겼다가, 넘어지는 건 다 보이게 물러난다
  if (t >= CUT_BOX && t < CUT_OWL) {   // 조끼가 붙는 순간 개로 확 당겨 끝까지 둔다
    ox = 100; oy = 1100;
    s = 1 + 0.38 * ramp(t, VEST_SLAM, 0.12);
  }
  if (t >= CUT_OWL && t < CUT_CLAW) { s = 1.2; ox = 540; oy = 800; }   // 고개가 잘 보이게
  const [a1, b1] = shake(t, w(3, 1), 20, 0.32);
  const [a0, b0] = shake(t, VEST_SLAM, 26, 0.4);
  const [a2, b2] = shake(t, w(4, 2) + 0.09, 26, 0.35);
  const [a3, b3] = shake(t, w(5, 5), 24, 0.5);
  const [a4, b4] = shake(t, w(8, 3), 22, 0.6);
  const [a5, b5] = shake(t, kk, 18, 0.35);
  return { s, ox, oy, x: a0 + a1 + a2 + a3 + a4 + a5, y: b0 + b1 + b2 + b3 + b4 + b5 };
};

export const P11B: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const c = camera(t);
  const l = lineAt(t);
  const spoken = l && l !== LINES[3] && l !== LINES[6] && !(l === LINES[8] && t >= w(8, 3) + 0.1);
  return (
    <AbsoluteFill style={{ background: '#000', overflow: 'hidden' }}>
      <AbsoluteFill style={{ transform: `translate(${c.x}px,${c.y}px) scale(${c.s * (c.x || c.y ? 1.03 : 1)})`, transformOrigin: `${c.ox}px ${c.oy}px` }}>
        <OffthreadVideo src={staticFile('p11/picture_b.mp4')} muted style={{ width: '100%', height: '100%' }} />
        <HolyLight t={t} />
        <Telekinesis t={t} />
        <Halo t={t} />
        <ClawLight t={t} f={f} />
        <Beam t={t} />
        <LensGlow t={t} />
      </AbsoluteFill>
      <Hud t={t} />
      <Alien t={t} />
      <Moon t={t} />
      <HumanScan t={t} />
      <Kkam t={t} />
      <Product t={t} />
      <PriceCallout t={t} />
      <Tough t={t} />
      <Handles t={t} />
      <Bbeon t={t} />
      <Glam t={t} />
      <AlienQ t={t} />
      <Splash t={t} />
      {/* 말자막 */}
      {spoken && l && (() => {
        const ws = l === LINES[8] ? l.words.slice(0, 3) : l.words;
        const cut = splitAt(ws);
        const o = life(t, l.at - 0.05, l.end + 0.35, 0.1, 0.1);
        return <div style={{ ...abs(72, t >= CUT_CLAW && t < CUT_GLAM ? 1696 : l === LINES[7] ? 1716 : 1540, 936), zIndex: 25, textAlign: 'center', opacity: o }}><span style={{ fontFamily: KO, fontWeight: 650, fontSize: 52, lineHeight: 1.32, color: PAPER, background: '#0E1320e0', boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone', padding: '10px 22px', borderRadius: 10 }}>{ws.map((x, i) => <React.Fragment key={i}>{i === cut ? <br /> : null}<span style={{ color: x.key && t >= x.t ? LEMON : PAPER }}>{i === ws.length - 1 ? noDot(x.w).replace(/,$/, '') : noDot(x.w)}</span>{i < ws.length - 1 && i + 1 !== cut ? ' ' : ''}</React.Fragment>)}</span></div>;
      })()}
      {l === LINES[6] && <div style={{ ...abs(0, 1716, 1080), zIndex: 25, textAlign: 'center', opacity: life(t, CUT_GLAM + 0.2, l.end + 0.1, 0.1, 0.1), fontFamily: KO, fontWeight: 400, fontSize: 48, color: PAPER, letterSpacing: '0.01em' }}>{l.words.map((x) => noDot(x.w)).join(' ')}</div>}
      {t < BLACK_AT && <div style={{ ...abs(0, 1866, 1080), zIndex: 30, textAlign: 'center', fontFamily: KO, fontWeight: 500, fontSize: 24, color: '#ffffffeb' }}>
        <span style={{ background: '#0E132073', padding: '4px 14px 5px', borderRadius: 8 }}>가상 브랜드 · AI로 만든 가상 모델 · 음성</span>
      </div>}
      {t >= BLACK_AT && <div style={{ ...abs(0, 0, 1080, 1920), zIndex: 60, background: '#000' }} />}
      <Audio src={staticFile('p11/sound_b.wav')} />
    </AbsoluteFill>
  );
};
