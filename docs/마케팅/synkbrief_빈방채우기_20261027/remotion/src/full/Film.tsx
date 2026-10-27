// 본편(「빈 방 사진 한 장, AI가 기억하는 '나'」 다시 살림 v4~): 청금석 무대 위 카드 하나.
// 마디 셋 — 방(보낸 빈 방 사진이 1.5초쯤 채워진 방으로 밀려 넘어감 → 넓게 머물며 「메모리를 켜 둔 ChatGPT가 짐작」
// → 물건 다섯으로 미끄러져 옮겨 가며 노란 테 → 넓게 물러나 다섯 테가 함께) → 한 줄(보낸 요청문을 크게 다시 짠 입력 칸 +
// 「여러분도 … 이 한 줄만 붙여 보내 보세요」) → 끝. 마디 사이는 위로 밀기.
// 옛 판(v3)에서 뺀 것: 기억 · 임시 채팅 · 끄는 곳 설명 셋(이해 시험 세 번 3점, 8~16초 이탈) — 캡션 · 고정 댓글 · 블로그로 보냈다.
// v4(3점 「7초 입력 칸이 지루 · AI 결과인지 안 읽힘 · 기억이 갑자기」) → v5(3점 「ChatGPT가 나를 어떻게 아는지 · 영상 안에 따라 할 방법이 없음 ·
// 물건 컷이 0.8초라 따라가기 벅참」) → v6: 결과 바로 뒤 「메모리를 켜 둔」 한 줄, 요청문은 끝에서 말로 시키며 크게(흰 글 · 핵심만 노랗게),
// 물건은 끊지 않고 카메라가 미끄러져 옮겨 감(배율도 낮춤). v4 · v5의 짜임은 git 이력에 있다.
// 소리: 배경음(본편 + 곡 끝맺음) + 사건마다 효과음 하나 + 내레이션(범수). 말하는 동안 배경음을 낮춘다(지난 편 값).
import { Audio } from '@remotion/media';
import React from 'react';
import { AbsoluteFill, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { clamp, EASE_IN_OUT, EASE_OUT } from '../lib/anim';
import { C, F } from '../theme';
import { Lines, MarkF, settle, Stage, Whip } from '../v5/cine';
import { CARD, Cam, camAt, Chip, H, Key, Mark, Screen, WipeEdge } from './screen';
import { at, CUT, TAIL, TOTAL } from './time';
import { CLIPS, clipEnd, wf } from './vo-time';

export { TOTAL };
export type Variant = 'A' | 'B' | 'C';
const WHERE: Record<Variant, string> = { A: '캡션에', B: '고정 댓글에', C: '아래 글에' };

// ── 시각(영상 프레임) ─────────────────────────────────────────
const T_WHY = at('why');
const T_ITEMS = at('items');
const T_LINE = at('line');
const T_END = at('end');
const W_FILL = wf('v12', '줬더니,', 1.4); // 「줬더니」에서 밀기 시작해 「이렇게」에 채워진 방
const WIPE = [W_FILL, W_FILL + 14];

// ── 결과 그림 좌표(이미지 픽셀, ../화면/M_결과방.jpg 1080×1618) ─────────────────
type Item = { name: string; word: string; box: { x: number; y: number; w: number; h: number }; cam: Cam };
const ITEMS: Item[] = [
  { name: '게임 패드', word: '게임', box: { x: 530, y: 975, w: 95, h: 62 }, cam: { cx: 590, cy: 960, z: 1.85 } },
  { name: '헤드폰', word: '헤드폰,', box: { x: 858, y: 380, w: 66, h: 80 }, cam: { cx: 860, cy: 450, z: 1.95 } },
  { name: '포스터', word: '포스터,', box: { x: 962, y: 88, w: 114, h: 300 }, cam: { cx: 960, cy: 300, z: 1.7 } },
  { name: '식물', word: '식물,', box: { x: 598, y: 495, w: 112, h: 160 }, cam: { cx: 660, cy: 560, z: 1.8 } },
  { name: '인형', word: '인형까지.', box: { x: 462, y: 1108, w: 186, h: 180 }, cam: { cx: 560, cy: 1150, z: 1.7 } },
];
const W_ITEM = ITEMS.map((it, i) => wf('v11', it.word, 0.8 * i) - 3); // 그 낱말 3프레임 전에 그 물건에 닿음
const GLIDE = 9; // 물건 사이를 미끄러져 옮겨 가는 프레임(끊지 않음 — v5 「0.8초 컷이라 따라가기 벅참」)
const W_BACK = W_ITEM[4] + 24; // 「인형까지」 뒤 넓게 물러나 다섯 테가 함께
const ROOM_WIDE: Cam = { cx: 560, cy: 730, z: 1 };

const SOURCE = '실제 ChatGPT 결과 · 2026.10.27 · 같은 요청도 사람마다 · 매번 달라요';
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

/** 머무는 동안 아주 천천히 당기는 카메라(멈춘 화면 점검 대비): from부터 프레임당 dz씩. */
const push = (c: Cam, f: number, from: number, dz = 0.0012): Cam => ({ ...c, z: c.z + dz * Math.max(0, f - from) });

/** 카드 왼쪽 아래 큰 꼬리표(이해 시험 v4 「이게 AI 결과인지 바로 안 읽힘」 — 작은 칩 대신). */
const Tag: React.FC<{ text: string; on: number; off: number; accent?: boolean }> = ({ text, on, off, accent }) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [on, on + 5, off - 5, off], [0, 1, 1, 0], clamp);
  if (o <= 0) return null;
  return (
    <span
      style={{
        position: 'absolute',
        left: CARD.x + 26,
        top: CARD.y + CARD.h - 26 - 64,
        height: 64,
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        borderRadius: 16,
        background: accent ? C.mark : 'rgba(0,0,0,.66)',
        color: accent ? C.ink : '#fff',
        font: `800 38px/1 ${F.ko}`,
        letterSpacing: '-.03em',
        opacity: o,
      }}
    >
      {text}
    </span>
  );
};

