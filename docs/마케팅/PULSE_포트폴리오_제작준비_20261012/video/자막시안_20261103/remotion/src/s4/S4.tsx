// 시즌 4 블프 스나이퍼 「느지막」 33초(원본 Target 「Montage」 32.15초) — 작전명 글판 · 훈련 꼬리표 · D-숫자 · 「블프 OPEN」 · 알림 · 끝(2026-11-07, Claude).
// 정보 농담은 한 말투로(점검표 16번) — 저격수 조준경 같은 표시(모서리 꺾쇠 · 고정폭 글자 · 호박색 · 달력 빨강)로 꼬리표와 D-숫자를 모은다.
// 화면 · 소리는 bf-sniper-20261025/최종편집.py가 public/s4/에 둔다. 시각은 02_콘티 2절(끝은 11-07 가게 목소리를 끊지 않고 이어 33.46초 — 판 끝 32.03초 뒤는 원본 20번처럼 검은 화면 · 코골이 한 번).
//   end="scene"(기본): 잠든 장면 위 한 묶음(점검표 1 · 6번 — 마침표 없음).  end="card": 콘티의 글 네 덩이 끝 카드(견줄 판).
import React from 'react';
import { AbsoluteFill, OffthreadVideo, staticFile, useCurrentFrame } from 'remotion';
import { Audio } from '@remotion/media';
import { KO, MONO } from '../lib/fonts';
import { EXPO, pop, ramp } from '../lib/motion';
import { Logo } from '../bf/Logo';
import spots from './자리.json';

const FPS = 24;
export const S4_FRAMES = 803;   // 33.46초 — 11-07 가게 목소리를 끊지 않고 이어 원본 20번(검은 화면 · 코골이)을 살림
const AMBER = '#FFB547', RED = '#E5383B', PAPER = '#F2EDE4';
const T = [0, 1.0, 2.68, 5.27, 7.61, 8.61, 10.45, 13.8, 15.09, 16.72, 17.23, 17.9, 18.94, 19.4, 20.7, 21.37, 23.04, 25.3, 26.17, 31.11, 33.46].map((x) => Math.round(x * FPS) / FPS);
const cutAt = (t: number) => { let i = 0; while (i < T.length - 2 && t >= T[i + 1] - 1e-6) i++; return i + 1; };   // 1 … 20

// 훈련 꼬리표(02_콘티 1절) — 같은 훈련이 이어지는 컷(10 → 11, 16 → 17)은 다시 뜨지 않는다
const TAGS: Record<number, [string, string]> = {
  3: ['01', '체력'], 4: ['02', '폰 근력'], 6: ['03', '장비 점검'], 8: ['04', '소음 차단'], 9: ['05', '위장'], 10: ['06', '반응 속도'], 11: ['06', '반응 속도'],
  12: ['07', '주소 입력'], 14: ['08', '저격 자세'], 16: ['09', '호흡'], 17: ['09', '호흡'],
};
const DDAY: Record<number, string> = { 2: 'D-7', 5: 'D-3', 13: 'D-2', 15: 'D-1', 18: 'D-DAY' };

// 7번 — 「반값…」 속삭임에 맞춰 목표를 박는다(11-07 낯선이 시험 「무엇의 반값인지 · 무엇과 싸우는지 모름」)
const Target: React.FC<{ t: number; cut: number }> = ({ t, cut }) => {
  if (cut !== 7) return null;
  const at = 10.74;
  const q = ramp(t, at, 0.16, EXPO);
  if (q <= 0) return null;
  return (
    <div style={{ position: 'absolute', right: 70, top: 58, opacity: q, textShadow: shadow }}>
      <div style={{ position: 'relative', padding: '14px 26px 16px 24px', background: 'rgba(12,12,16,0.5)', backdropFilter: 'blur(6px)', borderRadius: 2 }}>
        <div style={{ position: 'absolute', inset: 0 }}><Brackets w={0} h={0} color={RED} q={q} /></div>
        <div style={{ fontFamily: MONO, fontWeight: 500, fontSize: 27, letterSpacing: '0.2em', color: RED }}>{typed('TARGET LOCKED', t, at, 60)}</div>
        <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 58, color: '#FFFFFF', marginTop: 4, letterSpacing: '-0.01em' }}>75인치 TV 반값</div>
      </div>
    </div>
  );
};

const shadow = '0 2px 10px rgba(0,0,0,0.55), 0 0 2px rgba(0,0,0,0.6)';

