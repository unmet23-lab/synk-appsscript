// LAB E9 「미안 세 단계」(10-29) — 오마주 doci 「How Koreans say thank you」의 뼈대를 그대로: 고정 카메라 한 장면에
// 칸마다 몽글이 하나씩 더 숙인 자세로 쌓인다(그림 자체가 칸마다 한 장 — 누끼 · 얹기 없음). 카메라는 움직이지 않고(원본도 고정),
// 칸은 박자에 바로 바뀐다. 화면 글은 원본 자리(위 가운데)에, 배울 세 낱말(1~3칸)만 단계 표 · 읽는 법을 단다.
// 소리는 원본처럼 목소리 하나뿐, 음악 없음, 끝 카드 없음.
// v2: 글을 몽글의 흰 말풍선(꼬리가 처음 몽글 머리를 가리킴)으로 — v1 두 시험관이 「누가 말하는지 모르겠다」, haiku는 어두운 자막 상자 +
// [발음] + 노란 뜻 줄이 지난 「아니」 편과 같은 틀로 보인다고 했다. 말풍선은 아래 끝을 고정하고 위로 자란다.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { EN, KO } from '../lib/fonts';
import { CELLS, FPS, LOCALES, Loc, TOTAL } from './data';

const fr = (sec: number) => Math.round(sec * FPS);
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const MASTER = 0.8; // Remotion은 소리를 16비트로 더해 넘치면 자른다 — 모든 볼륨에 같은 값을 곱한다(현장 노트)
export const TOTAL_FRAMES = fr(TOTAL);
export { FPS };

const INK = '#2B2522';
const CORAL = '#E8503D';
const MEAN = '#B23A26'; // 뜻 줄 — 흰 말풍선 위 진한 산호
const BUBBLE_BOTTOM = 610; // 말풍선 아래 끝(px) — 처음 몽글 머리(약 725px) 바로 위
const TAIL_TIP: [number, number] = [640, 712]; // 꼬리 끝 — 처음 몽글 머리 위

const cellAt = (sec: number) => {
  let i = 0;
  CELLS.forEach((c, k) => {
    if (sec >= c.at) i = k;
  });
  return i;
};

// 1024×1536 그림을 1280×1920으로 깔고 가운데 1080을 보인다(좌우 100px씩 잘림) — 카메라는 고정
const Plate: React.FC<{ src: string }> = ({ src }) => (
  <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: '#2a1d16' }}>
    <Img src={staticFile(`img/${src}`)} style={{ position: 'absolute', left: -100, top: 0, width: 1280, height: 1920 }} />
  </AbsoluteFill>
);

