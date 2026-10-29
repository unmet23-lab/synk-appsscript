// 핵심 장면(제작 절차 「한 장면 먼저」) 3판. 1판(밀어 넘기기) · 2판(동그라미 넷 → 뜯기 → 체크 → 반반)은 장면 심사에서 둘 다
// 「넘김 · 볼 이유 2」 — 공통 지적은 「옛 메뉴판이 왜 문제인지 안 와닿고(스티커 · 품절 줄은 실제 가게에서 흔함) 사람 · 사연이 없다」,
// 2판은 「뜯는 순간 두 판이 겹쳐 비침 · 끝 반반이 메뉴 이름을 자름」. 3판: 손님 목소리 「사장님, 이거 4,000원이에요? 3,500원이에요?」에
// 카메라가 덧붙인 스티커로 다가가고(가게의 손해부터) → 확 물러서며 옛 종이를 선명하게 뜯어내면 같은 벽에 새 메뉴판(실제 ChatGPT 결과를
// 원근만 맞춰 앉힌 합성) → 4,000에 체크 → 끝은 「후」를 화면 가득(작은 「전」 창은 새 메뉴판 제목을 가려 뺐다). 전부 useCurrentFrame()으로만 움직인다.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from './lib/fonts';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);
const EASE_IN = Easing.bezier(0.55, 0, 1, 0.45);

// 장면 안 프레임(30fps). 손님 줄 c01(3.245초): 「사천」 0.94초 · 「삼천오백」 2.13초(public/vo/c01.json). 물러서기(pull)는 뜯기와 같은
// 프레임에 8프레임 동안 — 편에서 나란히가 물러서기 · 뜯기를 박자 둘로 세지 않게(원본은 그 자리에 박자 하나).
export const R = { voice: 2, circle: 30, ask: 66, pull: 104, rip: 104, ripEnd: 114, check: 124, inset: 148, end: 180 };
export const REVEAL_LEN = R.end;

// 자리(1080×1920) — 자료/뜯기층.py가 「전」 사진 · 메뉴 그림 좌표에서 원근 변환으로 구한 값
const STICKER = { x: 689, y: 511, rx: 122, ry: 60 }; // 원조김밥 4,000 스티커(밑에 옛 값이 조금 비친다)
const AFTER_4000 = { x: 774, y: 613 };
const AFTER_MORE = [{ x: 770, y: 972 }, { x: 782, y: 1460 }]; // 6,500 · 카드 가능(편에서만 — extra)
const CAM = { x: 720, y: 560 }; // 다가가는 중심 — 두 자리 사이라 원점을 바꾸지 않는다

// 손으로 그린 동그라미 — 한 바퀴 조금 넘게, 살짝 기운 타원. at부터 8프레임에 그린다.
const Loop: React.FC<{ x: number; y: number; rx: number; ry: number; at: number }> = ({ x, y, rx, ry, at }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [at, at + 8], [0, 1], { ...clamp, easing: EASE_OUT });
  if (p <= 0) return null;
  const pts: string[] = [];
  const turns = 1.12;
  for (let i = 0; i <= 64; i++) {
    const t = (i / 64) * turns * Math.PI * 2 - 2.3;
    const wob = 1 + 0.05 * Math.sin(i * 0.7) + 0.04 * (i / 64);
    pts.push(`${(x + Math.cos(t) * rx * wob).toFixed(1)},${(y + Math.sin(t) * ry * wob).toFixed(1)}`);
  }
  const len = 2 * Math.PI * Math.sqrt((rx * rx + ry * ry) / 2) * turns * 1.05;
  return (
    <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
      <path d={`M${pts.join(' L')}`} fill="none" stroke="#e3262b" strokeWidth={9} strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - p)}
        style={{ filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.25))', rotate: '-3deg', transformOrigin: `${x}px ${y}px` }} />
    </svg>
  );
};

// 손글씨 물음표 — 곡선 한 획 + 점
const Ask: React.FC<{ x: number; y: number; at: number }> = ({ x, y, at }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [at, at + 7], [0, 1], { ...clamp, easing: EASE_OUT });
  if (p <= 0) return null;
  const len = 150;
  return (
    <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
      <path d={`M${x},${y} c0,-34 52,-40 52,-6 c0,26 -30,26 -30,52`} fill="none" stroke="#e3262b" strokeWidth={9} strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - p)} />
      {p > 0.9 && <circle cx={x + 22} cy={y + 76} r={6} fill="#e3262b" />}
    </svg>
  );
};

const Check: React.FC<{ x: number; y: number; at: number }> = ({ x, y, at }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [at, at + 7], [0, 1], { ...clamp, easing: EASE_OUT });
  if (p <= 0) return null;
  const len = 124;
  return (
    <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
      <path d={`M${x + 110},${y - 5} l26,30 l52,-66`} fill="none" stroke="#34d27b" strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={len} strokeDashoffset={len * (1 - p)}
        style={{ filter: 'drop-shadow(0 3px 3px rgba(0,0,0,0.45))' }} />
    </svg>
  );
};

export const Chip: React.FC<{ text: string; x: number; y: number; size?: number }> = ({ text, x, y, size = 44 }) => (
  <div style={{ position: 'absolute', left: x, top: y, padding: '8px 22px', borderRadius: 14, fontFamily: KO, fontWeight: 800, fontSize: size,
    color: '#fff', background: 'rgba(17,17,17,0.86)', boxShadow: '0 6px 18px rgba(0,0,0,0.3)' }}>
    {text}
  </div>
);

