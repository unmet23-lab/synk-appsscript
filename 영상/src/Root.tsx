import React from "react";
import { Composition } from "remotion";
import { 폰트시험 } from "./시험/폰트시험";
import { 리드크루클립 } from "./클립/리드크루클립";
import { 클립01 } from "./클립/01_안녕하세요";
import "./킷/폰트"; /* 부수효과로 폰트를 등록한다 — delayRender 가 렌더를 기다리게 한다 */

/** 세로 릴 규격 — 인스타/틱톡 공통. */
export const 세로 = { width: 1080, height: 1920, fps: 30 } as const;

/**
 * 🔴 컴포지션 `id` 는 **한글을 못 쓴다.** Remotion 이 던진 원문:
 *   「Composition id can only contain a-z, A-Z, 0-9, CJK characters and -」
 * 「CJK」라고 적혀 있지만 한글 음절은 그 정규식에 안 들어간다(실측 — `폰트시험-로더있음` 거부됨).
 * 그래서 **id 만 영문**이고, 파일·폴더·변수·화면 글자는 이 저장소 관례대로 한글을 그대로 쓴다
 * (번들링은 한글 경로를 통과했다). id 를 지을 때만 이 줄을 떠올리면 된다.
 */
export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="clip-01-annyeong"
        component={리드크루클립}
        durationInFrames={클립01.전체프레임}
        {...세로}
        defaultProps={{ 클립: 클립01 }}
      />

      <Composition
        id="font-check-loaded"
        component={폰트시험}
        durationInFrames={1}
        {...세로}
        defaultProps={{ 로더: true }}
      />
      <Composition
        id="font-check-bare"
        component={폰트시험}
        durationInFrames={1}
        {...세로}
        defaultProps={{ 로더: false }}
      />
    </>
  );
};
