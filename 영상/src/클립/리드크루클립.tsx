import React from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { 클립, 장면 } from "./01_안녕하세요";
import { 지면, 율, 색 } from "../킷/색";
import { 본문스택, 웨이트, 트래킹, 몽골어보정 } from "../킷/폰트";

/* ────────────────────────────────────────────────────────────────────────────
 * 연출 값. 🔴 토큰 `감각.가안` 을 **인용하지 않는다** — DESIGN.md §8 이
 * 「가안 · Expo 첫 화면 실물에서 확정 · 확정 전까지 새 산출물이 인용 금지」로 못 박아 뒀다.
 * 그리고 그 블록은 «UI 모션»(눌림·시트·툴팁) 값이라 영상 연출과 축이 다르다.
 * 여기 값은 영상 전용이고, 킷을 참칭하지 않는다.
 * 지키는 것은 킷 «규칙» 쪽이다: transform·opacity 만 움직인다.
 * ──────────────────────────────────────────────────────────────────────────── */
const 연출 = {
  자막등장f: 12,
  몽글부유f: 120,
  몽글부유px: 14,
  깜빡주기f: 96,
  깜빡길이f: 5,
  몽글폭: 700,
  /* 🔴 인스타/틱톡은 화면 «하단 250px 안팎»을 자기 UI(계정·캡션·버튼)로 덮는다.
     몽글을 바닥에 붙이면 그 UI 에 다리가 잘린다 — 실물 앱에서만 드러나는 자리라
     여기서 미리 띄운다. 발행 규격이 바뀌면 이 한 값만 고친다. */
  안전여백아래: 210,
} as const;

/** 몽글 — 무언의 선생님. 말하지 않는다. 표정과 몸짓이 첫 언어다(synk-brand). */
const 몽글: React.FC<{ 표정: 장면["표정"] }> = ({ 표정 }) => {
  const frame = useCurrentFrame();

  /* 살아 있게 하는 것은 둘뿐이다 — 숨(부유)과 눈(깜빡임). 둘 다 transform·opacity 안에서 끝난다. */
  const 부유 = Math.sin((frame / 연출.몽글부유f) * Math.PI * 2) * 연출.몽글부유px;

  /* 눈웃음 장면에서는 깜빡이지 않는다 — 이미 눈을 감은 그림이라 겹치면 표정이 무너진다. */
  const 깜빡 = 표정 === "본체" && frame % 연출.깜빡주기f < 연출.깜빡길이f;
  const 컷 = 깜빡 ? "눈감음" : 표정;

  return (
    <Img
      src={staticFile(`몽글/${컷}.png`)}
      style={{
        width: 연출.몽글폭,
        height: 연출.몽글폭,
        transform: `translateY(${부유}px)`,
      }}
    />
  );
};

