// yuhobuilds Y27(10-31) 「AI한테 PC 정리 맡겼더니 — 53기가가 쓰레기가 아니었다」.
// 원본 UzmsVkfKjbg(28.1초, 형식만) 뼈대: 큰 주장 → 큰 숫자 그림 → 출처 화면 → 전후 → 공개 → 밈 질문 → 실제 표를 노란 커서로 긁기 → 범위 확장 → 반응 → 정리 카드.
// 우리 재료는 실제 옮긴 목록(칸 하나가 폴더 하나 · 넓이가 크기, ../../자료/폴더벽.json)과 실제 폴더 창 한 컷(이름 · 사용자만 가림).
// 진행자 얼굴 자리는 쓰지 않고 위아래 한 판으로 짰다(화면 짜임 — 우리 판단). 무대는 지난 편들(Y24 밝은 판 + 영상, Y23 붉은 잠금 화면 → 흰 판, Y25 사진 세 장)과 달리 폴더 벽.
import React from 'react';
import { Audio } from '@remotion/media';
import { AbsoluteFill, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from '../lib/fonts';
import { clamp, IN_OUT, mix, prog } from '../lib/motion';
import { AMBER, GREEN, PICK_C, RED, Wall } from './Wall';
import { at, B, lineEnd, ORDER, TOTAL, VO, type Spoken } from './time';

const MASTER = 0.8;
const BG = '#08090C';
const EXPLORER = '#191919';
const WHITE = '#FFFFFF';
const CURSOR = '#FFD93B';

const Line: React.FC<{ text: string; color?: string; size?: number; y?: number; o?: number }> = ({ text, color = WHITE, size = 76, y = 268, o = 1 }) => (
  <div style={{ position: 'absolute', left: 36, right: 36, top: y, textAlign: 'center', fontFamily: KO, fontWeight: 800, fontSize: size, lineHeight: 1.16, letterSpacing: -2, color, opacity: o, whiteSpace: 'pre-line' }}>{text}</div>
);

const Big: React.FC<{ n: string; unit?: string; color: string; size?: number; y?: number; o?: number; scale?: number }> = ({ n, unit = 'GB', color, size = 236, y = 350, o = 1, scale = 1 }) => (
  <div style={{ position: 'absolute', left: 0, right: 0, top: y, textAlign: 'center', fontFamily: KO, fontWeight: 900, fontSize: size, lineHeight: 1, letterSpacing: -8, color, opacity: o, fontVariantNumeric: 'tabular-nums', transform: `scale(${scale})` }}>
    {n}
    <span style={{ fontSize: size * 0.42, letterSpacing: -2, marginLeft: 10 }}>{unit}</span>
  </div>
);

/** 큰 낱말이 쾅 하고 앉는다. */
const Slam: React.FC<{ text: string; a: number; color?: string; size?: number; y: number }> = ({ text, a, color = WHITE, size = 180, y }) => {
  const f = useCurrentFrame();
  if (f < a) return null;
  const p = prog(f, a, 7);
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: y, textAlign: 'center', fontFamily: KO, fontWeight: 900, fontSize: size, lineHeight: 1.05, letterSpacing: -6, color, transform: `scale(${mix(1.5, 1, p)})`, opacity: mix(0.2, 1, p) }}>
      {text}
    </div>
  );
};

const Stamp: React.FC<{ text: string; a: number; x: number; y: number }> = ({ text, a, x, y }) => {
  const f = useCurrentFrame();
  if (f < a) return null;
  const p = prog(f, a, 6);
  return (
    <div style={{ position: 'absolute', left: x, top: y, padding: '10px 34px', border: `10px solid ${RED}`, borderRadius: 18, color: RED, fontFamily: KO, fontWeight: 900, fontSize: 112, letterSpacing: -2, background: 'rgba(8,9,12,0.86)', transform: `rotate(-7deg) scale(${mix(1.8, 1, p)})`, opacity: mix(0.1, 1, p) }}>
      {text}
    </div>
  );
};

/** 원본의 노란 커서: 지나간 줄을 드래그 선택하듯 칠한다. */
const Cursor: React.FC<{ x: number; y: number; o?: number; size?: number }> = ({ x, y, o = 1, size = 76 }) => (
  <div style={{ position: 'absolute', left: x - size / 2, top: y - size / 2, width: size, height: size, borderRadius: size / 2, background: CURSOR, opacity: 0.62 * o, boxShadow: `0 0 0 ${size / 19}px rgba(255,217,59,${0.55 * o})` }} />
);

