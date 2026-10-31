// LAB 몽골 M11(10-29 · 11-01 다시 살림 v7 — 몽글 하나가 자세만 바꾼다, data.ts 머리 주석) — E9 「미안 세 단계」와 같은 오마주 뼈대(고정 카메라 · 칸마다 몽글 하나씩 쌓임 · 반전 9.3 · 끝 12.5).
// 그림은 칸마다 앞 칸을 참고로 구운 한 장(누끼 · 얹기 없음), 카메라는 고정, 칸은 박자에 바로 바뀐다. 소리는 목소리 하나(소진 · 한국어 줄만),
// 음악 없음, 끝 카드 없음. 화면 글은 E9 v3와 같은 몽글의 흰 말풍선(꼬리가 처음 몽글 머리를 가리킴)에 한글 · 키릴 읽기 · 몽골 뜻 —
// 사장님 얼굴(왼쪽 위)을 비켜 오른쪽에 붙인다. E9 Film.tsx를 옮겨 판별 글 표 대신 칸마다 몽골어 칸을 읽게 했다.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { EN, KO } from '../lib/fonts';
import { BOSS, CELLS, FPS, LEVEL, Loc, PORTS, ROMAN, SCENE, TOTAL } from './data';

const fr = (sec: number) => Math.round(sec * FPS);
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const MASTER = 0.8; // Remotion은 소리를 16비트로 더해 넘치면 자른다 — 모든 볼륨에 같은 값을 곱한다(현장 노트)
export const TOTAL_FRAMES = fr(TOTAL);
export { FPS };

const INK = '#2B2522';
const CORAL = '#E8503D';
const MEAN = '#B23A26'; // 뜻 줄 — 흰 말풍선 위 진한 산호
const BUBBLE_TOP = 995; // v7: 말풍선 위 끝(px) — 계산대 앞판 위쪽
const TAIL_TIP: [number, number] = [770, 965]; // 꼬리 끝 — 계산대 위 몽글 자리

const cellAt = (sec: number) => {
  let i = 0;
  CELLS.forEach((c, k) => {
    if (sec >= c.at) i = k;
  });
  return i;
};

// 1024×1536 그림을 1280×1920으로 깔고 가운데 1080을 보인다(좌우 100px씩 잘림) — 카메라는 고정
// v7: 몽글이 하나라 아래 절반(계산대 앞판)이 비어 그림을 1.45배로 당겨 사장님 · 몽글이 위 60%를 채우고, 말풍선은 아래 나무판 자리에 둔다
const K = 1.5;
const OFF: [number, number] = [-160, -360]; // 11-01: 말풍선 아래 끝을 앱 글자 자리(1428px) 위로 — 그림을 100px 올림
const Plate: React.FC<{ src: string; push: number }> = ({ src, push }) => (
  <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: '#2a1d16' }}>
    <Img src={staticFile(`img/${src}`)} style={{ position: 'absolute', left: OFF[0], top: OFF[1], width: 1024 * K, height: 1536 * K, transformOrigin: '60% 45%', transform: `scale(${push})` }} />
  </AbsoluteFill>
);

