// LAB 몽골 M57 「авах = 사요 · 찍어요 · 받아요」(11-16) — M56 「성함」의 Film.tsx(말풍선 칸 틀)를 옮겨, 원본 우리 편 M19 「형 · 오빠」의 박자로 짰다.
// 그림은 칸마다 기준 판(c1)을 참고로 구운 한 장(누끼 · 얹기 없음)을 판/_판짜기.py가 1080×1920 화면 판으로 미리 짠 것 — 카메라는 고정, 칸은 박자에 바로 바뀐다.
// M56과 다른 것: 말풍선이 위쪽 흐린 가게 앞 자리에 뜨고 꼬리가 아래로 말하는 인형의 머리를 가리킨다(인형이 화면 가운데 · 아래는 벤치와 보도).
// 첫 2초 물음은 아래 벤치 앞 카드, 끝은 원본 M19의 이름표 표 자리에 「«авах» → 사요 · 찍어요 · 받아요」 표와 끝 줄.
// 판본 틀(11-10): 뜻 · 읽는 법 · 알약 · 물음 · 끝 표 · 끝 줄은 판본/<KEY>.json(판본.ts)에서 읽는다 — 그림 · 한국어 · 목소리 · 박자는 그대로.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { EN, KO } from '../lib/fonts';
import { CELLS, END_AT, FPS, SFX, TABLE_AT, TABLE_FORMS, TABLE_KO, TOTAL } from './data';
import { LocPack } from './판본';

const fr = (sec: number) => Math.round(sec * FPS);
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const MASTER = 0.8; // Remotion은 소리를 16비트로 더해 넘치면 자른다 — 모든 볼륨에 같은 값을 곱한다(현장 노트)
export const TOTAL_FRAMES = fr(TOTAL);
export { FPS };

const INK = '#2B2522';
const CORAL = '#E8503D';
const MEAN = '#B23A26'; // 뜻 줄 — 흰 말풍선 위 진한 산호
const MUSTARD = '#C98A12'; // 지우 말풍선 테두리 — 지우 겨자색 패딩(이해 시험 v2 셋 「성함 편과 말풍선 꼴이 같아 보임」 — 말하는 인형의 색으로 테두리를 가른다)
const BUBBLE_BOTTOM = 640; // 말풍선 아래 끝(px) — 지우 머리 위 끝(약 670px) 바로 위. 말풍선은 여기서 위로 자란다
const JIWOO_BOTTOM = 596; // 지우가 말할 때 말풍선 아래 끝 — 미학 맹검(카본) 「꼬리가 빠진 말풍선」: 지우 머리(664px)까지 꼬리가 24px뿐이라 올린다
const MONGLE_TIP: [number, number] = [790, 828]; // 몽글이 말할 때 꼬리 끝 — 벤치 위 몽글 머리 위 끝(판/_판자리.json)
const JIWOO_TIP: [number, number] = [320, 664]; // 지우가 말할 때 꼬리 끝 — 지우 머리 위 끝
const SCENE_TOP = 1262; // 첫 2초 물음 카드 위 끝 — 벤치 앞판(앱 글자 자리 1428px 위)

const cellAt = (sec: number) => {
  let i = 0;
  CELLS.forEach((c, k) => {
    if (sec >= c.at) i = k;
  });
  return i;
};

// 판은 이미 1080×1920(판/_판짜기.py — 구운 판 1.25배 · 왼쪽 100px 자름) — 카메라는 고정, 칸 안에서만 아주 천천히 다가간다
const Plate: React.FC<{ src: string; push: number; origin?: [number, number] }> = ({ src, push, origin }) => (
  <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: '#2a1d16' }}>
    <Img src={staticFile(`img/${src}`)} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, transformOrigin: origin ? `${origin[0]}px ${origin[1]}px` : '50% 45%', transform: `scale(${push})` }} />
  </AbsoluteFill>
);