const Brackets: React.FC<{ w: number; h: number; color: string; q: number; th?: number }> = ({ w, h, color, q, th = 3 }) => {
  const L = 22 * q;
  const s = (x: React.CSSProperties): React.CSSProperties => ({ position: 'absolute', width: L, height: L, borderColor: color, borderStyle: 'solid', borderWidth: 0, ...x });
  return (
    <>
      <div style={s({ left: 0, top: 0, borderLeftWidth: th, borderTopWidth: th })} />
      <div style={s({ right: 0, top: 0, borderRightWidth: th, borderTopWidth: th })} />
      <div style={s({ left: 0, bottom: 0, borderLeftWidth: th, borderBottomWidth: th })} />
      <div style={s({ right: 0, bottom: 0, borderRightWidth: th, borderBottomWidth: th })} />
      <div style={{ width: w, height: h }} />
    </>
  );
};

const typed = (s: string, t: number, at: number, cps = 26) => s.slice(0, Math.max(0, Math.floor((t - at) * cps)));

const TrainTag: React.FC<{ t: number; cut: number }> = ({ t, cut }) => {
  const tag = TAGS[cut];
  if (!tag) return null;
  // 이어지는 컷이면 첫 컷의 시작 시각으로 센다(다시 튀지 않게)
  let first = cut;
  while (TAGS[first - 1] && TAGS[first - 1][0] === tag[0]) first--;
  const at = T[first - 1] + 0.06;
  const q = ramp(t, at, 0.16, EXPO);
  return (
    <div style={{ position: 'absolute', right: 70, top: 58, opacity: q, textShadow: shadow }}>
      <div style={{ position: 'relative', padding: '14px 26px 16px 24px', background: 'rgba(12,12,16,0.5)', backdropFilter: 'blur(6px)', borderRadius: 2 }}>
        <div style={{ position: 'absolute', inset: 0 }}><Brackets w={0} h={0} color={AMBER} q={q} /></div>
        <div style={{ fontFamily: MONO, fontWeight: 500, fontSize: 27, letterSpacing: '0.2em', color: AMBER }}>{typed(`TRAINING ${tag[0]}`, t, at, 60)}</div>
        <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 58, color: '#FFFFFF', marginTop: 4, letterSpacing: '-0.01em' }}>훈련 · {tag[1]}</div>
      </div>
    </div>
  );
};

const DCount: React.FC<{ t: number; cut: number }> = ({ t, cut }) => {
  const d = DDAY[cut];
  if (!d) return null;
  const at = T[cut - 1] + 0.04;
  const q = ramp(t, at, 0.14, EXPO);
  const big = cut === 18;
  return (
    <div style={{ position: 'absolute', left: 70, top: 56, opacity: q }}>
      <div style={{ position: 'relative', padding: '12px 26px 16px 24px', background: 'rgba(255,252,246,0.92)', boxShadow: '0 6px 18px rgba(0,0,0,0.18)', borderRadius: 2 }}>
        <div style={{ position: 'absolute', inset: 0 }}><Brackets w={0} h={0} color={RED} q={q} /></div>
        <div style={{ fontFamily: MONO, fontWeight: 500, fontSize: 24, letterSpacing: '0.2em', color: RED }}>COUNTDOWN</div>
        <div style={{ fontFamily: MONO, fontWeight: 500, fontSize: big ? 136 : 128, lineHeight: 1, color: RED, letterSpacing: '0.02em', transform: `scale(${0.85 + 0.15 * pop(t, at, 0.3)})`, transformOrigin: 'left center',
          textShadow: '0 0 1px rgba(120,0,0,0.4)' }}>{d}</div>
        <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 38, color: '#2A2522', marginTop: 8 }}>11/27 00:00 블프</div>
      </div>
    </div>
  );
};

// 1번 — 검은 화면 위 작전 문서 한 줄(타자기처럼, 속삭임 「작전명… 블프」에 맞춤)
const Title: React.FC<{ t: number }> = ({ t }) => {
  if (t >= T[1]) return null;
  const head = ramp(t, 0.02, 0.2);
  const a = typed('작전명:', t, 0.12, 9), b = typed(' 블프', t, 0.74, 14);   // 띄어쓰기는 줄바꿈 없는 칸(플렉스 안 맨 앞 칸은 사라진다)
  const cursor = Math.floor(t * 6) % 2 === 0;
  const line = ramp(t, 0.86, 0.12, EXPO);
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', display: 'flex', flexDirection: 'column' }}>
      <div style={{ fontFamily: MONO, fontWeight: 500, fontSize: 22, letterSpacing: '0.42em', color: AMBER, opacity: head * 0.9, marginBottom: 26 }}>OPERATION FILE · 1127</div>
      <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 104, color: PAPER, letterSpacing: '-0.01em', minWidth: 520, display: 'flex' }}>
        <span>{a}</span><span style={{ color: '#FFFFFF' }}>{b}</span>
        <span style={{ display: 'inline-block', width: 14, marginLeft: 10, height: 92, alignSelf: 'center', background: AMBER, opacity: cursor ? 0.9 : 0 }} />
      </div>
      <div style={{ width: 520 * line, height: 3, background: RED, marginTop: 22, opacity: 0.9 }} />
    </AbsoluteFill>
  );
};

