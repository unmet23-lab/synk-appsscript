// LAB 몽골 M50 「생일 · 생신」(11-14) — 원본 우리 편 M11 「미안 · 죄송합니다」 v9의 Film.tsx를 옮겼다(고정 카메라 · 칸마다 같은 몽글의 자세만 바뀜 · 반전 9.3 · 끝 12.5).
// 그림은 칸마다 기준 판(g1)을 참고로 구운 한 장(누끼 · 얹기 없음)을 판/_판짜기.py가 1080×1920 화면 판으로 미리 짠 것 — 카메라는 고정, 칸은 박자에 바로 바뀐다.
// 화면 글은 원본과 같은 몽글의 흰 말풍선(꼬리가 몽글을 가리킴)에 단계 알약 · 몽골 뜻 · 한글 · 키릴 읽기 · 꼬리 — 할머니 얼굴(왼쪽 위)을 비켜 아래 나무판 자리에 둔다.
// 판본 틀(11-10): 뜻 · 읽는 법 · 꼬리 · 단계 · 상황 줄 · 할머니 이름표와 끝 카드 · 끝 질문은 판본/<KEY>.json(판본.ts)에서 읽는다 — 그림 · 한국어 · 목소리 · 박자는 그대로.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { EN, KO } from '../lib/fonts';
import { CAM, CELLS, END_AT, FPS, SFX, TOTAL } from './data';
import { LocPack } from './판본';

const fr = (sec: number) => Math.round(sec * FPS);
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const MASTER = 0.8; // Remotion은 소리를 16비트로 더해 넘치면 자른다 — 모든 볼륨에 같은 값을 곱한다(현장 노트)
export const TOTAL_FRAMES = fr(TOTAL);
export { FPS };

const INK = '#2B2522';
const CORAL = '#E8503D';
const MEAN = '#B23A26'; // 뜻 줄 — 흰 말풍선 위 진한 산호
const BUBBLE_TOP = 1000; // 말풍선 위 끝(px) — 상 앞판 위쪽(상 앞 모서리 약 970px 바로 아래)
const TAIL_TIP: [number, number] = [790, 915]; // 꼬리 끝 — 상 위 몽글 자리(서 있을 때 밑단 가운데 · 엎드려도 몸 아래)

const cellAt = (sec: number) => {
  let i = 0;
  CELLS.forEach((c, k) => {
    if (sec >= c.at) i = k;
  });
  return i;
};

// 판은 이미 1080×1920(판/_판짜기.py — 구운 판 1.18배 · 왼쪽 40px · 위 280px 자름, 모자란 아래는 나무 앞판을 거울로) — 카메라는 고정, 칸 안에서만 아주 천천히 다가간다
const Plate: React.FC<{ src: string; push: number }> = ({ src, push }) => (
  <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: '#2a1d16' }}>
    <Img src={staticFile(`img/${src}`)} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, transformOrigin: '45% 32%', transform: `scale(${push})` }} />
  </AbsoluteFill>
);

// 단계 알약 글 — 판본 level의 {n} 자리에 단계 수
const levelText = (L: LocPack, n: number | string) => L.level.split('{n}').join(String(n));

