// DM 창 부품(재현). S22처럼 밝은 앱 판 하나가 검정 무대 위에서 혼자 빛나고, 그 판이 끝까지 변형된다(10-19 Fable M2).
// 인스타 상표·색을 흉내 내지 않는다. 받는 사람 쪽 화면: 오른쪽 짙은 말풍선 = 보낸 사람(시청자 자리), 왼쪽 연한 말풍선 = @yuhobuilds 자동 답.
// 버터는 한 번에 한 곳: 말이 인용하는 대목의 굵은 밑줄, 또는 말풍선 테두리.
import React from 'react';
import { Img, interpolate, staticFile } from 'remotion';
import { BUTTER } from '../film/parts';
import { KO, MONO } from '../lib/fonts';
import { clamp, OUT, prog } from '../lib/motion';

export const PAPER = '#F6F5F1';
export const UI_INK = '#22211E';
export const UI_MUTED = '#8E8B84';
export const RULE = '#E2DFD7';
export const BUBBLE_ME = '#2B2A26';
export const BUBBLE_BOT = '#E7E4DD';
export const ME_INK = '#F4F2EC';

export const BUBBLE_FONT: React.CSSProperties = { fontFamily: KO, fontWeight: 560, fontSize: 34, lineHeight: 1.42, letterSpacing: '-0.015em' };

/** 글자 수(보이는 글자 단위). 이모지·한글을 한 칸으로 센다. */
export const glyphs = (s: string) => Array.from(s);

/** 말풍선 글 조각. mark: 버터 밑줄이 그어진 정도(0~1, 말이 그 대목을 말할 때). nowrap: 줄바꿈 금지(경로 등). */
export type Seg = { t: string; mark?: number; bold?: boolean; nowrap?: boolean };

export const Bubble: React.FC<{
  me?: boolean;
  segs: Seg[];
  width?: number;
  shown?: number;
  appear?: number;
  avatar?: boolean;
  dim?: number;
  outline?: number;
  size?: number;
  style?: React.CSSProperties;
}> = ({ me = false, segs, width = 700, shown, appear = 1, avatar = !me, dim = 0, outline = 0, size = 34, style }) => {
  if (appear <= 0) return null;
  let left = shown === undefined ? Infinity : Math.max(0, shown);
  const pieces = segs.map((s, i) => {
    const g = glyphs(s.t);
    const take = Math.min(g.length, left);
    left -= take;
    const text = g.slice(0, take).join('');
    if (!text) return null;
    const m = s.mark ?? 0;
    return (
      <span
        key={i}
        style={{
          fontWeight: m > 0 || s.bold ? 720 : undefined,
          whiteSpace: s.nowrap ? 'nowrap' : undefined,
          backgroundImage: m > 0 ? `linear-gradient(${BUTTER}, ${BUTTER})` : undefined,
          backgroundSize: m > 0 ? `${m * 100}% 7px` : undefined,
          backgroundPosition: '0 96%',
          backgroundRepeat: 'no-repeat',
          boxDecorationBreak: 'clone',
          WebkitBoxDecorationBreak: 'clone',
        }}
      >
        {text}
      </span>
    );
  });
  const sc = 0.94 + 0.06 * Math.min(1, appear);
  return (
    <div style={{ display: 'flex', justifyContent: me ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 16, opacity: Math.min(1, appear * 1.6) * (1 - 0.6 * dim), ...style }}>
      {avatar ? <Avatar size={52} /> : null}
      <div
        style={{
          maxWidth: width,
          padding: '20px 28px 22px',
          borderRadius: 34,
          background: me ? BUBBLE_ME : BUBBLE_BOT,
          color: me ? ME_INK : UI_INK,
          ...BUBBLE_FONT,
          fontSize: size,
          transform: `scale(${sc})`,
          transformOrigin: me ? '100% 100%' : '0% 100%',
          boxShadow: outline > 0 ? `0 0 0 ${5 * outline}px ${BUTTER}` : undefined,
          filter: dim > 0.01 ? `blur(${2.2 * dim}px)` : undefined,
          whiteSpace: 'pre-wrap',
          wordBreak: 'keep-all',
        }}
      >
        {pieces}
      </div>
    </div>
  );
};

