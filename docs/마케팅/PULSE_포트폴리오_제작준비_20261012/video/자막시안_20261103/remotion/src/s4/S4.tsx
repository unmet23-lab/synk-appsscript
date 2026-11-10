// 시즌 4 블프 스나이퍼 「느지막」 33초(원본 Target 「Montage」 32.15초) — 작전명 글판 · 훈련 꼬리표 · D-숫자 · 「블프 OPEN」 · 알림 · 끝(2026-11-07, Claude).
// 정보 농담은 한 말투로(점검표 16번) — 저격수 조준경 같은 표시(모서리 꺾쇠 · 고정폭 글자 · 호박색 · 달력 빨강)로 꼬리표와 D-숫자를 모은다.
// 화면 · 소리는 bf-sniper-20261025/최종편집.py가 public/s4/에 둔다. 시각은 02_콘티 2절(끝은 11-07 가게 목소리를 끊지 않고 이어 33.46초 — 판 끝 32.03초 뒤는 원본 20번처럼 검은 화면 · 코골이 한 번).
//   end="scene"(기본): 잠든 장면 위 한 묶음(점검표 1 · 6번 — 마침표 없음).  end="card": 콘티의 글 네 덩이 끝 카드(견줄 판).
import React from 'react';
import { AbsoluteFill, Img, OffthreadVideo, staticFile, useCurrentFrame } from 'remotion';
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
// 11-10(glyph A · B): 11-07 판은 주황 띠 + 굵은 SUIT를 옆으로 흐르는 장면 위에 혼자 또렷하게 얹어 화면 밖으로 삐져나왔다(점검표 46 · 55).
// 전단과 같은 브랜드 웹페이지 그림(블프_작품글자_20261110/노트북화면.py)을 영상 속 흰 화면에 곱하기로 얹어 화면의 빛 · 반사를 살리고,
// 노트북이 한 장에 움직이는 만큼 옆으로 흐리게 한다. 화면 기울기 때문에 자리 네모보다 안쪽(가로 10% · 세로 9%)에 둔다.
// 머리 표지는 판의 끝 로고를 따른다 — A 명조 묶음(laptop_open_A.png) · B 감은 눈 + 가는 글자(laptop_open.png), 노트북화면.py가 둘 다 낸다(11-11).
const LaptopPage: React.FC<{ frame: number; t: number; glyph: Glyph }> = ({ frame, t, glyph }) => {
  const s = spots.laptop as Spot;
  if (frame < s.from || frame >= s.from + s.r.length) return null;
  const [x0, y0, x1, y1] = at(s, frame);
  const prev = at(s, Math.max(s.from, frame - 1));
  const v = Math.abs(x0 - prev[0]);
  const w = x1 - x0, h = y1 - y0;
  return (
    <>
      <svg width={0} height={0} style={{ position: 'absolute' }}>
        <filter id="laptop-mblur" x="-20%" y="-10%" width="140%" height="120%"><feGaussianBlur stdDeviation={`${Math.max(0.6, v * 0.42)} 0.6`} /></filter>
      </svg>
      <Img src={staticFile(glyph === 'A' ? 's4/laptop_open_A.png' : 's4/laptop_open.png')} style={{ position: 'absolute', left: x0 + w * 0.1, top: y0 + h * 0.09, width: w * 0.8, height: h * 0.8, objectFit: 'fill',
        mixBlendMode: 'multiply', filter: 'url(#laptop-mblur)', opacity: ramp(t, T[18], 0.08) }} />
    </>
  );
};

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

// glyph(11-10 슬롭 점검표 55번 훑기 — 폰트 정본 §10): 'now' 11-07 완성본 그대로 · 'A' · 'B'는 잠든 장면 위 카피를 빼고(가게 목소리가 말한다)
// 그린 로고(로고2.json — 늘어진 단선 「느지막」 · 감은 눈 심벌)만 빛 번짐 없이. A는 감은 눈 + 글자, B는 앱 아이콘 + 글자 + 작은 줄 「블프, 자고 일어나서」.
type Glyph = 'now' | 'A' | 'B';

