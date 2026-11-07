// 시즌 3 블프 세일 「힘껏」 15초 · 6초 — 글자 카드 · 제품 칸 · 벽 화면(전광판 · 간판) · 떠 지나가는 제품 카드 · 끝(2026-11-07, Claude).
// 화면 · 소리는 bf-sale-20261025/최종편집.py가 public/s3/에 둔다(picture_<판>.mp4 · sound_<판>.wav). 시각은 02_콘티 2절(15초) · 3절(6초).
//   end="scene"(기본, 판 없음 — 점검표 1번): 장면 위 로고 · 벽 화면 시계 · 아래 한 줄.  end="card": 원본 짜임(위 절반 남색 끝 카드 · 영상 550px 내림) — 견줄 판.
import React from 'react';
import { AbsoluteFill, Img, OffthreadVideo, staticFile, useCurrentFrame } from 'remotion';
import { Audio } from '@remotion/media';
import { KO, MONO } from '../lib/fonts';
import { EXPO, SNAP, pop, ramp } from '../lib/motion';
import { Subject, type MaskCut } from '../lib/subject';
import { Logo } from '../bf/Logo';
import walls from './벽화면.json';
import masks15 from './masks_15.json';
import masks6 from './masks_6.json';

const FPS = 24;
const DAHONG = '#FF4A1C', NAVY = '#1B1446', AMBER = '#FFB547', CREAM = '#FFF4E8';
export const S3_FRAMES = { 15: 360, 6: 144 } as const;
const TT = (T: number[]) => T.map((x) => Math.round(x * FPS) / FPS);
const T15 = TT([0, 0.96, 2.28, 3.04, 3.64, 3.76, 4.48, 5.16, 6.16, 7.68, 8.6, 11.72, 12.56, 15.0]);
const T6 = TT([0, 0.9, 2.2, 3.7, 4.6, 6.0]);

type Len = 15 | 6;
type Props = { len: Len; end?: 'scene' | 'card' };

