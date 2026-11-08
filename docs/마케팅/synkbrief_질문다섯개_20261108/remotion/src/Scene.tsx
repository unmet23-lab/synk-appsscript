// synkbrief B32 한 장면(장면 심사용 · 제목 · 브랜드 · 해설 없음).
// v1(11-08): 마감한 백반집, 사장님 폰 속 실제 ChatGPT가 질문을 넘기다 「4. 최근 한두 달 사이에 달라진 게 있나요?」에서 멈추고(엄지가 멈춤),
//   카메라가 고개를 들듯 폰에서 벽 달력으로 올라가며 초점이 옮겨 간다 — 월요일마다 빨간 동그라미 · 「휴무」.
import React from 'react';
import { AbsoluteFill, Audio, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { camStyle, clamp, EASE_IO, EASE_OUT, frameSrc, PhonePlate, sec, Sfx, Shade, T } from './parts';

export const SCENE_TOTAL = sec(5.6);
// 판 좌표(원본 화소): 폰에서 질문이 멈추는 자리 · 달력 가운데 · 동그라미 줄
const A = { z: 2.35, fx: 439, fy: 1134, sx: 540, sy: 1240 };
const B = { z: 1.25, fx: 475, fy: 530, sx: 540, sy: 1060 };
// 11-08 셋째 판: 끝은 월요일 동그라미 줄과 오른쪽 아래 쪽지(「10월부터 정기휴무 일 → 월」)가 함께 들어오는 자리
const C = { z: 1.5, fx: 500, fy: 640, sx: 540, sy: 1120 };
export const SP = { stop: 2.2, lift0: 2.55, lift1: 4.35, end: 5.6 };

// screen — 폰에 넣을 실제 화면(기본: 질문 2번 근처 roll 20 → 4번이 화면 위 3분의 1에 오는 roll 75에서 멈춘다)
export const PhoneToCalendar: React.FC<{ t0?: number; text?: boolean; screen?: { dir: string; pre: string; k0: number; k1?: number } }> = ({ t0 = 0, text = true, screen = { dir: 'b3roll', pre: 's', k0: 20, k1: 75 } }) => {
  const f = useCurrentFrame();
  const t = f / 30 + t0;
  const k = screen.k1 === undefined ? screen.k0 : interpolate(t, [0, SP.stop], [screen.k0, screen.k1], { ...clamp, easing: EASE_OUT });
  const p1 = interpolate(t, [SP.lift0, SP.lift1], [0, 1], { ...clamp, easing: EASE_IO });
  const p2 = interpolate(t, [SP.lift1, SP.end], [0, 1], clamp);
  const mix = (a: number, b: number, p: number) => a + (b - a) * p;
  const cam = p2 > 0
    ? { z: mix(B.z, C.z, p2), fx: mix(B.fx, C.fx, p2), fy: mix(B.fy, C.fy, p2), sx: mix(B.sx, C.sx, p2), sy: mix(B.sy, C.sy, p2) }
    : { z: mix(A.z, B.z, p1), fx: mix(A.fx, B.fx, p1), fy: mix(A.fy, B.fy, p1), sx: mix(A.sx, B.sx, p1), sy: mix(A.sy, B.sy, p1) };
  const blurPhone = interpolate(t, [SP.lift0 + 0.3, SP.lift0 + 1.3], [0, 7], clamp);
  const blurTop = interpolate(t, [SP.lift0, SP.lift0 + 0.9], [6, 0], clamp);
  return (
    <AbsoluteFill style={{ background: '#0b0b0b', overflow: 'hidden' }}>
      <div style={camStyle(cam.z, cam.fx, cam.fy, cam.sx, cam.sy)}>
        <PhonePlate screen={frameSrc(screen.dir, screen.pre, k)} blurPhone={blurPhone} blurTop={blurTop} screenLight={interpolate(blurPhone, [0, 7], [0.86, 0.42], clamp)} />
      </div>
      {text ? (
        <>
          <Shade a={interpolate(t, [SP.lift0, SP.lift1], [0.9, 0.7], clamp)} />
          <T meta="AI의 넷째 질문" lines={['최근 한두 달 사이에', '달라진 게 있나요?']} from={0.25 - t0} to={SP.lift0 + 0.5 - t0} />
          <T me lines={['아…']} from={3.7 - t0} to={SP.end + 2 - t0} size={104} />
        </>
      ) : null}
    </AbsoluteFill>
  );
};

export const Scene: React.FC = () => (
  <AbsoluteFill style={{ background: '#000' }}>
    <PhoneToCalendar />
    <Audio src={staticFile('sfx/room.wav')} volume={(fr: number) => 0.24 * interpolate(fr, [0, 6, SCENE_TOTAL - 8, SCENE_TOTAL], [0, 1, 1, 0], clamp)} />
    <Sfx at={0.15} src="tick" v={0.22} />
    <Sfx at={0.7} src="tick" v={0.2} />
    <Sfx at={1.3} src="tick" v={0.18} />
    <Sfx at={SP.lift1 - 0.1} src="tok" v={0.16} />
  </AbsoluteFill>
);
