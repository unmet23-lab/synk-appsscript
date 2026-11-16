// LAB 몽골 M51 「인사 한마디의 힘」(11-16 07시 회차) — 원본 형식만 「Germans before & after you say hello」(27.4초).
// 그림은 칸마다 기준 판(g1)을 참고로 구운 한 장(누끼 · 얹기 없음)을 판/_판짜기.py가 1080×1920 화면 판으로 미리 짠 것 — 카메라는 고정, 칸은 박자에 바로 바뀐다.
// 화면 글: 위쪽 흰 상자에 머리 글(0~9.6초 — 원본 머리 글 자리), 아래 나무 판자 자리에 말하는 쪽(몽글 · 할머니)으로 꼬리가 가는 흰 말풍선
// (몽골 뜻 · 한글 · 키릴 읽기). 끝 3초(19.2초~)는 같은 말풍선 자리에 끝 카드 · 끝 질문.
// 판본 틀(11-10): 머리 글 · 뜻 · 읽는 법 · 끝 카드 · 끝 질문은 판본/<KEY>.json(판본.ts)에서 읽는다 — 그림 · 한국어 · 목소리 · 박자는 그대로.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { EN, KO } from '../lib/fonts';
import { CELLS, COLLAPSE, END_AT, END_PUSH, EXTRA_VO, FINAL, FPS, LAND, LINES, SFX, TITLE_FLIP, TITLE_UNTIL, TOTAL, WOBBLE_A, WOBBLE_AMP, WOBBLE_B, WOBBLE_TICK, ZOOM, ZOOM_LAND } from './data';
import { LocPack } from './판본';

const fr = (sec: number) => Math.round(sec * FPS);
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const MASTER = 0.8; // Remotion은 소리를 16비트로 더해 넘치면 자른다 — 모든 볼륨에 같은 값을 곱한다(현장 노트)
export const TOTAL_FRAMES = fr(TOTAL);
export { FPS };

const INK = '#2B2522';
const CORAL = '#E8503D';
const PLUM = '#7A3E5C'; // 할머니 말풍선 테 — 할머니 조끼 색
const MEAN = '#B23A26'; // 뜻 줄 — 흰 말풍선 위 진한 산호
const PAPER = '#FFFDF7';
// 자리(1080×1920 화면 판 기준 — 판/_판짜기.py가 짠 판에서 잼)
export const LAYOUT = {
  title: { top: 150, width: 900 }, // 최종: 위 머리 자리 — 40px은 틱톡 위 탭 · 인스타 머리와 겹쳐 150px로(판을 170px 올려 0~9.6초에는 이 자리가 차양 · 하늘이다)
  bubbleTop: 1090, // 말풍선 위 끝 — 최종: 안전선(1428px) 안으로. 판을 170px 올려 탁자 앞 끝이 약 1066px, 가장 긴 말풍선 아래 끝이 약 1420px
  tailM: [836, 1040] as [number, number], // 꼬리 끝 — 탁자 오른쪽에 앉은 몽글 밑단 가운데(v5 좌우 뒤집음)
  tailH: [150, 950] as [number, number], // 최종: 꼬리를 바구니 너머 할머니 앞치마 쪽으로 길게(최종 맹검 카본 「꼬리가 화자가 아닌 귤 바구니를 가리킴」) // 꼬리 끝 — 탁자 뒤 왼쪽 할머니 앞(v5 좌우 뒤집음)
};

const cellAt = (sec: number) => {
  let i = 0;
  CELLS.forEach((c, k) => {
    if (sec >= c.at) i = k;
  });
  return i;
};
const lineAt = (sec: number) => LINES.findIndex((l) => sec >= l.at && sec < l.until);

// 판은 이미 1080×1920 — 카메라는 고정, 칸 안에서만 아주 천천히 다가간다(늘 3% 넉넉히 — 흔들림에 가장자리가 비지 않게)
const Plate: React.FC<{ src: string; push: number; dx: number; dy: number }> = ({ src, push, dx, dy }) => (
  <AbsoluteFill style={{ overflow: 'visible', backgroundColor: '#3a2a1c' }}>{/* 최종: visible — 판을 170px 올릴 때 아래 뒤집은 판이 보이게(화면 밖은 Film 바깥 틀이 자른다) */}
    <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, transformOrigin: '50% 45%', transform: `translate(${dx}px, ${dy}px) scale(${push})` }}>
      <Img src={staticFile(`img/${src}`)} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920 }} />
      {/* 판을 올려 아래에 드러난 자리 — 같은 판을 위아래로 뒤집어 나무 판자를 잇는다(결이 세로라 이음이 안 보인다) */}
      <Img src={staticFile(`img/${src}`)} style={{ position: 'absolute', left: 0, top: 1920, width: 1080, height: 1920, transform: 'scaleY(-1)' }} />
    </div>
  </AbsoluteFill>
);

