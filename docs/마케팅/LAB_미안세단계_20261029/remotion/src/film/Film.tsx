// LAB E9 「미안 세 단계」(10-29) — 오마주 doci 「How Koreans say thank you」의 뼈대를 그대로: 고정 카메라 한 장면에
// 칸마다 몽글이 하나씩 더 숙인 자세로 쌓인다(그림 자체가 칸마다 한 장 — 누끼 · 얹기 없음). 카메라는 움직이지 않고(원본도 고정),
// 칸은 박자에 바로 바뀐다. 화면 글은 원본 자리(위 가운데)에, 배울 세 낱말(1~3칸)만 단계 표 · 읽는 법을 단다.
// 소리는 원본처럼 목소리 하나뿐, 음악 없음, 끝 카드 없음.
// v2: 글을 몽글의 흰 말풍선(꼬리가 처음 몽글 머리를 가리킴)으로 — v1 두 시험관이 「누가 말하는지 모르겠다」, haiku는 어두운 자막 상자 +
// [발음] + 노란 뜻 줄이 지난 「아니」 편과 같은 틀로 보인다고 했다. 말풍선은 아래 끝을 고정하고 위로 자란다.
// v4(다시 살림): 0초 부딪힘 칸은 글 없이 쿵 + 화면 흔들림, 말풍선 꼬리는 반전부터 뒤로 젖힌 몽글로, 「네가」 칸은 선생님을 가리키는 화살표, 끝은 눈빛 → 납작.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { EN, KO } from '../lib/fonts';
import { CELLS, FPS, LOCALES, Loc, SFX, TOTAL } from './data';

const fr = (sec: number) => Math.round(sec * FPS);
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const MASTER = 0.8; // Remotion은 소리를 16비트로 더해 넘치면 자른다 — 모든 볼륨에 같은 값을 곱한다(현장 노트)
export const TOTAL_FRAMES = fr(TOTAL);
export { FPS };

const INK = '#2B2522';
const CORAL = '#E8503D';
const MEAN = '#B23A26'; // 뜻 줄 — 흰 말풍선 위 진한 산호
// 말풍선 아래 끝(px)과 꼬리 끝 — 처음 몽글 머리(약 725px) · 뒤로 젖힌 몽글 머리(약 590px) · 납작 엎드린 몽글 위
const SPOT = {
  first: { bottom: 610, tip: [640, 712] as [number, number] },
  back: { bottom: 556, tip: [905, 622] as [number, number] },
  end: { bottom: 900, tip: [590, 996] as [number, number] },
  dream: { bottom: 1158, tip: [640, 1392] as [number, number] },
  palace: { bottom: 1056, tip: [720, 1262] as [number, number] },
  throne: { bottom: 556, tip: [690, 742] as [number, number] },
};

const cellAt = (sec: number) => {
  let i = 0;
  CELLS.forEach((c, k) => {
    if (sec >= c.at) i = k;
  });
  return i;
};

// 1024×1536 그림을 1280×1920으로 깔고 가운데 1080을 보인다(좌우 100px씩 잘림) — 카메라는 고정
const Plate: React.FC<{ src: string; shake?: number; push?: number }> = ({ src, shake = 0, push = 1 }) => (
  <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: '#2a1d16' }}>
    <Img src={staticFile(`img/${src}`)} style={{ position: 'absolute', left: -100, top: 0, width: 1280, height: 1920, transform: shake ? `translate(${shake}px, ${-shake * 0.6}px) scale(1.03)` : `scale(${push})`, transformOrigin: '50% 58%' }} />
  </AbsoluteFill>
);

// 선생님 이름표 — 쪽머리 위 왼쪽(시험관이 「이 할머니가 선생님인가」를 확신 못 했다)
const TeacherTag: React.FC<{ loc: Loc }> = ({ loc }) => {
  const L = LOCALES[loc];
  return (
    <div style={{ position: 'absolute', left: 70, top: 640, background: '#FFFDF7', border: `5px solid ${INK}`, borderRadius: 999, padding: '8px 26px 11px', fontFamily: L.font ?? EN, fontWeight: 800, fontSize: 40, color: INK, lineHeight: 1.1 }}>
      {L.teacher}
    </div>
  );
};

