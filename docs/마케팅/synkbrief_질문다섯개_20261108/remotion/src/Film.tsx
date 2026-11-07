// synkbrief B32 「질문 다섯 개」(11-08) — 가게 고민은 AI한테 답부터 받지 말고 「나한테 질문 다섯 개만 해 줘」부터.
// 뼈대는 Wd_IqVl7mLo(오마주.json — 「챗GPT 비밀 코드 10가지」 62초: 훅 0 · 이름 칸 → 효과 화면이 열 번 · 56.9초 끝 장치).
// 이 편은 28초라 원본 박자를 62.02/28배로 줄인 자리에 장면을 바꾼다(다르게 — 길이 · 칸 수, 오마주.json).
// 겉은 장부 「화면 결」: 원래 장면 그대로 · 위 그늘 위 큰 글자가 곧 말 · 검정 · 흰 + 버터 한 곳(「질문 다섯 개」) · SUIT 하나 · 마침표 없음 · 안전선 안.
// 실제 화면은 로그인 없는 ChatGPT(11-08, 예시 가게)를 휴대폰 폭으로 찍은 그대로다 — 값 · 글은 손대지 않고 자리만 다시 짠다.
import React from 'react';
import { AbsoluteFill, Audio, Img, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from './lib/fonts';
import PLACE from './vo-place.json';
import { clamp, EASE_IO, EASE_OUT, frameSrc, sec, Sfx, Shade, Small, T, X, Y } from './parts';
import { PhoneToCalendar } from './Scene';

const vo = (id: string) => (PLACE as { id: string; at: number }[]).find((c) => c.id === id)!.at / 30;
const seq = (from: number, to: number, el: React.ReactNode) => <Sequence from={sec(from)} durationInFrames={sec(to) - sec(from)}>{el}</Sequence>;

// 장면 시작(초) — 원본 박자 ÷ 2.215(62.02초 → 28.0초) 자리
export const S = {
  hook: 0, typeA: 1.4, headA: 2.93, listA: 3.84, typeB: 5.46, sentB: 7.49, askB: 8.04, rollB: 10.34, q4: 13.14, face: 13.68,
  cal: 15.8, typeR: 16.7, sentR: 18.6, ansR: 19.14, first: 21.08, why: 21.76, more: 23.52, end: 25.69, total: 28.0,
};
export const TOTAL = sec(S.total);

// 얼굴 컷 — Flow Omni 컷이 오면 plate/face.mp4, 그 전에는 정지 그림
const HAS_FACE = false;
const FACE_LOOK = 2.4; // 얼굴 컷에서 엄지가 멈추는 초
const FACE_NOD = 5.6; // 얼굴 컷에서 쓴웃음 · 끄덕임이 시작하는 초

// 판을 d만큼 내리고 위는 같은 장면을 뒤집어 흐리게 채운다. 들어올 때 1.035배에서 내려앉고 아주 천천히 다가간다
const Lowered: React.FC<{ d?: number; drift?: number; origin?: string; children: React.ReactNode }> = ({ d = 260, drift = 0.0009, origin = '50% 40%', children }) => {
  const f = useCurrentFrame();
  const z = interpolate(f, [0, 8], [1.035, 1], { ...clamp, easing: EASE_OUT }) + f * drift;
  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: '#0b0b0b' }}>
      <div style={{ position: 'absolute', inset: 0, transform: `translateY(${d}px) scaleY(-1)`, transformOrigin: '50% 0%', filter: 'blur(26px) brightness(0.4)' }}>{children}</div>
      <div style={{ position: 'absolute', inset: 0, transform: `translateY(${d}px) scale(${z})`, transformOrigin: origin }}>{children}</div>
    </AbsoluteFill>
  );
};
const Pic: React.FC<{ src: string; y?: number }> = ({ src, y = 0 }) => <Img src={staticFile(`img/${src}.png`)} style={{ position: 'absolute', left: 0, top: y, width: 1080, height: 1920, objectFit: 'cover' }} />;
const Vid: React.FC<{ src: string; start?: number; rate?: number }> = ({ src, start = 0, rate = 1 }) => (
  <OffthreadVideo muted src={staticFile(`plate/${src}.mp4`)} startFrom={sec(start)} playbackRate={rate} style={{ width: 1080, height: 1920, objectFit: 'cover' }} />
);
// 얼굴 판 — z배로 (ox, oy) 쪽에 다가간 판
const Face: React.FC<{ start: number; z?: number; ox?: number; oy?: number }> = ({ start, z = 1, ox = 540, oy = 900 }) => (
  <div style={{ width: 1080, height: 1920, transform: `scale(${z})`, transformOrigin: `${ox}px ${oy}px` }}>
    {HAS_FACE ? <Vid src="face" start={start} /> : <Pic src="night" />}
  </div>
);