// 남은 초(자정까지) — 15초는 실제 초대로(콘티: 0초 59:59 · 0.5초 58 · 6.5초 52 …), 6초는 컷마다 콘티 값(59 → 57 → 55)
const remain = (len: Len, t: number) => {
  if (len === 15) return 3599 - Math.floor(t + 0.5);
  if (t < 0.5) return 3599;
  if (t < T6[2]) return 3598;
  if (t < 3.2) return 3597;
  if (t < T6[4]) return 3596;
  return t < 5.5 ? 3595 : 3594;
};
const clock = (s: number) => `00:${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

// ---------- 벽 화면(전광판 · 간판 · 끝 시계) — 벽화면자리.py가 장마다 잰 자리에 붙인다 ----------
type Track = { from: number; rect: number[]; m: number[][] };
const WallScreen: React.FC<{ track: Track; frame: number; children: React.ReactNode; out?: number }> = ({ track, frame, children, out = 0 }) => {
  const k = Math.max(0, Math.min(track.m.length - 1, frame - track.from));
  const [s, , tx, ty] = track.m[k];
  const [x0, y0, x1, y1] = track.rect;
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, transformOrigin: '0 0', transform: `matrix(${s},0,0,${s},${tx - out},${ty})`, zIndex: 3 }}>
      <div style={{ position: 'absolute', left: x0, top: y0, width: x1 - x0, height: y1 - y0, overflow: 'hidden' }}>
        {/* 화면이 켜진 빛 — 검은 화면 안쪽만 아주 옅게 */}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 42%, rgba(255,150,70,0.16), rgba(255,90,30,0.04) 62%, rgba(0,0,0,0) 80%)' }} />
        {children}
      </div>
    </div>
  );
};

const Led: React.FC<{ w: number; h: number; sec: number; flash?: number }> = ({ w, h, sec, flash = 0 }) => (
  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: h * 0.03 }}>
    <div style={{ fontFamily: KO, fontWeight: 700, fontSize: h * 0.12, letterSpacing: '0.12em', color: AMBER, textShadow: `0 0 ${h * 0.05}px rgba(255,150,40,0.9)`, opacity: 0.95 }}>자정까지</div>
    <div style={{ fontFamily: MONO, fontWeight: 500, fontSize: h * 0.26, lineHeight: 1, marginTop: h * 0.01, color: '#FFF0DC', letterSpacing: '0.02em',
      textShadow: `0 0 ${h * 0.035}px rgba(255,170,80,${0.9 + flash * 0.1}), 0 0 ${h * 0.12}px rgba(255,100,30,${0.55 + flash * 0.4})` }}>{clock(sec)}</div>
    <div style={{ width: w * 0.0001 }} />
  </div>
);

// 넘김판 간판(⑥) — 두 칸이 남은 초(59 → 57 → 54 → 51)를 넘기다 그린 「힘껏」 로고로 내려앉는다.
// 11-07 Fable 재검수 「4.2에 「특 가」(벌어진 흰 글)가 또렷이 남음」 — 낱말(세일 · 블프 · 운동 · 특가)을 넘기면 두 칸 사이가 벌어진 글로 읽혀 Fable 제안대로 타이머로
const FLAPS = [['5', '5', '5', '5'], ['9', '7', '4', '1']];
const FlapSign: React.FC<{ w: number; h: number; t: number; land: number }> = ({ w, h, t, land }) => {
  const tw = w * 0.27, th = h * 0.66;
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: w * 0.012, paddingBottom: h * 0.08 }}>
      {t >= land ? (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingBottom: h * 0.06, opacity: ramp(t, land, 0.06) * (Math.floor((t - land) * 40) % 3 === 1 && t < land + 0.12 ? 0.4 : 1) }}>
          <Logo name="himkkeot" width={w * 0.66} color="#FFE9DE" glow={9} glowColor="rgba(255,74,28,0.95)" />
        </div>
      ) : null}
      {t >= land ? null : FLAPS.map((seq, i) => {
        const at = land;   // 두 칸이 함께 넘어간다 — 0.06초 어긋나면 중간 짝이 「운 프」처럼 뜻 없는 글로 읽혔다(11-07 낯선이 시험)
        const step = 0.085, n = seq.length;
        const start = at - n * step;
        const u = (t - start) / step;
        const done = false;
        const idx = Math.max(0, Math.min(n - 1, Math.floor(u)));
        const flip = done || u < 0 ? 0 : u - Math.floor(u);
        const ch = seq[idx];
        const lit = done ? ramp(t, at, 0.12) : 0;
        return (
          <div key={i} style={{ position: 'relative', width: tw, height: th, borderRadius: tw * 0.06, background: 'linear-gradient(#221d33, #17131f 49.6%, #0c0a12 50.4%, #1a1626)', boxShadow: '0 4px 10px rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <div style={{ fontFamily: KO, fontWeight: 900, fontSize: th * 0.7, color: done ? DAHONG : '#F4EEE6', lineHeight: 1,
              transform: !done && flip > 0 ? `scaleY(${Math.max(0.08, Math.abs(Math.cos(flip * Math.PI)))})` : 'none',
              textShadow: lit ? `0 0 ${th * 0.08 * lit}px rgba(255,90,30,0.95), 0 0 ${th * 0.25 * lit}px rgba(255,74,28,0.6)` : 'none' }}>{ch}</div>
            <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 2, background: 'rgba(0,0,0,0.85)' }} />
          </div>
        );
      })}
    </div>
  );
};

// ---------- 글자 카드(②) ----------
const TextCard: React.FC<{ t: number; a: number; b: number; hit: number }> = ({ t, a, b, hit }) => {
  if (t < a || t >= b) return null;
  // 판 움직임(콘티 카메라 줄 ②): 2% 살금 → 「팡」 바로 앞 두 장에 1.16배 + 오른쪽 5% → 끝까지 다시 2%. 11-07 Fable: 화면 가득한 단색 판은 「납작한 색 판 + 큰 글자」라
  // 흐린 스튜디오(밑 화면) 위에 빛살과 제품 칸과 같은 기울인 네온 칸 하나로 바꿨다. 다시 본 11-07 판에서도 주황으로 채운 칸은 「주황 단색 판」으로 읽혀
  // 칸 재질을 ⑨ ⑪ 제품 칸과 같은 남색 유리 + 주황 네온 테로, 「오늘 자정까지」는 처음부터 · 「전 품목」은 0.2초에 · 「70%」만 「팡」에 — 빈 0.4초가 없게.
  const punchA = hit - 0.12, punchB = hit - 0.04;
  const s0 = 1 + 0.02 * ramp(t, a, punchA - a, (x) => x);
  const sc = t < punchA ? s0 : t < punchB ? 1.02 + 0.14 * ramp(t, punchA, punchB - punchA, (x) => x) : 1.16 + 0.02 * ramp(t, punchB, b - punchB, (x) => x);
  const dx = t < punchA ? 0 : 40 * Math.min(1, (t - punchA) / (punchB - punchA));
  const l1 = (k: number) => ramp(t, a + k * 0.04, 0.16);
  const mid = ramp(t, a + 0.2, 0.18, EXPO);
  const big = t >= hit ? pop(t, hit, 0.3) : 0;
  const bump = t >= hit ? Math.max(0, 1 - Math.abs(t - hit - 0.06) / 0.12) : 0;
  const tileIn = ramp(t, a, 0.14, EXPO);
  const rays = 0.35 + 0.65 * (t >= hit ? Math.max(0, 1 - (t - hit) / 0.6) : 0);
  return (
    <AbsoluteFill style={{ zIndex: 20, overflow: 'hidden' }}>
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 48%, rgba(40,14,60,0.15), rgba(10,4,24,0.7) 78%)' }} />
      <div style={{ position: 'absolute', left: 540 - 1100, top: 900 - 1100, width: 2200, height: 2200, opacity: rays, transform: `rotate(${(t - a) * 24}deg)`,
        background: 'repeating-conic-gradient(from 0deg, rgba(255,120,50,0.42) 0deg 5deg, rgba(255,120,50,0) 5deg 15deg)',
        WebkitMaskImage: 'radial-gradient(circle, #000 0, rgba(0,0,0,0) 58%)', maskImage: 'radial-gradient(circle, #000 0, rgba(0,0,0,0) 58%)' }} />
      <AbsoluteFill style={{ transform: `translateX(${dx}px) scale(${sc * (0.9 + 0.1 * tileIn)})`, opacity: tileIn, alignItems: 'center', justifyContent: 'center', display: 'flex' }}>
        <div style={{ position: 'relative', width: 880, height: 900 }}>
          <div style={{ position: 'absolute', inset: 0, transform: 'skewX(-8deg)', borderRadius: 30, border: `5px solid ${DAHONG}`,
            background: 'linear-gradient(160deg, rgba(36,26,88,0.94), rgba(18,13,48,0.94))',
            boxShadow: `0 0 26px rgba(255,74,28,0.9), 0 0 80px rgba(255,74,28,0.4), inset 0 0 36px rgba(255,74,28,0.3)` }} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ display: 'flex', gap: 20, marginBottom: 18 }}>
              {['오늘', '자정까지'].map((w, k) => (
                <div key={k} style={{ overflow: 'hidden', height: 96 }}>
                  <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 84, color: CREAM, letterSpacing: '-0.02em', transform: `translateY(${(1 - l1(k)) * 100}px)` }}>{w}</div>
                </div>
              ))}
            </div>
            <div style={{ height: 560, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ fontFamily: KO, fontWeight: 900, fontSize: 156, color: '#FFFFFF', letterSpacing: '-0.03em', lineHeight: 1, opacity: mid, transform: `translateY(${(1 - mid) * 40}px) scale(${1 + 0.06 * bump})` }}>전 품목</div>
              <div style={{ fontFamily: KO, fontWeight: 900, fontSize: 330, color: DAHONG, letterSpacing: '-0.05em', lineHeight: 0.92, marginTop: 8, opacity: t >= hit ? 1 : 0,
                transform: `skewX(-11deg) scale(${0.55 + 0.45 * big})`, textShadow: '0 0 28px rgba(255,74,28,0.65), 0 14px 0 rgba(8,4,30,0.45)' }}>70%</div>
            </div>
          </div>
        </div>
      </AbsoluteFill>
      <Burst t={t} at={hit} cx={540} cy={1120} />
    </AbsoluteFill>
  );
};

// 「팡」 조각 — 짧게 터져 나가며 떨어진다(색은 크림 · 남색 · 호박)
const Burst: React.FC<{ t: number; at: number; cx: number; cy: number; n?: number; spread?: number }> = ({ t, at, cx, cy, n = 22, spread = 1 }) => {
  const q = t - at;
  if (q < 0 || q > 0.9) return null;
  const cols = [CREAM, NAVY, AMBER, '#FFFFFF'];
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {Array.from({ length: n }, (_, i) => {
        const ang = (i / n) * Math.PI * 2 + (i % 3) * 0.37;
        const sp = (420 + (i * 97) % 380) * spread;
        const d = sp * (1 - Math.exp(-q * 6)) * 0.9;
        const x = cx + Math.cos(ang) * d, y = cy + Math.sin(ang) * d + 900 * q * q;
        const op = 1 - ramp(q, 0.45, 0.45, (v) => v);
        return <div key={i} style={{ position: 'absolute', left: x, top: y, width: 16 + (i % 4) * 5, height: 7 + (i % 3) * 3, background: cols[i % 4], opacity: op,
          transform: `rotate(${ang * 57 + q * 540 * (i % 2 ? 1 : -1)}deg)`, borderRadius: 2 }} />;
      })}
    </AbsoluteFill>
  );
};

// ---------- 떠 지나가는 제품 카드(⑧) ----------
const FlyCards: React.FC<{ t: number; a: number; b: number }> = ({ t, a, b }) => {
  if (t < a || t >= b) return null;
  const cards = [
    { src: 'leggings', at: a + 0.06, dur: 0.62, from: [760, 640], to: [-160, 260] },
    { src: 'windbreaker', at: a + 0.36, dur: 0.6, from: [800, 640], to: [1290, 1030] },   // 오른쪽 벽으로 — 채원 몸 위를 지나지 않게
  ];
  return (
    <AbsoluteFill style={{ zIndex: 6, perspective: 1200 }}>
      {cards.map((c, i) => {
        const q = (t - c.at) / c.dur;
        if (q <= 0 || q >= 1) return null;
        const e = Math.pow(q, 1.9);   // 멀리서 천천히 → 가까이 빠르게(터널 속 원근)
        const x = c.from[0] + (c.to[0] - c.from[0]) * e, y = c.from[1] + (c.to[1] - c.from[1]) * e;
        const s = 0.16 + 1.45 * e;
        const op = Math.min(1, q * 6) * (1 - ramp(q, 0.88, 0.12, (v) => v));
        return (
          <div key={i} style={{ position: 'absolute', left: x - 150, top: y - 190, width: 300, height: 380, transform: `scale(${s}) rotateY(${i ? 28 : 34}deg)`, opacity: op,
            filter: `blur(${Math.max(0, (e - 0.55) * 7)}px)`, borderRadius: 26, border: `5px solid ${DAHONG}`, background: 'rgba(255,244,232,0.94)',
            boxShadow: `0 0 26px rgba(255,74,28,0.95), 0 0 70px rgba(255,74,28,0.5)`, overflow: 'hidden' }}>
            <Img src={staticFile(`s3/prod/${c.src}_a.png`)} style={{ position: 'absolute', left: 20, top: 24, width: 260, height: 332, objectFit: 'contain' }} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ---------- 제품 칸(⑨ ⑪) ----------
type Item = { src: string; name: string; was: string; now: string };
const P: Record<string, Item> = {
  leggings: { src: 'leggings', name: '레깅스', was: '59,000원', now: '17,700' },
  windbreaker: { src: 'windbreaker', name: '바람막이', was: '129,000원', now: '38,700' },
  bratop: { src: 'bratop', name: '브라탑', was: '39,000원', now: '11,700' },
  hoodie: { src: 'hoodie', name: '후디', was: '79,000원', now: '23,700' },
  jogger: { src: 'jogger', name: '조거 팬츠', was: '69,000원', now: '20,700' },
  cap: { src: 'cap', name: '러닝 캡', was: '29,000원', now: '8,700' },
  zipup: { src: 'zipup', name: '집업 재킷', was: '89,000원', now: '26,700' },
  shorts: { src: 'shorts', name: '반바지', was: '45,000원', now: '13,500' },
};
// 칸마다 회전 시각(시작) · 그 회전 뒤에 보일 제품 — 회전은 0.32초, 가격은 회전이 끝나는 순간 굴러 내려온다
type Spin = { at: number; item: string };
const ROT = 0.32;

// 가격 숫자 — 자리마다 위에서 굴러 내려와 그 숫자에 멎는다(왼쪽 자리부터 0.035초씩)
const Digits: React.FC<{ text: string; t: number; at: number; size: number }> = ({ text, t, at, size }) => {
  let k = 0;
  const lh = size * 1.04;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', height: lh, overflow: 'hidden' }}>
      {[...text].map((ch, i) => {
        if (!/\d/.test(ch)) return <div key={i} style={{ fontFamily: KO, fontWeight: 900, fontSize: size, lineHeight: `${lh}px`, color: '#FFFFFF' }}>{ch}</div>;
        const d = Number(ch);
        const q = ramp(t, at + (k++) * 0.018, 0.22, EXPO);
        const spins = 4 + d;   // 이만큼 칸을 지나 멎음
        const u = spins * q, n = Math.floor(u), f = u - n;
        const v = (m: number) => (((d - spins + m) % 10) + 10) % 10;
        const bl = q < 0.9 ? `blur(${(1 - q) * 3.2}px)` : undefined;
        return (
          <div key={i} style={{ position: 'relative', width: size * 0.6, height: lh, overflow: 'hidden', fontFamily: KO, fontWeight: 900, fontSize: size, lineHeight: `${lh}px`, color: '#FFFFFF', textAlign: 'center' }}>
            <div style={{ position: 'absolute', left: 0, right: 0, top: f * lh, filter: bl }}>{v(n)}</div>
            {f > 0.001 ? <div style={{ position: 'absolute', left: 0, right: 0, top: (f - 1) * lh, filter: bl }}>{v(n + 1)}</div> : null}
          </div>
        );
      })}
    </div>
  );
};

const Cell: React.FC<{ t: number; spins: Spin[]; y: number; tag: boolean; enter: number }> = ({ t, spins, y, tag, enter }) => {
  // 지금 보일 제품 = 이미 반 넘게 돈 회전 가운데 마지막
  let item = spins[0].item, priceAt = spins[0].at + ROT, rot = 0;
  for (const s of spins) {
    if (t >= s.at + ROT / 2) { item = s.item; priceAt = s.at + ROT; }
    if (t >= s.at && t < s.at + ROT) rot = 360 * ramp(t, s.at, ROT, SNAP);
  }
  const it = P[item];
  const shown = t >= priceAt;
  const inQ = ramp(t, enter, 0.16, EXPO);
  return (
    <div style={{ position: 'absolute', left: 64, top: y, width: 952, height: 380, perspective: 1600, opacity: inQ }}>
      <div style={{ position: 'absolute', inset: 0, transform: `rotateX(${rot}deg)`, transformStyle: 'preserve-3d', filter: rot > 20 && rot < 340 ? 'blur(1.6px)' : undefined }}>
        <div style={{ position: 'absolute', inset: 0, transform: 'skewX(-8deg)', borderRadius: 22, border: `4px solid ${DAHONG}`, background: 'linear-gradient(160deg, rgba(36,26,88,0.92), rgba(18,13,48,0.92))',
          boxShadow: `0 0 22px rgba(255,74,28,0.85), 0 0 60px rgba(255,74,28,0.35), inset 0 0 26px rgba(255,74,28,0.28)` }} />
        <div style={{ position: 'absolute', left: 40, top: 26, width: 328, height: 328, borderRadius: 20, background: 'linear-gradient(170deg, #FFF8F0, #F1E6DA)', overflow: 'hidden', transform: 'skewX(-8deg)' }}>
          <Img src={staticFile(`s3/prod/${it.src}_a.png`)} style={{ position: 'absolute', left: 24, top: 22, width: 288, height: 292, objectFit: 'contain', transform: 'skewX(8deg)' }} />
        </div>
        <div style={{ position: 'absolute', left: 420, top: 52, right: 30 }}>
          <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 50, color: CREAM, letterSpacing: '-0.02em' }}>{it.name}</div>
          <div style={{ fontFamily: KO, fontWeight: 600, fontSize: 40, color: '#B8AFD8', marginTop: 8, textDecoration: 'line-through', textDecorationColor: DAHONG, textDecorationThickness: 4 }}>{it.was}</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', marginTop: 18, height: 124 }}>
            {shown ? <Digits text={it.now} t={t} at={priceAt} size={112} /> : null}
            {shown ? <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 60, color: '#FFFFFF', marginLeft: 6, marginBottom: 12, opacity: ramp(t, priceAt + 0.02, 0.1) }}>원</div> : null}
          </div>
        </div>
        {tag ? (
          <div style={{ position: 'absolute', right: 34, top: 30, padding: '6px 16px 8px', borderRadius: 10, background: DAHONG, fontFamily: KO, fontWeight: 900, fontSize: 40, color: '#FFFFFF',
            transform: `skewX(-8deg) scale(${shown ? 0.6 + 0.4 * pop(t, priceAt + 0.05, 0.3) : 0})` }}>-70%</div>
        ) : null}
      </div>
    </div>
  );
};

const Grid: React.FC<{ t: number; a: number; b: number; cells: Spin[][]; tag: boolean; sec: number; note?: string }> = ({ t, a, b, cells, tag, sec, note }) => {
  if (t < a || t >= b) return null;
  const head = ramp(t, a, 0.2, EXPO);
  return (
    <AbsoluteFill style={{ zIndex: 20 }}>
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 40%, rgba(27,20,70,0.25), rgba(12,8,32,0.72) 75%)' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: head, transform: `translateY(${(1 - head) * -30}px)` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 26 }}>
          <Logo name="himkkeot" width={176} color={DAHONG} glow={6} glowColor="rgba(255,74,28,0.7)" />
          <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 50, color: CREAM, letterSpacing: '-0.02em' }}>운동복 블랙프라이데이</div>
        </div>
        <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 14, padding: '8px 26px 10px', borderRadius: 999, background: DAHONG, boxShadow: '0 0 24px rgba(255,74,28,0.6)' }}>
          <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 36, color: '#FFFFFF' }}>자정까지</div>
          <div style={{ fontFamily: MONO, fontWeight: 500, fontSize: 40, color: '#FFFFFF', letterSpacing: '0.02em' }}>{clock(sec)}</div>
        </div>
      </div>
      {cells.map((spins, i) => <Cell key={i} t={t} spins={spins} y={372 + i * 400} tag={tag} enter={a} />)}   {/* 셋째 칸 아래 끝 1552(80.8%) → 가격은 75% 위 */}
      {note ? <div style={{ position: 'absolute', left: 0, right: 0, top: 362, textAlign: 'center', fontFamily: KO, fontWeight: 700, fontSize: 32, color: 'rgba(255,244,232,0.9)', opacity: ramp(t, a + 0.3, 0.3) }}>{note}</div> : null}
    </AbsoluteFill>
  );
};

// ---------- 끝(⑬) ----------
const Confetti: React.FC<{ t: number; at: number; settle?: boolean }> = ({ t, at, settle }) => {
  const q = t - at;
  if (q < 0) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 8 }}>
      {Array.from({ length: 26 }, (_, i) => {
        const x0 = 60 + ((i * 263) % 960), y0 = -60 - ((i * 131) % 260);
        const fall = settle ? Math.min(1, q / 0.5) : q / 1.6;
        const yEnd = settle ? 80 + ((i * 197) % 700) : 2100;
        const y = y0 + (yEnd - y0) * (settle ? EXPO(fall) : fall);
        const x = x0 + Math.sin(q * 5 + i) * 22;
        const cols = [DAHONG, AMBER, '#FF7A45', CREAM];
        return <div key={i} style={{ position: 'absolute', left: x, top: y, width: 14 + (i % 3) * 6, height: 8 + (i % 2) * 4, background: cols[i % 4], opacity: 0.95,
          transform: `rotate(${(i * 47 + q * 260 * (i % 2 ? 1 : -1)) % 360}deg)`, borderRadius: 2 }} />;
      })}
    </AbsoluteFill>
  );
};

const EndScene: React.FC<{ t: number; a: number; whip: number; wall: Track; frame: number; len: Len }> = ({ t, a, whip, wall, frame, len }) => {
  if (t < a) return null;
  const q = t - a;
  const groupIn = ramp(t, a + 0.1, 0.28, EXPO);
  const flick = q < 0.4 && [0.14, 0.2, 0.28].some((f) => q > f && q < f + 0.04) ? 0.35 : 1;   // 네온이 켜질 때 두세 번 깜빡(묶음과 함께 0.1초 앞으로)
  const out = t > whip ? 1500 * Math.pow(ramp(t, whip, 0.3, (x) => x), 1.6) : 0;   // 벽 화면 시계는 휙과 함께 왼쪽으로 밀려 나간다
  const [x0, y0, x1, y1] = wall.rect;
  return (
    <>
      {t < whip + 0.4 ? (
        <WallScreen track={wall} frame={frame} out={out}>
          <div style={{ opacity: ramp(t, a + 0.1, 0.12) * (1 - ramp(t, whip, 0.1)) }}>
            <Led w={x1 - x0} h={y1 - y0} sec={remain(len, t)} flash={Math.max(0, 1 - q / 0.4)} />
          </div>
        </WallScreen>
      ) : null}
      {/* 아래 묶음(11-07 Fable) — 옅은 그늘(판 없음) 위에 네온 로고 · 오퍼 · 앱을 한 묶음으로, 휙에서도 남아 마지막 장 = 브랜드. 릴스 · 쇼츠 글 자리(아래 20%)는 비운다 */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 960, height: 960, zIndex: 8, background: 'linear-gradient(rgba(10,6,30,0), rgba(10,6,30,0.5) 30%, rgba(10,6,30,0.72) 70%, rgba(10,6,30,0.6))', opacity: groupIn }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 1068, zIndex: 9, display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: groupIn, transform: `translateY(${(1 - groupIn) * 26}px)` }}>
        <div style={{ opacity: flick }}><Logo name="himkkeot" width={400} color="#FFF3EC" glow={7} glowColor="rgba(255,74,28,0.9)" /></div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, marginTop: 26 }}>
          <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 52, color: '#FFFFFF', letterSpacing: '-0.02em', textShadow: '0 2px 12px rgba(0,0,0,0.5)' }}>오늘 자정까지 전 품목</div>
          <div style={{ fontFamily: KO, fontWeight: 900, fontSize: 120, lineHeight: 0.9, color: DAHONG, letterSpacing: '-0.04em', transform: 'skewX(-11deg)', textShadow: '0 0 22px rgba(255,74,28,0.6)' }}>70%</div>
        </div>
        <div style={{ marginTop: 22, padding: '10px 30px 12px', borderRadius: 999, border: '2px solid rgba(255,244,232,0.85)', fontFamily: KO, fontWeight: 700, fontSize: 40, color: '#FFF4E8', letterSpacing: '0.01em' }}>지금 힘껏 앱에서</div>
      </div>
      <Confetti t={t} at={a + 0.44} />
    </>
  );
};

const EndCard: React.FC<{ t: number; a: number; len: Len }> = ({ t, a, len }) => {
  if (t < a) return null;
  const rays = ramp(t, a + 0.28, 0.2) * (1 - ramp(t, a + 0.9, 0.5));
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 830, zIndex: 9, background: NAVY, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 540 - 700, top: 240 - 700, width: 1400, height: 1400, opacity: rays * 0.55,
        background: 'repeating-conic-gradient(from 0deg, rgba(255,120,60,0.35) 0deg 6deg, rgba(255,120,60,0) 6deg 18deg)', transform: `rotate(${(t - a) * 30}deg)`,
        WebkitMaskImage: 'radial-gradient(circle, #000 0, rgba(0,0,0,0) 62%)', maskImage: 'radial-gradient(circle, #000 0, rgba(0,0,0,0) 62%)' }} />
      <div style={{ position: 'absolute', left: (1080 - 330) / 2, top: 96 }}><Logo name="himkkeot" width={330} color={DAHONG} /></div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 290, textAlign: 'center', fontFamily: KO, fontWeight: 800, fontSize: 58, color: '#FFFFFF' }}>운동복 블랙프라이데이</div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 384, textAlign: 'center', fontFamily: KO, fontWeight: 900, fontSize: 64, color: DAHONG }}>오늘 자정까지 전 품목 70%</div>
      <div style={{ position: 'absolute', left: 290, top: 492, width: 500, height: 130, borderRadius: 26, border: `4px solid ${DAHONG}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: MONO, fontWeight: 500, fontSize: 96, color: '#FFFFFF' }}>{clock(remain(len, t))}</div>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 676, textAlign: 'center', fontFamily: KO, fontWeight: 700, fontSize: 52, color: '#FFFFFF' }}>지금 힘껏 앱에서</div>
      <Confetti t={t} at={a + 0.44} settle />
    </div>
  );
};

