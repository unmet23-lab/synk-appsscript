// yuhobuilds Y25(10-31) 「AI 사진을 밤으로 — '어둡게' 말고 '○○가 유일한 빛'」.
// 원본 Ls0r557jclc(42.5초) 뼈대: 실제 결과 + 이야기 한 문장 → 반전 → 방법 카드 → 실행 빨리 감기 → 결과 표 한 줄 → 새 데이터로 다시 →
// 끝 카드 둘 + 질문. 화면은 제미나이가 실제로 낸 판 그대로이고(public/real), 낮 · 밤 판은 구도가 0.2px 안으로 같아 겹쳐서 쓸어 덮는다.
// 무대는 지난 편들(Y24 회청색 판 · 슬레이트 · 판 없는 큰 자막, Y23 잠금 화면 · 색 판 자막)과 다르게: 화면 전체가 사진, 어두운 둥근 판 자막,
// 호박색 낱말, 끝은 폰 불빛이 꺼지며 암전.
import React from 'react';
import { Audio } from '@remotion/media';
import { AbsoluteFill, Img, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from '../lib/fonts';
import { clamp, IN_OUT, mix, prog as ease } from '../lib/motion';
import { at, B, lineEnd, ORDER, TOTAL, V6, VO } from './time';

const MASTER = 0.8;
const BLACK = '#08090B';
const PLATE = 'rgba(9,10,13,0.82)';
const AMBER = '#FFB648';
const WHITE = '#FFFFFF';
const RED = '#FF5A4E';

/** 빛이 있는 자리(화면 비율). */
const PHONE = { x: 0.555, y: 0.42 };
const CANDLE = { x: 0.917, y: 0.61 };
const HEAD = { x: 0.7, y: 0.545 };
const SHOP = { x: 0.4, y: 0.56 };

const HAS_CLIP = { car: true };
/** 밝기 중앙값(../../자료/밝기.json). */
const LUX = { 밤처럼: 80, 빛: 34 };

// ───────────── 공용 ─────────────
const Photo: React.FC<{ src: string; style?: React.CSSProperties }> = ({ src, style }) => (
  <Img src={staticFile(`real/${src}.jpg`)} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, ...style }} />
);

const Scene: React.FC<{ a: number; b: number; children: React.ReactNode }> = ({ a, b, children }) => {
  const f = useCurrentFrame();
  if (f < a || f >= b) return null;
  return <>{children}</>;
};

/** 어둠이 가장자리에서 빛 쪽으로 조여 들어온다. day 위에 night를 마스크로 덮는다(둘은 구도가 같다). */
const Sweep: React.FC<{ day: string; night: React.ReactNode; light: { x: number; y: number }; from: number; len: number; ease2?: (n: number) => number }> = ({ day, night, light, from, len, ease2 = IN_OUT }) => {
  const f = useCurrentFrame();
  const p = ease(f, from, len, ease2);
  const R = mix(2200, -300, p);
  const m = `radial-gradient(circle at ${light.x * 1080}px ${light.y * 1920}px, transparent ${R}px, black ${R + 300}px)`;
  return (
    <>
      <Photo src={day} />
      <div style={{ position: 'absolute', inset: 0, WebkitMaskImage: m, maskImage: m }}>{night}</div>
    </>
  );
};

/** 사람이 나온 밤 판 — 제미나이가 낸 움직이는 판(10초). from부터 skip초 뒤 자리를 돈다. */
const PersonNight: React.FC<{ from?: number; skip?: number }> = ({ from = 0, skip = 0 }) => (
  <Sequence from={from} layout="none">
    <OffthreadVideo src={staticFile('clip/person.mp4')} muted trimBefore={Math.round(skip * 24)} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920 }} />
  </Sequence>
);

const CafeNight: React.FC<{ from?: number }> = ({ from = 0 }) => (
  <Sequence from={from} layout="none">
    <OffthreadVideo src={staticFile('clip/cafe.mp4')} muted style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920 }} />
  </Sequence>
);

