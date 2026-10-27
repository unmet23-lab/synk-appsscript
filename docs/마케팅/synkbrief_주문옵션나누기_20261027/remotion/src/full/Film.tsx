// 본편(「한 칸에 몰린 주문 옵션, AI한테 나누는 수식을 달라고 하세요」): 청금석 무대 위 실제 화면 카드 하나 — 엑셀 → ChatGPT → 엑셀.
// 마디 넷 — 훅(엑셀: 몰린 칸 → 나뉜 결과) → 묻기(ChatGPT 입력) → 답(빨리 감기 → 칸마다 수식 셋 · 복사 단추) → 붙이기 · 채우기 · 끝(엑셀 한 화면이 이어진다).
// 소리: 배경음(본편 + 곡 끝맺음) + 사건마다 효과음 하나 + 내레이션(범수). 말하는 동안 배경음을 낮춘다(지난 편 값).
import { Audio } from '@remotion/media';
import React from 'react';
import { AbsoluteFill, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { clamp } from '../lib/anim';
import { F, L } from '../theme';
import { Lines, MarkF, Stage, Whip } from '../v5/cine';
import { Box, CARD, camAt, Chip, FR, G_ALL_H, G_GEN_H, G_TYPE_H, Key as CamKey, Mark, pick, Ring, Screen, TYPE_BOX, XL, XL_BOX } from './screen';
import { at, CUT, TAIL, TOTAL } from './time';
import { CLIPS, clipAt, wf } from './vo-time';

export { TOTAL };
type Variant = 'A' | 'B';

// ── 시각(영상 프레임) ─────────────────────────────────────────
const T_ASK = at('ask');
const T_ANS = at('ans');
const T_PASTE = at('paste');
const T_FILL = at('fill');
const T_END = at('end');
const SWAP = wf('v01', '수식을', 2.5); // 훅: 몰린 칸 → 나뉜 결과
const TYPE0 = wf('v02', '세', 0.8) - 4; // 질문을 치기 시작
const FF_END = T_ANS + 30; // 보낸 뒤 답 빨리 감기 끝
const P_B = clipAt('v04') + 8;
const P_C = P_B + 14;
const P_D = P_C + 14;
const F_SWAP = wf('v05', '내리면,', 0.5); // 아래로 채움

// ── 녹화 좌표(이미지 픽셀, ../화면/ 눈금으로 잼) ─────────────────
// 엑셀(1080×758, 300% 창을 잘라 줄임): 행 2 = y 177~250, 행 n = 177 + (n−2)×72.6, 열 A 95~494 · B 494~688 · C 688~882 · D 882~1076
const XH = FR.XH;
const ROW2 = { y: 177, h: 73 };
const COL = { A: [95, 494], B: [494, 688], C: [688, 882], D: [882, 1076] } as const;
const cell = (c: keyof typeof COL, pad = 16) => ({ x: COL[c][0] + pad, y: ROW2.y + 8, w: COL[c][1] - COL[c][0] - 2 * pad, h: ROW2.h - 16 });
const A2_TEXT = { x: 104, y: 186, w: 226, h: 56 }; // 「블랙/L/면티」 글자
const BD_ALL = { x: COL.B[0] + 16, y: ROW2.y + 6, w: COL.D[1] - COL.B[0] - 32, h: 758 - ROW2.y - 16 }; // B2:D9
const BD_REST = { x: COL.B[0] + 16, y: 250 + 6, w: COL.D[1] - COL.B[0] - 32, h: 758 - 250 - 16 }; // B3:D9
// ChatGPT 다 쓴 답(1080×3300): 코드 칸 B2 1438~1643 · C2 1889~2093 · D2 2339~2544(가로 40~1040), 칸마다 복사 단추는 위 끝 + 62 · 가로 976 언저리
const CODE = (y0: number) => ({ x: 58, y: y0 + 10, w: 964, h: 186 });
const COPY = (y0: number) => ({ x: 954, y: y0 + 40, w: 46, h: 44 });

const SOURCE = '실제 ChatGPT · 엑셀 화면 · 2026.10.27 · 같은 질문도 매번 답이 달라요';
const Source: React.FC<{ box: Box }> = ({ box }) => (
  <p style={{ position: 'absolute', left: box.x + 6, right: 1080 - box.x - box.w, top: box.y + box.h + 12, margin: 0, font: `500 24px/1.35 ${F.ko}`, color: 'rgba(255,255,255,.84)', letterSpacing: '-.01em' }}>{SOURCE}</p>
);

/** 머리 큰 글 두 줄 — 위 끝 272(키트 cover916 위 안전선 269 아래, 올리기 전 검사 ⑤) */
const Head: React.FC<{ lines: React.ReactNode[]; zero?: boolean }> = ({ lines, zero }) => <Lines lines={lines} at={0} size={66} top={272} visibleAtZero={zero} />;
const M: React.FC<{ children: React.ReactNode; at: number }> = ({ children, at: a }) => {
  const f = useCurrentFrame();
  return <MarkF p={interpolate(f, [a, a + 10], [0, 1], clamp)}>{children}</MarkF>;
};

// ── 마디 1: 훅 — 엑셀, 몰린 칸 → 나뉜 결과 ─────────────────────
const SegHook: React.FC = () => {
  const f = useCurrentFrame();
  const cam = { cx: 540, cy: 379, z: 1 + 0.05 * interpolate(f, [0, T_ASK], [0, 1], clamp) };
  return (
    <>
      {f < SWAP ? (
        <Screen src={XL('before')} imgH={XH} cam={cam} box={XL_BOX} bg="#fff">
          <Ring {...A2_TEXT} padX={30} padY={22} at={-12} id="a2" />
        </Screen>
      ) : (
        <Screen src={XL('clean')} imgH={XH} cam={cam} box={XL_BOX} bg="#fff">
          <Mark {...BD_ALL} at={SWAP + 1} />
        </Screen>
      )}
      <Chip text="엑셀 실제 화면" on={-6} off={T_ASK} box={XL_BOX} />
      <Source box={XL_BOX} />
    </>
  );
};

// ── 마디 2: 묻기 — ChatGPT 입력 칸에 질문을 친다(시퀀스 안 프레임 lf = 영상 프레임 − OFF_ASK) ──
const OFF_ASK = T_ASK - 12;
const SegAsk: React.FC = () => {
  const f = useCurrentFrame() + OFF_ASK;
  const typ = FR.G.typing;
  const first = typ.find((t) => t.tag === 'type')!;
  const last = typ[typ.length - 1];
  const speed = (last.ms - first.ms) / 1000 / ((T_ANS - 10 - TYPE0) / 30);
  const t = f < TYPE0 ? typ[0] : pick(typ, f, TYPE0, speed, first.ms);
  return (
    <>
      <Screen src={`screen/G/${t.f}`} imgH={G_TYPE_H} cam={{ cx: 540, cy: 455 + 0.15 * (f - T_ASK), z: 1.15 }} box={TYPE_BOX}>
        {f >= T_ANS - 10 ? <Mark x={70} y={300} w={940} h={190} at={T_ANS - 10 - OFF_ASK} /> : null}
      </Screen>
      <Chip text={f < TYPE0 ? 'ChatGPT 실제 화면' : 'ChatGPT 실제 화면 · 빨리 감기'} on={0} off={T_ANS - OFF_ASK} box={TYPE_BOX} />
      <Source box={TYPE_BOX} />
    </>
  );
};

// ── 마디 3: 답 — 보내고 빨리 감기 → 칸마다 수식 셋 · 「구버전에서도」 ──
const OFF_ANS = T_ANS - 12;
const SegAns: React.FC = () => {
  const f = useCurrentFrame() + OFF_ANS;
  if (f < FF_END) {
    const gen = FR.G.gen;
    const speed = gen[gen.length - 1].ms / 1000 / ((FF_END - 2 - T_ANS) / 30);
    const g = f < T_ANS ? gen[0] : pick(gen, f, T_ANS, speed, gen[0].ms);
    return (
      <>
        <Screen src={`screen/G/${g.f}`} imgH={G_GEN_H} cam={{ cx: 540, cy: 570, z: 1 }} />
        <Chip text="ChatGPT 실제 화면 · 빨리 감기" on={0} off={FF_END - OFF_ANS} />
        <Source box={CARD} />
      </>
    );
  }
  // 수식 세 칸(B2 라벨 ~ D2 코드 칸)에만 머문다 — 이해 시험 v1 「호환성 · 텍스트 나누기 줄이 작고 잘려 뜻을 모르겠다」
  const W_COPY = wf('v03', '복사만', 2.85);
  const keys: CamKey[] = [
    // 1.05배(이해 시험 v2 「수식이 작아 불안」) — 끝 자리에서 복사 단추 셋(1478~2423)과 D2 수식 줄(2475~2503)이 다 보인다
    { f: FF_END, cam: { cx: 552, cy: 1850, z: 1.05 } },
    { f: wf('v03', '하나씩', 0.9) + 8, cam: { cx: 552, cy: 1990, z: 1.05 } },
  ];
  const lf = (x: number) => x - OFF_ANS;
  return (
    <>
      <Screen src="screen/G/전체.jpg" imgH={G_ALL_H} cam={camAt(f, keys, 0.2)}>
        <Mark {...CODE(1438)} at={lf(wf('v03', '칸마다', 0))} />
        <Mark {...CODE(1889)} at={lf(wf('v03', '수식이', 0.6))} />
        <Mark {...CODE(2339)} at={lf(wf('v03', '하나씩', 0.9))} />
        <Ring {...COPY(1438)} padX={24} padY={20} at={lf(W_COPY)} id="cp1" len={8} />
        <Ring {...COPY(1889)} padX={24} padY={20} at={lf(W_COPY + 4)} id="cp2" len={8} />
        <Ring {...COPY(2339)} padX={24} padY={20} at={lf(W_COPY + 8)} id="cp3" len={8} />
      </Screen>
      {/* 복사 단추 동그라미 전에 걷는다 — B2 복사 단추가 이 표 자리에 온다 */}
      <Chip text="ChatGPT 실제 화면" on={FF_END - OFF_ANS} off={lf(W_COPY) - 2} />
      <Source box={CARD} />
    </>
  );
};

// ── 마디 4~6: 엑셀 — 한 칸씩 붙이기 → 아래로 채우기 → 끝(한 화면이 이어진다) ──
const OFF_X = T_PASTE - 12;
const SegExcel: React.FC<{ variant: Variant }> = ({ variant }) => {
  const f = useCurrentFrame() + OFF_X;
  const lf = (x: number) => x - OFF_X;
  const tag = f < P_B ? 'before' : f < P_C ? 'paste-B' : f < P_D ? 'paste-C' : f < T_FILL ? 'paste-D' : f < F_SWAP ? 'sel-row' : f < T_END ? 'fill' : 'clean';
  const keys: CamKey[] = [
    { f: T_PASTE, cam: { cx: 560, cy: 330, z: 1.06 } },
    { f: F_SWAP - 2, cam: { cx: 560, cy: 340, z: 1.08 } },
    { f: F_SWAP + 10, cam: { cx: 540, cy: 379, z: 1 } },
    { f: T_END, cam: { cx: 540, cy: 379, z: 1.01 } },
    { f: TOTAL - 18, cam: { cx: 600, cy: 420, z: 1.1 } },
  ];
  const cam = camAt(f, keys, 0);
  const o = interpolate(f, [T_END + 10, T_END + 18], [0, 1], clamp);
  return (
    <>
      <Screen src={XL(tag)} imgH={XH} cam={cam} box={XL_BOX} bg="#fff">
        {f < T_FILL ? (
          <>
            <Mark {...cell('B')} at={lf(P_B)} thick={5} />
            <Mark {...cell('C')} at={lf(P_C)} thick={5} />
            <Mark {...cell('D')} at={lf(P_D)} thick={5} />
          </>
        ) : null}
        {f >= F_SWAP && f < T_END ? <Mark {...BD_REST} at={lf(wf('v05', '전부가', 1.3))} /> : null}
        {f >= T_END ? <Mark {...BD_ALL} at={lf(T_END + 2)} /> : null}
      </Screen>
      <Chip text="엑셀 실제 화면" on={0} off={TOTAL - OFF_X + 10} box={XL_BOX} />
      <Source box={XL_BOX} />
      <div style={{ position: 'absolute', left: XL_BOX.x + 4, top: XL_BOX.y + XL_BOX.h + 66, opacity: o }}>
        {/* 이해 시험 v1 「캡션에 있다는 줄을 못 봤다」 → 크게 */}
        <div style={{ font: `700 38px/1.3 ${F.ko}`, color: '#fff', letterSpacing: '-.02em' }}>그대로 붙여 쓸 질문 · 수식은</div>
        <div style={{ font: `700 38px/1.3 ${F.ko}`, color: '#ffebb0', letterSpacing: '-.02em' }}>{variant === 'A' ? '캡션에' : '고정 댓글에'} 그대로 있어요</div>
        <Img src={staticFile('kit/logo-shift.webp')} style={{ height: 40, marginTop: 22, display: 'block' }} />
      </div>
    </>
  );
};

// ── 머리 큰 글(장면마다) ───────────────────────────────────────
const HEADS: { from: number; to: number; el: React.ReactNode }[] = [
  { from: 0, to: T_ASK, el: <Head zero lines={['한 칸에 몰린 엑셀,', <>AI한테 <M at={SWAP}>수식</M> 달라 하세요</>]} /> },
  { from: T_ASK, to: T_ANS - 6, el: <Head lines={['“세 칸으로 나누는 수식 줘,', '옛날 엑셀에서도 되게”', <>그래야 <M at={wf('v02', '그래야', 4.2) - T_ASK}>어느 엑셀에서나</M></>]} /> },
  { from: T_ANS, to: T_PASTE - 6, el: <Head lines={['칸마다 수식 하나씩,', <>몰라도 돼요, <M at={wf('v03', '복사만', 2.85) - T_ANS}>복사만</M></>]} /> },
  { from: T_PASTE, to: T_FILL - 6, el: <Head lines={['바로 옆 칸에 하나씩', <M at={wf('v04', '붙여', 0.95) - T_PASTE}>붙여 넣고</M>]} /> },
  { from: T_FILL, to: T_END - 6, el: <Head lines={['아래로 끌어 내리면', <>전부 <M at={wf('v05', '세', 1.7) - T_FILL}>세 칸으로</M></>]} /> },
  { from: T_END, to: TOTAL, el: <Head lines={['엑셀에서 또 귀찮은 거,', <M at={wf('v06', '댓글로', 1.67) - T_END}>댓글로 알려 주세요</M>]} /> },
];

// ── 소리 ─────────────────────────────────────────────────────
type Hit = { at: number; src: string; v: number };
const hits = (): Hit[] => [
  { at: 1, src: 'sfx/thud.wav', v: 0.42 },
  { at: SWAP, src: 'sfx/snap.wav', v: 0.34 },
  { at: T_ASK - 10, src: 'sfx/swish.wav', v: 0.5 },
  { at: T_ANS - 10, src: 'sfx/swish.wav', v: 0.45 },
  { at: T_ANS, src: 'sfx/tok.wav', v: 0.34 },
  { at: FF_END, src: 'sfx/swish.wav', v: 0.3 },
  { at: wf('v03', '칸마다', 0), src: 'sfx/pop.wav', v: 0.26 },
  { at: wf('v03', '수식이', 0.6), src: 'sfx/pop.wav', v: 0.26 },
  { at: wf('v03', '하나씩', 0.9), src: 'sfx/pop.wav', v: 0.26 },
  { at: wf('v03', '복사만', 2.85), src: 'sfx/tick.wav', v: 0.28 },
  { at: T_PASTE - 10, src: 'sfx/swish.wav', v: 0.5 },
  { at: P_B, src: 'sfx/tick.wav', v: 0.3 },
  { at: P_C, src: 'sfx/tick.wav', v: 0.3 },
  { at: P_D, src: 'sfx/tick.wav', v: 0.3 },
  { at: F_SWAP, src: 'sfx/earn.wav', v: 0.3 },
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
    <Sequence from={0} durationInFrames={T_ASK}>
      <Whip len={T_ASK} noIn>
        <SegHook />
      </Whip>
    </Sequence>
    <Sequence from={OFF_ASK} durationInFrames={T_ANS - OFF_ASK}>
      <Whip len={T_ANS - OFF_ASK}>
        <SegAsk />
      </Whip>
    </Sequence>
    <Sequence from={OFF_ANS} durationInFrames={T_PASTE - OFF_ANS}>
      <Whip len={T_PASTE - OFF_ANS}>
        <SegAns />
      </Whip>
    </Sequence>
    <Sequence from={OFF_X} durationInFrames={TOTAL - OFF_X}>
      <Whip len={TOTAL - OFF_X} noOut>
        <SegExcel variant={variant} />
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