const HotLine: React.FC<{ text: string; hot?: string; size: number }> = ({ text, hot, size }) => (
  <div style={{ fontFamily: KO, fontWeight: 800, fontSize: size, color: INK, lineHeight: 1.16, whiteSpace: 'pre-line' }}>
    {/* 짚는 낱말은 마지막 한 번만 — 「사진을 사?」에서 「사진」의 「사」까지 칠하던 첫 렌더 */}
    {hot && text.includes(hot) ? (
      <>
        {text.slice(0, text.lastIndexOf(hot))}
        <span style={{ color: CORAL }}>{hot}</span>
        {text.slice(text.lastIndexOf(hot) + hot.length)}
      </>
    ) : (
      text
    )}
  </div>
);

const Bubble: React.FC<{ i: number; L: LocPack }> = ({ i, L }) => {
  const frame = useCurrentFrame();
  const c = CELLS[i];
  if (c.b < 0) return null;
  const tip = c.tip ?? (c.who === 'j' ? JIWOO_TIP : MONGLE_TIP);
  const mean = L.means[c.b];
  const meanSize = L.meanSizes[c.b];
  const read = L.reads[c.b] || undefined;
  const pill = L.pills[c.b] || undefined;
  // 칸이 바뀔 때 말풍선만 4프레임 살짝 튀어나온다(그림은 바로 바뀜)
  const p = c.cont ? 1 : interpolate(frame, [fr(c.at), fr(c.at) + 4], [0.9, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  // 알약(맞음 ✓ · 틀림 ⚠️/❌)은 말이 끝난 뒤 말풍선 아래에 뜬다 — 이해 시험 v2 볼 이유 「물음과 답이 처음부터 한꺼번에 떠서 궁금할 것이 없음」. 자리는 처음부터 잡아 두어 글이 밀리지 않는다
  const first = CELLS.find((x) => x.b === c.b) ?? c;
  const pillStart = first.pillAt ?? first.at + 0.5;
  const q = interpolate(frame, [fr(pillStart), fr(pillStart) + 5], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.8)) });
  const edge = c.who === 'j' ? MUSTARD : CORAL;
  const bottom = c.who === 'j' ? JIWOO_BOTTOM : BUBBLE_BOTTOM;
  // 꼬리 뿌리 — 말풍선 아래 끝에서 말하는 인형 쪽으로 치우치되 말풍선 안(220~860px)
  const root = Math.max(230, Math.min(850, tip[0] * 0.55 + 540 * 0.45));
  return (
    <>
      <div style={{ position: 'absolute', bottom: 1920 - bottom, left: 90, width: 900, display: 'flex', justifyContent: 'center' }}>
        <div
          style={{
            display: 'inline-block',
            minWidth: 600,
            maxWidth: 880,
            textAlign: 'center',
            background: '#FFFDF7',
            border: `7px solid ${edge}`,
            borderRadius: 48,
            padding: '14px 40px 16px',
            boxShadow: '0 10px 28px rgba(0,0,0,0.28)',
            transform: `scale(${p})`,
            transformOrigin: `${((root - 90) / 900) * 100}% 100%`,
          }}
        >
          <div style={{ fontFamily: L.font, fontWeight: 800, fontSize: meanSize, color: MEAN, lineHeight: Math.max(1.16, L.lineH), marginBottom: 8, whiteSpace: 'pre-line' }}>{mean}</div>
          <HotLine text={c.ko} hot={c.hot} size={c.koSize} />
          {/* 이해 시험 v1(GPT · 그록 · sonnet 「작은 글 못 읽음」): 알약 42 → 48px · 읽기 54 → 58px */}
          {read ? <div style={{ fontFamily: EN, fontWeight: 800, fontSize: 58, whiteSpace: 'nowrap', color: '#3A2D24', lineHeight: 1.15, marginTop: 2 }}>{read}</div> : null}
          {pill ? (
            <div style={{ marginTop: 10, opacity: q, transform: `scale(${0.8 + 0.2 * q})` }}>
              <span style={{ display: 'inline-block', background: c.mark === 'ng' ? INK : CORAL, color: '#fff', fontFamily: L.font, fontWeight: 800, fontSize: 48, lineHeight: 1.1, padding: '10px 26px 12px', borderRadius: 999, whiteSpace: 'nowrap' }}>
                {pill}
              </span>
            </div>
          ) : null}
        </div>
      </div>
      {/* 꼬리 — 말풍선 아래 끝에서 말하는 인형 머리로 */}
      <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0, opacity: p }}>
        <path
          d={`M ${root - 30} ${bottom - 8} L ${root + 30} ${bottom - 8} L ${tip[0]} ${tip[1]} Z`}
          fill="#FFFDF7"
          stroke={edge}
          strokeWidth={7}
          strokeLinejoin="round"
        />
        <rect x={root - 26} y={bottom - 15} width={52} height={10} fill="#FFFDF7" />
      </svg>
    </>
  );
};