// ───────────── 1. 무너짐 · 밤 ─────────────
const Opening: React.FC = () => {
  const f = useCurrentFrame();
  const pull = prog(f, 0, B.fall - 6, IN_OUT);
  const wallK = mix(1.48, 1, pull);
  const wallTop = mix(0, 620, pull);
  const shakeRed = f >= B.stop ? Math.sin((f - B.stop) * 2.4) * Math.max(0, 8 - (f - B.stop) * 0.9) : 0;
  return (
    <AbsoluteFill style={{ background: BG }}>
      <Wall beat={{ fall: B.fall, shake: 0, ghost: [B.night, B.real + 2] }} scan={[0, B.fall]} style={{ top: wallTop, transform: `scale(${wallK})`, transformOrigin: '50% 0%' }} />
      {f < B.fall ? <div style={{ position: 'absolute', left: 96, right: 96, top: 236, height: 400, borderRadius: 34, background: 'rgba(8,9,12,0.86)', opacity: 1 - pull }} /> : null}
      {f < B.empty ? (
        <>
          <Line text={f < at('v1', 'AI') ? '전부 쓰레기랍니다' : 'AI 말로는요'} />
          <Big n="53" color={AMBER} />
        </>
      ) : null}
      {f >= B.empty && f < B.night ? (
        <>
          <Line text={f < VO.v2 ? 'AI 말로는요' : '치우는 데 걸린 시간'} />
          {f < VO.v2 ? <Big n="53" color={AMBER} /> : <Big n="1" unit="초" color={AMBER} />}
        </>
      ) : null}
      {f >= B.night ? (
        <>
          <Line text="그날 밤" />
          <div style={{ transform: `translateX(${shakeRed}px)` }}>
            <Slam text="회사 업데이트 멈춤" a={B.stop} color={RED} size={110} y={382} />
          </div>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 1120, textAlign: 'center' }}>
            <span style={{ padding: '14px 34px', borderRadius: 16, background: 'rgba(8,9,12,0.92)', color: WHITE, fontFamily: KO, fontWeight: 800, fontSize: 58 }}>폴더가 있던 자리</span>
          </div>
        </>
      ) : null}
    </AbsoluteFill>
  );
};

// ───────────── 2. 실제 폴더 창 — 짧고 크게 ─────────────
const ROW0 = 82;
const ROWH = 53.75;
const List: React.FC = () => {
  const f = useCurrentFrame();
  const enter = prog(f, B.real, 7);
  const zoom = prog(f, B.real + 9, 11);
  const rows = interpolate(f, [B.days, at('v3', '쓰레기') - 2], [0, 4], clamp);
  const n = Math.floor(rows);
  const s = mix(1, 3, zoom);
  const tx = mix(0, 540 - 3 * 688, zoom);
  const ty = mix(0, 70 - 3 * ROW0, zoom);
  return (
    <AbsoluteFill style={{ background: EXPLORER }}>
      <div style={{ position: 'absolute', left: 0, top: 560, width: 1080, height: 1360, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: mix(70, 0, enter), width: 1080, opacity: enter, transformOrigin: '0 0', transform: `translate(${tx}px, ${ty}px) scale(${s})` }}>
          <Img src={staticFile('real/정리대기_가림.png')} style={{ width: 1080, display: 'block' }} />
          {Array.from({ length: n + 1 }).map((_, i) => (
            <div key={i} style={{ position: 'absolute', left: 566, top: ROW0 + i * ROWH - ROWH * 0.44, width: 244, height: ROWH * 0.9, background: 'rgba(0,120,212,0.42)', opacity: i === n ? rows - n : 1 }} />
          ))}
          <Cursor x={800} y={ROW0 + rows * ROWH} o={prog(f, B.days - 6, 6)} size={26} />
        </div>
      </div>
      <Line text={'PC 정리를 맡겼더니\n사흘 넘게 안 건드린 폴더'} size={72} y={262} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 448, textAlign: 'center', fontFamily: KO, fontWeight: 700, fontSize: 37, color: '#D7DAE0' }}>폴더를 마지막으로 건드린 날 · 정리는 10월 29일</div>
    </AbsoluteFill>
  );
};