// ── 마디 1: 방 — 보낸 빈 방 사진(0프레임부터) → 채워진 방 → 넓게 머묾 → 물건 다섯으로 미끄러져 → 넓게 ─────
// 카메라 열쇠: 넓게 당김 → 물건마다 (닿기 · 머물며 조금 당김) → 넓게 물러남
const ROOM_KEYS: Key[] = [
  { f: W_ITEM[0] - GLIDE, cam: push(ROOM_WIDE, W_ITEM[0] - GLIDE, 0, 0.0009) },
  ...ITEMS.flatMap((it, i) => {
    const leave = i < ITEMS.length - 1 ? W_ITEM[i + 1] - GLIDE : W_BACK;
    return [
      { f: W_ITEM[i], cam: it.cam },
      { f: leave, cam: { ...it.cam, z: it.cam.z + 0.06 } },
    ];
  }),
  { f: W_BACK + 18, cam: { cx: 560, cy: 720, z: 1.0 } },
];
const SegRoom: React.FC = () => {
  const f = useCurrentFrame();
  const p = interpolate(f, WIPE, [0, 1], { ...clamp, easing: EASE_IN_OUT });
  const cam = f < ROOM_KEYS[0].f ? push(ROOM_WIDE, f, 0, 0.0009) : camAt(f, ROOM_KEYS, 0.2);
  return (
    <>
      <Screen src="screen/빈방.jpg" imgH={H.empty} cam={cam} />
      <Screen src="screen/M_결과방.jpg" imgH={H.room} cam={cam} clip={p}>
        {ITEMS.map((it, i) => (
          <Mark key={i} {...it.box} at={W_ITEM[i] - 2} />
        ))}
      </Screen>
      <WipeEdge p={p} />
      <Tag text="보낸 빈 방 사진" on={-6} off={WIPE[0] + 4} />
      <Tag text="ChatGPT가 채운 방" on={WIPE[1] - 4} off={W_ITEM[0] - GLIDE} accent />
      <Chip text="ChatGPT 실제 결과" on={W_ITEM[0] - GLIDE} off={T_LINE} />
      {/* 출처 줄은 결과 그림이 다 들어온 뒤에만(빈 방은 보낸 사진이라 「실제 ChatGPT 결과」가 아니다) */}
      <div style={{ opacity: interpolate(f, [WIPE[1] - 4, WIPE[1] + 2], [0, 1], clamp) }}>
        <Source top={SRC_TOP} />
      </div>
    </>
  );
};