type Spot = { from: number; r: number[][] };
const at = (s: Spot, frame: number) => s.r[Math.max(0, Math.min(s.r.length - 1, frame - s.from))];

// 19 앞 — 가까운 노트북 화면에 「블프 OPEN」(02_콘티 1절, 가까운 화면 하나에만)
const LaptopOpen: React.FC<{ frame: number; t: number }> = ({ frame, t }) => {
  const s = spots.laptop as Spot;
  if (frame < s.from || frame >= s.from + s.r.length) return null;
  const [x0, y0, x1, y1] = at(s, frame);
  const w = x1 - x0, h = y1 - y0;
  return (
    <div style={{ position: 'absolute', left: x0 + w * 0.06, top: y0 + h * 0.08, width: w * 0.88, height: h * 0.84, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: '#FFFDF8', borderRadius: 3, opacity: ramp(t, T[18], 0.08) }}>
      <div style={{ width: '100%', height: h * 0.16, background: '#D67828', marginBottom: h * 0.08 }} />
      <div style={{ fontFamily: KO, fontWeight: 900, fontSize: h * 0.3, lineHeight: 1, color: '#1E1A18', letterSpacing: '-0.02em' }}>블프 OPEN</div>
      <div style={{ fontFamily: KO, fontWeight: 700, fontSize: h * 0.12, marginTop: h * 0.05, color: '#C9402E' }}>75인치 TV 반값</div>
    </div>
  );
};

// 27.1~29.0 — 귀 옆 휴대폰 알림(원본 끝 카드 1 자리). 폰 화면 위로 떠오르는 알림 한 장, 폰을 따라간다
const Notify: React.FC<{ frame: number; t: number }> = ({ frame, t }) => {
  const a = 27.1, b = 29.02;
  if (t < a - 0.01 || t >= b) return null;
  const s = spots.phone as Spot;
  const [x0, y0, x1] = at(s, frame);
  // 11-07 Fable 「알림 카드가 휴대폰이 아니라 카펫 위 공중에 떠 있음」 → 폰 화면에서 솟아올라 제자리로, 폰과 카드 사이 빛줄
  const rise = ramp(t, a, 0.32, EXPO), out = ramp(t, b - 0.18, 0.18);
  const W = 700;
  const px = (x0 + x1) / 2;
  const left = Math.min(1920 - W - 40, Math.max(40, px - W / 2));
  const topEnd = y0 - 190;
  const top = y0 + (topEnd - y0) * rise;
  const sc = 0.25 + 0.75 * rise;
  return (
    <>
      <div style={{ position: 'absolute', left: x0 - 30, top: y0 - 30, width: x1 - x0 + 60, height: 100, borderRadius: 40, background: 'radial-gradient(ellipse, rgba(200,230,255,0.45), rgba(200,230,255,0))', opacity: Math.max(0, 1 - (t - a) / 1.4) }} />
      <div style={{ position: 'absolute', left: px - 2, top: top + 120, width: 4, height: Math.max(0, y0 - top - 110), background: 'linear-gradient(rgba(230,240,255,0.0), rgba(230,240,255,0.55))', opacity: (1 - out) * 0.8 }} />
      <div style={{ position: 'absolute', left, top, width: W, opacity: Math.min(1, rise * 1.6) * (1 - out), transform: `scale(${sc})`, transformOrigin: `${px - left}px 120px`,
        borderRadius: 30, padding: '20px 26px', background: 'rgba(28,30,38,0.84)', border: '1px solid rgba(255,255,255,0.16)', boxShadow: '0 12px 40px rgba(0,0,0,0.45)', display: 'flex', gap: 18, alignItems: 'center' }}>
        <div style={{ width: 70, height: 70, borderRadius: 18, background: '#E8913A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Logo name="neujimak" width={54} color="#FFFFFF" />
        </div>
        <div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
            <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 34, color: '#FFFFFF' }}>느지막</div>
            <div style={{ fontFamily: KO, fontWeight: 600, fontSize: 24, color: 'rgba(255,255,255,0.55)' }}>지금</div>
          </div>
          <div style={{ fontFamily: KO, fontWeight: 600, fontSize: 40, color: '#FFFFFF', marginTop: 4, letterSpacing: '-0.01em' }}>주무세요, 선착순 없어요</div>
        </div>
      </div>
    </>
  );
};