// ───────────── 3. 쓰레기 → 왜 → 폴더 하나가 빠지면 ─────────────
const Why: React.FC = () => {
  const f = useCurrentFrame();
  const tag = at('v4', '쓰던');
  const zoomIn = interpolate(f, [at('v3', '쓰레기'), B.gone], [1, 1.9], { ...clamp, easing: IN_OUT });
  return (
    <AbsoluteFill style={{ background: BG }}>
      <div style={{ position: 'absolute', left: 0, top: 620, width: 1080, height: 1300, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1300, transform: `scale(${zoomIn})`, transformOrigin: `${PICK_C[0]}px ${PICK_C[1]}px` }}>
          <Wall beat={{ shake: 0, pick: { at: B.gone, red: B.gone + 5 } }} style={{ top: 0 }} />
        </div>
      </div>
      {f < B.why ? <Stamp text="쓰레기" a={at('v3', '쓰레기')} x={290} y={1090} /> : null}
      {f < VO.v3b ? <Line text={'사흘 넘게 안 건드렸다고\n쓰레기로 본 거예요'} size={72} y={272} /> : f < VO.v4 ? <Line text="왜 멈췄을까요?" size={100} y={340} /> : <Line text={'그 폴더 안에,\n업데이트에 쓰던 파일이 있었어요'} size={62} y={280} />}
      {f >= tag && f < B.gone ? (
        <div style={{ position: 'absolute', left: PICK_C[0] - 150, top: 620 + PICK_C[1] - 62, width: 300, textAlign: 'center', padding: '12px 0', borderRadius: 14, background: 'rgba(8,9,12,0.9)', color: WHITE, fontFamily: KO, fontWeight: 800, fontSize: 58 }}>쓰던 파일</div>
      ) : null}
    </AbsoluteFill>
  );
};

// ───────────── 4. 안 건드렸다 ≠ 안 쓴다 ─────────────
const NotEqual: React.FC = () => (
  <AbsoluteFill style={{ background: BG }}>
    <Slam text="안 건드렸다" a={B.ne1} y={560} size={176} />
    <Slam text="≠" a={B.ne2} y={770} color={RED} size={230} />
    <Slam text="안 쓴다" a={B.ne3} y={1040} size={176} color={GREEN} />
  </AbsoluteFill>
);

// ───────────── 5. 옮겨만 뒀다 — 실제 주소 줄 ─────────────
const Moved: React.FC = () => {
  const f = useCurrentFrame();
  const enter = prog(f, B.moved, 8);
  const drag = prog(f, B.drag, 14);
  // 주소 줄 그림 안 「SYNK_정리대기」 자리(2배로 키운 그림 기준)
  const SX = 1.05;
  const x0 = 796 * SX;
  const w = 300 * SX;
  return (
    <AbsoluteFill style={{ background: EXPLORER }}>
      <Wall beat={{ fall: -200, ghost: [B.moved, B.back0], ghostColor: '255,201,77' }} style={{ top: 1190 }} />
      <Line text={f < VO.v7b ? '지우지는 않았어요\n정리 대기 폴더로' : '어디서 쓰는지 따라가'} size={84} y={290} />
      <div style={{ position: 'absolute', left: -410, top: mix(760, 720, enter), width: 1528 * SX, opacity: enter }}>
        <Img src={staticFile('real/주소줄_가림.png')} style={{ width: 1528 * SX, display: 'block' }} />
        <div style={{ position: 'absolute', left: x0, top: 8, height: 90, width: w * drag, background: 'rgba(0,120,212,0.45)' }} />
        {f >= B.moved + 8 ? <Cursor x={x0 + w * drag} y={52} /> : null}
      </div>
      <Slam text="옮겨만 뒀습니다" a={at('v6', '옮겨만')} size={128} y={960} color={AMBER} />
      <Wall beat={{ base: 'amber' }} style={{ top: mix(1950, 1190, prog(f, at('v6', '옮겨만'), 13)), opacity: 0.92 }} />
    </AbsoluteFill>
  );
};

// ───────────── 6. 되돌림 → 질문 → 6.7 ─────────────
const Back: React.FC = () => {
  const f = useCurrentFrame();
  const alive = at('v7b', '다시');
  const ask = at('v7', '얼마');
  const q = prog(f, ask, 7);
  const pop = prog(f, B.lone, 7);
  return (
    <AbsoluteFill style={{ background: BG }}>
      <Wall beat={{ fall: -200, back: [B.back0, B.back1, B.back2], backLen: [B.back1 - B.back0 - 12, B.back2 - B.back1 + 4, 14], lone: B.lone }} />
      {f < VO.v7 ? (
        <>
          <Line text="어디서 쓰는지 따라가 되돌리니" size={62} y={276} />
          <Slam text="업데이트 다시 돌아감" a={alive} color={GREEN} size={100} y={378} />
        </>
      ) : f < B.lone ? (
        <>
          <Line text={f < VO.v8 ? '그럼 진짜 쓰레기는' : '53GB 중에'} />
          {f >= ask ? <Big n="?" color={AMBER} scale={mix(1.4, 1, q)} /> : null}
        </>
      ) : (
        <>
          <Line text="진짜 쓰레기는" />
          <Big n="6.7" color={AMBER} scale={mix(1.35, 1, pop)} />
        </>
      )}
    </AbsoluteFill>
  );
};