/** 핵심 장면. sound=false면 효과음 · 손님 목소리 없이(편에서 따로 깐다). */
export const Reveal: React.FC<{ sound?: boolean; extra?: boolean; punch?: number }> = ({ sound = true, extra = false, punch }) => {
  const f = useCurrentFrame();
  // 카메라: 손님 말에 스티커로 다가갔다가(0~1초), 뜯기 직전에 확 물러선다. 뒤에는 4,000 쪽으로 조금.
  const zoomIn = interpolate(f, [R.voice, R.voice + 26], [1.04, 1.5], { ...clamp, easing: EASE_OUT }) + interpolate(f, [R.voice + 26, R.pull], [0, 0.08], clamp);
  // punch: 편에서 숨 고르기 박(24.4초)에 한 번 확 다가간다 — 물러서기(pull) 전까지
  const kick = punch === undefined ? 1 : interpolate(f, [punch, punch + 3], [1, 1.12], clamp);
  const zoom = f < R.pull ? zoomIn * kick : interpolate(f, [R.pull, R.pull + 8], [1.58, 1.04], { ...clamp, easing: EASE_IN_OUT }) + interpolate(f, [R.ripEnd, R.inset], [0, 0.1], { ...clamp, easing: EASE_OUT });
  const bump = f >= R.ripEnd ? Math.exp(-(f - R.ripEnd) / 4) : 0;
  const shake = bump * Math.sin((f - R.ripEnd) * 2.6) * 10;
  const dx = Math.sin(f / 23) * 3 + shake, dy = Math.cos(f / 31) * 2 + shake * 0.6;
  const rip = interpolate(f, [R.rip, R.ripEnd], [0, 1], { ...clamp, easing: EASE_IN });
  const fall = interpolate(f, [R.rip + 2, R.rip + 26], [0, 1], { ...clamp, easing: EASE_IN });
  return (
    <AbsoluteFill style={{ background: '#2a2620', overflow: 'hidden' }}>
      <AbsoluteFill style={{ transformOrigin: `${CAM.x}px ${CAM.y}px`, scale: `${(zoom * (1 + 0.02 * bump)).toFixed(4)}`, translate: `${dx.toFixed(2)}px ${dy.toFixed(2)}px` }}>
        <Img src={staticFile('img/후_벽.png')} style={{ position: 'absolute', inset: 0, width: 1080, height: 1920 }} />
        {f < R.rip ? (
          <AbsoluteFill>
            <Img src={staticFile('img/전.png')} style={{ position: 'absolute', inset: 0, width: 1080, height: 1920 }} />
            <Loop {...STICKER} at={R.circle} />
            <Ask x={STICKER.x + 150} y={STICKER.y - 30} at={R.ask} />
          </AbsoluteFill>
        ) : (
          <>
            {rip < 1 && (
              <AbsoluteFill style={{ transformOrigin: '14% 9%', translate: `${-950 * rip}px ${-1350 * rip}px`, rotate: `${-42 * rip}deg`, scale: `${1 - 0.15 * rip} ${1 - 0.28 * rip}` }}>
                <div style={{ position: 'absolute', inset: 0, translate: `${24 * rip}px ${40 * rip}px`, filter: 'blur(18px)', opacity: 0.45 * Math.min(1, rip * 4) }}>
                  <Img src={staticFile('img/전_종이.png')} style={{ position: 'absolute', inset: 0, width: 1080, height: 1920, filter: 'brightness(0)' }} />
                </div>
                <Img src={staticFile('img/전_종이.png')} style={{ position: 'absolute', inset: 0, width: 1080, height: 1920, filter: `brightness(${(1 + 0.15 * rip).toFixed(2)})` }} />
                <Loop {...STICKER} at={R.circle} />
              </AbsoluteFill>
            )}
            {fall < 1 && (
              <AbsoluteFill style={{ transformOrigin: '85% 87%', translate: `${40 * fall}px ${900 * fall}px`, rotate: `${28 * fall}deg` }}>
                <Img src={staticFile('img/전_쪽지.png')} style={{ position: 'absolute', inset: 0, width: 1080, height: 1920 }} />
              </AbsoluteFill>
            )}
            <Check {...AFTER_4000} at={R.check} />
            {extra && AFTER_MORE.map((a, i) => <Check key={i} {...a} at={R.check + 8 * (i + 1)} />)}
          </>
        )}
      </AbsoluteFill>
      {sound && (
        <>
          <Sequence from={R.voice} durationInFrames={100}><Audio src={staticFile('vo/c01.wav')} volume={1} /></Sequence>
          <Sequence from={R.circle} durationInFrames={12}><Audio src={staticFile('sfx/pen.wav')} volume={0.9} /></Sequence>
          <Sequence from={R.ask} durationInFrames={12}><Audio src={staticFile('sfx/pen.wav')} volume={0.8} /></Sequence>
          <Sequence from={R.rip - 3} durationInFrames={27}><Audio src={staticFile('sfx/tear.wav')} volume={1} /></Sequence>
          <Sequence from={R.ripEnd} durationInFrames={15}><Audio src={staticFile('sfx/thud.wav')} volume={0.55} /></Sequence>
          <Sequence from={R.check} durationInFrames={6}><Audio src={staticFile('sfx/tick.wav')} volume={0.9} /></Sequence>
        </>
      )}
    </AbsoluteFill>
  );
};
