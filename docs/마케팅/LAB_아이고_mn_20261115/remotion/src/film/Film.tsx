// LAB 몽골 M52 「아이고」(11-15 07시 회차) — 원본 같은분야 「6 signs your Korean is improving」(8.3초 · 고정 카메라 한 장면 · 머리 글이 내내 떠 있음).
// 그림은 칸마다 기준 판(g1)을 참고로 구운 한 장(누끼 · 얹기 없음)을 판/_판짜기.py가 1080×1920 화면 판으로 미리 짠 것 — 카메라는 고정, 칸은 박자에 바로 바뀐다.
// 화면 글: 왼쪽 위 벽에 체크 카드(머리 글 + 신호 칸 셋이 차례로 ✓) — 원본의 「신호 여섯」 머리 글 자리. 아래 깔개 자리에 몽글의 흰 말풍선
// (신호 알약 · 몽골 뜻 · 한글 · 키릴 읽기). 박는 순간(4.75~5.75초)은 말풍선 없이 그림만 — 가장 센 그림을 가리지 않는다.
// 판본 틀(11-10): 머리 글 · 신호 뜻 · 읽는 법 · 끝 줄 뜻 · 끝 카드 · 끝 질문은 판본/<KEY>.json(판본.ts)에서 읽는다 — 그림 · 한국어 · 목소리 · 박자는 그대로.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { EN, KO } from '../lib/fonts';
import { BONK, CELLS, CHECK_AT, CHECK_LIST, COUNT_VO, END_AT, FACE, FPS, HOPS, LINES, ROW_AT, SFX, TOTAL } from './data';
import { LocPack } from './판본';

const fr = (sec: number) => Math.round(sec * FPS);
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const MASTER = 0.8; // Remotion은 소리를 16비트로 더해 넘치면 자른다 — 모든 볼륨에 같은 값을 곱한다(현장 노트)
export const TOTAL_FRAMES = fr(TOTAL);
export { FPS };

const INK = '#2B2522';
const CORAL = '#E8503D';
const MEAN = '#B23A26'; // 뜻 줄 — 흰 말풍선 위 진한 산호
const PAPER = '#FFFDF7';
// 자리(1080×1920 화면 판 기준 — 판/_판짜기.py가 짠 판에서 잼)
export const LAYOUT = {
  // v2(장면 심사 v1 「아래 절반이 빈 깔개 — 잘라서 인물을 키워라」): 판을 1.45배로 당겼다(판/_판짜기.py) — 아래 자리는 그 판에서 잰 값
  card: { left: 65, top: 292, width: 490 }, // 체크 카드 — 선반(왼끝 약 615px) 왼쪽 벽, TV(위 끝 약 600px) 위
  bubbleTop: 1090, // 말풍선 위 끝 — 소파 앉는 자리 앞(몽글 밑단 약 1047px 바로 아래)
  tail: [752, 1050] as [number, number], // 꼬리 끝 — 소파 왼쪽 자리에 앉은 몽글 밑단 가운데
  tailUp: [752, 905] as [number, number], // 소파 위로 튄 칸(하나 · 둘 · 셋)
  bonk: '70% 25%', // 박는 자리(선반 밑 · 몽글 머리 위 약 752, 489px) — 당겨 들어가는 축
};

const cellAt = (sec: number) => {
  let i = 0;
  CELLS.forEach((c, k) => {
    if (sec >= c.at) i = k;
  });
  return i;
};

// 판은 이미 1080×1920 — 카메라는 고정, 칸 안에서만 아주 천천히 다가간다. v3: 늘 4% 넉넉히 키워 둔다(튈 때 판이 아래로 밀리면 위에 검은 띠가 보였다)
// v3: 튐 · 흔들림(dx · dy)도 상자 안 그림에만 준다 — 상자째 밀면 넉넉히 키운 판도 상자 밖은 못 채워 위에 검은 띠가 보였다
const Plate: React.FC<{ src: string; push: number; dx: number; dy: number }> = ({ src, push, dx, dy }) => (
  <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: '#2a211a' }}>
    <Img src={staticFile(`img/${src}`)} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, transformOrigin: '52% 40%', transform: `translate(${dx}px, ${dy}px) scale(${push})` }} />
  </AbsoluteFill>
);


