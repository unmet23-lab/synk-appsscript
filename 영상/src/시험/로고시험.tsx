/**
 * 로고 갈래 눈검사 — «어느 판을 쓸 것인가»를 화면에서 고르기 위한 정지화.
 *
 * 🔴 왜 필요했나(08-26): 이 통로가 릴에 `민라이트` 를 쓰고 있었다. 근거로 든 것은
 *   킷 §3 의 「크기가 표현을 정한다 — 문턱 180px, 그 아래는 민판」이었는데,
 *   **로고 크기를 내가 150px 로 잡아 놓고 그 크기를 근거로 표현을 골랐다.** 순환이다.
 *   같은 §3 이 바로 위 표에서 「펠트판 … 이름을 보여주는 순간. **기본값이다**」라고 적었고,
 *   「펠트판이 사는 자리는 스플래시·포스터급 큰 판」이라고도 적었다 — 1080×1920 세로 릴은
 *   스플래시(202dp)보다 훨씬 큰 판이다.
 *
 * 이 컴포지션은 판정을 «대신하지» 않는다. 갈래를 한 화면에 세워 유호님 눈에 올리는 자리다.
 *   `node 영상/굽기.js --목록` 에서 `logo-check` 로 보이고, 정지화라 몇 초면 나온다.
 */
import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { 지면, 율 } from "../킷/색";
import { 본문스택, 웨이트 } from "../킷/폰트";

const 갈래 = [
  { 이름: "펠트라이트", 설명: "킷 §3 기본값 — 보풀 헤일로 · 손맛 실땀 · 두께 2톤" },
  { 이름: "알록synk", 설명: "특별판 — 하얀 펠트 몸 + 색실 다섯" },
  { 이름: "민라이트", 설명: "지금 릴이 쓰던 것 — 필터 0(작은 자리·1도 인쇄용)" },
  { 이름: "단색라이트", 설명: "단색 갈래" },
  { 이름: "꺾쇠라이트", 설명: "앱 락업 syn< — 대외 자리에는 안 쓴다" },
  { 이름: "알록꺾쇠", 설명: "앱 락업 특별판" },
];

/** 크기가 표현을 정한다 — 문턱 180px 을 «양쪽에서» 본다. */
const 크기들 = [132, 240, 340];

export const 로고시험: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: 지면.바탕, padding: 율.켜 }}>
    <div style={{ display: "flex", flexDirection: "column", gap: 율.단 }}>
      {갈래.map((g) => (
        <div key={g.이름} style={{ borderTop: `2px solid ${지면.실땀}`, paddingTop: 율.참 }}>
          <div
            style={{
              fontFamily: 본문스택,
              fontSize: 26,
              fontWeight: 웨이트.강조_라벨,
              color: 지면.글자,
              marginBottom: 4,
            }}
          >
            {g.이름}
          </div>
          <div
            style={{
              fontFamily: 본문스택,
              fontSize: 20,
              fontWeight: 웨이트.캡션_보조,
              color: 지면.캡션글자,
              marginBottom: 율.틈,
            }}
          >
            {g.설명}
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 율.단 }}>
            {크기들.map((px) => (
              <div key={px} style={{ textAlign: "center" }}>
                <Img src={staticFile(`로고/${g.이름}.svg`)} style={{ width: px }} />
                <div
                  style={{
                    fontFamily: 본문스택,
                    fontSize: 17,
                    color: 지면.캡션글자,
                    marginTop: 6,
                  }}
                >
                  {px}px{px < 180 ? " (문턱 아래)" : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  </AbsoluteFill>
);