// 실제 화면 한 칸 — 프레임 묶음(dir/pre)의 k0 → k1장을 그 칸 길이 동안 넘기며, 원본 화소(x, y, w, h)를 scale배로 top에 놓는다
type Box = { x: number; y: number; w: number; h: number };
// lit — 밝게 둘 줄(원본 화소 y 범위), 그 밖은 어둡게 누른다(화면 결 ⑥)
// win — 화면에 고정된 읽는 자리(칸 높이의 비율 [위, 아래]): 굴러 지나가는 줄이 그 자리에서만 밝다 · zoom — lit 줄 쪽으로 다가가는 배율
const Screen: React.FC<{ dir: string; pre: string; k0: number; k1?: number; dur: number; box: Box; scale?: number; top: number; note?: string; ease?: 'out' | 'io' | 'lin'; hold?: number; lit?: [number, number]; win?: [number, number]; zoom?: number; ox?: number }> = ({ dir, pre, k0, k1, dur, box, scale = 1, top, note, ease = 'out', hold = 0, lit, win, zoom = 1, ox = 540 }) => {
  const f = useCurrentFrame();
  const e = ease === 'out' ? EASE_OUT : ease === 'io' ? EASE_IO : undefined;
  const k = k1 === undefined ? k0 : interpolate(f, [0, Math.max(1, sec(dur - hold))], [k0, k1], { ...clamp, ...(e ? { easing: e } : {}) });
  const z = (interpolate(f, [0, 8], [1.03, 1], { ...clamp, easing: EASE_OUT }) + f * 0.00025) * zoom;
  const w = box.w * scale, h = box.h * scale;
  const left = (1080 - w) / 2;
  const oy = lit ? top + ((lit[0] + lit[1]) / 2 - box.y) * scale : top + h * 0.45;
  return (
    <AbsoluteFill style={{ background: '#0b0b0b' }}>
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${z})`, transformOrigin: `${ox}px ${oy}px` }}>
        {win ? (
          <div style={{ position: 'absolute', left, top, width: w, height: h, zIndex: 2, pointerEvents: 'none' }}>
            <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: h * win[0], background: 'rgba(11,11,11,0.6)' }} />
            <div style={{ position: 'absolute', left: 0, right: 0, top: h * win[1], bottom: 0, background: 'rgba(11,11,11,0.6)' }} />
          </div>
        ) : null}
        {note ? <div style={{ position: 'absolute', left: Math.max(X, left + 24), top: top - 52, fontFamily: KO, fontWeight: 600, fontSize: 30, color: '#9a9a9a', letterSpacing: -0.4 }}>{note}</div> : null}
        <div style={{ position: 'absolute', left, top, width: w, height: h, overflow: 'hidden', borderRadius: 26 }}>
          <Img src={frameSrc(dir, pre, k)} style={{ position: 'absolute', left: -box.x * scale, top: -box.y * scale, width: 1080 * scale, height: 2341 * scale, maxWidth: 'none', filter: 'brightness(1.12)' }} />
          {lit ? (
            <>
              <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: Math.max(0, (lit[0] - box.y) * scale), background: 'rgba(11,11,11,0.66)' }} />
              <div style={{ position: 'absolute', left: 0, right: 0, top: (lit[1] - box.y) * scale, bottom: 0, background: 'rgba(11,11,11,0.66)' }} />
            </>
          ) : null}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const NOTE = '예시 가게로 실제 ChatGPT에 물어본 화면 · 11월 8일';

export const Film: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: '#0b0b0b' }}>
      {/* 0 훅 — 마감한 백반집, 폰을 보는 사장님 */}
      {seq(S.hook, S.typeA, <Lowered d={300} drift={0.0007}><Face start={0} /></Lowered>)}
      {/* 1.4 첫 요청을 치는 실제 화면 */}
      {seq(S.typeA, S.headA, <Screen dir="a3" pre="f" k0={12} k1={24} dur={S.headA - S.typeA} box={{ x: 0, y: 990, w: 1080, h: 420 }} scale={1} top={820} note={NOTE} ease="lin" hold={0.35} />)}
      {/* 2.93 답 머리 — 방법 다섯 가지 */}
      {seq(S.headA, S.listA, <Screen dir="a3m" pre="s" k0={34} box={{ x: 0, y: 690, w: 1080, h: 760 }} scale={1} top={700} note="ChatGPT 답 · 사진 칸은 가림" dur={S.listA - S.headA} lit={[690, 800]} />)}
      {/* 3.84 목록이 줄줄이(사진 칸은 빼고 글 칸만) */}
      {seq(S.listA, S.typeB, <Screen dir="a3m" pre="s" k0={40} k1={187} dur={S.typeB - S.listA} box={{ x: 0, y: 260, w: 1080, h: 1420 }} scale={0.86} top={650} note="ChatGPT 답 · 사진 칸은 가림" ease="io" />)}
      {/* 5.46 둘째 요청을 치는 실제 화면 */}
      {seq(S.typeB, S.sentB, <Screen dir="b3" pre="f" k0={10} k1={31} dur={S.sentB - S.typeB} box={{ x: 0, y: 980, w: 1080, h: 470 }} scale={1} top={900} note={NOTE} ease="lin" hold={0.3} />)}
      {/* 7.49 보냄 */}
      {seq(S.sentB, S.askB, <Screen dir="b3" pre="f" k0={33} box={{ x: 0, y: 150, w: 1080, h: 480 }} scale={1} top={860} dur={S.askB - S.sentB} />)}
      {/* 8.04 AI가 되묻기 시작 */}
      {seq(S.askB, S.rollB, <Screen dir="b3" pre="f" k0={36} k1={49} dur={S.rollB - S.askB} box={{ x: 0, y: 520, w: 1080, h: 1000 }} scale={1} top={680} note="ChatGPT 답" ease="lin" />)}
      {/* 10.34 질문 1 → 4 — 읽는 자리(가운데 띠)를 지나가는 질문만 밝다 */}
      {seq(S.rollB, S.q4, <Screen dir="b3roll" pre="s" k0={40} k1={75} dur={S.q4 - S.rollB} box={{ x: 0, y: 330, w: 1080, h: 1150 }} scale={1} top={660} ease="io" win={[0.36, 0.64]} />)}
      {/* 13.14 폰 속 넷째 질문 → 13.68 얼굴(엄지가 멈추고 고개를 듦) → 15.8 달력(한 장면) */}
      {seq(S.q4, S.face, <PhoneToCalendar t0={2.2} text={false} />)}
      {seq(S.face, S.cal, <Lowered d={240} drift={0.0004} origin="50% 30%"><Face start={FACE_LOOK - 0.6} z={1.32} ox={540} oy={820} /></Lowered>)}
      {seq(S.cal, S.typeR, <PhoneToCalendar t0={4.0} text={false} />)}
      {/* 16.7 사장님이 치는 답(넷째 줄까지) */}
      {seq(S.typeR, S.sentR, <Screen dir="b3r" pre="f" k0={44} k1={52} dur={S.sentR - S.typeR} box={{ x: 0, y: 1150, w: 1080, h: 1110 }} scale={0.95} top={680} note={NOTE} ease="lin" hold={0.3} lit={[1760, 2260]} />)}
      {/* 18.6 보냄 · 답이 흘러나옴 */}
      {seq(S.sentR, S.ansR, <Screen dir="b3r" pre="f" k0={64} k1={66} dur={S.ansR - S.sentR} box={{ x: 0, y: 150, w: 1080, h: 1000 }} scale={0.95} top={700} />)}
      {/* 19.14 「바로 그 시기에 휴무일을 … 변경했다는 점」 */}
      {seq(S.ansR, S.first, <Screen dir="b3rroll" pre="s" k0={30} box={{ x: 0, y: 640, w: 1080, h: 980 }} scale={1} top={700} note="ChatGPT 답" dur={S.first - S.ansR} lit={[686, 892]} zoom={1.04} ox={40} />)}
      {/* 21.08 「제일 먼저 의심해 볼 부분은 휴무일 변경입니다」 — 그 줄로 다가감 */}
      {seq(S.first, S.why, <Screen dir="b3rroll" pre="s" k0={30} box={{ x: 0, y: 640, w: 1080, h: 980 }} scale={1} top={700} note="ChatGPT 답" dur={S.why - S.first} lit={[912, 992]} zoom={1.19} ox={40} />)}
      {/* 21.76 「월요일 점심 단골이 다른 식당으로 이동했을 가능성」 */}
      {seq(S.why, S.more, <Screen dir="b3rroll" pre="s" k0={30} box={{ x: 0, y: 640, w: 1080, h: 980 }} scale={1} top={700} note="ChatGPT 답" dur={S.more - S.why} lit={[1390, 1596]} />)}
      {/* 23.52 사장님 반응 — 달력을 보다 작게 쓴웃음 · 끄덕임 */}
      {seq(S.more, S.end, <Lowered d={200} drift={0.0003} origin="50% 30%"><Face start={FACE_NOD} z={1.18} ox={540} oy={760} /></Lowered>)}
      {/* 25.69 끝 — 폰에서 달력으로(한 장면을 다시) */}
      {seq(S.end, S.total, <PhoneToCalendar t0={3.0} text={false} screen={{ dir: 'b3rroll', pre: 's', k0: 30 }} />)}

      <Shade a={0.9} />
      {/* 위 작은 표시 — 사람 장면은 재연 꼬리표, 끝은 브랜드 */}
      <Small text="예시 가게 · 사장님 장면은 AI로 만든 재연" from={S.hook} to={S.typeA} />
      <Small text="예시 가게 · 사장님 장면은 AI로 만든 재연" from={S.q4} to={S.typeR} />
      <Small text="사장님 장면은 AI로 만든 재연" from={S.more} to={S.total} />
      <Small text="SYNK 브리핑" from={S.end} to={S.total} right />

      {/* 큰 글자 = 말 */}
      <T lines={['가게 매출이 줄어서', 'AI한테 물어봤어요']} from={0.05} to={S.headA} />
      <T lines={['맞는 말은 많은데', '우리 가게 얘기는 없어요']} from={vo('n02')} to={S.typeB} />
      <T meta="이번엔" size={88} lines={['「답부터 말고,', '먼저 나한테', <><Y>질문 다섯 개</Y>만 해 줘」</>]} from={vo('n03')} to={vo('n04') - 0.1} />
      <T lines={['AI가 거꾸로 묻습니다']} from={vo('n04')} to={S.q4} />
      <T meta="AI의 넷째 질문" lines={['최근 한두 달 사이에', '달라진 게 있나요?']} from={S.q4} to={S.cal} />
      <T me lines={['아, 쉬는 날을', '월요일로 바꿨지']} from={S.cal + 0.05} to={S.typeR} />
      <T lines={['쉬는 날을 바꾼 걸', '적었더니']} from={vo('n05')} to={S.ansR} />
      <T lines={['AI가 제일 먼저 짚은 게', '바로 그거예요']} from={vo('n06')} to={S.more} />
      <T lines={['물어봐 주니까', '그제야 보이더라고요']} from={vo('n07')} to={S.total + 1} />

      {/* 소리 */}
      <Audio src={staticFile('bgm.wav')} volume={(fr: number) => 0.8 * interpolate(fr, [0, sec(0.4), sec(S.q4) - 6, sec(S.q4) + 6, sec(S.typeR) - 6, sec(S.typeR) + 6, TOTAL - 20, TOTAL], [0.0, 0.16, 0.16, 0.06, 0.06, 0.16, 0.14, 0], clamp)} />
      <Audio src={staticFile('sfx/room.wav')} volume={(fr: number) => 0.8 * interpolate(fr, [sec(S.q4) - 6, sec(S.q4), sec(S.typeR) - 4, sec(S.typeR)], [0, 0.22, 0.22, 0], clamp)} />
      {(PLACE as { id: string; at: number }[]).map((c) => (
        <Sequence key={c.id} from={c.at}><Audio src={staticFile(`vo/${c.id}.wav`)} volume={0.8} /></Sequence>
      ))}
      <Sfx at={S.headA - 0.05} src="tok" v={0.22} />
      <Sfx at={S.sentB} src="tok" v={0.22} />
      <Sfx at={S.sentR} src="tok" v={0.22} />
      <Sfx at={S.q4 + 0.2} src="tick" v={0.16} />
      <Sfx at={S.q4 + 0.45} src="tick" v={0.14} />
    </AbsoluteFill>
  );
};