// 왼쪽 위 체크 카드 — 머리 글 아래에 신호마다 그 한국어가 한 줄씩 쌓이고(ROW_AT), 신호가 끝나면 그 줄이 산호 ✓로 바뀐다(CHECK_AT).
// v3: 번호 동그라미 셋만 있던 꼴을 「한국어 반사 목록」으로 — 이해 시험 v2 셋이 9번에 「생신 편처럼 단계 알약 + 큰 한국어 + 읽기」라고 짚었다.
const CheckCard: React.FC<{ L: LocPack }> = ({ L }) => {
  const frame = useCurrentFrame();
  const appear = interpolate(frame, [0, 5], [0.92, 1], { ...clamp, easing: Easing.out(Easing.back(2)) });
  const { left, top, width } = LAYOUT.card;
  return (
    <div style={{ position: 'absolute', left, top, width, transform: `scale(${appear})`, transformOrigin: '0% 0%' }}>
      <div style={{ background: PAPER, border: `5px solid ${INK}`, borderRadius: 28, boxShadow: '0 8px 20px rgba(0,0,0,0.3)', padding: '14px 22px 14px' }}>
        <div style={{ fontFamily: L.font, fontWeight: 800, fontSize: L.titleSize, color: INK, lineHeight: Math.max(1.12, L.lineH), whiteSpace: 'pre-line' }}>{L.title}</div>
        {CHECK_LIST.map((ko, k) => {
          if (frame < fr(ROW_AT[k])) return null;
          const inP = interpolate(frame, [fr(ROW_AT[k]), fr(ROW_AT[k]) + 5], [0, 1], { ...clamp, easing: Easing.out(Easing.back(2)) });
          const on = interpolate(frame, [fr(CHECK_AT[k]), fr(CHECK_AT[k]) + 4], [0, 1], clamp);
          const pop = 1 + 0.3 * Math.sin(Math.PI * on);
          return (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 10, opacity: inP, transform: `translateX(${(1 - inP) * -24}px)` }}>
              <div
                style={{
                  flex: '0 0 auto',
                  width: 52,
                  height: 52,
                  borderRadius: 999,
                  border: `5px solid ${on > 0.5 ? CORAL : '#9A8B7E'}`,
                  background: on > 0.5 ? CORAL : PAPER,
                  color: on > 0.5 ? '#fff' : '#9A8B7E',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: EN,
                  fontWeight: 900,
                  fontSize: on > 0.5 ? 32 : 28,
                  transform: `scale(${pop})`,
                }}
              >
                {on > 0.5 ? '✓' : k + 1}
              </div>
              <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 46, lineHeight: 1.1, color: on > 0.5 ? INK : '#9A8B7E', whiteSpace: 'nowrap' }}>{ko}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Bubble: React.FC<{ i: number; L: LocPack }> = ({ i, L }) => {
  const frame = useCurrentFrame();
  const c = CELLS[i];
  if (c.sign < 0) return null;
  // 같은 신호가 이어지는 칸은 말풍선을 다시 튀기지 않는다
  const first = CELLS.findIndex((x) => x.sign === c.sign);
  const startAt = CELLS[first].at;
  const p = interpolate(frame, [fr(startAt), fr(startAt) + 4], [0.9, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const line = LINES[c.sign];
  const isEnd = c.sign === 3;
  // 끝 질문(판본 ask) — 끝 줄 목소리가 끝난 뒤 말풍선 자리에 크게(v3)
  const askOn = isEnd && !!L.ask && frame >= fr(END_AT);
  const askP = interpolate(frame, [fr(END_AT), fr(END_AT) + 5], [0.88, 1], { ...clamp, easing: Easing.out(Easing.back(2)) });
  const mean = isEnd ? L.endMean : L.signs[c.sign];
  const meanSize = isEnd ? L.endMeanSize : L.signSizes[c.sign];
  const read = isEnd ? undefined : L.reads[c.sign];
  const up = ['g2a.jpg', 'g2b.jpg', 'g2c.jpg'].includes(c.img); // 소파 위로 뜬 칸(내려앉은 g2d는 앉은 자리)
  const tip = up ? LAYOUT.tailUp : LAYOUT.tail;
  const top = LAYOUT.bubbleTop;
  // 셋 세기는 목소리 박자대로 낱말이 진해진다(아직 안 센 낱말은 흐리게 먼저 보인다)
  const ko = line.words ? (
    <div style={{ fontFamily: KO, fontWeight: 800, fontSize: line.koSize, color: INK, lineHeight: 1.12 }}>
      {line.words.map(([w, t], k) => {
        const at = fr(line.voAt + t);
        const q = interpolate(frame, [at, at + 3], [0, 1], clamp);
        return (
          <span key={k} style={{ display: 'inline-block', opacity: 0.4 + 0.6 * q, transform: `scale(${1 + 0.1 * q * (1 - q) * 4})`, color: q > 0.5 && k === 2 ? CORAL : INK, marginRight: k < 2 ? 22 : 0 }}>
            {w}
          </span>
        );
      })}
    </div>
  ) : (
    <div style={{ fontFamily: KO, fontWeight: 800, fontSize: line.koSize, color: c.sign === 2 ? CORAL : INK, lineHeight: 1.12, whiteSpace: 'pre-line' }}>{line.ko}</div>
  );
  return (
    <>
      <div style={{ position: 'absolute', top, left: 110, width: 860, display: 'flex', justifyContent: 'center' }}>
        <div
          style={{
            display: 'inline-block',
            minWidth: 520,
            maxWidth: askOn ? 860 : 800, // 끝 질문은 두 줄로 들게 조금 넓게
            textAlign: 'center',
            background: PAPER,
            border: `6px solid ${c.sign === 2 ? CORAL : INK}`,
            borderRadius: 48,
            padding: '16px 40px 18px',
            boxShadow: '0 10px 28px rgba(0,0,0,0.28)',
            transform: `scale(${askOn ? askP : p})`,
            transformOrigin: '45% 0%',
          }}
        >
          {askOn ? (
            <>
            {L.endCard ? <div style={{ fontFamily: L.font, fontWeight: 800, fontSize: L.endSize, color: CORAL, lineHeight: Math.max(1.16, L.lineH), marginBottom: 6, whiteSpace: 'pre-line' }}>{L.endCard}</div> : null}
            <div style={{ fontFamily: L.font, fontWeight: 800, fontSize: L.askSize, color: INK, lineHeight: Math.max(1.16, L.lineH), whiteSpace: 'pre-line' }}>{L.ask}</div>
            </>
          ) : (
            <>
            <div style={{ fontFamily: L.font, fontWeight: 800, fontSize: meanSize, color: MEAN, lineHeight: Math.max(1.16, L.lineH), marginBottom: 6, whiteSpace: 'pre-line' }}>{mean}</div>
            {ko}
            {read ? <div style={{ fontFamily: EN, fontWeight: 800, fontSize: read.length > 22 ? 44 : 50, whiteSpace: 'nowrap', color: '#4F3F33', lineHeight: 1.15, marginTop: 4 }}>{read}</div> : null}
            </>
          )}
        </div>
      </div>
      {/* 꼬리 — 말풍선 위 끝에서 몽글로 */}
      <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0, opacity: p }}>
        <path d={`M ${tip[0] - 30} ${top + 8} L ${tip[0] + 26} ${top + 8} L ${tip[0]} ${tip[1]} Z`} fill={PAPER} stroke={INK} strokeWidth={6} strokeLinejoin="round" />
        <rect x={tip[0] - 27} y={top + 5} width={50} height={9} fill={PAPER} />
      </svg>
    </>
  );
};

const Sound: React.FC = () => (
  <>
    <Audio src={staticFile('bgm.wav')} volume={(i) => 0.2 * MASTER * interpolate(i, [fr(TOTAL) - 20, fr(TOTAL)], [1, 0], clamp)} />
    <Audio src={staticFile('sfx/room.wav')} volume={0.12 * MASTER} endAt={fr(TOTAL)} />
    {LINES.filter((l) => l.vo).map((l) => (
      <Sequence key={l.vo} from={fr(l.voAt)} layout="none">
        <Audio src={staticFile(`vo/${l.vo}.wav`)} volume={MASTER} />
      </Sequence>
    ))}
    {COUNT_VO.map(([v, t]) => (
      <Sequence key={v} from={fr(t)} layout="none">
        <Audio src={staticFile(`vo/${v}.wav`)} volume={MASTER} />
      </Sequence>
    ))}
    {SFX.map(([t, f, v]) => (
      <Sequence key={`${t}-${f}`} from={fr(t)} layout="none">
        <Audio src={staticFile(`sfx/${f}`)} volume={v * MASTER} />
      </Sequence>
    ))}
  </>
);

// L = 판본 글(판본/<KEY>.json) — Root가 판본마다 컴포지션 aigo-<KEY>로 넘긴다
// bare = 장면 심사용(체크 카드 · 말풍선 없이 그림과 소리만 — 제작 절차 「한 장면 먼저」 ①)
export const Film: React.FC<{ L: LocPack; bare?: boolean }> = ({ L, bare }) => {
  const frame = useCurrentFrame();
  const i = cellAt(frame / FPS);
  const b0 = fr(BONK.at);
  const shake = frame >= b0 && frame < fr(BONK.shakeTo) ? Math.sin((frame - b0) * 2.4) * 9 * (1 - (frame - b0) / (fr(BONK.shakeTo) - b0)) : 0;
  const punch = 1 + BONK.punch * interpolate(frame, [b0, b0 + 2, b0 + 10], [0, 1, 0], clamp);
  // 튈 때마다 판이 아래로 살짝 밀렸다 돌아온다(카메라가 몽글을 따라 올라감)
  const hop = HOPS.reduce((acc, [t, px]) => acc + px * interpolate(frame, [fr(t), fr(t) + 3, fr(t) + 12], [0, 1, 0], { ...clamp, easing: Easing.out(Easing.quad) }), 0);
  const face = 1 + FACE.zoom * interpolate(frame, [fr(FACE.from), fr(FACE.to)], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  return (
    <AbsoluteFill style={{ backgroundColor: '#2a211a' }}>
      <AbsoluteFill style={{ transformOrigin: FACE.origin, transform: `scale(${face})` }}>
        <AbsoluteFill style={{ transformOrigin: LAYOUT.bonk, transform: `scale(${punch})` }}>
          <Plate src={CELLS[i].img} push={interpolate(frame, [fr(CELLS[i].at), fr(i + 1 < CELLS.length ? CELLS[i + 1].at : TOTAL)], [1.04, 1.07], clamp)} dx={shake} dy={shake * 0.6 + hop} />
        </AbsoluteFill>
      </AbsoluteFill>
      {bare ? null : <CheckCard L={L} />}
      {bare ? null : <Bubble i={i} L={L} />}
      <Sound />
    </AbsoluteFill>
  );
};