// ───────────── 7. 바로 지웠으면 ─────────────
const IfDeleted: React.FC = () => {
  const f = useCurrentFrame();
  const fade = interpolate(f, [B.ifDel + 10, B.ifDel + 34], [1, 0.05], clamp);
  return (
    <AbsoluteFill style={{ background: BG }}>
      <Wall beat={{ base: 'done', ash: B.ifDel }} style={{ opacity: fade }} />
      <Line text="바로 지웠으면" size={92} y={272} />
      <Slam text="못 살렸습니다" a={at('v9', '못')} color={RED} size={136} y={392} />
    </AbsoluteFill>
  );
};

// ───────────── 8. 끝 — 핵심 장면이 한 번 더 ─────────────
const End: React.FC = () => {
  const f = useCurrentFrame();
  const ok = at('v10', '옮기는');
  const up = prog(f, ok, 6);
  const punch = f >= ok ? mix(1.14, 1, prog(f, ok, 8)) : 1;
  return (
    <AbsoluteFill style={{ background: BG, transform: `scale(${punch})`, transformOrigin: '50% 60%' }}>
      <Wall beat={{ fall: -200, back: [B.end + 10, B.end + 22, B.end + 31], backLen: [20, 13, 9] }} />
      {f < ok ? (
        <Line text={'그래서 이제\nAI한테는'} size={96} y={272} />
      ) : (
        <>
          {/* 끝 말에 위 띠가 초록으로 뒤집힌다 — 원본 끝 카드 자리(27.2초) */}
          <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 620, background: GREEN }} />
          <Line text="그래서 이제 AI한테는" size={62} y={276} color={BG} />
          <Slam text="옮기는 것까지만" a={ok} color={BG} size={118} y={350} />
          <div style={{ position: 'absolute', left: 0, right: 0, top: 510, textAlign: 'center', fontFamily: KO, fontWeight: 700, fontSize: 44, color: '#06331F', opacity: up }}>요청문 전체 · synk.im/prompts</div>
        </>
      )}
    </AbsoluteFill>
  );
};

const Part: React.FC<{ a: number; b: number; children: React.ReactNode }> = ({ a, b, children }) => {
  const f = useCurrentFrame();
  if (f < a || f >= b) return null;
  return <>{children}</>;
};

export const PcFilm: React.FC<{ bgm?: boolean }> = ({ bgm = true }) => {
  // 배경음: 벽이 무너지고 프로그램이 멈추는 순간 끊긴다 → 되돌릴 때 다시 → 바로 지웠으면에 끊긴다 → 끝에 다시.
  const music = (f: number) => {
    const on = (a: number, b: number) => interpolate(f, [a, a + 3, b - 2, b], [0, 1, 1, 0], clamp);
    const gate = Math.max(on(0, B.stop), on(B.back0, B.ifDel), on(B.end + 10, TOTAL));
    const fadeOut = interpolate(f, [TOTAL - 20, TOTAL], [1, 0], clamp);
    return 0.17 * gate * fadeOut * MASTER;
  };
  return (
    <AbsoluteFill style={{ background: BG }}>
      <Part a={0} b={B.real}><Opening /></Part>
      <Part a={B.real} b={at('v3', '쓰레기')}><List /></Part>
      <Part a={at('v3', '쓰레기')} b={B.ne1}><Why /></Part>
      <Part a={B.ne1} b={B.moved}><NotEqual /></Part>
      <Part a={B.moved} b={B.back0}><Moved /></Part>
      <Part a={B.back0} b={B.ifDel}><Back /></Part>
      <Part a={B.ifDel} b={B.end}><IfDeleted /></Part>
      <Part a={B.end} b={TOTAL}><End /></Part>
      {bgm ? <Audio src={staticFile('bgm.wav')} volume={music} /> : null}
      <Audio src={staticFile('sfx/벽_본편.wav')} volume={(f) => (ORDER.some((id) => f >= VO[id] && f < lineEnd(id)) ? 0.34 : 0.78) * MASTER} />
      {(ORDER as Spoken[]).map((id) => (
        <Sequence key={id} from={VO[id]} layout="none">
          <Audio src={staticFile(`vo/${id}.wav`)} volume={MASTER} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

export const CoverStill: React.FC = () => (
  <AbsoluteFill style={{ background: BG }}>
    <Wall beat={{ base: 'done', lone: -30 }} />
    <Line text={'AI가 쓰레기라던 53GB\n진짜 쓰레기는'} size={70} y={262} />
    <Big n="6.7" color={AMBER} size={160} y={438} />
  </AbsoluteFill>
);