// ---------- 합성 ----------
export const S3: React.FC<Props> = ({ len, end = 'scene' }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const T = len === 15 ? T15 : T6;
  const W = (walls as Record<string, Record<string, Track>>)[String(len)];
  const cutsMask = (len === 15 ? masks15 : masks6) as MaskCut[];
  const film = `s3/${len}`;
  // 컷 시각
  const C = len === 15
    ? { board: [T[0], T[1]], card: [T[1], T[2]], hit: 1.4, sign: [T[5], T[6]], fly: [T[7], T[8]], g1: [T[8], T[9]], g2: [T[10], T[11]], end: T[12], whip: T[12] + 39 / 24 }   // 11-07 끝 판(s3-13__2) — 판 7장부터 쓰고 46장에 휙
    : { board: [T[0], T[1]], card: [T[1], T[2]], hit: 1.3, sign: null, fly: null, g1: [T[2], T[3]], g2: null, end: T[4], whip: T[4] + 16 / 24 };   // 같은 판 30장부터 — 46장에 휙
  const blurBg = (t >= C.card[0] && t < C.card[1]) || (C.g1 && t >= C.g1[0] && t < C.g1[1]) || (C.g2 && t >= C.g2[0] && t < C.g2[1]);
  const endCut = len === 15 ? 'c13' : 'c05';
  const card = end === 'card' && t >= C.end;
  const g1: Spin[][] = len === 15
    ? [[{ at: 6.2, item: 'leggings' }], [{ at: 6.36, item: 'windbreaker' }], [{ at: 6.48, item: 'bratop' }]]
    : [[{ at: 2.24, item: 'leggings' }], [{ at: 2.4, item: 'windbreaker' }], [{ at: 2.52, item: 'bratop' }]];
  const g2: Spin[][] = [[{ at: 8.64, item: 'hoodie' }, { at: 10.12, item: 'hoodie' }], [{ at: 8.8, item: 'jogger' }, { at: 10.2, item: 'zipup' }], [{ at: 8.92, item: 'cap' }, { at: 10.32, item: 'shorts' }]];
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <AbsoluteFill style={{ transform: card ? 'translateY(550px)' : undefined, filter: blurBg ? 'blur(26px) brightness(0.5) saturate(1.25)' : undefined }}>
        <OffthreadVideo src={staticFile(`s3/picture_${len}.mp4`)} muted style={{ width: '100%', height: '100%' }} />
      </AbsoluteFill>
      {/* ① 전광판 */}
      {t < C.board[1] ? (
        <WallScreen track={W.c01} frame={frame}>
          <Led w={W.c01.rect[2] - W.c01.rect[0]} h={W.c01.rect[3] - W.c01.rect[1]} sec={remain(len, t)} />
        </WallScreen>
      ) : null}
      {/* ⑥ 넘김판 간판 */}
      {C.sign && t >= C.sign[0] && t < C.sign[1] ? (
        <WallScreen track={W.c06} frame={frame}>
          <FlapSign w={W.c06.rect[2] - W.c06.rect[0]} h={W.c06.rect[3] - W.c06.rect[1]} t={t} land={4.24} />
        </WallScreen>
      ) : null}
      {/* 끝 — 판 없음(기본) · 원본 짜임(견줄 판) */}
      {!card ? <EndScene t={t} a={C.end} whip={C.whip} wall={W[endCut]} frame={frame} len={len} /> : <EndCard t={t} a={C.end} len={len} />}
      {/* 사람 다시 얹기 — 벽 화면 글자가 머리 뒤로(①, 끝 휙 전) */}
      {!card ? <Subject film={film} cuts={cutsMask} t={t} /> : null}
      {C.fly ? <FlyCards t={t} a={C.fly[0]} b={C.fly[1]} /> : null}
      <TextCard t={t} a={C.card[0]} b={C.card[1]} hit={C.hit} />
      <Grid t={t} a={C.g1[0]} b={C.g1[1]} cells={g1} tag={false} sec={remain(len, t)} />
      {C.g2 ? <Grid t={t} a={C.g2[0]} b={C.g2[1]} cells={g2} tag sec={remain(len, t)} /> : null}
      <Audio src={staticFile(`s3/sound_${len}.wav`)} />
    </AbsoluteFill>
  );
};
