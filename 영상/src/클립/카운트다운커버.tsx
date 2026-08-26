/**
 * 카운트다운 릴의 «표지» — 피드에서 손가락을 멈추게 하는 한 장.
 *
 * 🔴 리드크루 클립의 `커버.tsx` 를 못 쓴다: 그 파일은 `클립.장면들[0] = 표현` 을 전제한다.
 *   카운트다운의 첫 칸은 «5위»라, 그대로 쓰면 표지에 「5」와 5위 표현이 박힌다 —
 *   릴을 여는 이유(훅)도, 무엇에 관한 릴인지도 안 보인다.
 *
 * 그래서 표지가 지는 것은 셋이다: ① TOP 5 배지 ② 훅 한 줄 ③ 가이드.
 *   1위를 표지에 안 쓴다 — 카운트다운은 «1위를 모르는 채로» 들어와야 끝까지 본다.
 */
import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import type { 카운트다운 as 카운트다운형 } from "./타입";
import { 지면, 율, 색 } from "../킷/색";
import { 본문스택, 웨이트, 트래킹 } from "../킷/폰트";
import { 로고, 그늘 } from "./연출";

export const 카운트다운커버: React.FC<{ 클립: 카운트다운형 }> = ({ 클립 }) => {
  /* 훅에서 이모지를 뗀다 — 표지는 정지화라 이모지가 «움직이지 않는 장식»으로 남는다.
     그리고 브랜드 폰트 아홉 벌 어디에도 이모지가 없어 기계마다 다른 그림이 난다(cmap 실측). */
  const 훅글 = 클립.훅.replace(/\p{Extended_Pictographic}/gu, "").trim();
  const 크기 = 훅글.length <= 14 ? 96 : 훅글.length <= 22 ? 78 : 66;

  return (
    <AbsoluteFill style={{ backgroundColor: 지면.바탕 }}>
      <AbsoluteFill
        style={{ background: `linear-gradient(180deg, ${지면.바탕} 30%, ${지면.신호바닥} 88%)` }}
      />

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
        {/* ① TOP 5 배지 — 코랄은 «면»이고 그 위 글자는 Ink 다(종이 위 코랄 «글자»는 대비 2.75 로 금지) */}
        <div
          style={{
            fontFamily: 본문스택,
            fontSize: 52,
            fontWeight: 웨이트.강조_라벨,
            color: 지면.글자,
            backgroundColor: 지면.신호면,
            padding: `${율.틈}px ${율.단}px`,
            borderRadius: 999,
            letterSpacing: 트래킹.본문,
            boxShadow: `0 8px 20px ${그늘(0.14)}`,
          }}
        >
          TOP {클립.순위들.length}
        </div>

        {/* ② 훅 — 표지에서 제일 큰 것. `keep-all` 이 낱말 가운데 끊김을 막는다
            (표지 10장 중 셋이 「주문 도와드릴까 / 요?」로 끊겼던 자리와 같은 병이다). */}
        <div
          style={{
            fontFamily: 본문스택,
            fontSize: 크기,
            fontWeight: 웨이트.태그라인_한글,
            color: 지면.글자,
            letterSpacing: 트래킹.헤드_태그라인,
            lineHeight: 1.18,
            wordBreak: "keep-all",
            /* 🔑 두 줄이 날 때 «둘째 줄에 한 어절만» 떨어지는 것을 막는다(실측: 「…이 다섯 / 개예요」).
               Remotion 은 크롬에서 렌더하므로 `text-wrap: balance` 가 실제로 듣는다 — 줄 길이를
               스스로 고르게 나눈다. 폭을 손으로 잡아 두는 것보다 글자 수에 안 흔들린다. */
            textWrap: "balance",
            maxWidth: 820,
          }}
        >
          {훅글}
        </div>
      </AbsoluteFill>

      {/* ③ 가이드 — 폭은 릴 본편과 «같은 비율»이라 표지와 첫 프레임이 안 어긋난다 */}
      <AbsoluteFill
        style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 300 }}
      >
        <Img
          src={staticFile(`${클립.가이드}/본체.png`)}
          style={{
            width: Math.round(1080 * 클립.폭비),
            filter: `drop-shadow(0 18px 26px ${그늘(0.16)})`,
          }}
        />
      </AbsoluteFill>

      <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center", paddingTop: 150 }}>
        <Img src={staticFile(로고.파일)} style={{ width: 220 }} />
      </AbsoluteFill>

      <AbsoluteFill
        style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 120 }}
      >
        <div
          style={{
            fontFamily: 본문스택,
            fontSize: 34,
            fontWeight: 웨이트.캡션_보조,
            color: 색("Coral 3"),
            letterSpacing: 트래킹.본문,
          }}
        >
          солонгос хэл · 한국어 한 컷
        </div>
      </AbsoluteFill>

      <AbsoluteFill style={{ justifyContent: "flex-end" }}>
        <div style={{ height: 율.실 * 3, backgroundColor: 지면.실땀 }} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
