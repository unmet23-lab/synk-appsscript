import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import type { 클립 } from "./01_안녕하세요";
import { 지면, 율, 색 } from "../킷/색";
import { 본문스택, 웨이트, 트래킹, 몽골어보정 } from "../킷/폰트";

/**
 * 표지(커버) — 릴에 «반드시 직접 지정»하는 썸네일.
 *
 * 🔴 왜 이게 따로 필요한가 — 이 저장소가 이미 한 번 물린 자리다.
 *   `docs/홍보물/README.md` 원문: 「⚠**썸네일로 반드시 직접 지정**한다 — 안 하면 FB 가
 *   첫 프레임(거의 캄캄한 화면)을 쓴다」.
 *   우리 릴도 똑같다 — 0프레임은 훅 자막이 스프링으로 «들어오는 중»이라 거의 빈 화면이다.
 *   플랫폼에 맡기면 그 빈 화면이 표지가 된다.
 *
 * 🔑 표지는 영상의 한 프레임이 아니라 **따로 짠 한 장**이다. 움직임이 없으니 글자를 더 크게,
 *   여백을 더 넓게 쓸 수 있고, 피드에서 손가락을 멈추게 하는 것만 한다.
 *
 * ⚠ 이름 「몽글」은 여기에도 «안 박는다» — synk-brand 「확정 ≠ 전파」(말가이 원어민 검수 대기).
 *   브랜드 표식은 로고가 진다(SYNK 는 대외에 이미 나간 이름이다).
 */
const 그늘 = (a: number) => `rgba(8, 9, 12, ${a})`;

export const 커버: React.FC<{ 클립: 클립 }> = ({ 클립 }) => {
  /* 표지에 세우는 것은 «표현» 한 장면뿐이다 — 피드에서 0.5초 안에 읽혀야 한다 */
  const 표현 = 클립.장면들[0];

  return (
    <AbsoluteFill style={{ backgroundColor: 지면.바탕 }}>
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, ${지면.바탕} 30%, ${지면.신호바닥} 88%)`,
        }}
      />

      {/* 위: 무엇을 배우나 */}
      <AbsoluteFill
        style={{
          justifyContent: "flex-start",
          alignItems: "center",
          paddingTop: 300,
          paddingLeft: 율.켜,
          paddingRight: 율.켜,
          textAlign: "center",
          gap: 율.단,
        }}
      >
        <div
          style={{
            fontFamily: 본문스택,
            fontSize: 42,
            fontWeight: 웨이트.강조_라벨,
            color: 지면.글자,
            backgroundColor: 지면.신호면,
            padding: `${율.참}px ${율.켜}px`,
            borderRadius: 999,
            letterSpacing: 트래킹.본문,
            boxShadow: `0 8px 20px ${그늘(0.14)}`,
          }}
        >
          오늘의 한 문장
        </div>

        <div
          style={{
            fontFamily: 본문스택,
            fontSize: 152,
            fontWeight: 웨이트.태그라인_한글,
            color: 지면.글자,
            letterSpacing: 트래킹.헤드_태그라인,
            lineHeight: 1.12,
          }}
        >
          {표현.한국어}
        </div>

        <div
          style={{
            fontFamily: 본문스택,
            fontSize: Math.round(52 * 몽골어보정),
            fontWeight: 웨이트.본문_UI,
            color: 지면.보조글자,
            letterSpacing: 트래킹.본문,
          }}
        >
          {표현.몽골어}
        </div>
      </AbsoluteFill>

      {/* 가운데: 몽글 */}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", paddingTop: 300 }}>
        <Img
          src={staticFile("몽글/눈웃음.png")}
          style={{
            width: 720,
            height: 720,
            filter: `drop-shadow(0 22px 30px ${그늘(0.18)})`,
          }}
        />
      </AbsoluteFill>

      {/* 아래: 브랜드 표식. 이름이 아니라 로고가 진다 */}
      <AbsoluteFill
        style={{
          justifyContent: "flex-end",
          alignItems: "center",
          paddingBottom: 250,
          gap: 율.칸,
        }}
      >
        <Img src={staticFile("로고/민라이트.svg")} style={{ width: 250 }} />
        <div
          style={{
            fontFamily: 본문스택,
            fontSize: 34,
            fontWeight: 웨이트.캡션_보조,
            color: 색("Coral 3"),
            letterSpacing: 트래킹.본문,
          }}
        >
          солонгос хэл · 한국어 첫 문장
        </div>
      </AbsoluteFill>

      {/* 실땀 — 지면 아래를 여민다 */}
      <AbsoluteFill style={{ justifyContent: "flex-end" }}>
        <div style={{ height: 율.실 * 3, backgroundColor: 지면.실땀 }} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