// 머리 알약 — 「인사 전 😐」(회색) → 2.5초 「인사 뒤 😊」(산호)로 뒤집힌다, 9.6초까지(원본 머리 글 자리 · v5: 흰 상자 대신 — 이해 시험 v4 haiku · GPT 「지난 편과 같은 머리 글」)
const Title: React.FC<{ L: LocPack }> = ({ L }) => {
  const frame = useCurrentFrame();
  if (frame >= fr(TITLE_UNTIL)) return null;
  const after = frame >= fr(TITLE_FLIP);
  const at = after ? fr(TITLE_FLIP) : 0;
  const pop = interpolate(frame, [at, at + 6], [0.82, 1], { ...clamp, easing: Easing.out(Easing.back(2.4)) });
  const out = interpolate(frame, [fr(TITLE_UNTIL) - 6, fr(TITLE_UNTIL)], [1, 0], clamp);
  return (
    <div style={{ position: 'absolute', top: LAYOUT.title.top, left: 0, width: 1080, display: 'flex', justifyContent: 'center', opacity: out }}>
      <div
        style={{
          background: after ? CORAL : '#5E5650',
          color: '#FFFFFF',
          borderRadius: 999,
          padding: '14px 40px 16px',
          boxShadow: '0 8px 22px rgba(0,0,0,0.32)',
          transform: `scale(${pop})`,
          fontFamily: L.font,
          fontWeight: 800,
          fontSize: L.titleSize,
          lineHeight: Math.max(1.14, L.lineH),
          whiteSpace: 'nowrap',
        }}
      >
        {after ? L.title2 : L.title}
      </div>
    </div>
  );
};