/** 자동차 밤 판 — 움직이는 판이 있으면 그것, 없으면 사진. */
const CarNight: React.FC<{ from?: number; skip?: number }> = ({ from = 0, skip = 0 }) =>
  HAS_CLIP.car ? (
    <Sequence from={from} layout="none">
      <OffthreadVideo src={staticFile('clip/car.mp4')} muted trimBefore={Math.round(skip * 24)} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920 }} />
    </Sequence>
  ) : (
    <Photo src="k_night" />
  );

/** 위쪽 큰 글 판. */
const Head: React.FC<{ a: number; top?: number; size?: number; color?: string; children: React.ReactNode }> = ({ a, top = 300, size = 78, color = WHITE, children }) => {
  const f = useCurrentFrame();
  const p = ease(f, a, 7);
  if (f < a) return null;
  return (
    <div style={{ position: 'absolute', left: 70, width: 850, top, display: 'flex', justifyContent: 'center', opacity: p, transform: `translateY(${mix(14, 0, p)}px)` }}>
      <div style={{ background: PLATE, borderRadius: 26, padding: '16px 34px 20px', fontFamily: KO, fontWeight: 900, fontSize: size, color, letterSpacing: '-0.035em', lineHeight: 1.18, textAlign: 'center', wordBreak: 'keep-all' }}>{children}</div>
    </div>
  );
};

/** 내가 보낸 말(제미나이 채팅 말풍선 꼴). */
const Bubble: React.FC<{ a: number; top?: number; size?: number; children: React.ReactNode }> = ({ a, top = 300, size = 52, children }) => {
  const f = useCurrentFrame();
  const p = ease(f, a, 7);
  if (f < a) return null;
  return (
    <div style={{ position: 'absolute', left: 70, width: 850, top, display: 'flex', justifyContent: 'center', opacity: p, transform: `scale(${mix(0.94, 1, p)})` }}>
      <div style={{ background: 'rgba(38,40,46,0.94)', borderRadius: 40, padding: '24px 40px 26px', fontFamily: KO, fontWeight: 700, fontSize: size, color: WHITE, letterSpacing: '-0.03em', lineHeight: 1.26, wordBreak: 'keep-all', textAlign: 'center' }}>{children}</div>
    </div>
  );
};

/** 사진 위 짚기: 호박색 원 + 작은 판. */
const Ring: React.FC<{ a: number; x: number; y: number; w: number; h: number; label: string; lx?: number; ly?: number }> = ({ a, x, y, w, h, label, lx, ly }) => {
  const f = useCurrentFrame();
  const p = ease(f, a, 9);
  if (f < a) return null;
  return (
    <>
      <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, borderRadius: '50%', border: `8px solid ${AMBER}`, transform: `scale(${mix(1.25, 1, p)})`, opacity: p }} />
      <div style={{ position: 'absolute', left: lx ?? x - 260, top: ly ?? y + h + 18, background: PLATE, borderRadius: 18, padding: '10px 22px 13px', fontFamily: KO, fontWeight: 900, fontSize: 50, color: AMBER, letterSpacing: '-0.03em', opacity: p, whiteSpace: 'nowrap' }}>{label}</div>
    </>
  );
};

// ───────────── 칸 ─────────────
/** 0~6초: 낮 사진이 0.3초부터 헤드라이트 쪽으로 밤이 된다. */
const Hook: React.FC = () => {
  const f = useCurrentFrame();
  // r10: 1~6초 한 구성 5초(올리기 전 검사 ⑬) — 밤이 된 뒤 헤드라이트 쪽으로 성큼 다가가 장면을 바꾼다.
  const z = interpolate(f, [B.hook + 30, B.turn], [1.02, 1.34], { ...clamp, easing: IN_OUT });
  return (
    <AbsoluteFill style={{ transform: `scale(${f < B.hook + 30 ? 1 + 0.0007 * f : z})`, transformOrigin: `${HEAD.x * 100}% ${HEAD.y * 100}%` }}>
      <Sweep day="k_day" night={<CarNight from={B.hook} />} light={HEAD} from={B.hook} len={26} />
    </AbsoluteFill>
  );
};