/** 물건 이름: 물건에 닿을 때마다 둘째 줄이 바뀐다(아래에서 올라옴). 넓게 물러난 뒤에도 마지막 이름을 둔다. */
const ItemName: React.FC = () => {
  const f = useCurrentFrame() + T_ITEMS;
  const k = Math.max(0, W_ITEM.findIndex((w, i) => f >= w - 4 && (i === W_ITEM.length - 1 || f < W_ITEM[i + 1] - 4)));
  const p = settle(f, W_ITEM[k] - 4, 18);
  return (
    <span style={{ display: 'inline-block', overflow: 'hidden', verticalAlign: 'bottom', paddingBottom: '.12em', marginBottom: '-.12em' }}>
      <span style={{ display: 'inline-block', translate: `0 ${(1 - p) * 100}%`, color: C.markField }}>{ITEMS[k].name}</span>
    </span>
  );
};

// ── 마디 2: 한 줄 — 보낸 요청문을 크게 다시 짠 입력 칸(글 · 사진은 실제 그대로, ../화면/M_입력.jpg) ─────
// 「여러분도 빈 방 사진에, 이 한 줄만 붙여 보내 보세요」(v16). 글은 처음부터 흰 글로 다 보이고(v5 「흐려 읽기 어려움」),
// 「이 한 줄」에서 핵심 「내가 좋아할 만한 물건들로」만 차례로 노랗게, 말이 끝나면 보내기 단추를 누른다.
const OFF_LINE = T_LINE - 12;
const REQ = '네가 아는 나를 바탕으로, 내가 좋아할 만한 물건들로 이 방을 채워 줘';
const REQ_WORDS = REQ.split(' ');
const KEY_FROM = 4; // 「내가」
const KEY_TO = 7; // 「물건들로」
const BOX = { x: CARD.x, y: 520, w: CARD.w };
const LIT0 = wf('v16', '한', 1.6) - 2;
const SEND = clipEnd('v16') + 6;
const SegLine: React.FC = () => {
  const f = useCurrentFrame() + OFF_LINE;
  const zoom = 1 + 0.03 * interpolate(f, [T_LINE, T_END], [0, 1], clamp);
  const press = interpolate(f, [SEND - 2, SEND, SEND + 6], [1, 0.86, 1], clamp);
  const ring = interpolate(f, [SEND, SEND + 14], [0, 1], { ...clamp, easing: EASE_OUT });
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: BOX.x,
          top: BOX.y,
          width: BOX.w,
          padding: '40px 44px 34px',
          boxSizing: 'border-box',
          borderRadius: 54,
          background: '#212121',
          boxShadow: '0 0 0 2px rgba(255,255,255,.12),0 50px 90px -40px rgba(4,12,36,.75),0 18px 40px -24px rgba(4,12,36,.6)',
          scale: String(zoom),
          transformOrigin: '50% 40%',
        }}
      >
        <Img src={staticFile('screen/빈방.jpg')} style={{ display: 'block', width: 230, height: 230, objectFit: 'cover', borderRadius: 28 }} />
        <p style={{ margin: '30px 0 0', font: `700 70px/1.34 ${F.ko}`, letterSpacing: '-.03em', color: '#fff', wordBreak: 'keep-all' }}>
          {REQ_WORDS.map((w, i) => {
            const on = i >= KEY_FROM && i <= KEY_TO && f >= LIT0 + (i - KEY_FROM) * 4;
            // 낱말 사이 빈칸은 글자로 둔다(여백만 주면 keep-all에서 줄을 못 바꿔 칸 밖으로 넘친다)
            return (
              <React.Fragment key={i}>
                <span style={{ color: on ? C.mark : '#fff' }}>{w}</span>
                {i < REQ_WORDS.length - 1 ? ' ' : null}
              </React.Fragment>
            );
          })}
        </p>
        <div style={{ marginTop: 26, height: 104, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <svg width="56" height="56" viewBox="0 0 24 24" style={{ marginLeft: 6 }}>
            <path d="M12 4v16M4 12h16" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <div style={{ position: 'relative', width: 104, height: 104 }}>
            {f >= SEND && ring < 1 ? (
              <div style={{ position: 'absolute', inset: -10, borderRadius: '50%', boxShadow: `0 0 0 8px ${C.mark}`, opacity: 1 - ring, scale: String(0.8 + 0.7 * ring) }} />
            ) : null}
            <div style={{ width: 104, height: 104, borderRadius: '50%', background: '#fff', display: 'grid', placeItems: 'center', scale: String(press) }}>
              <svg width="54" height="54" viewBox="0 0 24 24">
                <path d="M12 19V5M5.5 11.5L12 5l6.5 6.5" fill="none" stroke="#0d0d0d" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>
      </div>
      <Chip text="ChatGPT에 보낸 말 그대로" on={0} off={T_END - OFF_LINE} box={{ ...BOX, h: 0 }} />
    </>
  );
};