// 27.1~29.0 — 귀 옆 휴대폰 알림(원본 끝 카드 1 자리). 폰 화면 위로 떠오르는 알림 한 장, 폰을 따라간다
const Notify: React.FC<{ frame: number; t: number; glyph?: Glyph }> = ({ frame, t, glyph = 'now' }) => {
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
          {glyph === 'now' ? <Logo name="neujimak" width={54} color="#FFFFFF" />
            : glyph === 'A' ? <Logo name="neujimak_serif_mono" width={46} color="#FFFFFF" />
            : <Logo name="neujimak_eye" width={42} color="#FFFFFF" style={{ marginTop: 4 }} />}
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

// 11-10 끝 — 잠든 장면 위 카피 없음(「주무세요. 블프는 선착순 없이 일주일 내내. 느지막.」을 목소리가 말한다 — 폰트 정본 §10-4 1). 빛 번짐 없음.
// 두 단: ① 30.70초에 잠든 장면 오른쪽 어두운 이불 위로 천천히 들어와(맹검 2차 장면 위 「고쳐서 냄 7」) 장면과 함께 어두워지고
//        ② 32.03초 검은 화면이 되면 가운데에 다시 — 가게 목소리 「느지막」(32.05)과 같은 박. 맹검 2차: 빈 검은 화면에서 오른쪽 3/4에 치우친 묶음은
//        왼쪽이 비어 어색했고, 이불 위 그늘(둥근 남색 그림자)이 검은 화면에서 띠 얼룩으로 남았다 → 검은 화면에서는 그늘 없이 가운데.
// 11-11 새벽 A 다시 — 3차(「한 획만 휜 기성 고딕 · 위에 띄운 눈은 클립아트」) 뒤 그린 「처진 획 + 「느」의 ㅡ가 감은 눈」 판(neujimak3)을
// 4차가 「누지막」으로 읽고 「어설픈 손글씨풍 · 장면에 너무 크고 모서리에 바짝」으로 봤다 → 장치를 빼고 §10-2 「로고타입으로 묶어 작게 · 효과 없이」:
// 전단 제목 · 노트북 화면과 같은 명조 결 「느지막」 + 작은 줄 「가전 · 생활 온라인몰」(neujimak_serif). 장면 위는 오른쪽 아래에 여백을 넉넉히, 검은 화면은 가운데.
const Lockup: React.FC<{ glyph: Glyph; color: string; big?: boolean }> = ({ glyph, color, big }) => glyph === 'A' ? (
  <Logo name="neujimak_serif" width={big ? 430 : 300} color={color} />
) : (
  <>
    {/* 작은 줄이 위, 감은 눈 · 글자 가로 묶음이 아래(캠페인 끝 화면 짜임). 주황 앱 네모는 55번 훑기가 짚은 「주황 네모」라 뺐다 */}
    <Logo name="neujimak_tag" width={540} color={color} />
    <div style={{ height: 46 }} />
    <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
      <Logo name="neujimak_eye" width={66} color={color} style={{ marginTop: 10 }} />
      <Logo name="neujimak2" width={220} color={color} />
    </div>
  </>
);

const EndLogo: React.FC<{ t: number; glyph: Glyph }> = ({ t, glyph }) => {
  const a = 30.7, black = 32.03;
  if (t < a) return null;
  const white = '#FBF6EF';
  const box: React.CSSProperties = { position: 'absolute', top: 0, height: 1080, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' };
  if (t < black) {
    const q = ramp(t, a, 0.7, EXPO);
    const shade = ramp(t, a - 0.2, 0.8) * (1 - ramp(t, 31.78, 0.25));
    const out = 1 - ramp(t, 31.78, 0.25);
    if (glyph === 'A') {
      return (
        <>
          <div style={{ position: 'absolute', right: 0, top: 380, width: 1100, height: 700, background: 'radial-gradient(ellipse at 66% 72%, rgba(6,10,20,0.5), rgba(6,10,20,0) 62%)', opacity: shade }} />
          <div style={{ position: 'absolute', right: 170, bottom: 150, opacity: q * out, transform: `translateY(${(1 - q) * 10}px)` }}>
            <Lockup glyph={glyph} color={white} />
          </div>
        </>
      );
    }
    return (
      <>
        <div style={{ position: 'absolute', right: 0, top: 0, width: 1000, height: 1080, background: 'radial-gradient(ellipse at 66% 50%, rgba(6,10,20,0.5), rgba(6,10,20,0) 64%)', opacity: shade }} />
        <div style={{ ...box, left: 1440 - 300, width: 600, opacity: q * out, transform: `translateY(${(1 - q) * 10}px)` }}>
          <Lockup glyph={glyph} color={white} />
        </div>
      </>
    );
  }
  return (
    <div style={{ ...box, left: 0, width: 1920, opacity: ramp(t, black + 0.02, 0.1) }}>
      <Lockup glyph={glyph} color={white} big />
    </div>
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

export const S4: React.FC<{ end?: 'scene' | 'card'; glyph?: Glyph }> = ({ end = 'scene', glyph = 'now' }) => {
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
      {glyph === 'now' ? <LaptopOpen frame={frame} t={t} /> : <LaptopPage frame={frame} t={t} glyph={glyph} />}
      <Notify frame={frame} t={t} glyph={glyph} />
      {/* 19b 판이 32.03초에 끝나 검은 화면으로 — 툭 끊긴 듯 보이지 않게 0.25초 어두워지며(11-07 Fable 재검수 참고) */}
      {end !== 'card' && t >= 31.78 ? <AbsoluteFill style={{ background: '#000', opacity: ramp(t, 31.78, 0.25) }} /> : null}
      {end === 'card' ? <EndCard t={t} /> : glyph === 'now' ? <EndScene t={t} /> : <EndLogo t={t} glyph={glyph} />}
      <Audio src={staticFile('s4/sound.wav')} />
    </AbsoluteFill>
  );
};
