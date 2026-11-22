// LAB 몽골 M49 「더 먹어」(11-22) — M72 「계세요」 Film.tsx(그 뿌리 M56 · M50 · M11)의 말풍선 틀을 옮기고, 칸마다 카메라 크기 · 축을 바꿨다(data.ts CELLS의 cam).
// 그림은 칸마다 기준 판 g1을 참고로 구운 한 장(누끼 · 얹기 없음)을 판/_판짜기.py가 1080×1920 화면 판으로 미리 짠 것 — 칸은 박자에 바로 바뀌고, 칸이 바뀌는 5프레임 동안 카메라가 새 크기로 옮겨 간다.
// 카메라 축 y는 인형들 아래(CAM_Y)라 다가갈수록 인형이 위로 올라가 아래 밥상 앞판 · 깔개 자리(말풍선)를 비운다. 말풍선 꼬리 끝은 같은 변환으로 말하는 인형을 따라간다.
// 화면 글: 위 머리 글(0~3.2초) · 흰 말풍선(알약 · 몽골 뜻 · 한글 · 키릴 읽기 · 꼬리) · 끝 제목(「잘 먹었습니다!」 ✓ + 뜻 줄).
// 판본 틀(11-10): 뜻 · 읽는 법 · 꼬리 · 알약 · 머리 글 · 끝 제목 뜻 줄 · 끝 질문은 판본/<KEY>.json(판본.ts)에서 읽는다 — 그림 · 한국어 · 목소리 · 박자는 그대로.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from '../lib/fonts';
import { CAM_Y, CELLS, Cam, END_AT, FPS, SFX, TOTAL } from './data';
import { LocPack } from './판본';

const fr = (sec: number) => Math.round(sec * FPS);
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const MASTER = 0.8; // Remotion은 소리를 16비트로 더해 넘치면 자른다 — 모든 볼륨에 같은 값을 곱한다(현장 노트)
export const TOTAL_FRAMES = fr(TOTAL);
export { FPS };

const INK = '#2B2522';
const CORAL = '#E8503D';
const MEAN = '#B23A26'; // 뜻 줄 — 흰 말풍선 위 진한 산호
const OK = '#0A9A66'; // 통하는 말 — 초록 + ✓(제작 절차 「맞는 말 · 틀린 말」 11-19)
const NG = '#D92D20'; // 안 통하는 말 — 빨강 + ✗
const HL = 'linear-gradient(transparent 58%, #FFE36A 58%, #FFE36A 92%, transparent 92%)'; // 짚는 낱말 — 형광 밑줄(맞음 · 틀림이 아닌 강조)
const BUBBLE_TOP = 1056; // 올리기 전 검사 1 · 2차 — 3.5~4초 알약 칸 말풍선 아래 끝 1474 → 1451px(안전선 1428) → 44px 올리고 그 칸 글을 줄임 // 말풍선 위 끝(px) — 밥상 윗면(약 1080px) 바로 아래, 밥상 앞판 위
// 말하는 인형의 꼬리 끝(카메라 변환 전 화면 판 좌표) — 몽글은 몸 아래쪽 가운데, 어머니는 앞치마, 친구는 후드티 가슴
const TIP: Record<'s' | 'm' | 'f', [number, number]> = { s: [720, 1010], m: [300, 1000], f: [985, 1000] };

const cellAt = (sec: number) => {
  let i = 0;
  CELLS.forEach((c, k) => {
    if (sec >= c.at) i = k;
  });
  return i;
};