// ── 마디 3: 끝 — 채워진 방을 다시 띄우고 질문 · 요청문 있는 곳 · 로고 ─────
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
        <div style={{ font: `700 38px/1.25 ${F.ko}`, color: '#fff', letterSpacing: '-.02em' }}>그대로 붙여 쓸 요청문은 {WHERE[variant]} 있어요</div>
        <Img src={staticFile('kit/logo-shift.webp')} style={{ height: 40, marginTop: 18, display: 'block' }} />
      </div>
      <Source top={1352} />
    </>
  );
};

// ── 머리 큰 글(장면마다) ───────────────────────────────────────
const HEADS: { from: number; to: number; el: React.ReactNode }[] = [
  { from: 0, to: T_WHY, el: <Head zero lines={['빈 방 사진 한 장을', <M at={W_FILL}>ChatGPT에 줬더니</M>]} /> },
  { from: T_WHY, to: T_ITEMS, el: <Head lines={['메모리 켜 둔 ChatGPT가', <M at={wf('v15', '짐작해서', 2.0) - T_WHY}>저를 짐작했나 봐요</M>]} /> },
  { from: T_ITEMS, to: T_LINE - 6, el: <Head lines={['ChatGPT가 짐작한 저는', <ItemName />]} /> },
  { from: T_LINE, to: T_END - 6, el: <Head lines={['빈 방 사진에', <M at={wf('v16', '한', 1.7) - T_LINE}>이 한 줄만</M>]} /> },
  { from: T_END, to: TOTAL, el: <Head lines={['여러분 방엔', '뭐가 들어왔나요?']} /> },
];

// ── 소리 ─────────────────────────────────────────────────────
type Hit = { at: number; src: string; v: number };
const hits = (): Hit[] => [
  { at: 1, src: 'sfx/thud.wav', v: 0.42 },
  { at: WIPE[0], src: 'sfx/swish.wav', v: 0.4 },
  { at: WIPE[1] - 2, src: 'sfx/earn.wav', v: 0.3 },
  ...W_ITEM.map((w) => ({ at: w - 2, src: 'sfx/pop.wav', v: 0.22 })),
  { at: W_BACK, src: 'sfx/earn.wav', v: 0.26 },
  { at: T_LINE - 10, src: 'sfx/swish.wav', v: 0.45 },
  { at: SEND, src: 'sfx/tok.wav', v: 0.4 },
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
  { from: 0, to: T_LINE, el: () => <SegRoom />, noIn: true },
  { from: OFF_LINE, to: T_END, el: () => <SegLine /> },
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