/** 6~11.9초: 사람 사진 — 「밤처럼 어둡게」는 저녁. */
const Turn: React.FC = () => {
  const f = useCurrentFrame();
  const w = interpolate(f, [B.turn2, B.turn2 + 30], [1080, 0], { ...clamp, easing: IN_OUT });
  const zoom = 1 + 0.00055 * Math.max(0, f - B.turn2);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: `scale(${zoom})`, transformOrigin: '86% 36%' }}>
        <Photo src="p_ev" />
        <div style={{ position: 'absolute', left: 0, top: 0, width: w, height: 1920, overflow: 'hidden' }}>
          <Photo src="p_day" />
        </div>
        {w > 0 && w < 1080 ? <div style={{ position: 'absolute', left: w - 3, top: 0, width: 6, height: 1920, background: WHITE, opacity: 0.85 }} /> : null}
      </AbsoluteFill>
      <Bubble a={B.turn + 2}>이 사진을 밤처럼 어둡게 해 줘. …</Bubble>
      {/* r10: 원이 소매를 짚었다(r9 볼 이유 심사) — 저녁 판 80 · 밤 판 34가 가장 크게 갈리는 왼쪽 벽으로. Run도 같은 자리. */}
      <Ring a={B.turn2 + 26} x={14} y={410} w={300} h={290} label="방이 아직 환해요" lx={70} ly={716} />
    </AbsoluteFill>
  );
};