// 칸이 바뀌는 5프레임 동안 앞 칸 카메라에서 이 칸 카메라로 옮겨 가고, 칸 안에서는 아주 천천히 더 다가간다(3%)
const camAt = (frame: number): Cam => {
  const i = cellAt(frame / FPS);
  const c = CELLS[i];
  const prev = i > 0 ? CELLS[i - 1].cam : c.cam;
  const k = interpolate(frame, [fr(c.at), fr(c.at) + 5], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const end = fr(i + 1 < CELLS.length ? CELLS[i + 1].at : TOTAL);
  const drift = interpolate(frame, [fr(c.at), end], [1, i === 0 ? 1.12 : 1.03], clamp); // 첫 칸은 12% 다가간다(볼 이유 v5 「0~1.5초가 멈춘 사진 같다」)
  return { z: (prev.z + (c.cam.z - prev.z) * k) * drift, x: prev.x + (c.cam.x - prev.x) * k };
};
// 화면 판 좌표 → 카메라 변환 뒤 좌표(배율 z, 축 (x, CAM_Y))
const mapPt = ([px, py]: [number, number], cam: Cam): [number, number] => [cam.x + (px - cam.x) * cam.z, CAM_Y + (py - CAM_Y) * cam.z];

const Bubble: React.FC<{ i: number; L: LocPack; cam: Cam }> = ({ i, L, cam }) => {
  const frame = useCurrentFrame();
  const c = CELLS[i];
  const read = L.reads[c.b];
  const mean = L.means[c.b];
  const meanSize = L.meanSizes[c.b];
  const tag = L.tags[c.b] || undefined;
  const who = c.who ?? 's';
  let [tx, ty] = mapPt(TIP[who], cam);
  tx = Math.max(90, Math.min(990, tx));
  ty = Math.min(ty, BUBBLE_TOP - 34); // 꼬리가 늘 말풍선 위로 나가게
  // 칸이 바뀔 때 말풍선만 4프레임 살짝 튀어나온다(그림은 바로 바뀜) — 앞 칸을 잇는 칸은 그대로
  const p = c.cont ? 1 : interpolate(frame, [fr(c.at), fr(c.at) + 4], [0.9, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const enFont = L.font;
  const koLine = (
    <div style={{ fontFamily: KO, fontWeight: 800, fontSize: c.koSize, color: INK, lineHeight: 1.16, whiteSpace: 'pre-line' }}>
      {c.hot && c.ko.includes(c.hot)
        ? c.ko.split(c.hot).map((part, k, all) => (
            <React.Fragment key={k}>
              {part}
              {k < all.length - 1 ? <span style={c.mark === 'ok' ? { color: OK } : { background: HL, padding: '0 4px' }}>{c.hot}</span> : null}
            </React.Fragment>
          ))
        : c.ko}
    </div>
  );
  // 말풍선 자리 — 어머니 말은 왼쪽, 친구 말은 오른쪽, 몽글 말은 가운데(오른쪽 단추 자리 920px 안)
  const left = who === 'm' ? 70 : who === 'f' ? 140 : 150; // 친구 말풍선 오른쪽 끝을 오른쪽 단추 자리(920px) 안으로(올리기 전 검사 1차 960px)
  const justify = who === 'm' ? 'flex-start' : who === 'f' ? 'flex-end' : 'center';
  return (
    <>
      <div style={{ position: 'absolute', top: BUBBLE_TOP, left, width: 780, display: 'flex', justifyContent: justify }}>
        <div
          style={{
            display: 'inline-block',
            minWidth: 520,
            maxWidth: 780,
            textAlign: 'center',
            background: '#FFFDF7',
            border: `6px solid ${INK}`,
            borderRadius: 48,
            padding: '14px 36px 16px',
            boxShadow: '0 10px 28px rgba(0,0,0,0.28)',
            transform: `scale(${p})`,
            transformOrigin: who === 'm' ? '25% 0%' : who === 'f' ? '80% 0%' : '55% 0%',
          }}
        >
          {c.pill !== undefined ? (
            <div style={{ marginBottom: 6 }}>
              <span style={{ display: 'inline-block', background: c.pill === 0 ? NG : OK, color: '#fff', fontFamily: enFont, fontWeight: 800, fontSize: 47, lineHeight: 1.05, padding: '10px 24px 12px', borderRadius: 999 }}>
                {L.pills[c.pill]}
              </span>
            </div>
          ) : null}
          <div style={{ fontFamily: enFont, fontWeight: 800, fontSize: meanSize, color: MEAN, lineHeight: Math.max(1.16, L.lineH), marginBottom: 6, whiteSpace: 'pre-line' }}>{mean}</div>
          {koLine}
          {read ? <div style={{ fontFamily: enFont, fontWeight: 800, fontSize: read.length > 22 ? 46 : 56, whiteSpace: 'nowrap', color: '#3A2D24', lineHeight: 1.15, marginTop: 2 }}>{read}</div> : null}
          {tag ? <div style={{ marginTop: 8, fontFamily: enFont, fontWeight: 800, fontSize: 52, color: '#3A2D24', lineHeight: Math.max(1.15, L.lineH), whiteSpace: 'pre-line' }}>→ {tag}</div> : null}
        </div>
      </div>
      {/* 꼬리 — 말풍선 위 끝에서 말하는 인형으로 */}
      <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0, opacity: p }}>
        <path d={`M ${tx - 30} ${BUBBLE_TOP + 8} L ${tx + 26} ${BUBBLE_TOP + 8} L ${tx} ${ty} Z`} fill="#FFFDF7" stroke={INK} strokeWidth={6} strokeLinejoin="round" />
        <rect x={tx - 27} y={BUBBLE_TOP + 5} width={50} height={9} fill="#FFFDF7" />
      </svg>
    </>
  );
};

const Sound: React.FC = () => (
  <>
    <Audio src={staticFile('bgm.wav')} volume={(i) => 0.24 * MASTER * interpolate(i, [fr(TOTAL) - 20, fr(TOTAL)], [1, 0], clamp)} />
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

// 위 머리 글(0~3.2초) — 흰 이름표 안 큰 글, 가운데. 위 안전선(269px) 아래
const Head: React.FC<{ L: LocPack }> = ({ L }) => {
  const frame = useCurrentFrame();
  if (frame >= fr(CELLS[2].at)) return null;
  const p = interpolate(frame, [0, 5], [0.88, 1], { ...clamp, easing: Easing.out(Easing.back(2)) });
  return (
    <div style={{ position: 'absolute', left: 70, width: 850, top: 300, display: 'flex', justifyContent: 'center' }}>
      <span style={{ display: 'inline-block', textAlign: 'center', whiteSpace: 'pre-line', background: '#FFFDF7', color: INK, border: `5px solid ${INK}`, boxShadow: '0 8px 20px rgba(0,0,0,0.3)', fontFamily: L.font, fontWeight: 800, fontSize: L.headSize, lineHeight: Math.max(1.2, L.lineH), padding: '12px 30px 14px', borderRadius: 28, transform: `scale(${p})` }}>
        {L.head}
      </span>
    </div>
  );
};

// 끝 제목(END_AT~) — 이 편의 결과 한 가지를 제목만 한 크기로: 「잘 먹었습니다!」 ✓ + 판본 뜻 줄(endCard) · 끝 질문(ask)
const EndCard: React.FC<{ L: LocPack }> = ({ L }) => {
  const frame = useCurrentFrame();
  if (frame < fr(END_AT) || (!L.endCard && !L.ask)) return null; // 몽골판은 끝 카드 없이 과일 사건으로 닫는다(이해 시험 v3)
  const p = interpolate(frame, [fr(END_AT), fr(END_AT) + 6], [0.84, 1], { ...clamp, easing: Easing.out(Easing.back(2)) });
  return (
    <div style={{ position: 'absolute', left: 70, width: 850, top: 290, display: 'flex', justifyContent: 'center' }}>
      <div style={{ display: 'inline-block', textAlign: 'center', background: '#FFFDF7', border: `5px solid ${INK}`, boxShadow: '0 8px 20px rgba(0,0,0,0.3)', padding: '14px 34px 16px', borderRadius: 30, transform: `scale(${p})` }}>
        <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 92, color: OK, lineHeight: 1.12 }}>잘 먹었습니다! ✓</div>
        {L.endCard ? <div style={{ fontFamily: L.font, fontWeight: 800, fontSize: L.endSize, color: CORAL, lineHeight: Math.max(1.2, L.lineH), marginTop: 6, whiteSpace: 'pre-line' }}>{L.endCard}</div> : null}
        {L.ask ? <div style={{ fontFamily: L.font, fontWeight: 800, fontSize: L.askSize, color: '#4F3F33', lineHeight: Math.max(1.2, L.lineH), marginTop: 6, whiteSpace: 'pre-line' }}>{L.ask}</div> : null}
      </div>
    </div>
  );
};

