// v7c 키네틱 머리글(10-20 밤, 유호님 「텍스트 들어가는거 모션에니매이션을 트렌디하고 반응 좋은거로 … 지금 너무 정적이라」).
// 키트 §9 기준 그대로: 낱말 단위 등장(말한 시각), 강조 낱말은 형광펜이 왼쪽부터 그어짐(mark), 박자마다 펀치인 1.04, 숫자는 세며 커짐(count).
// 뜻에 묶인 움직임만 쓴다: 「올려」는 위로 튐(up), 「텅」은 속 빈 글자(hollow), 「멈췄는데」는 줄이 회색으로 굳음(freezeAt),
// 「체크리스트」는 체크가 그려짐(check), 「저장해」는 책갈피(save). 글리치·흔들림·이유 없는 회전은 쓰지 않는다(키트 「하지 않는 움직임」).
import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { BUTTER, INK } from '../film/parts';
import { KO } from '../lib/fonts';
import { clamp, IN, mixColor, OUT, prog } from '../lib/motion';
import { LEFT, TOP } from '../full/kit';

export type Kind = 'up' | 'count' | 'hollow' | 'check' | 'save' | 'under';
/** 낱말: 글자, 들어오는 프레임, 형광펜 프레임(mark), 움직임 종류, count면 시작 수·끝 수. */
export type KW = { t: string; at: number; mark?: number; kind?: Kind; from?: number; to?: number };

const DARK = '#141412';

const Word: React.FC<{ w: KW; f: number; size: number; gray: number }> = ({ w, f, size, gray }) => {
  // 등장: 아래에서 살짝 커지며 올라와 한 번 넘쳤다 앉는 팝(10프레임), 흐림 8px → 0
  const t = w.at < 0 ? 1 : interpolate(f, [w.at, w.at + 10], [0, 1], clamp);
  if (t <= 0) return <span style={{ display: 'inline-block', opacity: 0 }}>{w.t}</span>;
  const y = interpolate(t, [0, 0.55, 1], [0.5 * size, -0.07 * size, 0], clamp);
  const sc = interpolate(t, [0, 0.55, 1], [0.84, 1.04, 1], clamp);
  const op = interpolate(t, [0, 0.3], [0, 1], clamp);
  const bl = interpolate(t, [0, 0.5], [8, 0], clamp);
  // 형광펜 + 그 순간 펀치
  // 밑줄(under)은 형광펜 없이 흰 밑줄만 — 한 벌에 버터는 한 곳
  const m = w.mark === undefined || w.kind === 'under' ? 0 : prog(f, w.mark, 7, OUT);
  const punch = w.mark === undefined || w.kind === 'under' ? 1 : interpolate(f - w.mark, [0, 4, 11], [1, 1.1, 1], clamp);
  // 「올려」: 위로 튐
  const up = w.kind === 'up' && w.mark !== undefined ? interpolate(f - w.mark, [0, 5, 13], [0, -0.13 * size, 0], clamp) : 0;
  // 숫자 세기
  let text = w.t;
  if (w.kind === 'count' && w.from !== undefined && w.to !== undefined) {
    const n = Math.round(interpolate(f, [w.at, w.at + 12], [w.from, w.to], clamp));
    text = w.t.replace(/\d+/, String(n));
  }
  const hollow = w.kind === 'hollow';
  const color = m > 0.45 ? DARK : gray > 0 ? mixColor(INK, '#6E6C66', gray) : INK;
  const under = w.kind === 'under' && w.mark !== undefined ? prog(f, w.mark, 9, OUT) : 0;
  const chk = w.kind === 'check' ? prog(f, (w.mark ?? w.at) + 6, 8, OUT) : 0;
  const save = w.kind === 'save' ? prog(f, (w.mark ?? w.at) + 3, 8, OUT) : 0;
  return (
    <span
      style={{
        display: 'inline-block',
        position: 'relative',
        transform: `translateY(${y + up}px) scale(${sc * punch})`,
        transformOrigin: '50% 80%',
        opacity: op,
        filter: bl > 0.3 ? `blur(${bl}px)` : undefined,
      }}
    >
      <span
        style={{
          display: 'inline-block',
          padding: '0 0.12em',
          margin: '0 -0.12em',
          borderRadius: 12,
          backgroundImage: m > 0 ? `linear-gradient(${BUTTER}, ${BUTTER})` : undefined,
          backgroundSize: `${m * 100}% 74%`,
          backgroundPosition: '0 78%',
          backgroundRepeat: 'no-repeat',
          color: hollow ? 'transparent' : color,
          WebkitTextStroke: hollow ? `${Math.max(2, size * 0.045)}px ${INK}` : undefined,
        }}
      >
        {text}
      </span>
      {under > 0 ? <span style={{ position: 'absolute', left: 0, bottom: -0.02 * size, height: 0.07 * size, width: `${under * 100}%`, borderRadius: 4, background: INK }} /> : null}
      {chk > 0 ? (
        <svg width={0.62 * size} height={0.62 * size} viewBox="0 0 40 40" style={{ position: 'absolute', right: -0.78 * size, top: 0.2 * size, overflow: 'visible' }}>
          <rect x={3} y={3} width={34} height={34} rx={8} fill="none" stroke={INK} strokeWidth={4} opacity={Math.min(1, chk * 2)} />
          <path d="M10 21 L18 29 L33 11" fill="none" stroke={BUTTER} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={40} strokeDashoffset={40 * (1 - chk)} />
        </svg>
      ) : null}
      {save > 0 ? (
        <svg width={0.5 * size} height={0.64 * size} viewBox="0 0 46 58" style={{ position: 'absolute', right: -0.7 * size, top: 0.18 * size, transform: `scale(${interpolate(save, [0, 0.6, 1], [0.4, 1.15, 1], clamp)})` }}>
          <path d="M5 4 Q5 2 7 2 L39 2 Q41 2 41 4 L41 54 L23 41 L5 54 Z" fill={BUTTER} stroke={BUTTER} strokeWidth={3.5} strokeLinejoin="round" />
        </svg>
      ) : null}
    </span>
  );
};