/** 11.9~17.8초: 방법 — 그 사진을 눌러 폰만 남기고, 그 위에 바꾼 말. 그다음 실제 화면 한 컷(글이 읽히게 크게). */
const Method: React.FC = () => {
  const f = useCurrentFrame();
  const strike = ease(f, B.method + 2, 8);
  const real = at('v3', '휴대폰');
  const realP = ease(f, real + 34, 8);
  const a1 = ease(f, B.chip1, 7);
  const a2 = ease(f, B.chip2, 7);
  const dark = ease(f, B.method, 10);
  return (
    <AbsoluteFill style={{ background: BLACK }}>
      <Photo src="p_ev" />
      <div style={{ position: 'absolute', inset: 0, opacity: dark, background: 'rgba(0,0,0,0.42)' }} />
      <div style={{ position: 'absolute', left: 70, width: 850, top: 300, display: 'flex', justifyContent: 'center' }}>
        <div style={{ position: 'relative', background: 'rgba(38,40,46,0.94)', borderRadius: 40, padding: '24px 40px 26px', fontFamily: KO, fontWeight: 700, fontSize: 52, color: 'rgba(255,255,255,0.8)', letterSpacing: '-0.03em' }}>
          이 사진을 밤처럼 어둡게 해 줘. …
          <div style={{ position: 'absolute', left: 190, top: '50%', height: 10, width: `${strike * 290}px`, background: RED, borderRadius: 5 }} />
        </div>
      </div>
      <div style={{ position: 'absolute', left: 70, width: 850, top: 930, textAlign: 'center', fontFamily: KO, fontWeight: 900, letterSpacing: '-0.035em' }}>
        <div style={{ display: 'inline-block', background: PLATE, borderRadius: 26, padding: '14px 34px 20px', fontSize: 84, color: AMBER, lineHeight: 1.18, opacity: a1, transform: `translateY(${mix(18, 0, a1)}px)` }}>
          휴대폰 화면이
          <br />
          유일한 빛
        </div>
        <div style={{ marginTop: 18 }}>
          <div style={{ display: 'inline-block', background: PLATE, borderRadius: 22, padding: '10px 28px 14px', fontSize: 54, color: WHITE, opacity: a2, transform: `translateY(${mix(18, 0, a2)}px)` }}>그 밖은 거의 검은 형체로</div>
        </div>
      </div>
      {realP > 0 ? (
        <div style={{ position: 'absolute', left: 30, top: 250, width: 1020, height: 300, borderRadius: 24, overflow: 'hidden', background: BLACK, opacity: realP, boxShadow: `0 0 0 4px ${AMBER}` }}>
          <Img src={staticFile('real/screen.png')} style={{ position: 'absolute', left: -975, top: -320, width: 2500 }} />
          <div style={{ position: 'absolute', left: 30, top: 26, fontFamily: KO, fontWeight: 900, fontSize: 50, color: AMBER }}>제가 실제로 보낸 말</div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

/** 17.8~23.2초: 저녁 판 그대로 전체 구도 — 말에 맞춰 한 번에 꺼지듯 밤으로, 창에 표시(r6 심사관 「결과가 화면 밖이라 보상이 김빠진다」 · 창은 푸른빛이 남아 방을 짚는다 — 사실 검수). */
const Run: React.FC = () => {
  const f = useCurrentFrame();
  const snap = at('v4', '방') - 3;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: `scale(${1 + 0.0004 * (f - B.run)})`, transformOrigin: `${PHONE.x * 100}% ${PHONE.y * 100}%` }}>
        <Sweep day="p_ev" night={<PersonNight from={snap} />} light={PHONE} from={snap} len={9} />
      </AbsoluteFill>
      <Ring a={snap + 30} x={14} y={410} w={300} h={290} label="방이 어두워졌어요" lx={70} ly={716} />
    </AbsoluteFill>
  );
};

/** 23.2~27.4초: 작은 표 대신 두 판을 화면 가득 — 경계가 왼쪽에서 들어와 가운데 선다. */
const Table: React.FC = () => {
  const f = useCurrentFrame();
  const x = interpolate(f, [B.table, B.table + 22], [1080, 540], { ...clamp, easing: IN_OUT });
  const p2 = ease(f, at('v5', String(LUX.빛)), 8);
  // r10: 「사진 밝기(0 검정 · 255 흰색)」가 무엇을 재는지 시험관 셋이 다 짚었다 — 숫자 밑에 검정→흰색 막대를 깔고 그 숫자 자리에 눈금.
  // 판은 무릎 쪽(얼굴 · 폰을 가리지 않게, 위 머리 자리 269px 아래 — 올리기 전 검사).
  const num = (val: number, sub: string, left: number, on: number, amber: boolean) => (
    <div style={{ position: 'absolute', left, width: 460, top: 1030, textAlign: 'center', opacity: on }}>
      <div style={{ display: 'inline-block', background: PLATE, borderRadius: 24, padding: '12px 30px 18px', fontFamily: KO, fontWeight: 900, color: amber ? AMBER : WHITE, letterSpacing: '-0.03em' }}>
        <div style={{ fontSize: 40 }}>{sub}</div>
        <div style={{ fontSize: 128, lineHeight: 1.08 }}>{val}</div>
        <div style={{ position: 'relative', width: 300, height: 30, marginTop: 10, borderRadius: 8, background: 'linear-gradient(90deg, #000 0%, #fff 100%)', boxShadow: '0 0 0 2px rgba(255,255,255,0.55)' }}>
          <div style={{ position: 'absolute', left: (val / 255) * 300 - 5, top: -12, width: 10, height: 54, borderRadius: 5, background: amber ? AMBER : RED, boxShadow: '0 0 0 3px rgba(0,0,0,0.7)' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: 300, marginTop: 8, fontSize: 32, fontWeight: 800, color: 'rgba(255,255,255,0.85)' }}>
          <span>검정</span>
          <span>흰색</span>
        </div>
      </div>
    </div>
  );
  return (
    <AbsoluteFill style={{ background: BLACK }}>
      <Photo src="p_night" />
      <div style={{ position: 'absolute', left: 0, top: 0, width: x, height: 1920, overflow: 'hidden' }}>
        <Photo src="p_ev" />
      </div>
      <div style={{ position: 'absolute', left: x - 3, top: 0, width: 6, height: 1920, background: WHITE, opacity: 0.9 }} />
      <div style={{ position: 'absolute', left: 0, top: 955, width: 1080, textAlign: 'center' }}>
        <span style={{ display: 'inline-block', background: PLATE, borderRadius: 18, padding: '6px 22px 10px', fontFamily: KO, fontWeight: 800, fontSize: 46, color: WHITE, letterSpacing: '-0.03em' }}>사진 전체 밝기</span>
      </div>
      {num(LUX.밤처럼, '밤처럼', 60, ease(f, at('v5', String(LUX.밤처럼)), 8), false)}
      {num(LUX.빛, '유일한 빛', 520, p2, true)}
    </AbsoluteFill>
  );
};

/** 27.4~35.4초: 새 사진 셋 — 낮을 먼저 보이고 말에 맞춰 화면 가득 밤으로. 마지막 차는 끝 칸까지 이어진다. */
const Word: React.FC<{ a: number; children: React.ReactNode }> = ({ a, children }) => (
  <Head a={a} top={290} size={70} color={AMBER}>
    {children}
  </Head>
);
const Again: React.FC = () => {
  const f = useCurrentFrame();
  if (f < B.again1)
    return (
      <AbsoluteFill>
        <Sweep day="c_day" night={<CafeNight from={B.again} />} light={CANDLE} from={B.again + 3} len={18} />
        <Word a={B.again}>초가 유일한 빛</Word>
      </AbsoluteFill>
    );
  if (f < B.again2)
    return (
      <AbsoluteFill>
        <Sweep day="f_day" night={<Photo src="f_night" />} light={SHOP} from={B.again1 + 6} len={18} />
        <Word a={B.again1}>가게 전구가 유일한 빛</Word>
      </AbsoluteFill>
    );
  return (
    <AbsoluteFill style={{ transform: `scale(${1 + 0.0005 * (f - B.again2)})`, transformOrigin: `${HEAD.x * 100}% ${HEAD.y * 100}%` }}>
      <Sweep day="k_day" night={<CarNight from={B.again2} skip={2} />} light={HEAD} from={B.again2 + 6} len={18} />
      <Word a={B.again2}>헤드라이트가 유일한 빛</Word>
    </AbsoluteFill>
  );
};

/** 35.4초~끝: 앞 칸의 그 차가 그대로 — 끝 카드 둘 + 질문, 헤드라이트 쪽으로 다가가다 불이 꺼진다. */
const End: React.FC = () => {
  const f = useCurrentFrame();
  const off = ease(f, B.off, 10, IN_OUT);
  const zoom = 1 + 0.0005 * (B.end - B.again2) + 0.0016 * (f - B.end);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: `scale(${zoom})`, transformOrigin: `${HEAD.x * 100}% ${HEAD.y * 100}%` }}>
        <CarNight from={B.again2} skip={2} />
      </AbsoluteFill>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.34)', opacity: ease(f, B.end, 6) * (1 - ease(f, B.end2 + 60, 30, IN_OUT)) }} />
      <Head a={B.end1} top={270} size={84} color={AMBER}>
        뭐가 빛인지 말해 주기
      </Head>
      <Head a={B.end2} top={430} size={52}>
        대신 먼 풍경은 어둠에 묻혀요
      </Head>
      <div style={{ position: 'absolute', left: 0, top: 1800, width: 1080, textAlign: 'center', fontFamily: KO, fontWeight: 700, fontSize: 34, color: 'rgba(255,255,255,0.72)' }}>@yuhobuilds</div>
      <div style={{ position: 'absolute', inset: 0, background: '#000', opacity: off }} />
    </AbsoluteFill>
  );
};