/** 프로필 사진 동그라미(@yuhobuilds 자동 답 쪽). */
export const Avatar: React.FC<{ size?: number }> = ({ size = 52 }) => (
  <div style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', flex: 'none', background: '#CFCBC2' }}>
    <Img src={staticFile('img/yuho-profile.webp')} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '44% 26%' }} />
  </div>
);

/** 상대 화면 머리줄: 사진 · yuhobuilds. right는 오른쪽 작은 표시(예시 번호·「다른 대화」). */
export const ChatHeader: React.FC<{ right?: React.ReactNode }> = ({ right }) => (
  <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 108 }}>
    <div style={{ position: 'absolute', left: 34, top: 25 }}>
      <Avatar size={58} />
    </div>
    <div style={{ position: 'absolute', left: 110, top: 33, fontFamily: KO, fontWeight: 680, fontSize: 34, color: UI_INK, letterSpacing: '-0.02em' }}>yuhobuilds</div>
    {right ? <div style={{ position: 'absolute', right: 34, top: 40, fontFamily: MONO, fontSize: 23, color: UI_MUTED }}>{right}</div> : null}
    <div style={{ position: 'absolute', left: 0, right: 0, top: 107, height: 1, background: RULE }} />
  </div>
);

/** 「…」 입력 중 점 셋. */
export const Typing: React.FC<{ f: number; at: number; opacity?: number }> = ({ f, at, opacity = 1 }) => (
  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, opacity }}>
    <Avatar size={52} />
    <div style={{ padding: '26px 30px', borderRadius: 34, background: BUBBLE_BOT, display: 'flex', gap: 12 }}>
      {[0, 1, 2].map((i) => {
        const ph = (((f - at) / 12 + i * 0.33) % 1 + 1) % 1;
        const up = Math.max(0, Math.sin(ph * Math.PI * 2));
        return <div key={i} style={{ width: 14, height: 14, borderRadius: 7, background: UI_MUTED, opacity: 0.45 + 0.55 * up, transform: `translateY(${-5 * up}px)` }} />;
      })}
    </div>
  </div>
);

/** 보낸 DM 목록 한 줄(받은 사람 사진·이름은 흐림). sent: 「보냄」 표시, tail: 미리보기가 꼬리 줄로 바뀐 정도. */
export const InboxRow: React.FC<{ i: number; top: number; appear: number; sent: number; tail: number; head: string; tailText: string }> = ({ i, top, appear, sent, tail, head, tailText }) => {
  if (appear <= 0) return null;
  const tones = ['#CFC8BC', '#C2CACA', '#D3C7BA', '#C9C4D0', '#C8CFC4'];
  return (
    <div style={{ position: 'absolute', left: 24, right: 24, top, height: 48, opacity: appear, transform: `translateY(${(1 - appear) * 18}px)` }}>
      <div style={{ position: 'absolute', left: 8, top: 4, width: 40, height: 40, borderRadius: 20, background: tones[i % tones.length], filter: 'blur(2px)' }} />
      <div style={{ position: 'absolute', left: 64, top: 15, width: 92 + ((i * 29) % 50), height: 18, borderRadius: 9, background: '#D8D4CB', filter: 'blur(2px)' }} />
      <div style={{ position: 'absolute', left: 190, top: 6, width: 600, height: 36, overflow: 'hidden', whiteSpace: 'nowrap', fontFamily: KO, fontWeight: 540, fontSize: 24, lineHeight: '36px' }}>
        <span style={{ position: 'absolute', left: 0, top: 0, color: '#8E8B84', opacity: 1 - tail }}>{head}</span>
        <span style={{ position: 'absolute', left: 0, top: 0, color: UI_INK, opacity: tail }}>{tailText}</span>
      </div>
      <div style={{ position: 'absolute', right: 6, top: 9, fontFamily: MONO, fontSize: 21, color: UI_MUTED, opacity: sent }}>보냄 ✓</div>
    </div>
  );
};