/** 머리글 한 벌. out: 그 프레임부터 7프레임에 위로 흐리며 한 번에 빠진다. freezeAt: 그 낱말에서 줄 전체가 회색으로 굳는다. */
export const KHeadline: React.FC<{ lines: KW[][]; out?: number; top?: number; size?: number; freezeAt?: number }> = ({ lines, out, top = TOP, size = 78, freezeAt }) => {
  const f = useCurrentFrame();
  const firstAt = Math.min(...lines.flat().map((w) => w.at));
  // 묶음 펀치인(키트 punch 1.04 → 1): 0프레임부터 보이는 벌은 첫 강조 때만
  const punchAt = firstAt < 0 ? undefined : firstAt;
  const punch = punchAt === undefined ? 1 : interpolate(f - punchAt, [0, 3, 10], [1, 1.04, 1], clamp);
  const pout = out === undefined ? 0 : prog(f, out, 7, IN);
  const gray = freezeAt === undefined ? 0 : prog(f, freezeAt, 6, OUT);
  if (pout >= 1) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: LEFT,
        top,
        fontFamily: KO,
        fontWeight: 760,
        fontSize: size,
        lineHeight: 1.16,
        letterSpacing: '-0.035em',
        color: INK,
        transform: `translateY(${-46 * pout}px) scale(${punch})`,
        transformOrigin: '0% 50%',
        opacity: 1 - pout,
        filter: pout > 0.05 ? `blur(${6 * pout}px)` : undefined,
      }}
    >
      {lines.map((ws, li) => (
        <div key={li} style={{ whiteSpace: 'nowrap' }}>
          {ws.map((w, wi) => (
            <React.Fragment key={wi}>
              {wi > 0 ? ' ' : null}
              <Word w={w} f={f} size={size} gray={gray} />
            </React.Fragment>
          ))}
        </div>
      ))}
    </div>
  );
};