// 끝 띠 — 끝 3초 아래 산호 띠에 한 문장 + 끝 질문(v5: 말풍선 꼴 끝 카드 대신 — 이해 시험 v4 haiku · GPT 「지난 편과 같은 끝 카드」)
const EndBand: React.FC<{ L: LocPack }> = ({ L }) => {
  const frame = useCurrentFrame();
  if (frame < fr(END_AT)) return null;
  const inP = interpolate(frame, [fr(END_AT), fr(END_AT) + 7], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  return (
    <div style={{ position: 'absolute', left: 0, top: 1100, width: 1080, transform: `translateY(${(1 - inP) * 60}px)`, opacity: inP }}>
      <div style={{ background: CORAL, padding: '26px 160px 30px 65px', textAlign: 'center', boxShadow: '0 -6px 24px rgba(0,0,0,0.25)' }}>{/* 최종: 글은 65~920px 안(오른쪽 단추 자리를 피함) */}
        {/* 최종: 미학 맹검(카본) 「끝 요약이 한 번에 툭 나타나 멈춰 있다」 — 줄마다 0.17초씩 늦게 살짝 튀어 오른다 */}
        {L.endCard.split('\n').map((ln, n) => {
          const s0 = fr(END_AT) + 4 + n * 5;
          const q = interpolate(frame, [s0, s0 + 8], [0, 1], { ...clamp, easing: Easing.out(Easing.back(2.2)) });
          return (
            <div key={n} style={{ fontFamily: L.font, fontWeight: 800, fontSize: L.endSize, color: n === 0 ? '#FFF3D6' : '#FFFFFF', lineHeight: Math.max(1.16, L.lineH), whiteSpace: 'pre', opacity: Math.min(1, q * 1.4), transform: `translateY(${(1 - q) * 28}px)` }}>{ln}</div>
          );
        })}
        {L.ask ? <div style={{ fontFamily: L.font, fontWeight: 800, fontSize: L.askSize, color: '#FFF3D6', lineHeight: Math.max(1.18, L.lineH), marginTop: 14, whiteSpace: 'pre-line' }}>{L.ask}</div> : null}
      </div>
    </div>
  );
};

const Bubble: React.FC<{ L: LocPack }> = ({ L }) => {
  const frame = useCurrentFrame();
  const sec = frame / FPS;
  const endOn = false; // v5: 끝 3초는 EndBand가 맡는다
  const k = lineAt(sec);
  if (sec >= END_AT || k < 0) return null;
  const line = endOn ? null : LINES[k];
  const startAt = endOn ? END_AT : line!.at;
  const p = interpolate(frame, [fr(startAt), fr(startAt) + 5], [0.88, 1], { ...clamp, easing: Easing.out(Easing.back(2)) });
  const isH = line?.who === 'h';
  const tip = isH ? LAYOUT.tailH : LAYOUT.tailM;
  const top = LAYOUT.bubbleTop;
  const edge = endOn ? CORAL : isH ? PLUM : INK;
  return (
    <>
      <div style={{ position: 'absolute', top, left: 65, width: 855, display: 'flex', justifyContent: isH ? 'flex-start' : 'flex-end' }}>{/* 최종: 오른쪽 단추 자리 — 인스타 · 틱톡의 좋아요 · 댓글 단추(920px 오른쪽)를 피해 65~920px 안에 */}
        <div
          style={{
            display: 'inline-block',
            minWidth: 540,
            maxWidth: 855,
            textAlign: 'center',
            background: PAPER,
            border: `6px solid ${edge}`,
            borderRadius: 48,
            padding: '16px 40px 20px',
            boxShadow: '0 10px 28px rgba(0,0,0,0.28)',
            transform: `scale(${p})`,
            transformOrigin: isH ? '15% 0%' : '85% 0%',
          }}
        >
          {endOn ? (
            <>
              <div style={{ fontFamily: L.font, fontWeight: 800, fontSize: L.endSize, color: CORAL, lineHeight: Math.max(1.16, L.lineH), marginBottom: 10, whiteSpace: 'pre-line' }}>{L.endCard}</div>
              {L.ask ? <div style={{ fontFamily: L.font, fontWeight: 800, fontSize: L.askSize, color: INK, lineHeight: Math.max(1.16, L.lineH), whiteSpace: 'pre-line' }}>{L.ask}</div> : null}
            </>
          ) : (
            <>
              <div style={{ fontFamily: L.font, fontWeight: 800, fontSize: L.meanSizes[k], color: MEAN, lineHeight: Math.max(1.16, L.lineH), marginBottom: 6, whiteSpace: 'pre-line' }}>{L.means[k]}</div>
              <div style={{ fontFamily: KO, fontWeight: 800, fontSize: line!.koSize, color: isH ? PLUM : INK, lineHeight: 1.12, whiteSpace: 'pre' }}>{line!.ko}</div>
              <div style={{ fontFamily: EN, fontWeight: 800, fontSize: L.reads[k].length > 22 ? 46 : 50, whiteSpace: 'nowrap', color: '#4F3F33', lineHeight: 1.15, marginTop: 4 }}>{L.reads[k]}</div>
            </>
          )}
        </div>
      </div>
      {/* 꼬리 — 말풍선 위 끝에서 말하는 쪽으로(끝 카드는 꼬리 없음) */}
      {endOn ? null : (
        <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0, opacity: p }}>
          <path d={`M ${tip[0] - 30} ${top + 8} L ${tip[0] + 26} ${top + 8} L ${tip[0]} ${tip[1]} Z`} fill={PAPER} stroke={edge} strokeWidth={6} strokeLinejoin="round" />
          <rect x={tip[0] - 27} y={top + 5} width={50} height={9} fill={PAPER} />
        </svg>
      )}
    </>
  );
};

const inWobble = (sec: number) => (sec >= WOBBLE_A[0] && sec < WOBBLE_A[1]) || (sec >= WOBBLE_B[0] && sec < WOBBLE_B[1]);