/** 자막 한 장면. 한국어를 크게, 몽골어를 병기로 — 제작가이드가 정한 규격이다. */
const 자막: React.FC<{ 장면: 장면 }> = ({ 장면 }) => {
  const frame = useCurrentFrame();

  const 등장 = interpolate(frame, [0, 연출.자막등장f], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  /* 한국어가 길면 글자를 줄인다 — 잘리는 것보다 작아지는 편이 낫다
     (uupm UX 「필수 텍스트는 잘리면 안 된다」 = Critical). */
  const 한글크기 = 장면.한국어.length <= 8 ? 118 : 장면.한국어.length <= 16 ? 82 : 64;

  return (
    <div
      style={{
        opacity: 등장,
        transform: `translateY(${(1 - 등장) * 24}px)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 율.단,
        paddingLeft: 율.막,
        paddingRight: 율.막,
        textAlign: "center",
      }}
    >
      {/* 라벨 — 코랄은 «면»이다. 면 위 글자는 Ink(종이 위 코랄 «글자»는 대비 2.75 로 금지) */}
      <div
        style={{
          fontFamily: 본문스택,
          fontSize: 38,
          fontWeight: 웨이트.강조_라벨,
          color: 지면.글자,
          backgroundColor: 지면.신호면,
          padding: `${율.숨}px ${율.단}px`,
          borderRadius: 999,
          letterSpacing: 트래킹.본문,
        }}
      >
        {장면.라벨}
      </div>

      <div
        style={{
          fontFamily: 본문스택,
          fontSize: 한글크기,
          fontWeight: 웨이트.헤드,
          color: 지면.글자,
          letterSpacing: 트래킹.헤드_태그라인,
          lineHeight: 1.25,
        }}
      >
        {장면.한국어}
      </div>

      <div
        style={{
          fontFamily: 본문스택,
          fontSize: Math.round(40 * 몽골어보정),
          fontWeight: 웨이트.본문_UI,
          color: 지면.보조글자,
          letterSpacing: 트래킹.본문,
          lineHeight: 1.4,
        }}
      >
        {장면.몽골어}
      </div>
    </div>
  );
};

export const 리드크루클립: React.FC<{ 클립: 클립 }> = ({ 클립 }) => {
  const { fps } = useVideoConfig();
  const 훅프레임 = 90; /* 0~3초 — 제작가이드 4단 구성의 첫 칸 */

  let 커서 = 훅프레임;

  return (
    <AbsoluteFill style={{ backgroundColor: 지면.바탕 }}>
      {/* 깔림 — 튀는 소리를 뺀 개정판. 자막 낭독을 덮지 않게 낮게 깐다 */}
      <Audio src={staticFile("소리/BGM_깔림.wav")} volume={0.18} />

      {/* 바닥 결 — 코랄이 앉는 여린 면. 유채 실은 «주연 1(코랄)» 하나로 끝낸다 */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, ${지면.바탕} 38%, ${지면.신호바닥} 88%)`,
        }}
      />

      {/* ── 훅 (0~3초) ─────────────────────────────────────────────── */}
      <Sequence durationInFrames={훅프레임}>
        <훅자막 글={클립.훅} />
      </Sequence>

      {/* ── 본문 6장면 ─────────────────────────────────────────────── */}
      {클립.장면들.map((장면, i) => {
        const 시작 = 커서;
        커서 += 장면.프레임;
        return (
          <Sequence key={i} from={시작} durationInFrames={장면.프레임}>
            <AbsoluteFill
              style={{
                justifyContent: "center",
                alignItems: "center",
                paddingBottom: 560,
              }}
            >
              <자막 장면={장면} />
            </AbsoluteFill>
            <AbsoluteFill
              style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 연출.안전여백아래 }}
            >
              <몽글 표정={장면.표정} />
            </AbsoluteFill>
            {장면.소리 ? <Audio src={staticFile(`소리/${장면.소리}`)} /> : null}
          </Sequence>
        );
      })}

      {/* 실땀 — 모든 펠트 오브젝트의 테두리. 지면 아래를 한 줄로 여민다 */}
      <AbsoluteFill style={{ justifyContent: "flex-end" }}>
        <div style={{ height: 율.실 * 3, backgroundColor: 지면.실땀 }} />
      </AbsoluteFill>

      {/* fps 는 컴포지션이 쥔다 — 여기서 다시 정하지 않는다 */}
      <div style={{ display: "none" }}>{fps}</div>
    </AbsoluteFill>
  );
};

/** 훅 — 첫 2~3초. 궁금·공감을 여는 자리(synk-content §2). */
const 훅자막: React.FC<{ 글: string }> = ({ 글 }) => {
  const frame = useCurrentFrame();
  const 등장 = interpolate(frame, [0, 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  return (
    <>
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          paddingBottom: 560,
          paddingLeft: 율.막,
          paddingRight: 율.막,
        }}
      >
        <div
          style={{
            opacity: 등장,
            transform: `translateY(${(1 - 등장) * 28}px)`,
            fontFamily: 본문스택,
            fontSize: 74,
            fontWeight: 웨이트.태그라인_한글,
            color: 색("Coral 3"),
            letterSpacing: 트래킹.헤드_태그라인,
            lineHeight: 1.3,
            textAlign: "center",
          }}
        >
          {글}
        </div>
      </AbsoluteFill>
      <AbsoluteFill
        style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 연출.안전여백아래 }}
      >
        <몽글 표정="본체" />
      </AbsoluteFill>
    </>
  );
};