// 끝(29.1~) — 판 없이 잠든 장면 위 한 묶음(기본)
const EndScene: React.FC<{ t: number }> = ({ t }) => {
  const a = 28.81;
  if (t < a) return null;
  // 11-07 Fable 「3초 동안 한 번도 안 움직여 붙여 넣은 판」 → 가게 목소리에 맞춰 줄마다 조용히 들어온다:
  //   「블프는」(28.85) → 「블프, 자고 일어나서」 · 「선착순」(29.64) → 둘째 줄 · 「내내.」 끝(31.72) → 로고, 32.03 장면이 검게 끝나고 「느지막」(32.05)이 들릴 때 빛이 한 번
  const l1 = ramp(t, a, 0.45, EXPO), l2 = ramp(t, 29.6, 0.45, EXPO), l3 = ramp(t, 31.7, 0.4, EXPO);
  const glow = Math.max(0, 1 - Math.abs(t - 32.25) / 0.3);
  return (
    <>
      <div style={{ position: 'absolute', right: 0, top: 0, width: 1100, height: 1080, background: 'radial-gradient(ellipse at 72% 58%, rgba(6,10,20,0.55), rgba(6,10,20,0) 62%)', opacity: l1 }} />
      <div style={{ position: 'absolute', left: 1170, top: 400, textShadow: '0 2px 18px rgba(0,0,0,0.6)' }}>
        <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 76, lineHeight: 1.12, color: '#FFFFFF', letterSpacing: '-0.02em', opacity: l1, transform: `translateY(${(1 - l1) * 16}px)` }}>블프,<br />자고 일어나서</div>
        <div style={{ fontFamily: KO, fontWeight: 700, fontSize: 50, color: 'rgba(255,255,255,0.94)', marginTop: 20, letterSpacing: '-0.01em', opacity: l2, transform: `translateY(${(1 - l2) * 12}px)` }}>선착순 없이 일주일 내내</div>
        {/* 로고는 27.1초 알림의 주황 앱 아이콘과 한 몸(11-07 Fable 「알림 아이콘(주황)과 한 몸인 그린 로고타입」) · 깨알 줄(가전 · 생활 온라인몰)은 뺌 */}
        <div style={{ marginTop: 46, display: 'flex', alignItems: 'center', gap: 24, opacity: l3, transform: `translateY(${(1 - l3) * 12}px)` }}>
          <div style={{ width: 104, height: 104, borderRadius: 26, background: '#E8913A', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 ${18 + glow * 26}px rgba(255,170,90,${0.25 + glow * 0.5})` }}>
            <Logo name="neujimak" width={80} color="#FFFFFF" />
          </div>
          <Logo name="neujimak" width={300} color="#FFFFFF" glow={glow * 8} glowColor="rgba(255,170,90,0.9)" />
        </div>
      </div>
    </>
  );
};

// 견줄 판 — 콘티의 끝 카드(글 네 덩이)
const EndCard: React.FC<{ t: number }> = ({ t }) => {
  const a = 29.1;
  if (t < a) return null;
  const q = ramp(t, a, 0.35, EXPO);
  return (
    <AbsoluteFill style={{ background: 'rgba(12,14,22,0.82)', opacity: q, alignItems: 'center', justifyContent: 'center', display: 'flex', flexDirection: 'column' }}>
      <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 92, color: '#FFFFFF', letterSpacing: '-0.02em' }}>블프, 자고 일어나서</div>
      <div style={{ marginTop: 40 }}><Logo name="neujimak" width={360} color="#EE9634" /></div>
      <div style={{ fontFamily: KO, fontWeight: 600, fontSize: 34, color: 'rgba(255,255,255,0.85)', marginTop: 36 }}>가전 · 생활 온라인몰 · 선착순 없음 · 블프 반값 일주일 내내</div>
      <div style={{ fontFamily: KO, fontWeight: 700, fontSize: 36, color: '#FFFFFF', marginTop: 22 }}>앱에서 「느지막」 검색</div>
    </AbsoluteFill>
  );
};

export const S4: React.FC<{ end?: 'scene' | 'card' }> = ({ end = 'scene' }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const cut = cutAt(t);
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <OffthreadVideo src={staticFile('s4/picture.mp4')} muted style={{ width: '100%', height: '100%' }} />
      <Title t={t} />
      <TrainTag t={t} cut={cut} />
      <DCount t={t} cut={cut} />
      <Target t={t} cut={cut} />
      <LaptopOpen frame={frame} t={t} />
      <Notify frame={frame} t={t} />
      {/* 19b 판이 32.03초에 끝나 검은 화면으로 — 툭 끊긴 듯 보이지 않게 0.25초 어두워지며(11-07 Fable 재검수 참고) */}
      {end !== 'card' && t >= 31.78 ? <AbsoluteFill style={{ background: '#000', opacity: ramp(t, 31.78, 0.25) }} /> : null}
      {end === 'card' ? <EndCard t={t} /> : <EndScene t={t} />}
      <Audio src={staticFile('s4/sound.wav')} />
    </AbsoluteFill>
  );
};