const Sound: React.FC = () => (
  <>
    <Audio src={staticFile('bgm.wav')} volume={(i) => 0.19 * MASTER * interpolate(i, [fr(TOTAL) - 20, fr(TOTAL)], [1, 0], clamp)} />
    {CELLS.filter((c) => c.vo).map((c) => (
      <Sequence key={c.vo} from={fr(c.voAt)} layout="none">
        <Audio src={staticFile(`vo/${c.vo}.wav`)} volume={MASTER} />
      </Sequence>
    ))}
    {SFX.map(([t, f, v]) => (
      <Sequence key={`${t}-${f}`} from={fr(t)} layout="none">
        <Audio src={staticFile(`sfx/${f}`)} volume={v * MASTER} />
      </Sequence>
    ))}
  </>
);

// 끝 표(22.2초~) — 원본 M19의 이름표 표 자리. 끝 줄 띠는 표와 같은 폭(미학 맹검 「표보다 어정쩡하게 좁은 띠」), 줄 머리 이모지는 뺌(「화풍이 제각각인 기본 이모지」). 폭 860px(올리기 전 검사 「오른쪽 단추 자리 920px」 — 940 → 860). 그림을 어둡게 눌러 두고 세 줄이 0.45초 간격으로 차례로 뜬다. 끝 줄은 25.6초.
const Table: React.FC<{ L: LocPack }> = ({ L }) => {
  const frame = useCurrentFrame();
  if (frame < fr(TABLE_AT)) return null;
  const dim = interpolate(frame, [fr(TABLE_AT), fr(TABLE_AT) + 6], [0, 0.55], clamp);
  const pop = (at: number) => interpolate(frame, [fr(at), fr(at) + 5], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.6)) });
  const e = pop(END_AT);
  return (
    <>
      <AbsoluteFill style={{ backgroundColor: `rgba(30,20,14,${dim})` }} />
      <div style={{ position: 'absolute', left: 60, top: 300, width: 860, transform: `scale(${0.92 + 0.08 * pop(TABLE_AT)})`, opacity: pop(TABLE_AT), transformOrigin: '50% 0%' }}>
        <div style={{ background: '#FFFDF7', border: `6px solid ${INK}`, borderRadius: 44, padding: '30px 40px 34px', boxShadow: '0 12px 32px rgba(0,0,0,0.35)' }}>
          <div style={{ fontFamily: L.font, fontWeight: 800, fontSize: L.tableSize + 4, color: INK, lineHeight: Math.max(1.2, L.lineH), textAlign: 'center', marginBottom: 18 }}>{L.tableHead}</div>
          {TABLE_KO.map((ko, k) => {
            const q = pop(TABLE_AT + 0.35 + k * 0.45);
            return (
              <div key={ko} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: k ? '4px dashed #E2D6C6' : 'none', padding: '20px 4px', opacity: q, transform: `translateY(${(1 - q) * 18}px)` }}>
                <div style={{ fontFamily: L.font, fontWeight: 800, fontSize: L.tableSize, color: MEAN, lineHeight: Math.max(1.2, L.lineH), textAlign: 'left', flex: '1 1 auto' }}>{L.tableRows[k]}</div>
                <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 44, color: '#8C7A6A', margin: '0 18px' }}>→</div>
                <div style={{ textAlign: 'center', minWidth: 300 }}>
                  <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 96, color: CORAL, lineHeight: 1.05 }}>{ko}</div>
                  {/* 이해 시험 v2(haiku · GPT · 그록 「사자 · 사 · 사다 말끝이 왜 바뀌는지 모름」): 대사에 나온 꼴을 기본꼴 밑에 작게 */}
                  <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 46, color: '#7A6858', lineHeight: 1.2 }}>{TABLE_FORMS[k]}</div>
                  <div style={{ fontFamily: EN, fontWeight: 800, fontSize: 46, color: '#3A2D24', lineHeight: 1.15 }}>{L.tableReads[k]}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {frame >= fr(END_AT) ? (
        <div style={{ position: 'absolute', left: 60, width: 860, top: 1250, display: 'flex', justifyContent: 'center', transform: `scale(${0.86 + 0.14 * e})`, opacity: e }}>
          <span style={{ display: 'block', width: '100%', boxSizing: 'border-box', background: CORAL, color: '#fff', fontFamily: L.font, fontWeight: 800, fontSize: L.endSize, lineHeight: Math.max(1.2, L.lineH), padding: '14px 32px 16px', borderRadius: 28, textAlign: 'center', boxShadow: '0 8px 22px rgba(0,0,0,0.3)', whiteSpace: 'pre-line' }}>{L.endLine}</span>
        </div>
      ) : null}
    </>
  );
};

