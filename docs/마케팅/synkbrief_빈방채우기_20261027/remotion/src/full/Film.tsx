// 본편(「빈 방 사진 한 장, AI가 기억하는 '나'」): 청금석 무대 위 실제 ChatGPT 화면 카드 하나.
// 마디 다섯 — 방(보낸 빈 방 사진이 2초쯤 채워진 방으로 밀려 넘어가고, 물건마다 당김) → 기억(실제 대화) → 임시 채팅(시작 화면 → 답)
// → 끄는 곳(설정) → 끝. 마디 사이는 위로 밀기. 이해 시험 v1(3점) 「첫 4~5초가 입력 칸뿐」 · 「임시 채팅 · 메모리가 뭔지」 · 「글씨가 작다」를 고친 판.
// 소리: 배경음(본편 + 곡 끝맺음) + 사건마다 효과음 하나 + 내레이션(범수). 말하는 동안 배경음을 낮춘다(지난 편 값).
import { Audio } from '@remotion/media';
import React from 'react';
import { AbsoluteFill, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { clamp, EASE_IN_OUT } from '../lib/anim';
import { F } from '../theme';
import { Lines, MarkF, Stage, Whip } from '../v5/cine';
import { CARD, Cam, camAt, Chip, H, Mark, Screen, Spot, WipeEdge } from './screen';
import { at, CUT, TAIL, TOTAL } from './time';
import { CLIPS, wf } from './vo-time';

export { TOTAL };
type Variant = 'A' | 'B';

// ── 시각(영상 프레임) ─────────────────────────────────────────
const T_RES = at('res');
const T_MEM = at('mem');
const T_TMP = at('tmp');
const T_OFF = at('off');
const T_END = at('end');
const W_FILL = wf('v01', '내가', 2.0); // 「내가 좋아할 …」에서 빈 방 → 채워진 방
const WIPE = [W_FILL, W_FILL + 14];
const W_PAD = wf('v02', '게임', 1.5);
const W_PHONES = wf('v02', '헤드폰,', 2.0);
const W_PLANT = wf('v02', '식물까지.', 2.6);
const W_NOT = wf('v04', '아직', 1.7); // 임시 채팅: 시작 화면 → 답

// ── 녹화 좌표(이미지 픽셀, ../화면/ 눈금으로 잼) ─────────────────
const PAD = { x: 530, y: 975, w: 95, h: 62 }; // 결과 방의 게임 패드(그림 픽셀)
const PHONES = { x: 858, y: 380, w: 66, h: 80 }; // 헤드폰
const PLANT = { x: 598, y: 495, w: 112, h: 160 }; // 창가 식물
const BUBBLE = { x: 337, y: 432, w: 703, h: 243 }; // 보통 채팅의 내 요청 말풍선
const TMP_DEF = { x: 180, y: 840, w: 720, h: 245 }; // 임시 채팅 시작 화면 「임시 채팅 · 이 채팅은 메모리 … 무시하며」
const NOTYET = { x: 40, y: 780, w: 790, h: 58 }; // 임시 채팅 답 「아직 네 취향에 대해 아는 게 많지는 않지만,」
const SET_HEAD = { x: 120, y: 30, w: 330, h: 70 }; // 「개인 맞춤 설정」
const SET_MEM = { x: 70, y: 340, w: 940, h: 190 }; // 「메모리 활성화」 줄과 켜짐 단추

const SOURCE = '실제 ChatGPT 화면 · 2026.10.27 · 같은 요청도 매번 결과가 달라요';

/** 카드 아래 출처 줄 */
const Source: React.FC<{ top: number }> = ({ top }) => (
  <p style={{ position: 'absolute', left: CARD.x + 6, right: 1080 - CARD.x - CARD.w, top, margin: 0, font: `500 24px/1.35 ${F.ko}`, color: 'rgba(255,255,255,.84)', letterSpacing: '-.01em' }}>{SOURCE}</p>
);
const SRC_TOP = CARD.y + CARD.h + 12;

/** 머리 큰 글 두 줄 — 위 끝 272(키트 cover916 위 안전선 269 아래, 올리기 전 검사 ⑤) */
const Head: React.FC<{ lines: React.ReactNode[]; zero?: boolean }> = ({ lines, zero }) => <Lines lines={lines} at={0} size={66} top={272} visibleAtZero={zero} />;
const M: React.FC<{ children: React.ReactNode; at: number }> = ({ children, at: a }) => {
  const f = useCurrentFrame();
  return <MarkF p={interpolate(f, [a, a + 10], [0, 1], clamp)}>{children}</MarkF>;
};

/** 컷마다 아주 천천히 당기는 카메라(멈춘 화면 점검 대비): from부터 프레임당 dz씩. */
const push = (c: Cam, f: number, from: number, dz = 0.0012): Cam => ({ ...c, z: c.z + dz * Math.max(0, f - from) });

// ── 마디 1·2: 방 — 보낸 빈 방 사진(0프레임부터 크게) → 「내가 좋아할」에서 채워진 방으로 → 물건마다 끊어 당김 ─────
const WIDE: Cam = { cx: 540, cy: 780, z: 1 };
const SegRoom: React.FC = () => {
  const f = useCurrentFrame();
  const p = interpolate(f, WIPE, [0, 1], { ...clamp, easing: EASE_IN_OUT });
  // 물건을 말하는 동안은 그 물건으로 끊어 들어가고(가까이), 말이 끝나면 다시 넓게
  const back = wf('v02', '식물까지.', 2.6) + 30;
  const cam =
    f < W_PAD - 2 ? push(WIDE, f, 0, 0.0009)
      : f < W_PHONES - 2 ? push({ cx: 578, cy: 1000, z: 2.0 }, f, W_PAD - 2)
        : f < W_PLANT - 2 ? push({ cx: 860, cy: 430, z: 2.0 }, f, W_PHONES - 2)
          : f < back ? push({ cx: 650, cy: 560, z: 1.8 }, f, W_PLANT - 2)
            : camAt(f, [{ f: back, cam: { cx: 600, cy: 760, z: 1.15 } }, { f: T_MEM, cam: { cx: 560, cy: 780, z: 1.05 } }]);
  return (
    <>
      <Screen src="screen/빈방.jpg" imgH={H.empty} cam={cam} />
      <Screen src="screen/M_결과방.jpg" imgH={H.room} cam={cam} clip={p}>
        <Mark {...PAD} at={W_PAD} />
        <Mark {...PHONES} at={W_PHONES} />
        <Mark {...PLANT} at={W_PLANT} />
      </Screen>
      <WipeEdge p={p} />
      <Chip text="보낸 빈 방 사진" on={-6} off={WIPE[0] + 6} />
      <Chip text="ChatGPT 실제 결과" on={WIPE[1] - 4} off={T_MEM} />
    </>
  );
};

// ── 마디 3: 기억 — 실제 대화(내 요청 말풍선 + 결과 그림) ─────
const OFF_MEM = T_MEM - 12;
const SegMem: React.FC = () => {
  const f = useCurrentFrame() + OFF_MEM;
  const cam = camAt(f, [
    { f: T_MEM, cam: { cx: 640, cy: 640, z: 1.3 } },
    { f: T_TMP - 14, cam: { cx: 560, cy: 940, z: 1.0 } },
  ]);
  return (
    <>
      <Screen src="screen/M_결과대화.jpg" imgH={H.phone} cam={cam}>
        <Mark {...BUBBLE} at={T_MEM + 2 - OFF_MEM} r={36} />
      </Screen>
      <Chip text="ChatGPT 실제 화면 · 보통 채팅" on={0} off={T_TMP - OFF_MEM} />
    </>
  );
};

// ── 마디 4: 임시 채팅 — 시작 화면(「메모리 … 무시」) → 같은 사진 · 같은 말의 답(그림 없이 글로만) ─────
const OFF_TMP = T_TMP - 12;
const SegTmp: React.FC = () => {
  const f = useCurrentFrame() + OFF_TMP;
  if (f < W_NOT - 3) {
    return (
      <>
        <Screen src="screen/T_임시채팅_시작.jpg" imgH={H.phone} cam={push({ cx: 540, cy: 960, z: 1.25 }, f, T_TMP)}>
          <Mark {...TMP_DEF} at={wf('v04', '임시', 0.7) - OFF_TMP} r={30} />
        </Screen>
        <Chip text="ChatGPT 실제 화면 · 임시 채팅" on={0} off={W_NOT - 3 - OFF_TMP} />
      </>
    );
  }
  return (
    <>
      <Screen src="screen/T_임시채팅.jpg" imgH={H.phone} cam={push({ cx: 435, cy: 700, z: 1.35 }, f, W_NOT - 3, 0.0009)}>
        <Spot bands={[[250, 505], [770, 850]]} imgH={H.phone} at={W_NOT - OFF_TMP} dim={0.72} />
        <Mark {...NOTYET} at={W_NOT + 2 - OFF_TMP} />
      </Screen>
      <Chip text="ChatGPT 실제 화면 · 임시 채팅" on={W_NOT - 3 - OFF_TMP} off={T_OFF - OFF_TMP} />
    </>
  );
};

// ── 마디 5: 끄는 곳 — 설정 → 개인 맞춤 설정 → ChatGPT 메모리 ─────
const OFF_OFF = T_OFF - 12;
const SegOff: React.FC = () => {
  const f = useCurrentFrame() + OFF_OFF;
  const cam = camAt(f, [
    { f: T_OFF, cam: { cx: 540, cy: 420, z: 1.08 } },
    { f: T_END - 14, cam: { cx: 540, cy: 400, z: 1.15 } },
  ]);
  return (
    <>
      <Screen src="screen/S_설정.jpg" imgH={H.phone} cam={cam}>
        <Spot bands={[[20, 110], [330, 545]]} imgH={H.phone} at={wf('v05', '개인', 1.8) - OFF_OFF - 2} dim={0.6} />
        <Mark {...SET_HEAD} at={wf('v05', '개인', 1.8) - OFF_OFF} />
        <Mark {...SET_MEM} at={wf('v05', '메모리를', 3.0) - OFF_OFF} r={26} />
      </Screen>
      <Chip text="ChatGPT 실제 화면 · 설정" on={0} off={T_END - OFF_OFF} />
    </>
  );
};

// ── 마디 6: 끝 — 채워진 방을 다시 띄우고 질문 · 요청문 있는 곳 · 로고 ─────
const OFF_END = T_END - 12;
const BOX_END = { x: CARD.x, y: 470, w: CARD.w, h: 720 };
const SegEnd: React.FC<{ variant: Variant }> = ({ variant }) => {
  const f = useCurrentFrame() + OFF_END;
  // 같은 빠르기로 끝 0.6초 전까지(멈춘 화면 점검 대비)
  const p = interpolate(f, [T_END, TOTAL - 18], [0, 1], clamp);
  const o = interpolate(f, [T_END + 10, T_END + 18], [0, 1], clamp);
  return (
    <>
      <Screen src="screen/M_결과방.jpg" imgH={H.room} cam={{ cx: 540, cy: 760 + 40 * p, z: 1 + 0.1 * p }} box={BOX_END} radius={30} />
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
  { from: 0, to: T_RES, el: <Head zero lines={['빈 방 사진 한 장에', <M at={wf('v01', '좋아할', 2.2)}>“좋아할 물건으로 채워 줘”</M>]} /> },
  { from: T_RES, to: T_MEM - 6, el: <Head lines={['제 방은', <>이렇게 <M at={wf('v02', '채워졌어요.', 0.6) - T_RES}>채워졌어요</M></>]} /> },
  { from: T_MEM, to: T_TMP - 6, el: <Head lines={['ChatGPT 메모리가', <M at={wf('v03', '짐작한', 2.6) - T_MEM}>나를 짐작했어요</M>]} /> },
  { from: T_TMP, to: T_OFF - 6, el: <Head lines={['기억 안 쓰는 임시 채팅은', <M at={W_NOT - T_TMP}>아직 잘 모른대요</M>]} /> },
  { from: T_OFF, to: T_END - 6, el: <Head lines={['싫다면 설정 →', <>개인 맞춤 설정 → <M at={wf('v05', '메모리를', 3.0) - T_OFF}>메모리</M></>]} /> },
  { from: T_END, to: TOTAL, el: <Head lines={['여러분 방엔', '뭐가 들어왔나요?']} /> },
];

// ── 소리 ─────────────────────────────────────────────────────
type Hit = { at: number; src: string; v: number };
const hits = (): Hit[] => [
  { at: 1, src: 'sfx/thud.wav', v: 0.42 },
  { at: WIPE[0], src: 'sfx/swish.wav', v: 0.4 },
  { at: WIPE[1] - 2, src: 'sfx/earn.wav', v: 0.3 },
  { at: W_PAD - 2, src: 'sfx/pop.wav', v: 0.28 },
  { at: W_PHONES - 2, src: 'sfx/pop.wav', v: 0.28 },
  { at: W_PLANT - 2, src: 'sfx/pop.wav', v: 0.28 },
  { at: T_MEM - 10, src: 'sfx/swish.wav', v: 0.45 },
  { at: T_TMP - 10, src: 'sfx/swish.wav', v: 0.5 },
  { at: W_NOT - 3, src: 'sfx/snap.wav', v: 0.3 },
  { at: T_OFF - 10, src: 'sfx/swish.wav', v: 0.45 },
  { at: wf('v05', '메모리를', 3.0), src: 'sfx/pop.wav', v: 0.3 },
  { at: T_END - 10, src: 'sfx/swish.wav', v: 0.45 },
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

const SEGS: { from: number; to: number; el: (v: Variant) => React.ReactNode; noIn?: boolean; noOut?: boolean; src?: boolean }[] = [
  { from: 0, to: T_MEM, el: () => <SegRoom />, noIn: true, src: true },
  { from: OFF_MEM, to: T_TMP, el: () => <SegMem />, src: true },
  { from: OFF_TMP, to: T_OFF, el: () => <SegTmp />, src: true },
  { from: OFF_OFF, to: T_END, el: () => <SegOff />, src: true },
  { from: OFF_END, to: TOTAL, el: (v) => <SegEnd variant={v} />, noOut: true },
];

export const FullFilm: React.FC<{ variant: Variant }> = ({ variant }) => (
  <AbsoluteFill>
    <Sequence from={0} durationInFrames={CUT} layout="none">
      <Audio src={staticFile('bgm.mp3')} volume={(fr) => bgm(fr) * interpolate(fr, [CUT - 2, CUT], [1, 0], clamp)} />
    </Sequence>
    <Sequence from={CUT} durationInFrames={TOTAL - CUT} layout="none">
      <Audio src={staticFile('bgm.mp3')} trimBefore={TAIL.songFrame} volume={(fr) => bgm(CUT + fr) * interpolate(fr, [0, 1, TOTAL - CUT - 10, TOTAL - CUT], [0.4, 1, 1, 0], clamp)} />
    </Sequence>
    <Stage total={TOTAL} />
    {SEGS.map((s, i) => (
      <Sequence key={i} from={s.from} durationInFrames={s.to - s.from}>
        <Whip len={s.to - s.from} noIn={s.noIn} noOut={s.noOut}>
          {s.el(variant)}
          {s.src ? <Source top={SRC_TOP} /> : null}
        </Whip>
      </Sequence>
    ))}
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