/** 점검표 한 줄: 번호 · 이름 · ✕. */
export const CheckRow: React.FC<{ n: number; label: string; top: number; appear: number; cross: number }> = ({ n, label, top, appear, cross }) => {
  if (appear <= 0) return null;
  const c1 = Math.min(1, cross * 2);
  const c2 = Math.max(0, Math.min(1, (cross - 0.5) * 2));
  return (
    <div style={{ position: 'absolute', left: 24, right: 24, top, height: 82, opacity: appear, transform: `translateY(${(1 - appear) * 18}px)` }}>
      <div style={{ position: 'absolute', left: 26, top: 24, fontFamily: MONO, fontSize: 28, color: UI_MUTED }}>{n}</div>
      <div style={{ position: 'absolute', left: 84, top: 16, fontFamily: KO, fontWeight: 650, fontSize: 40, color: UI_INK, letterSpacing: '-0.02em' }}>{label}</div>
      <svg width={40} height={40} viewBox="0 0 40 40" style={{ position: 'absolute', right: 30, top: 21, opacity: cross > 0 ? 1 : 0 }}>
        <path d={`M8 8 L${8 + 24 * c1} ${8 + 24 * c1}`} stroke={UI_INK} strokeWidth={5} strokeLinecap="round" />
        {c2 > 0 ? <path d={`M32 8 L${32 - 24 * c2} ${8 + 24 * c2}`} stroke={UI_INK} strokeWidth={5} strokeLinecap="round" /> : null}
      </svg>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 1, background: RULE }} />
    </div>
  );
};

/** 07 메일 알림 카드(재현): 판 위로 내려온다. 받는 주소는 그리지 않는다. */
export const MailCard: React.FC<{ f: number; at: number; subject: string }> = ({ f, at, subject }) => {
  const p = prog(f, at, 12, OUT);
  if (p <= 0) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: 34,
        right: 34,
        top: 124,
        height: 132,
        borderRadius: 28,
        background: '#1D1C19',
        boxShadow: '0 18px 44px rgba(0,0,0,0.35)',
        transform: `translateY(${(1 - p) * -170}px)`,
        opacity: interpolate(p, [0, 0.4], [0, 1], clamp),
      }}
    >
      <svg width={46} height={36} viewBox="0 0 46 36" style={{ position: 'absolute', left: 32, top: 48 }}>
        <rect x={2} y={2} width={42} height={32} rx={6} fill="none" stroke={ME_INK} strokeWidth={3} />
        <path d="M4 6 L23 21 L42 6" fill="none" stroke={ME_INK} strokeWidth={3} strokeLinejoin="round" />
      </svg>
      <div style={{ position: 'absolute', left: 104, top: 24, fontFamily: MONO, fontSize: 22, color: '#9B988F' }}>메일 · SYNK</div>
      <div style={{ position: 'absolute', left: 104, top: 58, fontFamily: KO, fontWeight: 680, fontSize: 35, color: ME_INK, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>{subject}</div>
    </div>
  );
};

/** 글을 가린 질문 말풍선: 글자 대신 흐린 막대 둘(무엇을 물었는지는 지어내지 않는다). */
export const HiddenQuestion: React.FC<{ appear: number }> = ({ appear }) =>
  appear <= 0 ? null : (
    <div style={{ display: 'flex', justifyContent: 'flex-end', opacity: Math.min(1, appear * 1.6) }}>
      <div style={{ width: 520, padding: '28px 30px', borderRadius: 34, background: BUBBLE_ME, display: 'flex', flexDirection: 'column', gap: 14, transform: `scale(${0.94 + 0.06 * appear})`, transformOrigin: '100% 100%' }}>
        <div style={{ width: 440, height: 22, borderRadius: 11, background: '#5E5C56', filter: 'blur(2px)' }} />
        <div style={{ width: 250, height: 22, borderRadius: 11, background: '#5E5C56', filter: 'blur(2px)' }} />
      </div>
    </div>
  );
