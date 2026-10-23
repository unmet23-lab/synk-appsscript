// 본편(「'보고서 써 줘'만 하면 지어냅니다 — 메모 붙이기 전후」): 청금석 무대 위 실제 ChatGPT 화면 카드 하나.
// 마디 셋 — A(메모 없이: 훅 · 전) → B(메모 붙여서: 준비 · 후) → C(전후 나란히: 정리 · 끝). 마디 사이만 위로 밀기, 마디 안은 화면이 이어진다.
// 소리: 배경음(본편 + 곡 끝맺음) + 사건마다 효과음 하나 + 내레이션(범수). 말하는 동안 배경음을 낮춘다(지난 편 값).
import { Audio } from '@remotion/media';
import React from 'react';
import { AbsoluteFill, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { clamp } from '../lib/anim';
import { C, F, L } from '../theme';
import { Lines, MarkF, Stage, Whip } from '../v5/cine';
import { CARD, camAt, Chip, Cross, FR, Key as CamKey, Mark, pickGen, Ring, Screen, Spot } from './screen';
import { at, CUT, TAIL, TOTAL } from './time';
import { CLIPS, clipAt, clipEnd, wf } from './vo-time';

export { TOTAL };
type Variant = 'A' | 'B';

// ── 시각(영상 프레임) ─────────────────────────────────────────
const T_BEFORE = at('before');
const T_SETUP = at('setup');
const T_AFTER = at('after');
const T_SUM = at('sum');
const T_END = at('end');
const A_TALL = T_BEFORE - 8; // 다 쓴 답(긴 화면)으로 넘어가는 프레임
const W_GIFT = wf('v02', '사은품');
const W_BUDGET = wf('v02', '예산', 1.2);
const W_200 = wf('v02', '이백만', 1.6);
const W_MEMO = wf('v03', '메모를', 0.6);
const W_SAME = wf('v03', '똑같이', 1.6);
const B_SEND = clipEnd('v03') - 4; // 보내기
const B_TALL = clipAt('v04') - 18; // 메모를 붙인 답(긴 화면) — 「예산은」 전에 확대가 끝나게
const W_BUD2 = wf('v04', '예산은');
const W_PROG = wf('v04', '프로그램은', 1.8);

// ── 녹화 좌표(이미지 픽셀, ../화면/ 눈금으로 잼) ─────────────────
const A_H = FR.A.tall[1];
const B_H = FR.B.tall[1];
const BUBBLE_A = { cx: 360, cy: 267 }; // 메모 없이 친 말풍선(창 y=0 기준) 왼쪽
const GIFT = { x: 82, y: 5098, w: 184, h: 38, padX: 30 }; // 예산 표 「고객 사은품」(글자 픽셀로 잼) — 사은품 · 200만 원을 한 화면에서(이해 시험 v1 「빠르게 스크롤돼 읽을 수 없다」)
const TOTAL200 = { x: 866, y: 5546, w: 142, h: 38, padX: 30 }; // 「200만 원」(글자 픽셀로 잼, 오른쪽 끝이라 테를 좁게)
const MEMO_INPUT = { x: 76, y: 612, w: 640, h: 268 }; // 입력 칸 속 메모 네 줄(입력 창 기준)
const MEMO_BUBBLE = { x: 428, y: 244, w: 594, h: 250 }; // 보낸 말풍선 속 메모 네 줄(창 y=0 기준)
const BUD2 = { x: 138, y: 2062, w: 480, h: 62 }; // 「행사 예산: 팀장 확인 예정」
const PROG = { x: 138, y: 2126, w: 620, h: 62 }; // 「세부 프로그램 및 참석 규모: 미정」

const SOURCE = '실제 ChatGPT 화면 · 임시 채팅 · 2026.10.24 · 같은 질문도 매번 답이 달라요';

/** 카드 아래 출처 줄 */
const Source: React.FC<{ top: number }> = ({ top }) => (
  <p style={{ position: 'absolute', left: CARD.x + 6, right: 1080 - CARD.x - CARD.w, top, margin: 0, font: `500 24px/1.35 ${F.ko}`, color: 'rgba(255,255,255,.84)', letterSpacing: '-.01em' }}>{SOURCE}</p>
);

/** 머리 큰 글 두 줄 */
// 위 끝 272 — 키트 cover916 위 안전선 269 아래(올리기 전 검사 ⑤ 「위 머리 자리」)
const Head: React.FC<{ lines: React.ReactNode[]; zero?: boolean }> = ({ lines, zero }) => <Lines lines={lines} at={0} size={66} top={272} visibleAtZero={zero} />;
const M: React.FC<{ children: React.ReactNode; at: number }> = ({ children, at: a }) => {
  const f = useCurrentFrame();
  return <MarkF p={interpolate(f, [a, a + 10], [0, 1], clamp)}>{children}</MarkF>;
};

// ── 마디 A: 메모 없이 ─────────────────────────────────────────
const SegA: React.FC = () => {
  const f = useCurrentFrame();
  if (f < A_TALL) {
    // 0~18프레임은 보고서가 막 시작된 프레임에 머물고, 그 뒤 녹화를 빨리 감는다(끝 프레임이 A_TALL 직전에 오게).
    const first = FR.A.gen.findIndex((g) => g.ms >= 2200);
    const fromMs = FR.A.gen[first].ms;
    const lastMs = FR.A.gen[FR.A.gen.length - 1].ms;
    const hold = 18;
    const speed = (lastMs - fromMs) / 1000 / ((A_TALL - 2 - hold) / 30);
    const g = f < hold ? FR.A.gen[first] : pickGen('A', f, hold, speed, fromMs);
    return (
      <>
        <Screen src={`screen/A/${g.f}`} imgH={1320} cam={{ cx: 540, cy: 700, z: 1 }}>
          <Cross cx={BUBBLE_A.cx} cy={BUBBLE_A.cy - g.y} size={120} at={-10} />
        </Screen>
        <Chip text="ChatGPT 실제 화면 · 빨리 감기" on={-6} off={A_TALL} />
      </>
    );
  }
  // 예산 표 한 화면에 머문다: 「5. 소요 예산」부터 「※ 상기 예산은 예시」 줄까지 가로로 다 보이게 1.08배(Fable 콘티 검수 — 잘리면 P1)
  const keys: CamKey[] = [
    { f: A_TALL, cam: { cx: 540, cy: 5000, z: 1 } },
    { f: A_TALL + 14, cam: { cx: 540, cy: 5346, z: 1.08 } },
  ];
  return (
    <>
      <Screen src="screen/A/전체.jpg" imgH={A_H} cam={camAt(f, keys, 0.2)}>
        {/* 「고객 사은품」 줄 · 「합계 200만 원」 줄 · 「※ 상기 예산은 예시」 두 줄만 밝게 */}
        <Spot bands={[[5084, 5150], [5530, 5600], [5696, 5826]]} imgH={A_H} at={W_GIFT - 2} />
        <Ring {...GIFT} at={W_GIFT} id="gift" />
        <Ring {...TOTAL200} at={W_200} id="t200" />
      </Screen>
      <Chip text="ChatGPT 실제 화면" on={A_TALL} off={T_SETUP} />
    </>
  );
};

// ── 마디 B: 메모 붙여서 (시퀀스 안 프레임 lf = 영상 프레임 − OFF_B) ─────
const OFF_B = T_SETUP - 12;
const SegB: React.FC = () => {
  const lf = useCurrentFrame();
  const f = lf + OFF_B;
  const typ = FR.B.typing;
  if (f < B_SEND) {
    // 메모를 붙인 입력 칸 → 「똑같이」에 맞춰 같은 한 줄을 친다(녹화 속도 그대로, 두 글자씩 찍힌 프레임)
    const pre = typ.find((t) => t.tag === 'pre')!;
    const typed = typ.filter((t) => t.tag === 'type' || t.tag === 'typed');
    const typeStart = Math.max(W_SAME - 10, OFF_B + 14);
    const ms = pre.ms + Math.max(0, ((f - typeStart) / 30) * 1000);
    let t = pre;
    if (f >= typeStart) for (const x of typed) if (x.ms <= ms) t = x;
    return (
      <>
        <Screen src={`screen/B/${t.f}`} imgH={1320} cam={{ cx: 441, cy: 800, z: 1.4 }}>
          <Mark {...MEMO_INPUT} at={W_MEMO - OFF_B} />
        </Screen>
        <Chip text="ChatGPT 실제 화면" on={0} off={B_SEND - OFF_B} />
      </>
    );
  }
  if (f < B_TALL) {
    // 보낸 뒤: 녹화를 빨리 감아 다 쓴 데까지
    const fromMs = FR.B.gen[0].ms;
    const lastMs = FR.B.gen[FR.B.gen.length - 1].ms;
    const speed = (lastMs - fromMs) / 1000 / ((B_TALL - B_SEND - 1) / 30);
    const g = pickGen('B', f, B_SEND, speed, fromMs);
    return (
      <>
        <Screen src={`screen/B/${g.f}`} imgH={1320} cam={{ cx: 540, cy: 700, z: 1 }}>
          <Mark {...MEMO_BUBBLE} y={MEMO_BUBBLE.y - g.y} at={B_SEND - OFF_B} />
        </Screen>
        <Chip text="ChatGPT 실제 화면 · 빨리 감기" on={B_SEND - OFF_B} off={B_TALL - OFF_B} />
      </>
    );
  }
  const keys: CamKey[] = [
    { f: B_TALL, cam: { cx: 540, cy: 1950, z: 1 } },
    { f: clipAt('v04') - 2, cam: { cx: 445, cy: 2110, z: 1.3 } }, // 글머리 점까지 보이게 왼쪽 30px부터
  ];
  return (
    <>
      <Screen src="screen/B/전체.jpg" imgH={B_H} cam={camAt(f, keys, 0.2)}>
        <Spot bands={[[2046, 2196]]} imgH={B_H} at={W_BUD2 - OFF_B - 2} />
        <Mark {...BUD2} at={W_BUD2 - OFF_B} />
        <Mark {...PROG} at={W_PROG - OFF_B} />
      </Screen>
      <Chip text="ChatGPT 실제 화면" on={B_TALL - OFF_B} off={T_SUM - OFF_B} />
    </>
  );
};

// ── 마디 C: 시키는 법 나란히(한 줄만 ✕ / 메모 붙이고 ✓) — 이해 시험 v1 「메모를 어떻게 붙이는지 모르겠다」 ──
// 화면 안을 천천히 당겨 멈춘 화면이 되지 않게 한다(카드 자리는 그대로라 안전선을 넘지 않는다).
const OFF_C = T_SUM - 12;
const BOX1 = { x: CARD.x, y: 520, w: CARD.w, h: 210 };
const BOX2 = { x: CARD.x, y: 820, w: CARD.w, h: 520 };
const Tag: React.FC<{ top: number; good?: boolean; text: string; at: number; off: number }> = ({ top, good, text, at: a, off }) => {
  const f = useCurrentFrame() + off;
  const o = interpolate(f, [a, a + 6], [0, 1], clamp);
  return (
    <div style={{ position: 'absolute', left: CARD.x + 4, top, display: 'flex', alignItems: 'center', gap: 14, opacity: o, font: `760 34px/1 ${F.ko}`, color: '#fff' }}>
      <span style={{ display: 'grid', placeItems: 'center', width: 46, height: 46, borderRadius: 23, background: good ? C.mark : C.crayon, color: good ? C.ink : '#fff', font: `800 28px/1 ${F.ko}` }}>{good ? '✓' : '✕'}</span>
      {text}
    </div>
  );
};
const SegC: React.FC = () => {
  const f = useCurrentFrame() + OFF_C;
  const lift = interpolate(f, [T_SUM, T_SUM + 20], [40, 0], clamp);
  const o2 = interpolate(f, [T_SUM + 8, T_SUM + 16], [0, 1], clamp);
  const p = interpolate(f, [T_SUM, T_END], [0, 1], clamp);
  return (
    <>
      <Tag top={BOX1.y - 58} text="한 줄만 시키면" at={T_SUM} off={OFF_C} />
      <Screen src={`screen/A/${FR.A.gen[4].f}`} imgH={1320} cam={{ cx: 648, cy: 267, z: 1.25 + 0.13 * p }} box={{ ...BOX1, y: BOX1.y + lift }} radius={30}>
        <Cross cx={BUBBLE_A.cx} cy={BUBBLE_A.cy} size={110} at={T_SUM + 4 - OFF_C} />
      </Screen>
      <Tag top={BOX2.y - 58} good text="메모 붙이고 같은 한 줄" at={T_SUM + 8} off={OFF_C} />
      <div style={{ opacity: o2 }}>
        <Screen src={`screen/B/${FR.B.typing[FR.B.typing.length - 1].f}`} imgH={1320} cam={{ cx: 470, cy: 820, z: 1.14 + 0.14 * p }} box={{ ...BOX2, y: BOX2.y + lift }} radius={30}>
          <Mark {...MEMO_INPUT} at={T_SUM + 12 - OFF_C} />
        </Screen>
      </div>
      <Source top={BOX2.y + BOX2.h + 12} />
    </>
  );
};

// ── 마디 D: 끝 — 지어낸 예산 표를 다시 띄우고 질문 · 요청문 있는 곳 · 로고 ─────
// 카메라는 처음부터 끝까지 「※ 상기 예산은 예시」 두 줄(5710~5811)이 다 보이는 자리에서만 움직인다.
const OFF_D = T_END - 12;
const BOX_END = { x: CARD.x, y: 470, w: CARD.w, h: 720 };
const SegD: React.FC<{ variant: Variant }> = ({ variant }) => {
  const f = useCurrentFrame() + OFF_D;
  // 같은 빠르기로 끝 0.6초 전까지(v6은 끝에서 느려져 2.5초가 멈춘 화면으로 잡혔다)
  const p = interpolate(f, [T_END, TOTAL - 18], [0, 1], clamp);
  const o = interpolate(f, [T_END + 10, T_END + 18], [0, 1], clamp);
  return (
    <>
      <Screen src="screen/A/전체.jpg" imgH={A_H} cam={{ cx: 540, cy: 5400 + 40 * p, z: 1 + 0.1 * p }} box={BOX_END} radius={30}>
        <Spot bands={[[5084, 5150], [5530, 5600], [5696, 5826]]} imgH={A_H} at={T_END + 2 - OFF_D} />
        <Ring {...GIFT} padX={26} at={T_END + 4 - OFF_D} id="egift" />
        <Ring {...TOTAL200} padX={16} at={T_END + 8 - OFF_D} id="e200" />
      </Screen>
      <div style={{ position: 'absolute', left: CARD.x + 4, top: BOX_END.y + BOX_END.h + 30, opacity: o }}>
        <div style={{ font: `600 30px/1.25 ${F.ko}`, color: '#fff' }}>그대로 붙여 쓸 요청문은 {variant === 'A' ? '캡션에' : '고정 댓글에'} 있어요</div>
        <Img src={staticFile('kit/logo-shift.webp')} style={{ height: 40, marginTop: 18, display: 'block' }} />
      </div>
      <Source top={1352} />
    </>
  );
};

// ── 머리 큰 글(장면마다) ───────────────────────────────────────
const HEADS: { from: number; to: number; el: React.ReactNode }[] = [
  { from: 0, to: T_BEFORE, el: <Head zero lines={['“보고서 써 줘”만 하면', <>없는 내용을 <M at={wf('v01', '지어냅니다.', 3.4)}>지어냅니다</M></>]} /> },
  { from: T_BEFORE, to: T_SETUP - 6, el: <Head lines={['말한 적 없는', <><M at={W_GIFT - T_BEFORE}>사은품</M> · <M at={W_200 - T_BEFORE}>예산 200만 원</M></>]} /> },
  { from: T_SETUP, to: T_AFTER, el: <Head lines={['회의 메모를 붙여서', <M at={W_SAME - T_SETUP}>똑같이</M>]} /> },
  { from: T_AFTER, to: T_SUM - 6, el: <Head lines={[<>예산 <M at={W_BUD2 - T_AFTER}>“팀장 확인 예정”</M></>, <>프로그램 <M at={W_PROG - T_AFTER}>“미정”</M></>]} /> },
  { from: T_SUM, to: T_END, el: <Head lines={['“써 줘” 전에', <><M at={wf('v05', '메모부터', 2) - T_SUM}>메모부터</M> 붙이세요</>]} /> },
  { from: T_END, to: TOTAL, el: <Head lines={['AI가 지어낸 거,', '그대로 낸 적 있으세요?']} /> },
];

// ── 소리 ─────────────────────────────────────────────────────
type Hit = { at: number; src: string; v: number };
const hits = (): Hit[] => [
  { at: 1, src: 'sfx/thud.wav', v: 0.42 },
  { at: A_TALL, src: 'sfx/swish.wav', v: 0.34 },
  { at: W_GIFT, src: 'sfx/snap.wav', v: 0.32 },
  { at: Math.max(W_200, W_BUDGET + 14), src: 'sfx/snap.wav', v: 0.32 },
  { at: T_SETUP - 10, src: 'sfx/swish.wav', v: 0.5 },
  { at: W_MEMO, src: 'sfx/pop.wav', v: 0.28 },
  { at: B_SEND, src: 'sfx/tok.wav', v: 0.34 },
  { at: B_TALL, src: 'sfx/swish.wav', v: 0.3 },
  { at: W_BUD2, src: 'sfx/pop.wav', v: 0.3 },
  { at: W_PROG, src: 'sfx/pop.wav', v: 0.3 },
  { at: T_SUM - 10, src: 'sfx/swish.wav', v: 0.5 },
  { at: T_SUM + 4, src: 'sfx/snap.wav', v: 0.28 },
  { at: T_SUM + 12, src: 'sfx/earn.wav', v: 0.26 },
  { at: T_END - 10, src: 'sfx/swish.wav', v: 0.45 },
  { at: T_END + 8, src: 'sfx/snap.wav', v: 0.26 },
  { at: CUT, src: 'sfx/tok.wav', v: 0.5 },
];
const BGM_OPEN = 0.42;
const BGM_UNDER = 0.16;
const SFX_UNDER = 0.7;
const MASTER = 0.8;
const windows = CLIPS.reduce<[number, number][]>((w, c) => {
  const last = w[w.length - 1];
  if (last && c.at - last[1] <= 30) last[1] = c.speechEnd;
  else w.push([c.at, c.speechEnd]);
  return w;
}, []);
const duck = (fr: number) => Math.max(0, ...windows.map(([a, e]) => interpolate(fr, [a - 6, a, e, e + 10], [0, 1, 1, 0], clamp)));
const bgm = (fr: number) => MASTER * (BGM_OPEN - (BGM_OPEN - BGM_UNDER) * duck(fr));

export const FullFilm: React.FC<{ variant: Variant }> = ({ variant }) => (
  <AbsoluteFill>
    <Sequence from={0} durationInFrames={CUT} layout="none">
      <Audio src={staticFile('bgm.mp3')} volume={(fr) => bgm(fr) * interpolate(fr, [CUT - 2, CUT], [1, 0], clamp)} />
    </Sequence>
    <Sequence from={CUT} durationInFrames={TOTAL - CUT} layout="none">
      <Audio src={staticFile('bgm.mp3')} trimBefore={TAIL.songFrame} volume={(fr) => bgm(CUT + fr) * interpolate(fr, [0, 1, TOTAL - CUT - 10, TOTAL - CUT], [0.4, 1, 1, 0], clamp)} />
    </Sequence>
    <Stage total={TOTAL} />
    <Sequence from={0} durationInFrames={T_SETUP}>
      <Whip len={T_SETUP} noIn>
        <SegA />
        <Source top={CARD.y + CARD.h + 12} />
      </Whip>
    </Sequence>
    <Sequence from={OFF_B} durationInFrames={T_SUM - OFF_B}>
      <Whip len={T_SUM - OFF_B}>
        <SegB />
        <Source top={CARD.y + CARD.h + 12} />
      </Whip>
    </Sequence>
    <Sequence from={OFF_C} durationInFrames={T_END - OFF_C}>
      <Whip len={T_END - OFF_C}>
        <SegC />
      </Whip>
    </Sequence>
    <Sequence from={OFF_D} durationInFrames={TOTAL - OFF_D}>
      <Whip len={TOTAL - OFF_D} noOut>
        <SegD variant={variant} />
      </Whip>
    </Sequence>
    {HEADS.map((h, i) => (
      <Sequence key={i} from={h.from} durationInFrames={h.to - h.from}>
        {h.el}
      </Sequence>
    ))}
    {CLIPS.map((c) => (
      <Sequence key={c.id} from={c.at} durationInFrames={c.end - c.at + 2} layout="none">
        <Audio src={staticFile(`vo/${c.id}.wav`)} volume={MASTER} />
      </Sequence>
    ))}
    {hits().map((h, i) => (
      <Sequence key={i} from={h.at} durationInFrames={60} layout="none">
        <Audio src={staticFile(h.src)} volume={MASTER * h.v * (1 - (1 - SFX_UNDER) * duck(h.at))} />
      </Sequence>
    ))}
  </AbsoluteFill>
);

export const unused = L;
