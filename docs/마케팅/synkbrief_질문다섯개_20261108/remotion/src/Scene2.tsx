// synkbrief B32 한 장면 v2 → v3(장면 심사용 · 제목 · 브랜드 · 해설 없음).
// v2 「넘김 · 2 — 0초 첫 칸에 글자 없음 · 손님이 줄었다는 문제가 늦게 나옴 · 달력만으로 일→월이 안 읽힘 · 달력 위 회색 글이 전등과 겹침 · 입력창 위 반쯤 가린 줄」
// v3: 0초부터 큰 글자 「매출 20~30% 줄었는데 / AI가 되묻습니다」(움직임 없이 첫 프레임부터) · 달력에 쪽지 「10월부터 정기휴무 일 → 월」 ·
//     달력 칸은 위를 더 어둡게 · 입력창만 잘라 크게.
// v1 「넘김 · 2 — 0~3초가 작은 글씨 채팅이고 거의 안 움직임 · 0초에 큰 글자 없음 · 「아…」는 글자 대신 얼굴로 · 달력과 표정을 먼저」
// v2: 0초부터 위 큰 글자 「AI의 넷째 질문 — 최근 한두 달 사이에 달라진 게 있나요?」와 폰을 보는 사장님 얼굴,
//     0.7초 고개를 들어 「아…」 하는 얼굴(GPT 정지 컷 — Flow가 11-08 막혀 움직이는 컷 대신 컷 이음),
//     2.3초 벽 달력(월요일마다 빨간 동그라미 · 「휴무」, 폰 속 실제 화면에서 초점이 옮겨 감), 3.9초 실제 입력창에 「아, 지난달부터 쉬는 날을 일요일에서 월요일로」를 친다.
import React from 'react';
import { AbsoluteFill, Audio, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from './lib/fonts';
import { clamp, EASE_OUT, frameSrc, sec, Sfx, Shade, T, X } from './parts';
import { PhoneToCalendar } from './Scene';

export const SCENE2_TOTAL = sec(5.6);
export const F2 = { read: 0, up: 0.8, cal: 2.3, type: 3.9, end: 5.6 };

// 얼굴 정지 컷 — 들어올 때 내려앉고 얼굴 쪽으로 천천히 다가간다
export const FaceStill: React.FC<{ src: string; z?: number; ox?: number; oy?: number; drift?: number }> = ({ src, z = 1.5, ox = 540, oy = 900, drift = 0.0016 }) => {
  const f = useCurrentFrame();
  const zz = z * (interpolate(f, [0, 8], [1.03, 1], { ...clamp, easing: EASE_OUT }) + f * drift);
  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: '#0b0b0b' }}>
      <div style={{ width: 1080, height: 1920, transform: `scale(${zz})`, transformOrigin: `${ox}px ${oy}px` }}>
        <Img src={staticFile(`img/${src}.png`)} style={{ width: 1080, height: 1920, objectFit: 'cover' }} />
      </div>
    </AbsoluteFill>
  );
};

// 실제 입력창 — 사장님이 치는 답(B3r f44 → f52, 넷째 줄까지), 입력창만 밝게
const Typing: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const k = interpolate(f, [0, sec(dur - 0.25)], [44, 51], clamp);
  const box = { x: 0, y: 1768, w: 1080, h: 492 }, s = 1, top = 960;
  return (
    <AbsoluteFill style={{ background: '#0b0b0b' }}>
      <div style={{ position: 'absolute', left: X, top: top - 52, fontFamily: KO, fontWeight: 600, fontSize: 34, color: '#a8a8a8', letterSpacing: -0.4 }}>예시 가게로 실제 ChatGPT에 물어본 화면 · 11월 8일</div>
      <div style={{ position: 'absolute', left: (1080 - box.w * s) / 2, top, width: box.w * s, height: box.h * s, overflow: 'hidden', borderRadius: 26 }}>
        <Img src={frameSrc('b3r', 'f', k)} style={{ position: 'absolute', left: -box.x * s, top: -box.y * s, width: 1080 * s, height: 2341 * s, maxWidth: 'none', filter: 'brightness(1.12)' }} />
      </div>
    </AbsoluteFill>
  );
};

export const Scene2: React.FC = () => (
  <AbsoluteFill style={{ background: '#000' }}>
    <Sequence durationInFrames={sec(F2.up)}><FaceStill src="night" z={1.55} /></Sequence>
    <Sequence from={sec(F2.up)} durationInFrames={sec(F2.cal - F2.up)}><FaceStill src="up" z={1.62} /></Sequence>
    <Sequence from={sec(F2.cal)} durationInFrames={sec(F2.type - F2.cal)}><PhoneToCalendar t0={3.5} text={false} /></Sequence>
    <Sequence from={sec(F2.type)}><Typing dur={F2.end - F2.type} /></Sequence>
    <Shade a={0.9} />
    {/* 달력 칸은 전등 빛이 위 글과 겹쳐 위를 더 어둡게 */}
    <Sequence from={sec(F2.cal)} durationInFrames={sec(F2.type - F2.cal)}><AbsoluteFill style={{ background: 'linear-gradient(to bottom, rgba(8,8,8,0.82) 0px, rgba(8,8,8,0.7) 520px, rgba(8,8,8,0) 760px)' }} /></Sequence>
    <T still lines={['매출 20~30% 줄었는데', 'AI가 되묻습니다']} from={0} to={F2.up} />
    <T meta="AI의 넷째 질문" lines={['최근 한두 달 사이에', '달라진 게 있나요?']} from={F2.up} to={F2.cal} />
    <T me lines={['아, 쉬는 날을', '월요일로 바꿨지']} from={F2.cal + 0.05} to={F2.end + 1} />
    <Audio src={staticFile('sfx/room.wav')} volume={(fr: number) => 0.24 * interpolate(fr, [0, 6, SCENE2_TOTAL - 8, SCENE2_TOTAL], [0, 1, 1, 0], clamp)} />
    <Sfx at={0.15} src="tick" v={0.18} />
    <Sfx at={F2.cal} src="tok" v={0.14} />
  </AbsoluteFill>
);
