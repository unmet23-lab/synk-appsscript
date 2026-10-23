// 콘티 v3.1 영상 판(10-23 유호님 「이대로 Omni 1.1 Flash로 영상 만들자」): 컷 이름 → 고른 Omni 클립(색감 입힌 판, public/clips/<file>.mp4)과 쓰기 시작할 초.
// 영상 판(`Film-3V` · `Band916-3V`)에서만 쓰고, 여기 없는 컷은 정지컷 그대로다. 클립을 고를 때마다 이 표만 고친다(영상_색감.py가 만든 파일 이름).
import React from 'react';

// from: 클립에서 쓰기 시작할 초 · rate: 빠르기(C01a 그림자가 4초에 걸쳐 들어오면 컷 안에 맞게 당긴다)
export type Clip = { file: string; from?: number; rate?: number };
export const CLIPS_V3: Record<string, Clip> = {
  C03v3: { file: 'C03v3_a', from: 0 },
};

// 영상 판인지 — FilmV3가 주고, 정지컷 칸(StillCut)과 쇼호스트 칸(hs/v3.tsx HostShot)이 읽는다
export const VideoMode = React.createContext(false);