// 몽글 이름표 — 처음 몽글 아래(말하는 쪽이 몽글임을 그림에서 바로)
const StudentTag: React.FC<{ loc: Loc; x: number; y: number }> = ({ loc, x, y }) => {
  const L = LOCALES[loc];
  return (
    <div style={{ position: 'absolute', left: x, top: y, transform: 'translateX(-50%)', background: '#FFFDF7', border: `5px solid ${INK}`, borderRadius: 999, padding: '8px 26px 11px', fontFamily: L.font ?? EN, fontWeight: 800, fontSize: 40, color: INK, lineHeight: 1.1, whiteSpace: 'nowrap' }}>
      {L.student}
    </div>
  );
};

// 되감기 칸 — 0초 부딪힘을 증거처럼: 주사선 · REPLAY 표시, 몽글에 이름표(말로 뒤집은 것이 그림으로 다시 뒤집힌다)
const Replay: React.FC<{ loc: Loc; from: number }> = ({ loc, from }) => {
  const frame = useCurrentFrame();
  const L = LOCALES[loc];
  const blink = Math.floor((frame - fr(from)) / 6) % 2 === 0;
  return (
    <>
      <AbsoluteFill style={{ background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.16) 0 3px, rgba(0,0,0,0) 3px 9px)' }} />
      <div style={{ position: 'absolute', left: 70, top: 280, display: 'flex', alignItems: 'center', gap: 16, background: 'rgba(20,16,14,0.78)', borderRadius: 18, padding: '10px 26px 12px' }}>
        <span style={{ width: 28, height: 28, borderRadius: 14, background: blink ? '#FF3B30' : 'transparent', border: '4px solid #FF3B30' }} />
        <span style={{ fontFamily: L.font ?? EN, fontWeight: 800, fontSize: 54, color: '#fff', letterSpacing: 2 }}>◀◀ {L.replay}</span>
      </div>
    </>
  );
};

// 「네가」 화살표 — 말풍선 아래에서 선생님 얼굴 쪽으로
const Arrow: React.FC<{ from: number; loc: Loc }> = ({ from, loc }) => {
  const frame = useCurrentFrame();
  const L = LOCALES[loc];
  const p = interpolate(frame, [fr(from), fr(from) + 5], [0.5, 1], { ...clamp, easing: Easing.out(Easing.back(2)) });
  const nudge = Math.sin(((frame - fr(from)) / FPS) * Math.PI * 6) * 8;
  return (
    <>
      <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0 }}>
        <g transform={`translate(${560 + nudge} ${640 + nudge * 0.4}) rotate(204) scale(${p})`}>
          <path d="M 0 -20 L 92 -20 L 92 -52 L 170 0 L 92 52 L 92 20 L 0 20 Z" fill={CORAL} stroke="#FFFDF7" strokeWidth={9} strokeLinejoin="round" />
        </g>
      </svg>
      <div style={{ position: 'absolute', left: 556, top: 612, background: CORAL, border: '5px solid #FFFDF7', borderRadius: 999, padding: '8px 24px 11px', color: '#fff', fontFamily: KO, fontWeight: 800, fontSize: 42, lineHeight: 1.1, transform: `scale(${p})`, transformOrigin: '0% 50%', whiteSpace: 'nowrap' }}>
        네가 = {L.you}
      </div>
    </>
  );
};