// L = 판본 글(판본/<KEY>.json) — Root가 판본마다 컴포지션 deomeogeo-<KEY>로 넘긴다
// bare = 장면 심사용(머리 글 · 말풍선 · 끝 제목 없이 그림과 소리만 — 제작 절차 「한 장면 먼저」 ①)
// 겹쳐 넘김을 끈다 — 장면 심사 v3 「5.7초 반투명 얼룩」에 이어 미학 맹검(카본, 최종본 v8)이 11.8 · 14.3초 띠에서 겹치는 3프레임을 「유령처럼 겹쳐 눈 · 입이 두 벌」로 짚었다. 두 상태 사이는 중간 그림(g8m · g8c)이 잇고, 넘김은 끊어 넘긴다(펠트 정지 동작처럼)
const FADE = false;
export const Film: React.FC<{ L: LocPack; bare?: boolean }> = ({ L, bare }) => {
  const frame = useCurrentFrame();
  const i = cellAt(frame / FPS);
  const cam = camAt(frame);
  return (
    <AbsoluteFill style={{ backgroundColor: '#2a1d16', overflow: 'hidden' }}>
      <AbsoluteFill style={{ transformOrigin: `${cam.x}px ${CAM_Y}px`, transform: `translateX(${CELLS[i].freeze && frame < fr(CELLS[i].at) + 4 ? Math.sin(frame * 2.4) * 7 : 0}px) scale(${cam.z})` }}>
        {FADE && CELLS[i].fade && i > 0 && frame < fr(CELLS[i].at) + 3 ? <Img src={staticFile(`img/${CELLS[i - 1].img}`)} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920 }} /> : null}
        <Img src={staticFile(`img/${CELLS[i].img}`)} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, opacity: FADE && CELLS[i].fade ? interpolate(frame, [fr(CELLS[i].at), fr(CELLS[i].at) + 3], [0, 1], clamp) : 1 }} />
      </AbsoluteFill>
      {bare ? null : <Head L={L} />}
      {bare ? null : <Bubble i={i} L={L} cam={cam} />}
      {bare ? null : <EndCard L={L} />}
      <Sound />
    </AbsoluteFill>
  );
};