const Bubble: React.FC<{ i: number; L: LocPack }> = ({ i, L }) => {
  const frame = useCurrentFrame();
  const c = CELLS[i];
  // 판본 글(판본/<KEY>.json): 뜻 · 꼬리는 말풍선 차례 c.b로, 읽는 법은 배울 세 낱말(단계 1~3)만
  const read = typeof c.level === 'number' && c.level <= L.reads.length ? L.reads[c.level - 1] : undefined;
  const mean = L.means[c.b];
  const meanSize = L.meanSizes[c.b];
  const tag = L.tags[c.b] || undefined;
  // 칸이 바뀔 때 말풍선만 4프레임 살짝 튀어나온다(그림은 바로 바뀜)
  const p = c.cont ? 1 : interpolate(frame, [fr(c.at), fr(c.at) + 4], [0.9, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const enFont = L.font;
  // 목소리 박자대로 밝아지는 줄 — v5부터 줄 전체가 처음부터 흐리게 보이고, 말한 낱말만 진해진다(3.2초 동안 끝 낱말까지 읽히게)
  const koLine = c.words ? (
    <div style={{ fontFamily: KO, fontWeight: 800, fontSize: c.koSize, color: INK, lineHeight: 1.16 }}>
      {c.words.map(([w, t, hot], k) => {
        if (w === '\n') return <br key={k} />;
        const at = fr(c.voAt + t);
        const q = interpolate(frame, [at, at + 3], [0, 1], clamp);
        return (
          <span key={k} style={{ display: 'inline-block', opacity: 0.55 + 0.45 * q, // v6: 아직 말 안 한 낱말을 0.32 → 0.55로(이해 시험 v6 「흐린 글씨 연출의 의도를 모름」)
            transform: `scale(${1 + 0.06 * q * (1 - q) * 4})`, color: hot && q > 0.5 ? CORAL : INK, marginRight: 18 }}>
            {w}
          </span>
        );
      })}
    </div>
  ) : (
    <div style={{ fontFamily: KO, fontWeight: 800, fontSize: c.koSize, color: INK, lineHeight: 1.16, whiteSpace: 'pre-line' }}>
      {c.hot && c.ko.includes(c.hot)
        ? c.ko.split(c.hot).map((part, k, all) => (
            <React.Fragment key={k}>
              {part}
              {k < all.length - 1 ? <span style={{ color: CORAL }}>{c.hot}</span> : null}
            </React.Fragment>
          ))
        : c.ko}
    </div>
  );
  return (
    <>
      {/* 할머니 얼굴(왼쪽 위)을 비켜 아래 나무판 자리 — 꼬리 자리(760~816px)가 늘 말풍선 안에 들게 가장 좁아도 560px */}
      <div style={{ position: 'absolute', top: BUBBLE_TOP, left: 140, width: 800, display: 'flex', justifyContent: 'center' }}>
        <div
          style={{
            display: 'inline-block',
            minWidth: 560,
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
              <span style={{ display: 'inline-block', background: INK, color: '#fff', fontFamily: enFont, fontWeight: 800, fontSize: 44, lineHeight: 1, padding: '10px 24px 12px', borderRadius: 999 }}>
                {levelText(L, 0)} ❌
              </span>
            </div>
          ) : null}
          {c.level ? (
            <div style={{ marginBottom: 4 }}>
              <span style={{ display: 'inline-block', background: CORAL, color: '#fff', fontFamily: enFont, fontWeight: 800, fontSize: 44, lineHeight: 1, padding: '10px 24px 12px', borderRadius: 999 }}>
                {levelText(L, c.level)}
              </span>
            </div>
          ) : null}
          <div style={{ fontFamily: enFont, fontWeight: 800, fontSize: meanSize, color: MEAN, lineHeight: Math.max(1.16, L.lineH), marginBottom: 8, whiteSpace: 'pre-line' }}>
            {mean}
          </div>
          {koLine}
          {/* v5: 읽기 44 → 50px · 꼬리 40 → 44px(이해 시험 v4 셋이 「작은 줄을 못 읽음」) */}
          {/* 두 채널 판(11-14): 로마자 「saeng-sin chu-ka-deu-ryeo-yo」(28자)는 50px로 말풍선 안 폭(680px)을 넘어 「yo」만 줄이 넘어갔다 — 긴 읽기만 44px 한 줄 */}
          {read ? <div style={{ fontFamily: EN, fontWeight: 800, fontSize: read.length > 22 ? 44 : 50, whiteSpace: 'nowrap', color: '#4F3F33', lineHeight: 1.15, marginTop: 2 }}>{read}</div> : null}
          {tag ? <div style={{ marginTop: 8, fontFamily: enFont, fontWeight: 800, fontSize: 44, color: '#4F3F33', lineHeight: Math.max(1.15, L.lineH) }}>→ {tag}</div> : null}
        </div>
      </div>
      {/* 꼬리 — 말풍선 위 끝에서 상 위 몽글로 */}
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
    <Audio src={staticFile('bgm.wav')} volume={(i) => 0.19 * MASTER * interpolate(i, [fr(TOTAL) - 20, fr(TOTAL)], [1, 0], clamp)} />
    {CELLS.filter((c) => c.vo).map((c) => (
      <Sequence key={c.vo} from={fr(c.voAt)} layout="none">
        <Audio src={staticFile(`vo/${c.vo}.wav`)} volume={MASTER} startFrom={c.voFrom ? fr(c.voFrom) : undefined} endAt={c.voTo ? fr(c.voTo) : undefined} />
      </Sequence>
    ))}
    {SFX.map(([t, f, v]) => (
      <Sequence key={`${t}-${f}`} from={fr(t)} layout="none">
        <Audio src={staticFile(`sfx/${f}`)} volume={v * MASTER} endAt={f === 'wind.wav' ? fr(0.9) : undefined} />
      </Sequence>
    ))}
  </>
);

// 끝 카드 · 끝 질문(판본 endCard · ask, 선택) — 마지막 칸 말 뒤(END_AT) 할머니 얼굴 오른쪽, 0~4.4초 상황 줄과 같은 자리 · 같은 꼴.
// 둘 다 비우면 그리지 않는다(몽골판 그대로). 오른쪽 끝 900px — 오른쪽 단추 자리(920px) 안.
const EndCard: React.FC<{ L: LocPack }> = ({ L }) => {
  const frame = useCurrentFrame();
  if (frame < fr(END_AT) || (!L.endCard && !L.ask)) return null;
  const p = interpolate(frame, [fr(END_AT), fr(END_AT) + 5], [0.86, 1], { ...clamp, easing: Easing.out(Easing.back(2)) });
  return (
    <div style={{ position: 'absolute', left: 360, top: 290, maxWidth: 540, textAlign: 'left', transform: `scale(${p})`, transformOrigin: '0% 0%' }}>
      <span style={{ display: 'inline-block', background: '#FFFDF7', color: INK, border: `4px solid ${INK}`, boxShadow: '0 6px 16px rgba(0,0,0,0.3)', fontFamily: L.font, fontWeight: 800, lineHeight: Math.max(1.2, L.lineH), padding: '10px 22px 12px', borderRadius: 22, whiteSpace: 'pre-line' }}>
        {L.endCard ? <span style={{ display: 'block', fontSize: L.endSize, color: CORAL }}>{L.endCard}</span> : null}
        {L.ask ? <span style={{ display: 'block', fontSize: L.askSize, color: '#4F3F33', marginTop: L.endCard ? 6 : 0 }}>{L.ask}</span> : null}
      </span>
    </div>
  );
};

// L = 판본 글(판본/<KEY>.json) — Root가 판본마다 컴포지션 saengsin-<KEY>로 넘긴다
// bare = 장면 심사용(제목 · 이름표 · 말풍선 · 끝 카드 없이 그림과 소리만 — 제작 절차 「한 장면 먼저」 ①)
export const Film: React.FC<{ L: LocPack; bare?: boolean }> = ({ L, bare }) => {
  const frame = useCurrentFrame();
  const i = cellAt(frame / FPS);
  return (
    <AbsoluteFill style={{ backgroundColor: '#2a1d16' }}>
      {/* 칸 안의 아주 느린 다가감 + 핵심 장면 카메라(CAM — 「근데…」부터 끝까지 다가가고, 「후우~!」에 바람으로 살짝 흔들림) */}
      <AbsoluteFill
        style={{
          transformOrigin: '45% 30%',
          transform: `translateX(${frame >= fr(CAM.shakeFrom) && frame < fr(CAM.shakeTo) ? Math.sin(frame * 2.1) * 5 : 0}px) scale(${1 + CAM.zoom * interpolate(frame, [fr(CAM.from), fr(CAM.to)], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) })})`,
        }}
      >
        <Plate src={CELLS[i].img} push={interpolate(frame, [fr(CELLS[i].at), fr(i + 1 < CELLS.length ? CELLS[i + 1].at : TOTAL)], [1, 1.035], clamp)} />
      </AbsoluteFill>
      {/* 할머니 옆 상황 한 줄 — 무슨 날인지(0~4.4초) · 판본의 첫 2초 카드 */}
      {!bare && frame < fr(CELLS[3].at) ? (
        <div style={{ position: 'absolute', left: 340, top: 290, maxWidth: 600, textAlign: 'left' }}>
          <span style={{ display: 'inline-block', whiteSpace: 'nowrap', background: '#FFFDF7', color: INK, border: `4px solid ${INK}`, boxShadow: '0 6px 16px rgba(0,0,0,0.3)', fontFamily: L.font, fontWeight: 800, fontSize: L.sceneSize, lineHeight: Math.max(1.2, L.lineH), padding: '10px 22px 12px', borderRadius: 22 }}>{L.scene}</span>
        </div>
      ) : null}
      {/* 할머니 이름표(0~2.3초) — 할머니 가디건 위, 「👆」가 얼굴을 가리킨다 */}
      {/* v8: 할머니 이름표는 그리지 않는다 — 카본 맹검 「이름표가 할머니 팔 · 국그릇을 덮고 템플릿 티」, 상황 줄과 그림만으로 할머니가 읽힌다(판본 boss 칸은 틀 호환으로 남김) */}
      {false && !bare && frame < fr(CELLS[2].at) ? (
        <div style={{ position: 'absolute', left: 50, top: 730, opacity: interpolate(frame, [0, 4], [0, 1], clamp) }}>
          <span style={{ display: 'inline-block', background: '#FFFDF7', color: INK, border: `5px solid ${INK}`, fontFamily: L.font, fontWeight: 800, fontSize: 52, lineHeight: 1, padding: '10px 24px 12px', borderRadius: 999, boxShadow: '0 6px 16px rgba(0,0,0,0.3)' }}>👆 {L.boss}</span>
        </div>
      ) : null}
      {bare ? null : <Bubble i={i} L={L} />}
      {bare ? null : <EndCard L={L} />}
      <Sound />
    </AbsoluteFill>
  );
};