const Bubble: React.FC<{ i: number; loc: Loc }> = ({ i, loc }) => {
  const frame = useCurrentFrame();
  const c = CELLS[i];
  const L = LOCALES[loc];
  const m = L.lines[i];
  // 칸이 바뀔 때 말풍선만 4프레임 살짝 튀어나온다(그림은 바로 바뀜)
  const p = interpolate(frame, [fr(c.at), fr(c.at) + 4], [0.9, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const moreOn = c.more ? frame >= fr(c.more.at) : false;
  const enFont = L.font ?? EN;
  // v3: 목소리 박자대로 낱말이 붙는 줄 — 아직 안 나온 낱말은 자리만 차지한다(말풍선 크기가 흔들리지 않게)
  const koLine = c.words ? (
    <div style={{ fontFamily: KO, fontWeight: 800, fontSize: c.koSize, color: INK, lineHeight: 1.16 }}>
      {c.words.map(([w, t, hot], k) => {
        if (w === '\n') return <br key={k} />;
        const at = fr(c.voAt + t);
        const q = interpolate(frame, [at, at + 3], [0, 1], clamp);
        return (
          <span key={k} style={{ display: 'inline-block', opacity: q, transform: `translateY(${(1 - q) * 14}px)`, color: hot ? CORAL : INK, marginRight: 18 }}>
            {w}
          </span>
        );
      })}
    </div>
  ) : (
    <div style={{ fontFamily: KO, fontWeight: 800, fontSize: c.koSize, color: INK, lineHeight: 1.16, whiteSpace: 'pre-line' }}>{c.ko}</div>
  );
  return (
    <>
      {/* v3: 선생님 얼굴(왼쪽 위)을 비켜 오른쪽에 붙인다 — 꼬리 자리(588~644px)가 늘 말풍선 안에 들게 가장 좁아도 520px */}
      <div style={{ position: 'absolute', bottom: 1920 - BUBBLE_BOTTOM, right: 24, width: 1032, display: 'flex', justifyContent: 'flex-end' }}>
        <div
          style={{
            display: 'inline-block',
            minWidth: 520,
            maxWidth: 660,
            textAlign: 'center',
            background: '#FFFDF7',
            border: `6px solid ${INK}`,
            borderRadius: 48,
            padding: '20px 44px 24px',
            boxShadow: '0 10px 28px rgba(0,0,0,0.28)',
            transform: `scale(${p})`,
            transformOrigin: '20% 100%',
          }}
        >
          {c.level ? (
            <div style={{ marginBottom: 4 }}>
              <span style={{ display: 'inline-block', background: CORAL, color: '#fff', fontFamily: EN, fontWeight: 800, fontSize: 44, lineHeight: 1, padding: '10px 24px 12px', borderRadius: 999 }}>
                {L.levelWord}
                {c.level}
              </span>
            </div>
          ) : null}
          {koLine}
          {c.roman ? <div style={{ fontFamily: EN, fontWeight: 700, fontSize: 40, color: '#8A7563', lineHeight: 1.15, marginTop: 2 }}>{c.roman}</div> : null}
          <div style={{ fontFamily: enFont, fontWeight: 800, fontSize: m.size, color: MEAN, lineHeight: 1.16, marginTop: 8, whiteSpace: 'pre-line' }}>
            {m.text}
            {m.more && moreOn ? <span style={{ color: CORAL }}>{` ${m.more}`}</span> : null}
          </div>
          {m.tag ? (
            <div style={{ marginTop: 10 }}>
              <span style={{ display: 'inline-block', background: '#FFE7A1', color: INK, fontFamily: enFont, fontWeight: 800, fontSize: m.tag.length > 18 ? 36 : 42, lineHeight: 1.1, padding: '8px 22px 10px', borderRadius: 999 }}>{m.tag}</span>
            </div>
          ) : null}
        </div>
      </div>
      {/* 꼬리 — 말풍선 아래 끝에서 처음 몽글 머리로 */}
      <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0, opacity: p }}>
        <path
          d={`M ${TAIL_TIP[0] - 52} ${BUBBLE_BOTTOM - 8} L ${TAIL_TIP[0] + 4} ${BUBBLE_BOTTOM - 8} L ${TAIL_TIP[0]} ${TAIL_TIP[1]} Z`}
          fill="#FFFDF7"
          stroke={INK}
          strokeWidth={6}
          strokeLinejoin="round"
        />
        <rect x={TAIL_TIP[0] - 49} y={BUBBLE_BOTTOM - 14} width={50} height={9} fill="#FFFDF7" />
      </svg>
    </>
  );
};

const Sound: React.FC = () => (
  <>
    {CELLS.map((c) => (
      <Sequence key={c.vo} from={fr(c.voAt)} layout="none">
        <Audio src={staticFile(`vo/${c.vo}.wav`)} volume={MASTER} />
      </Sequence>
    ))}
  </>
);

export const Film: React.FC<{ loc: Loc }> = ({ loc }) => {
  const frame = useCurrentFrame();
  const i = cellAt(frame / FPS);
  return (
    <AbsoluteFill style={{ backgroundColor: '#2a1d16' }}>
      <Plate src={CELLS[i].img} />
      <Bubble i={i} loc={loc} />
      <Sound />
    </AbsoluteFill>
  );
};
