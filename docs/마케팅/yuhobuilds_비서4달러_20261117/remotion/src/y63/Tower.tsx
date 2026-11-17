// 대화 종이 탑 — 10-21부터 이어 쓴 한 대화를 날마다 한 장으로 쌓았다(아래가 오래된 날, 위가 11월 15일).
// 게시물 하나를 받을 때마다 맨 아래 장부터 위까지 다시 훑는다(버터 띠). 카메라가 띠를 따라 올라간다.
import React from 'react';
import { KO } from '../lib/fonts';
import { mix } from '../lib/motion';

export const INK = '#0E0F12';
export const BUTTER = '#F5C445';
export const SHEET = '#FFFFFF';
export const GRAY = '#6B6D74';
export const STAGE = '#ECE9E1';

export const N = 26; // 10-21 ~ 11-15
export const PITCH = 92;
export const SHEET_H = 76;
export const SHEET_W = 700;
export const TOWER_X = 190;
export const TOWER_TOP = 900; // 카메라가 맨 위일 때 맨 위 장(11-15)의 화면 y
export const PAN_BOTTOM = -((N - 1) * PITCH + TOWER_TOP - 1390); // 맨 아래 장이 화면 y 1390에 오게

/** 장마다 말풍선 둘 — 왼쪽은 AI 비서(동그라미 「AI」 + 밝은 풍선), 오른쪽은 내가 보낸 것(검은 풍선 · 링크 또는 그림). 값은 고정. */
const rnd = (i: number, k: number) => ((Math.sin(i * 12.9898 + k * 78.233) * 43758.5453) % 1 + 1) % 1;
/** 받은 그림이 실린 장(공유마다 장면 그림이 실렸다). */
export const HAS_PIC = (i: number) => i % 4 === 2 || i === N - 1;

const LinkIcon: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
    <path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
    <path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
  </svg>
);

const Pic: React.FC<{ w: number; h: number; glow: number }> = ({ w, h, glow }) => (
  <div style={{ width: w, height: h, borderRadius: 8, background: glow > 0 ? `rgba(255,255,255,${0.3 + 0.5 * glow})` : 'rgba(255,255,255,0.22)', overflow: 'hidden', flex: 'none' }}>
    <svg viewBox="0 0 92 56" width={w} height={h} style={{ display: 'block' }} preserveAspectRatio="none">
      <circle cx={70} cy={16} r={8} fill={glow > 0 ? BUTTER : 'rgba(255,255,255,0.85)'} />
      <path d="M0 56 L28 24 L46 40 L60 30 L92 56 Z" fill="rgba(255,255,255,0.92)" />
    </svg>
  </div>
);