const Bubble: React.FC<{ i: number; loc: Loc }> = ({ i, loc }) => {
  const frame = useCurrentFrame();
  const c = CELLS[i];
  // 두 채널 판은 읽는 법을 로마자로, 뜻 · 꼬리 · 둘째 걸음을 그 나라 말 칸에서 읽는다
  const P = loc === 'mn' ? null : PORTS[loc];
  const read = P ? (c.level ? ROMAN[c.level - 1] : undefined) : c.read;
  const mean = P ? P.lines[i].text : c.mn;
  const meanSize = P ? P.lines[i].size : c.mnSize;
  const tag = P ? P.lines[i].tag : c.tag;
  const moreText = P ? P.lines[i].more : c.more?.mn;
  // 칸이 바뀔 때 말풍선만 4프레임 살짝 튀어나온다(그림은 바로 바뀜)
  const p = c.cont ? 1 : interpolate(frame, [fr(c.at), fr(c.at) + 4], [0.9, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  // v5: 둘째 걸음 뜻 줄도 처음부터 보이고 그 말이 나올 때 산호색으로 밝아진다(v4 두 시험관 다 「'주말에도'가 화면 글에 없음」)
  const moreOn = c.more ? frame >= fr(c.more.at) : false;
  const enFont = P ? P.font : EN;
  // 목소리 박자대로 밝아지는 줄 — v5부터 줄 전체가 처음부터 흐리게 보이고, 말한 낱말만 진해진다(3.2초 동안 끝 낱말까지 읽히게)
  const koLine = c.words ? (
    <div style={{ fontFamily: KO, fontWeight: 800, fontSize: c.koSize, color: INK, lineHeight: 1.16 }}>
      {c.words.map(([w, t, hot], k) => {
        if (w === '\n') return <br key={k} />;
        const at = fr(c.voAt + t);
        const q = interpolate(frame, [at, at + 3], [0, 1], clamp);
        return (
          <span key={k} style={{ display: 'inline-block', opacity: 0.32 + 0.68 * q, transform: `scale(${1 + 0.06 * q * (1 - q) * 4})`, color: hot && q > 0.5 ? CORAL : INK, marginRight: 18 }}>
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
      {/* 사장님 얼굴(왼쪽 위)을 비켜 오른쪽에 붙인다 — 꼬리 자리(588~644px)가 늘 말풍선 안에 들게 가장 좁아도 520px */}
      <div style={{ position: 'absolute', top: BUBBLE_TOP, left: 140, width: 800, display: 'flex', justifyContent: 'center' }}>
        <div
          style={{
            display: 'inline-block',
            minWidth: 520,
            maxWidth: 760,
            textAlign: 'center',
            background: '#FFFDF7',
            border: `6px solid ${INK}`,
            borderRadius: 48,
            padding: '14px 40px 16px',
            boxShadow: '0 10px 28px rgba(0,0,0,0.28)',
            transform: `scale(${p})`,
            transformOrigin: '60% 0%',
          }}
        >
          {c.zero ? (
            <div style={{ marginBottom: 4 }}>
              <span style={{ display: 'inline-block', background: INK, color: '#fff', fontFamily: EN, fontWeight: 800, fontSize: 44, lineHeight: 1, padding: '10px 24px 12px', borderRadius: 999 }}>
                {LEVEL[loc](0)} ❌
              </span>
            </div>
          ) : null}
          {c.level ? (
            <div style={{ marginBottom: 4 }}>
              <span style={{ display: 'inline-block', background: CORAL, color: '#fff', fontFamily: EN, fontWeight: 800, fontSize: 44, lineHeight: 1, padding: '10px 24px 12px', borderRadius: 999 }}>
                {LEVEL[loc](c.level)}
              </span>
            </div>
          ) : null}
          <div style={{ fontFamily: enFont, fontWeight: 800, fontSize: meanSize, color: MEAN, lineHeight: 1.16, marginBottom: 8, whiteSpace: 'pre-line' }}>
            {mean}
            {moreText ? <span style={{ color: moreOn ? CORAL : MEAN, opacity: moreOn ? 1 : 0.45 }}>{` ${moreText}`}</span> : null}
          </div>
          {koLine}
          {read ? <div style={{ fontFamily: EN, fontWeight: 800, fontSize: 44, color: '#4F3F33', lineHeight: 1.15, marginTop: 2 }}>{read}</div> : null}
          {tag ? <div style={{ marginTop: 8, fontFamily: enFont, fontWeight: 700, fontSize: 40, color: '#4F3F33', lineHeight: 1.15 }}>→ {tag}</div> : null}
        </div>
      </div>
      {/* 꼬리 — 말풍선 위 끝에서 계산대 위 몽글로 */}
      <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0, opacity: p }}>
        <path
          d={`M ${TAIL_TIP[0] - 30} ${BUBBLE_TOP + 8} L ${TAIL_TIP[0] + 26} ${BUBBLE_TOP + 8} L ${TAIL_TIP[0]} ${TAIL_TIP[1]} Z`}
          fill="#FFFDF7"
          stroke={INK}
          strokeWidth={6}
          strokeLinejoin="round"
        />
        <rect x={TAIL_TIP[0] - 27} y={BUBBLE_TOP + 5} width={50} height={9} fill="#FFFDF7" />
      </svg>
    </>
  );
};

const Sound: React.FC = () => (
  <>
    <Audio src={staticFile('bgm.wav')} volume={(i) => 0.07 * MASTER * interpolate(i, [fr(TOTAL) - 20, fr(TOTAL)], [1, 0], clamp)} />
    {CELLS.filter((c) => c.vo).map((c) => (
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
      <Plate src={CELLS[i].img} push={interpolate(frame, [fr(CELLS[i].at), fr(i + 1 < CELLS.length ? CELLS[i + 1].at : TOTAL)], [1, 1.035], clamp)} />
      {/* v3: 사장님 옆 상황 한 줄 — 무엇을 사과하는지(v4: 0~2.3초 → 0~4.4초) */}
      {frame < fr(CELLS[3].at) ? (
        <div style={{ position: 'absolute', left: 360, top: 290, maxWidth: 540, textAlign: 'left' }}>
          <span style={{ display: 'inline-block', background: '#FFFDF7', color: INK, border: `4px solid ${INK}`, boxShadow: '0 6px 16px rgba(0,0,0,0.3)', fontFamily: loc === 'mn' ? EN : PORTS[loc].font, fontWeight: 800, fontSize: 40, lineHeight: 1.2, padding: '10px 22px 12px', borderRadius: 22 }}>{SCENE[loc]}</span>
        </div>
      ) : null}
      {/* v3: 칸마다 새로 생긴 몽글 자리에 「+1 🙇」 0.7초 — 같은 몽글이 한 번 더 숙였다는 것 */}
      {frame < fr(CELLS[2].at) ? (
        <div style={{ position: 'absolute', left: 60, top: 500, opacity: interpolate(frame, [0, 4], [0, 1], clamp) }}>
          <span style={{ display: 'inline-block', background: '#FFFDF7', color: INK, border: `5px solid ${INK}`, fontFamily: loc === 'mn' ? EN : PORTS[loc].font, fontWeight: 800, fontSize: 52, lineHeight: 1, padding: '10px 24px 12px', borderRadius: 999, boxShadow: '0 6px 16px rgba(0,0,0,0.3)' }}>👆 {BOSS[loc]}</span>
        </div>
      ) : null}
      <Bubble i={i} loc={loc} />
      <Sound />
    </AbsoluteFill>
  );
};