// ───────────── 자막 ─────────────
const KEY = ['밤이', '밤처럼', '어둡게', '유일한', '빛', `${LUX.밤처럼}`, `${LUX.빛}`, '저녁이', '절반도'];
// 원본 아래 고정 자막창처럼 칸마다 그 칸 말을 한 번에 — 덩어리로 끊어 갈면 자막 바뀜이 박자로 잡혀 칸이 30이 됐다(r1).
// 큰 글이 같은 말을 하는 자리(방법 칩 · 사진 이름 · 끝 카드)는 자막을 비워 사진을 가리지 않는다(r3 뒤).
const CELLS: { a: number; b: number; text: string }[] = [
  // r10: 세 줄이면 아래 앱 글자 자리(1428px)를 넘는다 — 말의 앞 두 마디만(「보정은…」은 시험관 둘이 낯설다고 짚은 말이라 화면에서 뺀다).
  { a: 0, b: B.turn, text: '낮 사진이 밤이 됐어요. AI한테 뭐가 빛인지 정해 줬더니요.' },
  { a: B.turn, b: B.method, text: '이 사진은 밤처럼 어둡게 해 달라고 했더니, 밤이 아니라 저녁이 나왔어요. 방이 아직 환하죠.' },
  { a: B.method, b: B.run, text: '그래서 어둡게란 말을 빼고, 빛을 정해 줬어요.' },
  { a: B.run, b: B.table, text: '그랬더니 방 전체가 어두워지고, 얼굴에는 폰 불빛만 남았어요.' },
  { a: B.table, b: B.more, text: `밝기를 재 보니, 밤처럼은 ${LUX.밤처럼}, 빛을 정한 사진은 ${LUX.빛}. 절반도 안 돼요.` },
  { a: B.more, b: B.again, text: '다른 사진도 해 봤어요.' },
  { a: B.again2 + 34, b: B.end, text: '빛을 정하니까, 전부 밤이 됐어요.' },
  { a: at('v7', '여러분'), b: B.off + 12, text: '여러분 사진엔, 뭐가 빛이 될까요?' },
];
const Caption: React.FC = () => {
  const f = useCurrentFrame();
  const c = CELLS.find((x) => f >= x.a && f < x.b);
  if (!c) return null;
  const ws = c.text.split(' ');
  return (
    <div style={{ position: 'absolute', left: 70, width: 850, top: 1340, display: 'flex', justifyContent: 'center' }}>
      <div style={{ background: PLATE, borderRadius: 24, padding: '16px 28px 20px', textAlign: 'center', fontFamily: KO, fontWeight: 800, fontSize: 50, lineHeight: 1.26, letterSpacing: '-0.03em', wordBreak: 'keep-all', color: WHITE }}>
        {ws.map((w, k) => (
          <span key={k} style={{ color: KEY.some((x) => w.includes(x)) ? AMBER : WHITE }}>
            {w}
            {k < ws.length - 1 ? ' ' : ''}
          </span>
        ))}
      </div>
    </div>
  );
};