export const Sheet: React.FC<{ i: number; read: number; band: number; picGlow?: number; squash?: number }> = ({ i, read, band, picGlow = 0, squash = 0 }) => {
  const jitter = Math.sin(i * 3.7) * 14;
  const rot = Math.sin(i * 1.9) * 0.9;
  const pic = HAS_PIC(i);
  const aiW = 190 + 150 * rnd(i, 1);
  const meW = pic ? 210 : 130 + 110 * rnd(i, 2);
  return (
    <div
      style={{
        position: 'absolute',
        left: TOWER_X + jitter,
        width: SHEET_W,
        height: SHEET_H,
        background: read ? '#F3F1EC' : SHEET,
        borderRadius: 10,
        transform: `rotate(${rot}deg)`,
        boxShadow: `0 ${mix(10, 3, squash)}px ${mix(18, 6, squash)}px rgba(40,34,20,0.16)`,
        overflow: 'hidden',
      }}
    >
      {band > 0 ? <div style={{ position: 'absolute', inset: 0, background: `rgba(245,196,69,${0.9 * band})` }} /> : null}
      <div style={{ position: 'absolute', left: 16, top: 0, bottom: 0, right: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 46, height: 46, borderRadius: 23, background: INK, color: '#fff', fontFamily: KO, fontWeight: 900, fontSize: 19, letterSpacing: -0.5, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>AI</div>
          <div style={{ width: aiW, height: 46, borderRadius: '6px 20px 20px 20px', background: '#E7E4DC', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8, padding: '0 16px', boxSizing: 'border-box' }}>
            <div style={{ height: 8, width: '88%', borderRadius: 4, background: 'rgba(14,15,18,0.22)' }} />
            <div style={{ height: 8, width: `${45 + 40 * rnd(i, 3)}%`, borderRadius: 4, background: 'rgba(14,15,18,0.16)' }} />
          </div>
        </div>
        <div style={{ width: meW, height: pic ? 58 : 46, borderRadius: '20px 20px 6px 20px', background: '#2A2C31', display: 'flex', alignItems: 'center', gap: 10, padding: pic ? '0 8px 0 14px' : '0 16px', boxSizing: 'border-box' }}>
          <LinkIcon size={24} color="#fff" />
          {pic ? (
            <>
              <Pic w={66} h={44} glow={picGlow} />
              <Pic w={66} h={44} glow={picGlow} />
            </>
          ) : (
            <div style={{ height: 8, flex: 1, borderRadius: 4, background: 'rgba(255,255,255,0.45)' }} />
          )}
        </div>
      </div>
    </div>
  );
};

/** 탑 전체. pan = 카메라 위치(0 = 맨 위 장이 TOWER_TOP, PAN_BOTTOM = 맨 아래가 보임). s = 다시 읽은 자리(0 ~ N, 소수). */
export const Tower: React.FC<{ pan: number; s: number; extraTop?: React.ReactNode; picGlowAll?: number; count?: number }> = ({ pan, s, extraTop, picGlowAll = 0, count = N }) => (
  <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920 }}>
    {Array.from({ length: count }, (_, i) => {
      const y = TOWER_TOP + (N - 1 - i) * PITCH + pan;
      if (y < -120 || y > 2040) return null;
      const read = s >= i + 1 ? 1 : 0;
      const d = s - i;
      const band = d > 0 && d < 1.6 ? Math.sin(Math.min(1, d / 1.6) * Math.PI) : 0;
      return (
        <div key={i} style={{ position: 'absolute', left: 0, top: y, width: 1080 }}>
          <Sheet i={i} read={read} band={band} picGlow={HAS_PIC(i) ? Math.max(band, picGlowAll) : 0} />
        </div>
      );
    })}
    {extraTop ? <div style={{ position: 'absolute', left: 0, top: TOWER_TOP - PITCH + pan, width: 1080 }}>{extraTop}</div> : null}
  </div>
);

/** 카메라가 띠를 따라간다 — 띠가 화면 y 1180쯤에 머물게, 범위 안에서. */
export const followPan = (s: number) => {
  const bandY = TOWER_TOP + (N - 1 - s) * PITCH; // pan 0일 때 띠의 화면 y
  return Math.max(PAN_BOTTOM, Math.min(0, 1180 - bandY));
};

/** 「다시 읽은 양」 계기판. */
export const Counter: React.FC<{ value: number; label: string; top?: number; flash?: number; scale?: number }> = ({ value, label, top = 540, flash = 0, scale = 1 }) => (
  <div style={{ position: 'absolute', left: 74, top, fontFamily: KO, color: INK, whiteSpace: 'nowrap' }}>
    <div style={{ fontWeight: 800, fontSize: 52, letterSpacing: -1.4, color: INK }}>{label}</div>
    <div style={{ display: 'flex', alignItems: 'flex-end', transformOrigin: '0% 85%', transform: `scale(${scale})` }}>
      <div style={{ fontWeight: 900, fontSize: 150, lineHeight: 1.02, letterSpacing: -6, fontVariantNumeric: 'tabular-nums', background: flash > 0 ? `rgba(245,196,69,${flash})` : 'transparent', borderRadius: 18, padding: '0 10px', marginLeft: -10 }}>
        {value.toLocaleString('en-US')}
      </div>
      <div style={{ fontWeight: 800, fontSize: 64, letterSpacing: -2, paddingBottom: 20, marginLeft: 8 }}>토큰</div>
    </div>
  </div>
);