// L = 판본 글(판본/<KEY>.json) — Root가 판본마다 컴포지션 sayo-<KEY>로 넘긴다
// bare = 장면 심사용(물음 · 말풍선 · 끝 표 없이 그림과 소리만 — 제작 절차 「한 장면 먼저」 ①)
export const Film: React.FC<{ L: LocPack; bare?: boolean }> = ({ L, bare }) => {
  const frame = useCurrentFrame();
  const i = cellAt(frame / FPS);
  return (
    <AbsoluteFill style={{ backgroundColor: '#2a1d16' }}>
      {/* 칸 안의 아주 느린 다가감 — zoom이 있는 칸은 말하는 인형 머리(꼬리 끝)를 중심으로 0.17초 안에 다가간다(장면 심사 v1) */}
      {CELLS[i].zoom ? (
        <Plate
          src={CELLS[i].img}
          origin={CELLS[i].tip ?? (CELLS[i].who === 'j' ? JIWOO_TIP : MONGLE_TIP)}
          push={interpolate(frame, [fr(CELLS[i].at), fr(CELLS[i].at) + 5], [1, CELLS[i].zoom as number], { ...clamp, easing: Easing.out(Easing.cubic) })}
        />
      ) : (
        <Plate src={CELLS[i].img} push={interpolate(frame, [fr(CELLS[i].at), fr(i + 1 < CELLS.length ? CELLS[i + 1].at : TOTAL)], [1, 1.03], clamp)} />
      )}
      {/* 첫 2초 물음 — 원본 M19의 물음 띠(0~5.1초), 벤치 앞판 위 */}
      {!bare && frame < fr(CELLS[2].at) ? (
        <div style={{ position: 'absolute', left: 60, width: 960, top: SCENE_TOP, display: 'flex', justifyContent: 'center' }}>
          <span style={{ display: 'inline-block', whiteSpace: 'pre-line', textAlign: 'center', background: '#FFFDF7', color: INK, border: `4px solid ${INK}`, boxShadow: '0 6px 16px rgba(0,0,0,0.3)', fontFamily: L.font, fontWeight: 800, fontSize: L.sceneSize, lineHeight: Math.max(1.2, L.lineH), padding: '10px 26px 12px', borderRadius: 22 }}>{L.scene}</span>
        </div>
      ) : null}
      {bare || frame >= fr(TABLE_AT) ? null : <Bubble i={i} L={L} />}
      {bare ? null : <Table L={L} />}
      <Sound />
    </AbsoluteFill>
  );
};