// ───────────── 소리 ─────────────
type Hit = { at: number; src: string; v: number };
const HITS: Hit[] = [
  { at: B.hook, src: 'sfx/swish.wav', v: 0.16 },
  { at: B.hook + 24, src: 'sfx/thud.wav', v: 0.24 },
  { at: B.turn, src: 'sfx/tok.wav', v: 0.16 },
  { at: B.turn2, src: 'sfx/swish.wav', v: 0.1 },
  { at: B.method, src: 'sfx/snap.wav', v: 0.14 },
  { at: B.chip1, src: 'sfx/tok.wav', v: 0.14 },
  { at: B.chip2, src: 'sfx/tok.wav', v: 0.12 },
    { at: at('v4', '방'), src: 'sfx/thud.wav', v: 0.24 },
  { at: B.table, src: 'sfx/swish.wav', v: 0.12 },
  { at: B.more, src: 'sfx/tick2.wav', v: 0.14 },
  { at: B.again + 15, src: 'sfx/thud.wav', v: 0.16 },
  { at: B.again1 + 18, src: 'sfx/thud.wav', v: 0.16 },
  { at: B.again2 + 18, src: 'sfx/thud.wav', v: 0.2 },
  { at: B.end2, src: 'sfx/tick.wav', v: 0.12 },
  { at: B.off, src: 'sfx/tok.wav', v: 0.22 },
];