const Bubble: React.FC<{ i: number; loc: Loc }> = ({ i, loc }) => {
  const frame = useCurrentFrame();
  const c = CELLS[i];
  const L = LOCALES[loc];
  const m = L.lines[i];
  // 칸이 바뀔 때 말풍선만 4프레임 살짝 튀어나온다(그림은 바로 바뀜)
  const p = interpolate(frame, [fr(c.at), fr(c.at) + 4], [0.9, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const moreOn = c.more ? frame >= fr(c.more.at) : false;
  const enFont = L.font ?? EN;
  const spot = SPOT[c.tail ?? 'first'];
  const BUBBLE_BOTTOM = spot.bottom;
  const TAIL_TIP = spot.tip;
  const tagChip = m.tag ? (
    <span style={{ display: 'inline-block', background: '#FFE7A1', color: INK, fontFamily: enFont, fontWeight: 800, fontSize: 40, lineHeight: 1.1, padding: '9px 22px 11px', borderRadius: 999, whiteSpace: 'nowrap' }}>{m.tag}</span>
  ) : null;
  // v3: 목소리 박자대로 낱말이 붙는 줄 — 아직 안 나온 낱말은 자리만 차지한다(말풍선 크기가 흔들리지 않게)
  const pairRows = c.pairs ? c.ko.split('\n').map((ko, k) => [ko, m.text.split('\n')[k] ?? ''] as const) : null;
  const koLine = pairRows ? (
    <div>
      {pairRows.map(([ko, en], k) => (
        <div key={k} style={{ marginTop: k ? 10 : 0 }}>
          <div style={{ fontFamily: KO, fontWeight: 800, fontSize: c.koSize, color: INK, lineHeight: 1.12 }}>{ko}</div>
          <div style={{ fontFamily: enFont, fontWeight: 800, fontSize: m.size, color: MEAN, lineHeight: 1.14 }}>{en}</div>
        </div>
      ))}
    </div>
  ) : c.words ? (
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
      <div style={{ position: 'absolute', bottom: 1920 - BUBBLE_BOTTOM, right: c.tail === 'dream' || c.tail === 'palace' ? 150 : 24, width: 1032, display: 'flex', justifyContent: 'flex-end' }}>
        <div
          style={{
            display: 'inline-block',
            minWidth: 520,
            maxWidth: c.tail === 'dream' ? 920 : 660,
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
            <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12 }}>
              <span style={{ display: 'inline-block', background: CORAL, color: '#fff', fontFamily: enFont, fontWeight: 800, fontSize: 44, lineHeight: 1, padding: '10px 24px 12px', borderRadius: 999 }}>
                {L.levelWord}
                {c.level}
                {L.levelTail ?? ''}
              </span>
              {tagChip}
            </div>
          ) : null}
          {koLine}
          {c.roman ? <div style={{ fontFamily: EN, fontWeight: 700, fontSize: 40, color: '#8A7563', lineHeight: 1.15, marginTop: 2 }}>{c.roman}</div> : null}
          {pairRows ? null : (
            <div style={{ fontFamily: enFont, fontWeight: 800, fontSize: m.size, color: MEAN, lineHeight: 1.16, marginTop: 8, whiteSpace: 'pre-line' }}>
              {m.text}
              {m.more ? <span style={{ color: CORAL, opacity: moreOn ? 1 : 0, display: 'block' }}>{m.more}</span> : null}
            </div>
          )}
          {m.tag && !c.level ? <div style={{ marginTop: 10 }}>{tagChip}</div> : null}
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
    {CELLS.filter((c) => c.vo).map((c) => (
      <Sequence key={c.vo} from={fr(c.voAt)} layout="none">
        <Audio src={staticFile(`vo/${c.vo}.wav`)} volume={MASTER} />
      </Sequence>
    ))}
    {SFX.map((s) => (
      <Sequence key={`${s.file}-${s.at}`} from={fr(s.at)} layout="none">
        <Audio src={staticFile(`sfx/${s.file}`)} volume={MASTER * s.vol} />
      </Sequence>
    ))}
  </>
);

export const Film: React.FC<{ loc: Loc }> = ({ loc }) => {
  const frame = useCurrentFrame();
  const i = cellAt(frame / FPS);
  const c = CELLS[i];
  // 부딪힘 칸만 화면이 잠깐 흔들린다 — 그 뒤 카메라는 원본처럼 고정
  const hit = fr(15.55); // 되감기 칸에서 쿵 하는 때
  const shake = i === 0 ? Math.sin(frame * 2.4) * interpolate(frame, [0, 12], [22, 0], clamp) : c.replay ? Math.sin((frame - hit) * 2.4) * interpolate(frame, [hit, hit + 12], [18, 0], clamp) : 0;
  const arrowFrom = CELLS.find((x) => x.arrow)?.at ?? 0;
  return (
    <AbsoluteFill style={{ backgroundColor: '#2a1d16' }}>
      <Plate src={c.next && frame >= fr(c.next.at) ? c.next.img : c.img} shake={shake} push={interpolate(frame, [fr(c.at), fr(CELLS[i + 1]?.at ?? TOTAL)], [1, 1.022], clamp)} />
      {c.replay ? <Replay loc={loc} from={c.at} /> : null}
      {c.replay ? <StudentTag loc={loc} x={600} y={920} /> : null}
      {i > 0 && !c.replay && c.tail !== 'dream' && c.tail !== 'palace' && c.tail !== 'throne' ? <TeacherTag loc={loc} /> : null}
      {c.bare ? null : <Bubble i={i} loc={loc} />}
      {c.arrow ? <Arrow from={arrowFrom} loc={loc} /> : null}
      {i >= 1 && i <= 3 ? <StudentTag loc={loc} x={640} y={1110} /> : null}
      {c.tail === 'end' ? <StudentTag loc={loc} x={590} y={1118} /> : null}
      <Sound />
    </AbsoluteFill>
  );
};