/** 요금표 — 끈 구멍이 있는 버터 꼬리표. */
export const PriceTag: React.FC<{ usd: number; p: number; left?: number; top?: number; size?: number }> = ({ usd, p, left = 560, top = 790, size = 128 }) => {
  if (p <= 0) return null;
  return (
    <div style={{ position: 'absolute', left, top, opacity: Math.min(1, p * 1.5), transform: `rotate(${mix(-16, -7, p)}deg) scale(${mix(1.9, 1, p)})`, transformOrigin: '20% 50%', filter: 'drop-shadow(0 18px 26px rgba(40,30,0,0.28))' }}>
      <div style={{ position: 'relative', background: BUTTER, color: INK, fontFamily: KO, fontWeight: 900, fontSize: size, letterSpacing: -5, lineHeight: 1, padding: `${size * 0.16}px ${size * 0.26}px ${size * 0.16}px ${size * 0.5}px`, borderRadius: `${size * 0.14}px`, clipPath: `polygon(${size * 0.28}px 0, 100% 0, 100% 100%, ${size * 0.28}px 100%, 0 50%)`, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
        <div style={{ position: 'absolute', left: size * 0.2, top: '50%', width: size * 0.16, height: size * 0.16, marginTop: -size * 0.08, borderRadius: '50%', background: STAGE }} />
        {usd.toFixed(2)}
        <span style={{ fontSize: size * 0.46, letterSpacing: -1, marginLeft: 6 }}>달러</span>
      </div>
    </div>
  );
};

/** 새 말풍선 — 「게시물 하나」를 보낸다. */
export const NewBubble: React.FC<{ p: number; label?: string }> = ({ p, label = '게시물 하나' }) => {
  if (p <= 0) return null;
  return (
    <div style={{ position: 'absolute', left: TOWER_X + 250, top: mix(-220, 0, p), opacity: Math.min(1, p * 2), transform: `scale(${mix(1.15, 1, p)})`, transformOrigin: '100% 100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, background: INK, color: '#fff', fontFamily: KO, fontWeight: 800, fontSize: 52, letterSpacing: -1.4, borderRadius: '34px 34px 8px 34px', padding: '18px 34px', whiteSpace: 'nowrap', boxShadow: '0 16px 30px rgba(0,0,0,0.25)' }}>
        <svg width={46} height={46} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
          <path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
        </svg>
        {label}
      </div>
    </div>
  );
};

/** 지금 다시 읽는 날 — 띠 옆 검은 꼬리표. 10월 21일부터 하루씩. */
const DAY_NAMES = Array.from({ length: N }, (_, i) => {
  const d = new Date(Date.UTC(2026, 9, 21 + i));
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;
});
export const DayChip: React.FC<{ s: number; pan: number; p: number }> = ({ s, pan, p }) => {
  if (p <= 0) return null;
  const i = Math.max(0, Math.min(N - 1, Math.floor(s)));
  const y = TOWER_TOP + (N - 1 - Math.min(N - 1, s)) * PITCH + pan;
  return (
    <div style={{ position: 'absolute', left: 560, top: y - 48, opacity: p, fontFamily: KO, color: '#fff', background: INK, borderRadius: 18, padding: '12px 24px 14px', whiteSpace: 'nowrap', boxShadow: '0 12px 26px rgba(0,0,0,0.3)' }}>
      <div style={{ fontWeight: 700, fontSize: 32, letterSpacing: -0.8, color: 'rgba(255,255,255,0.75)' }}>AI 비서가 다시 읽는 중</div>
      <div style={{ fontWeight: 900, fontSize: 52, letterSpacing: -1.6, fontVariantNumeric: 'tabular-nums' }}>{DAY_NAMES[i]}</div>
    </div>
  );
};