// ───────────── 본편 ─────────────
export const LightFilm: React.FC<{ bgm?: boolean }> = ({ bgm = true }) => {
  const voice = [...ORDER.filter((id) => id !== 'v6').map((id) => [VO[id], lineEnd(id)] as [number, number]), [VO.v6, B.end] as [number, number]];
  const bgmVolume = (fr: number) => {
    const tail = Math.min(1, (TOTAL - fr) / 15);
    const v = Math.max(0, ...voice.map(([a, b]) => interpolate(fr, [a - 10, a, b, b + 10], [0, 1, 1, 0], clamp)));
    return (0.34 - 0.14 * v) * tail * MASTER;
  };
  return (
    <AbsoluteFill style={{ background: BLACK }}>
      <Scene a={0} b={B.turn}>
        <Hook />
      </Scene>
      <Scene a={B.turn} b={B.method}>
        <Turn />
      </Scene>
      <Scene a={B.method} b={B.run}>
        <Method />
      </Scene>
      <Scene a={B.run} b={B.table}>
        <Run />
      </Scene>
      <Scene a={B.table} b={B.more}>
        <Table />
      </Scene>
      <Scene a={B.more} b={B.end}>
        <Again />
      </Scene>
      <Scene a={B.end} b={TOTAL}>
        <End />
      </Scene>
      <Caption />
      {ORDER.filter((id) => id !== 'v6').map((id) => (
        <Sequence key={id} from={VO[id]} layout="none">
          <Audio src={staticFile(`vo/${id}.wav`)} volume={MASTER} />
        </Sequence>
      ))}
      {V6.map((x) => (
        <Sequence key={x.src} from={x.at} layout="none">
          <Audio src={staticFile(x.src)} volume={MASTER} />
        </Sequence>
      ))}
      {HITS.map((x, i) => (
        <Sequence key={i} from={x.at} durationInFrames={60} layout="none">
          <Audio src={staticFile(x.src)} volume={x.v * MASTER} />
        </Sequence>
      ))}
      {bgm ? <Audio src={staticFile('bgm.wav')} volume={bgmVolume} /> : null}
    </AbsoluteFill>
  );
};

/** 표지: 낮 · 밤 반반 + 머리글. */
export const CoverStill: React.FC = () => (
  <AbsoluteFill style={{ background: BLACK }}>
    <Photo src="k_night" />
    <div style={{ position: 'absolute', left: 0, top: 0, width: 470, height: 1920, overflow: 'hidden' }}>
      <Photo src="k_day" />
    </div>
    <div style={{ position: 'absolute', left: 467, top: 0, width: 6, height: 1920, background: WHITE, opacity: 0.85 }} />
    <div style={{ position: 'absolute', left: 70, width: 850, top: 1150, display: 'flex', justifyContent: 'center' }}>
      <div style={{ background: PLATE, borderRadius: 26, padding: '18px 36px 24px', fontFamily: KO, fontWeight: 900, fontSize: 76, color: WHITE, letterSpacing: '-0.035em', lineHeight: 1.2, textAlign: 'center' }}>
        낮 사진이 밤으로
        <br />
        <span style={{ color: AMBER }}>빛을 정해서</span>
      </div>
    </div>
  </AbsoluteFill>
);