const Sound: React.FC = () => (
  <>
    <Audio src={staticFile('bgm.wav')} volume={(i) => 0.2 * MASTER * interpolate(i, [fr(TOTAL) - 20, fr(TOTAL)], [1, 0], clamp)} />
    <Audio src={staticFile('sfx/room.wav')} volume={0.12 * MASTER} endAt={fr(TOTAL)} />
    {LINES.filter((l) => l.vo).map((l) => (
      <Sequence key={l.vo} from={fr(l.at)} layout="none">
        <Audio src={staticFile(`vo/${l.vo}.wav`)} volume={MASTER} />
      </Sequence>
    ))}
    {EXTRA_VO.map(([v, t]) => (
      <Sequence key={v} from={fr(t)} layout="none">
        <Audio src={staticFile(`vo/${v}.wav`)} volume={MASTER} />
      </Sequence>
    ))}
    {SFX.map(([t, f, v]) => (
      <Sequence key={`${t}-${f}`} from={fr(t)} layout="none">
        <Audio src={staticFile(`sfx/${f}`)} volume={v * MASTER} />
      </Sequence>
    ))}
    {CELLS.filter((c) => inWobble(c.at + 0.001)).map((c) => (
      <Sequence key={`w${c.at}`} from={fr(c.at)} layout="none">
        <Audio src={staticFile(`sfx/${WOBBLE_TICK.file}`)} volume={WOBBLE_TICK.vol * MASTER} />
      </Sequence>
    ))}
  </>
);

// L = 판본 글(판본/<KEY>.json) — Root가 판본마다 컴포지션 insa-<KEY>로 넘긴다
// bare = 장면 심사용(머리 글 · 말풍선 없이 그림과 소리만 — 제작 절차 「한 장면 먼저」 ①)
export const Film: React.FC<{ L: LocPack; bare?: boolean }> = ({ L, bare }) => {
  const frame = useCurrentFrame();
  const sec = frame / FPS;
  const i = cellAt(sec);
  // 흔들릴 때 화면이 탑을 따라 아주 살짝 좌우로(카메라는 고정 — 판만 3~5px)
  const wk = CELLS.slice(0, i + 1).filter((c) => inWobble(c.at + 0.001)).length - 1; // 흔들림 몇째 칸인지
  const c0 = fr(COLLAPSE.at);
  const quake = frame >= c0 && frame < fr(COLLAPSE.to) ? Math.sin((frame - c0) * 2.2) * COLLAPSE.amp * (1 - (frame - c0) / (fr(COLLAPSE.to) - c0)) : 0;
  const endPush = 1 + END_PUSH.zoom * interpolate(frame, [fr(END_PUSH.from), fr(END_PUSH.to)], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const bowSway = CELLS[i].img === 'g8.jpg' ? 5 * Math.sin((frame - fr(CELLS[i].at)) * 0.9) : 0; // 꾸벅하는 동안 탑이 살짝 흔들림
  const sway = bowSway + (inWobble(sec) ? (CELLS[i].img === 'g7a.jpg' ? 1 : -1) * (WOBBLE_AMP[Math.max(0, Math.min(wk, WOBBLE_AMP.length - 1))] ?? 8) * interpolate(frame - fr(CELLS[i].at), [0, 3], [0.3, 1], clamp) : 0);
  const next = i + 1 < CELLS.length ? CELLS[i + 1].at : TOTAL;
  const l0 = fr(LAND.at);
  const punch = 1 + LAND.punch * interpolate(frame, [l0, l0 + 2, l0 + 10], [0, 1, 0], clamp);
  const finP = interpolate(frame, [fr(FINAL.from), fr(FINAL.to)], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const fin = 1 + FINAL.zoom * finP;
  const finX = FINAL.dx * finP;
  return (
    <AbsoluteFill style={{ backgroundColor: '#3a2a1c' }}>
      <AbsoluteFill style={{ transformOrigin: END_PUSH.origin, transform: `scale(${endPush})` }}>
      <AbsoluteFill style={{ transformOrigin: sec >= ZOOM_LAND.from && sec < ZOOM_LAND.to ? ZOOM_LAND.origin : ZOOM.origin, transform: `translateY(${ZOOM.shiftY}px) scale(${ZOOM.k})` }}>
      <AbsoluteFill style={{ transformOrigin: FINAL.origin, transform: `translateX(${finX}px) scale(${fin})` }}>
        <AbsoluteFill style={{ transformOrigin: LAND.origin, transform: `scale(${punch})` }}>
          <Plate src={CELLS[i].img} push={interpolate(frame, [fr(CELLS[i].at), fr(next)], [1.03, 1.05], clamp)} dx={sway + quake} dy={quake * 0.5} />
        </AbsoluteFill>
      </AbsoluteFill>
      </AbsoluteFill>
      </AbsoluteFill>
      {bare ? null : <Title L={L} />}
      {bare ? null : <Bubble L={L} />}
      {bare ? null : <EndBand L={L} />}
      <Sound />
    </AbsoluteFill>
  );
};
