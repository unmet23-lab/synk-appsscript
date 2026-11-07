// synkbrief B32 한 장면 v2(장면 심사용 · 제목 · 브랜드 · 해설 없음).
// v1 「넘김 · 2 — 0~3초가 작은 글씨 채팅이고 거의 안 움직임 · 0초에 큰 글자 없음 · 「아…」는 글자 대신 얼굴로 · 달력과 표정을 먼저」
// v2: 0초부터 사장님 얼굴(Flow 컷 — 폰을 넘기던 엄지가 멈추고 고개를 들며 「아…」) + 위 큰 글자 AI의 넷째 질문,
//     2.5초 벽 달력(월요일마다 빨간 동그라미 · 「휴무」), 4.0초 실제 입력창에 「아, 지난달부터 쉬는 날을 일요일에서 월요일로」를 친다.
import React from 'react';
import { AbsoluteFill, Audio, Img, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from './lib/fonts';
import { clamp, EASE_OUT, frameSrc, sec, Sfx, Shade, T, X } from './parts';
import { PhoneToCalendar } from './Scene';

export const SCENE2_TOTAL = sec(5.6);
export const F2 = { face: 0, cal: 2.5, type: 4.0, end: 5.6 };
const FACE_IN = 1.3; // 얼굴 컷에서 쓰기 시작하는 초(엄지가 넘기다 멈추기 바로 앞)

export const FaceShot: React.FC<{ start: number; z?: number; ox?: number; oy?: number; still?: boolean }> = ({ start, z = 1.28, ox = 540, oy = 760, still }) => {
  const f = useCurrentFrame();
  const zz = z * interpolate(f, [0, 8], [1.03, 1], { ...clamp, easing: EASE_OUT }) + f * 0.0006;
  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: '#0b0b0b' }}>
      <div style={{ width: 1080, height: 1920, transform: `scale(${zz})`, transformOrigin: `${ox}px ${oy}px` }}>
        {still
          ? <Img src={staticFile('img/night.png')} style={{ width: 1080, height: 1920, objectFit: 'cover' }} />
          : <OffthreadVideo muted src={staticFile('plate/face.mp4')} startFrom={sec(start)} style={{ width: 1080, height: 1920, objectFit: 'cover' }} />}
      </div>
    </AbsoluteFill>
  );
};

// 실제 입력창 — 사장님이 치는 답(B3r f44 → f62), 입력창 줄만 밝게
const Typing: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const k = interpolate(f, [0, sec(dur - 0.2)], [44, 62], clamp);
  const box = { x: 0, y: 1150, w: 1080, h: 1070 }, s = 0.95, top = 680;
  const lit = [1780, 2220];
  return (
    <AbsoluteFill style={{ background: '#0b0b0b' }}>
      <div style={{ position: 'absolute', left: X, top: top - 52, fontFamily: KO, fontWeight: 600, fontSize: 30, color: '#9a9a9a', letterSpacing: -0.4 }}>예시 가게로 실제 ChatGPT에 물어본 화면 · 11월 8일</div>
      <div style={{ position: 'absolute', left: (1080 - box.w * s) / 2, top, width: box.w * s, height: box.h * s, overflow: 'hidden', borderRadius: 26 }}>
        <Img src={frameSrc('b3r', 'f', k)} style={{ position: 'absolute', left: -box.x * s, top: -box.y * s, width: 1080 * s, height: 2341 * s, maxWidth: 'none', filter: 'brightness(1.12)' }} />
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: (lit[0] - box.y) * s, background: 'rgba(11,11,11,0.66)' }} />
      </div>
    </AbsoluteFill>
  );
};

export const Scene2: React.FC<{ still?: boolean }> = ({ still }) => (
  <AbsoluteFill style={{ background: '#000' }}>
    <Sequence durationInFrames={sec(F2.cal)}><FaceShot start={FACE_IN} still={still} /></Sequence>
    <Sequence from={sec(F2.cal)} durationInFrames={sec(F2.type - F2.cal)}><PhoneToCalendar t0={3.7} text={false} /></Sequence>
    <Sequence from={sec(F2.type)}><Typing dur={F2.end - F2.type} /></Sequence>
    <Shade a={0.9} />
    <T meta="AI의 넷째 질문" lines={['최근 한두 달 사이에', '달라진 게 있나요?']} from={0} to={F2.type} />
    <T me lines={['아, 쉬는 날을 바꿨지']} from={F2.type + 0.1} to={F2.end + 1} />
    {still ? null : <Sequence><Audio src={staticFile('plate/face.mp4')} startFrom={sec(FACE_IN)} endAt={sec(FACE_IN + F2.cal)} volume={0.9} /></Sequence>}
    <Audio src={staticFile('sfx/room.wav')} volume={(fr: number) => 0.22 * interpolate(fr, [0, 6, SCENE2_TOTAL - 8, SCENE2_TOTAL], [0, 1, 1, 0], clamp)} />
    <Sfx at={F2.cal} src="tok" v={0.14} />
  </AbsoluteFill>
);
