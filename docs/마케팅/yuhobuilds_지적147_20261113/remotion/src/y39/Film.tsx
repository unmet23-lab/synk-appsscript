// Y39 본편 — 원본 3Wo7N1FpLas(37.8초 · 17칸)의 컷 초를 따른다. 숫자는 11-08 실제 묶음 표(data.ts).
// 무대는 처음부터 끝까지 쪽지 벽 하나 — 벽 147장 → 다시 읽힘 → 실제 표 → 20더미(279번) → 가장 높은 더미 38 → 기획 81 → 질문 카드 → 끝.
import React from 'react';
import { Audio } from '@remotion/media';
import { AbsoluteFill, Img, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { KO } from '../lib/fonts';
import { IN, IN_OUT, clamp, mix, prog } from '../lib/motion';
import { GROUPS, REAL } from './data';
import { INK, NEVER, NOTE, NOTE_HI, PILE, TL, WALL_BG, World, countIn, pileX } from './World';

export const FPS = 30;
export const F = (s: number) => Math.round(s * FPS);
export const TOTAL = F(37.8);

// 원본 컷 · 박자 초(오마주.json)
export const CUT = [0, 1.4, 5.5, 6.4, 7.5, 8.5, 10.5, 15.5, 16.5, 17.0, 21.7, 24.1, 25.9, 28.3, 30.1, 32.2];
const END = 32.2;

export const VO: { id: string; at: number }[] = [
  { id: 'V1', at: 0.35 },
  { id: 'V2', at: 5.7 },
  { id: 'V3', at: 10.7 },
  { id: 'V4', at: 15.7 },
  { id: 'V5', at: 21.4 },
  { id: 'V6', at: 26.4 },
  { id: 'V7', at: 32.5 },
];

export const MAIN: TL = { enter: -40, sort: F(10.7), sortLen: F(2.2), rep: F(13.1), repLen: F(2.2), last: F(18.8), pale: F(21.7), merge: F(24.1), collapse: F(26.0), cards: F(26.7) };
const ENDTL: TL = { enter: -200, sort: -400, sortLen: 40, rep: -200, repLen: 40, last: -100, pale: NEVER, merge: NEVER, collapse: NEVER, cards: NEVER };

/** 위 큰 글 — 줄 단위로 28px 올라오며 나타남. 밝은 벽 위 먹색 글. */
export const Head: React.FC<{ from: number; to: number; lines: React.ReactNode[]; size?: number; top?: number; step?: number }> = ({ from, to, lines, size = 92, top = 286, step = 4 }) => {
  const f = useCurrentFrame();
  if (f < from || f >= to) return null;
  const out = 1 - prog(f, to - 2, 2);
  return (
    <div style={{ position: 'absolute', left: 74, right: 74, top, fontFamily: KO, fontWeight: 800, fontSize: size, lineHeight: 1.16, letterSpacing: -2.5, color: INK }}>
      {lines.map((l, i) => {
        const p = from === 0 && i === 0 ? 1 : prog(f, from + i * step, 6);
        return (
          <div key={i} style={{ opacity: p * out, transform: `translateY(${(1 - p) * 28}px)` }}>
            {l}
          </div>
        );
      })}
    </div>
  );
};

/** 숫자 아래 굵은 먹 밑줄(이 편에서 짚는 자리). */
const U: React.FC<{ children: React.ReactNode }> = ({ children }) => <span style={{ boxShadow: `inset 0 -0.22em 0 ${NOTE}` }}>{children}</span>;

type Cam = { s: number; tx: number; ty: number };
const WIDE: Cam = { s: 1, tx: 0, ty: 0 };
const WALLIN: Cam = { s: 1.42, tx: 540 - 1.42 * 540, ty: 1190 - 1.42 * 1120 };
export const TALL: Cam = { s: 1.5, tx: 330 - 1.5 * 170, ty: 1010 - 1.5 * 900 };
const SHOTS: [number, Cam][] = [
  [0, WIDE], [5.5, WALLIN], [8.5, WIDE], [10.5, WIDE], [15.5, TALL], [20.0, WIDE], [21.7, WIDE], [24.1, WIDE], [25.9, WIDE], [28.3, WIDE], [END, TALL],
];
const shotAt = (t: number) => {
  let i = 0;
  for (let k = 0; k < SHOTS.length; k++) if (t >= SHOTS[k][0]) i = k;
  const start = SHOTS[i][0];
  const end = i + 1 < SHOTS.length ? SHOTS[i + 1][0] : 37.8;
  return { cam: SHOTS[i][1], start, len: end - start, i };
};

/** 큰 쪽지 한 장에 손으로 쓴 듯 기운 숫자. */
const BigNote: React.FC<{ from: number; to: number }> = ({ from, to }) => {
  const f = useCurrentFrame();
  if (f < from || f >= to) return null;
  const p = prog(f, from, 9);
  const n = Math.round(REAL.notes * prog(f, from, 7));
  return (
    <div style={{ position: 'absolute', left: 540 - 230, top: 1130 - 230 - ((f - from) / (to - from)) * 40, width: 460, height: 460, transform: `rotate(${mix(-14, -5, p) + ((f - from) / (to - from)) * 5}deg) scale(${mix(0.5, 1, p) * (1 + 0.1 * ((f - from) / (to - from)))})`, opacity: p, background: `linear-gradient(165deg, ${NOTE_HI}, ${NOTE} 70%)`, borderRadius: 6, boxShadow: '0 40px 70px rgba(60,40,0,0.38)', display: 'flex', alignItems: 'baseline', justifyContent: 'center', paddingTop: 120, boxSizing: 'border-box', fontFamily: KO, color: INK }}>
      <div style={{ fontWeight: 900, fontSize: 200, letterSpacing: -10, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{n}</div>
      <div style={{ fontWeight: 800, fontSize: 104, letterSpacing: -2, marginLeft: 8 }}>개</div>
    </div>
  );
};

/** 실제 묶음 표 캡처(공개 문서 화면 그대로) — 증거 한 컷. */
const TableShot: React.FC<{ from: number; to: number }> = ({ from, to }) => {
  const f = useCurrentFrame();
  if (f < from || f >= to) return null;
  const p = prog(f, from, 9);
  const s = prog(f, from, to - from, (x) => x);
  return (
    <div style={{ position: 'absolute', left: 90, top: 560, width: 860, height: 1180, overflow: 'hidden', borderRadius: 14, transform: `rotate(${mix(3, -1.6, p)}deg) translateY(${(1 - p) * 120}px)`, opacity: p, boxShadow: '0 40px 80px rgba(30,20,0,0.45)' }}>
      <Img src={staticFile('table2.png')} style={{ width: 860, transform: `translateY(${-s * 150}px)` }} />
    </div>
  );
};

/** 질문 카드 한 장 — 흰 종이에 먹 글. */
const QCard: React.FC<{ from: number; to: number; text: string[]; tilt: number }> = ({ from, to, text, tilt }) => {
  const f = useCurrentFrame();
  if (f < from || f >= to) return null;
  const p = prog(f, from, 8);
  const out = 1 - prog(f, to - 3, 3);
  const live = (f - from) / (to - from);
  return (
    <div style={{ position: 'absolute', left: 110, top: 760 - live * 46, width: 860, height: 560, background: '#FFFFFF', border: `5px solid ${INK}`, borderRadius: 8, boxSizing: 'border-box', boxShadow: '0 36px 70px rgba(30,20,0,0.35)', transform: `rotate(${mix(tilt * 4, tilt, p) - live * tilt * 1.4}deg) scale(${mix(0.72, 1, p) * (1 + 0.09 * live)})`, opacity: p * out, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 64px', fontFamily: KO, color: INK }}>
      <div style={{ fontWeight: 700, fontSize: 44, letterSpacing: -0.8, opacity: 0.6, marginBottom: 18 }}>만들기 전에</div>
      {text.map((l, i) => (
        <div key={i} style={{ fontWeight: 800, fontSize: 86, lineHeight: 1.18, letterSpacing: -2.5 }}>{l}</div>
      ))}
    </div>
  );
};

/** 끝 — 떨어지던 쪽지가 더미에 닿기 전에 질문 카드로 뒤집힌다(세계 좌표). */
const EndNote: React.FC<{ from: number }> = ({ from }) => {
  const f = useCurrentFrame();
  if (f < from) return null;
  const fall = prog(f, from, 15, IN);
  const flip = prog(f, from + 17, 14, IN_OUT);
  const x = mix(pileX(0) + 100, pileX(0) + 14, fall) + flip * 230;
  const y = mix(60, 500, fall) + flip * 330;
  const size = mix(76, 190, flip);
  const sx = Math.abs(Math.cos(Math.PI * flip));
  const white = flip > 0.5;
  const hover = Math.sin((f - from) / 9) * 5 * flip;
  return (
    <div style={{ position: 'absolute', left: x - size / 2, top: y - size / 2 + hover, width: size, height: size, transform: `rotate(${mix(-22, -4, fall) + flip * 8}deg) scaleX(${Math.max(0.04, sx)})`, background: white ? '#FFFFFF' : `linear-gradient(165deg, ${NOTE_HI}, ${NOTE} 70%)`, border: white ? `4px solid ${INK}` : 'none', boxSizing: 'border-box', borderRadius: 4, boxShadow: '0 18px 30px rgba(50,35,0,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: KO, fontWeight: 900, fontSize: 120, color: INK }}>
      {white ? '?' : null}
    </div>
  );
};

/** 끝 글 — 그대로 시킬 한 요청(번호 목록 없이 — 지난 편 끝과 다르게). */
const SaveLines: React.FC<{ from: number }> = ({ from }) => {
  const f = useCurrentFrame();
  if (f < from) return null;
  const line = (i: number, a: React.ReactNode) => {
    const p = prog(f, from + i, 6);
    return (
      <div style={{ fontWeight: 800, fontSize: 68, lineHeight: 1.2, letterSpacing: -2, opacity: p, transform: `translateY(${(1 - p) * 20}px)` }}>{a}</div>
    );
  };
  return (
    <div style={{ position: 'absolute', left: 74, right: 120, top: 282, fontFamily: KO, color: INK }}>
      <div style={{ fontWeight: 800, fontSize: 44, letterSpacing: -1.1, opacity: prog(f, from, 8) * 0.7, marginBottom: 8 }}>AI한테 그대로 시켜 보세요</div>
      {line(0, '“내가 한 지적을 모아서')}
      {line(1, '같은 원인끼리 묶고')}
      {line(2, <><U>만들기 전 질문</U>으로 바꿔 줘”</>)}
    </div>
  );
};

export const Film: React.FC<{ bgm?: boolean; voice?: boolean }> = ({ bgm = true, voice = true }) => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const shot = shotAt(t);
  const inShot = Math.max(0, Math.min(1, (t - shot.start) / shot.len));
  const cam = shot.cam;
  const drift = 1 + Math.max(0.06, 0.028 * shot.len) * inShot;
  const pan = (shot.i % 2 === 0 ? -1 : 1) * Math.max(14, 7 * shot.len) * inShot;
  const kick = CUT.slice(1).reduce((a, c) => {
    const d = f - F(c);
    return d >= 0 && d < 10 ? Math.max(a, 1 - d / 10) : a;
  }, 0);
  const isEnd = t >= END;
  const tl = isEnd ? ENDTL : MAIN;
  // 가까이 간 컷에서 숫자는 0부터 빠르게 세어 37에 닿고, 서른여덟 번째 장이 얹히며 38이 된다
  const n0 = isEnd ? REAL.top : Math.min(countIn(0, f, MAIN), Math.round(37 * prog(f, F(15.6), F(0.8), (x) => x)) + (f >= MAIN.last ? 1 : 0));
  const shakeD = f - MAIN.last;
  const shake = shakeD >= 0 && shakeD < 5 ? (1 - shakeD / 5) * 6 * Math.sin(shakeD * 2.4) : 0;
  const tallShot = cam === TALL;
  const pop = Math.max(0, 1 - Math.abs(f - MAIN.last - 3) / 5);
  const dim = t >= 8.5 && t < 10.5 ? Math.min(prog(f, F(8.5), 6), 1 - prog(f, F(10.5) - 5, 5)) : t >= 28.3 && t < END ? prog(f, F(28.3), 6) : 0;
  const scanP = interpolate(f, [F(6.4), F(8.35)], [0, 1], clamp);
  const brO = t >= 24.1 && t < 25.95 ? prog(f, MAIN.merge + 10, 6) * (1 - prog(f, F(25.95) - 4, 4)) : 0;
  const mark = t >= 20 && t < 21.7 ? prog(f, F(20.0) + 3, 6) : 0;
  return (
    <AbsoluteFill style={{ background: WALL_BG }}>
      <AbsoluteFill style={{ background: 'radial-gradient(120% 80% at 50% 45%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 55%, rgba(120,100,60,0.16) 100%)' }} />
      <AbsoluteFill style={{ transform: `translate(${pan}px, ${shake}px) scale(${drift * (1 + 0.03 * kick * kick)})`, transformOrigin: '50% 60%' }}>
        <AbsoluteFill style={{ opacity: 1 - 0.8 * dim, transform: `translate(${cam.tx}px, ${cam.ty}px) scale(${cam.s})`, transformOrigin: '0 0' }}>
          {/* 더미가 선 바닥 선 */}
          <div style={{ position: 'absolute', left: 40, right: 40, top: PILE.base + 4, height: 3, background: INK, opacity: 0.85 * prog(f, MAIN.sort + 6, 12) * (isEnd ? 1 : 1 - prog(f, MAIN.cards, 10)) + (isEnd ? 1 : 0) * 0 }} />
          <World tl={tl} mark={mark} />
          {/* 기획 네 더미 아래 묶음 표시 */}
          {brO > 0 ? (
            <div style={{ position: 'absolute', left: pileX(0, 1) + 44, top: 930, opacity: brO, fontFamily: KO, color: INK, fontWeight: 800, fontSize: 50, letterSpacing: -1.4, lineHeight: 1.15, whiteSpace: 'nowrap' }}>
              기획에서 시작된
              <br />
              네 더미
            </div>
          ) : null}
          {isEnd ? <EndNote from={F(33.25)} /> : null}
        </AbsoluteFill>
      </AbsoluteFill>

      {/* 글 자리 막 — 벽에 다가간 컷에서 쪽지가 위 글 자리까지 올라오지 않게 */}
      {cam === WALLIN ? <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 640, background: `linear-gradient(to bottom, ${WALL_BG} 0px, ${WALL_BG} 560px, rgba(236,232,223,0) 640px)` }} /> : null}
      {/* 훑는 선(대화를 다시 읽힘) */}
      {t >= 6.4 && t < 8.5 ? <div style={{ position: 'absolute', left: 0, right: 0, top: mix(600, 1900, scanP), height: 8, background: INK, boxShadow: `0 -70px 90px 30px rgba(245,196,69,0.55)`, opacity: Math.min(1, (t - 6.4) * 8) }} /> : null}

      <Head from={0} to={F(5.5)} lines={['AI한테 한 지적', '전부 모았다']} />
      <BigNote from={F(2.5)} to={F(5.5)} />
      <Head from={F(5.5)} to={F(8.5)} lines={['영상 · 화면 만든 대화 224개', 'AI한테 다시 읽혔다']} size={78} step={F(0.9)} />
      <Head from={F(8.5)} to={F(10.5)} lines={['그날 나온 실제 표']} />
      <TableShot from={F(8.5)} to={F(10.5)} />
      <Head from={F(10.5)} to={F(13.0)} lines={['같은 원인끼리', '묶었더니']} />
      <Head from={F(13.0)} to={F(15.5)} lines={['20더미', <span key="s" style={{ fontSize: 62, letterSpacing: -1.6 }}>같은 지적을 또 한 것까지 <U>279번</U></span>]} />
      <Head from={F(15.5)} to={F(20.0)} lines={['제일 높은 더미']} />
      {tallShot && !isEnd ? (
        <div style={{ position: 'absolute', left: 300, top: 650, fontFamily: KO, color: INK }}>
          <div style={{ fontWeight: 800, fontSize: 66, letterSpacing: -2, opacity: prog(f, F(16.5), 6), transform: `translateY(${(1 - prog(f, F(16.5), 6)) * 24}px)` }}>뻔한 AI 틀 같다는 말</div>
          <div style={{ fontWeight: 900, fontSize: 230, lineHeight: 1.02, letterSpacing: -9, fontVariantNumeric: 'tabular-nums', transform: `scale(${1 + 0.16 * pop})`, transformOrigin: '10% 60%', opacity: prog(f, F(15.6), 5) }}>
            <U>
              {n0}
              <span style={{ fontSize: 92, letterSpacing: -2, marginLeft: 10 }}>번</span>
            </U>
          </div>
        </div>
      ) : null}
      <Head from={F(20.0)} to={F(21.7)} lines={['279번 가운데', <><U key="u">38번</U>이 이 한 더미</>]} />
      <Head from={F(21.7)} to={F(24.1)} lines={['문제가 제일 많이', '시작된 곳은']} />
      <Head from={F(24.1)} to={F(25.9)} lines={['만들기도 전인 기획', <span key="s" style={{ fontSize: 70, letterSpacing: -1.8 }}>279번 가운데 <U>81번</U></span>]} />
      <Head from={F(25.9)} to={F(28.3)} lines={['그래서 지적을', '만들기 전 질문으로']} />
      <Head from={F(28.3)} to={F(END)} lines={['만들기 전에 묻는 질문']} />
      <QCard from={F(28.3)} to={F(30.1)} text={['이 영상이 이길', '한 가지는?']} tilt={-2} />
      <QCard from={F(30.1)} to={F(END)} text={['참고할 화면 셋과', '나란히 놓고 봤나?']} tilt={1.6} />
      <SaveLines from={F(END)} />

      {bgm ? <Audio src={staticFile('bgm.wav')} volume={0.2} /> : null}
      {voice
        ? VO.map((v) => (
            <Sequence key={v.id} from={F(v.at)}>
              <Audio src={staticFile(`vo/${v.id}.wav`)} volume={1} />
            </Sequence>
          ))
        : null}
      {voice ? (
        <>
          {[0.05, 0.25, 0.45, 0.7, 0.95].map((s, i) => (
            <Sequence key={`e${i}`} from={F(s)}>
              <Audio src={staticFile('sfx/tick2.wav')} volume={0.35} />
            </Sequence>
          ))}
          {[2.5, 18.8, 28.3, 30.1].map((s) => (
            <Sequence key={`k${s}`} from={F(s)}>
              <Audio src={staticFile('sfx/tok.wav')} volume={0.95} />
            </Sequence>
          ))}
          {[5.5, 6.4, 10.7, 15.5, 20.0, 24.1, END, 33.25].map((s) => (
            <Sequence key={`s${s}`} from={F(s)}>
              <Audio src={staticFile('sfx/swish.wav')} volume={0.55} />
            </Sequence>
          ))}
          {[8.5, 18.85, 26.0].map((s) => (
            <Sequence key={`t${s}`} from={F(s)}>
              <Audio src={staticFile('sfx/thud.wav')} volume={0.6} />
            </Sequence>
          ))}
          {Array.from({ length: 26 }, (_, i) => (
            <Sequence key={`r${i}`} from={F(11.0) + i * 5}>
              <Audio src={staticFile(i % 2 ? 'sfx/tick.wav' : 'sfx/tick2.wav')} volume={0.28 + 0.01 * i} />
            </Sequence>
          ))}
          {Array.from({ length: 8 }, (_, i) => (
            <Sequence key={`c${i}`} from={F(26.8) + i * 4}>
              <Audio src={staticFile('sfx/tick2.wav')} volume={0.4} />
            </Sequence>
          ))}
          <Sequence from={F(33.85)}>
            <Audio src={staticFile('sfx/calm.wav')} volume={0.8} />
          </Sequence>
        </>
      ) : null}
    </AbsoluteFill>
  );
};

export const _groups = GROUPS.length;
