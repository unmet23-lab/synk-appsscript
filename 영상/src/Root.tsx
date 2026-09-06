import React from "react";
import { Composition } from "remotion";
import { 폰트시험 } from "./시험/폰트시험";
import { 로고시험 } from "./시험/로고시험";
import { 리드크루클립 } from "./클립/리드크루클립";
import { 커버 } from "./클립/커버";
import { 카운트다운 } from "./클립/카운트다운";
import { 카운트다운커버 } from "./클립/카운트다운커버";
import { 첫게시물티저, 정사각, 티저길이 } from "./클립/첫게시물티저";
import { 대본클립들 } from "./클립/생성/대본클립들";
import { 카운트다운들 } from "./클립/생성/카운트다운들";
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
 * 🔑 그래서 id 를 «로마자 표기»로 짓지 않는다 — 표기법이 갈리면 45편이 45가지로 선다.
 *   `clip-<편>-<화>` 로만 짓고, 사람이 읽는 이름은 `클립.제목`(한글)이 쥔다.
 *
 * 🔴 편을 여기에 손으로 «등록하지» 않는다. 대본 md 가 정본이고 `대본읽기.js` 가 목록을 만든다 —
 *   첫 판은 01편 1화 하나가 손으로 적혀 있었고, 그 손옮김이 대본에 없는 몽골어를 지어냈다.
 */
export const Root: React.FC = () => {
  return (
    <>
      {대본클립들.map((클립) => (
        <React.Fragment key={클립.id}>
          <Composition
            id={클립.id}
            component={리드크루클립}
            durationInFrames={클립.전체프레임}
            {...세로}
            defaultProps={{ 클립 }}
          />
          {/* 표지 — 릴에 «직접 지정»하는 썸네일. 플랫폼에 맡기면 첫 프레임(거의 빈 화면)이 표지가 된다.
              🔑 id 를 «클립 id + -cover» 로 짓는다(08-27). 전엔 `cover-편-화` 였는데, 한 대본이
                 가이드마다 한 벌씩 나면서 **두 클립이 같은 표지 id 를 가리키게** 됐다.
                 카운트다운이 이미 이 꼴이라 두 지면의 규칙도 같아진다. */}
          <Composition
            id={`${클립.id}-cover`}
            component={커버}
            durationInFrames={1}
            {...세로}
            defaultProps={{ 클립 }}
          />
        </React.Fragment>
      ))}

      {/* 카운트다운 릴 — 릴 A 포맷(유호 확정 08-26). 대본 폴더가 다르므로 목록도 따로 온다. */}
      {카운트다운들.map((클립) => (
        <React.Fragment key={클립.id}>
          <Composition
            id={클립.id}
            component={카운트다운}
            durationInFrames={클립.전체프레임}
            {...세로}
            defaultProps={{ 클립 }}
          />
          <Composition
            id={`${클립.id}-cover`}
            component={카운트다운커버}
            durationInFrames={1}
            {...세로}
            defaultProps={{ 클립 }}
          />
        </React.Fragment>
      ))}

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
