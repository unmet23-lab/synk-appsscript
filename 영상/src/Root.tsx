import React from "react";
import { Composition } from "remotion";
import { 폰트시험 } from "./시험/폰트시험";
import { 로고시험 } from "./시험/로고시험";
import { 첫게시물티저, 정사각, 티저길이 } from "./클립/첫게시물티저";
import "./킷/폰트"; /* 부수효과로 폰트를 등록한다 — delayRender 가 렌더를 기다리게 한다 */

/** 세로 릴 규격 — 인스타/틱톡 공통. */
export const 세로 = { width: 1080, height: 1920, fps: 30 } as const;

/**
 * 🔴 컴포지션 `id` 는 **한글을 못 쓴다.** Remotion 이 던진 원문:
 *   「Composition id can only contain a-z, A-Z, 0-9, CJK characters and -」
 * 「CJK」라고 적혀 있지만 한글 음절은 그 정규식에 안 들어간다(실측 — `폰트시험-로더있음` 거부됨).
 * 그래서 **id 만 영문**이고, 파일·폴더·변수·화면 글자는 이 저장소 관례대로 한글을 그대로 쓴다
 * (번들링은 한글 경로를 통과했다). id 를 지을 때만 이 줄을 떠올리면 된다.
 *
 * 옛 리드크루·카운트다운은 여기서 등록하지 않는다.
 * 새 콘텐츠는 각 프로젝트의 원문과 독립 entry에서 관리한다(영상/README.md).
 */
export const Root: React.FC = () => {
  return (
    <>
      {/* 첫 게시물 티저 — 세로 릴이 아니라 «정사각»이다(페이스북 피드 · 유호 지시 09-07).
          마지막 프레임이 곧 표지 카드가 되도록 짰다. */}
      <Composition
        id="fb-first-teaser"
        component={첫게시물티저}
        durationInFrames={티저길이}
        {...정사각}
      />

      {/* 로고 갈래 눈검사 — 「어느 판을 쓰나」를 화면에서 고른다(폰트시험과 같은 성격의 상시 검사판) */}
      <Composition id="logo-check" component={로고시험} durationInFrames={1} {...세로} />

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
