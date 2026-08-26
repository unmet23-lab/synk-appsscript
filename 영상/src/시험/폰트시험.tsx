import React from "react";
import { AbsoluteFill } from "remotion";
import { 지면, 율, 색 } from "../킷/색";
import { 본문스택, 웨이트, 트래킹, 몽골어보정 } from "../킷/폰트";

/**
 * 「이 노트북에서 브랜드 폰트가 실제로 물렸는가」를 **눈으로** 가르는 대조판.
 *
 * 종료코드는 이 질문에 답하지 못한다 — Remotion 은 폰트를 못 받아도 0 으로 끝난다.
 * 그래서 같은 문장을 두 벌 굽고 나란히 본다:
 *   · 로더 있음 = 등록한 SUIT(한글) + Inter Tight(키릴)
 *   · 로더 없음 = 시스템 기본 sans-serif
 * 차이가 «안 보이면» 그게 위험 신호다 — 이 기계에 폰트가 299벌 깔려 있어 가려진 것이다.
 */
export const 폰트시험: React.FC<{ 로더: boolean }> = ({ 로더 }) => {
  const 서체 = 로더 ? 본문스택 : "sans-serif";

  return (
    <AbsoluteFill
      style={{
        backgroundColor: 지면.바탕,
        justifyContent: "center",
        alignItems: "center",
        padding: 율.막,
        gap: 율.켜,
      }}
    >
      <div
        style={{
          fontFamily: 서체,
          fontSize: 34,
          fontWeight: 웨이트.캡션_보조,
          color: 지면.캡션글자,
          letterSpacing: 트래킹.본문,
        }}
      >
        {로더 ? "로더 있음 — SUIT + Inter Tight" : "로더 없음 — 시스템 sans-serif"}
      </div>

      {/* 한글 — SUIT 가 물려야 한다 */}
      <div
        style={{
          fontFamily: 서체,
          fontSize: 108,
          fontWeight: 웨이트.헤드,
          color: 지면.글자,
          letterSpacing: 트래킹.헤드_태그라인,
        }}
      >
        안녕하세요
      </div>

      {/* 몽골 키릴 — Inter Tight 가 물려야 한다. ө·ү 는 몽골 전용 글자다 */}
      <div
        style={{
          fontFamily: 서체,
          fontSize: 108 * 몽골어보정,
          fontWeight: 웨이트.강조_라벨,
          color: 지면.보조글자,
          letterSpacing: 트래킹.본문,
        }}
      >
        Сайн байна уу
      </div>

      {/* 병기 한 줄 — 한 줄 안에서 두 폰트가 글리프 단위로 갈리는지 보는 자리 */}
      <div
        style={{
          fontFamily: 서체,
          fontSize: 56,
          fontWeight: 웨이트.본문_UI,
          color: 지면.글자,
          letterSpacing: 트래킹.본문,
          backgroundColor: 지면.신호바닥,
          padding: `${율.참}px ${율.단}px`,
          borderRadius: 율.칸,
          border: `${율.실}px solid ${지면.실땀}`,
        }}
      >
        몽골 Монгол · 은빛 мөнгө · ӨҮЖЯ
      </div>

      {/* 코랄은 «면»이다 — 종이 위 글자로 쓰지 않는다(대비 2.75). 면 위 글자는 Ink */}
      <div
        style={{
          fontFamily: 서체,
          fontSize: 44,
          fontWeight: 웨이트.강조_라벨,
          color: 지면.글자,
          backgroundColor: 지면.신호면,
          padding: `${율.참}px ${율.켜}px`,
          borderRadius: 999,
        }}
      >
        따라 해 볼까 · Давтаад үзье
      </div>

      <div
        style={{
          fontFamily: 서체,
          fontSize: 30,
          color: 색("Coral 3"),
          fontWeight: 웨이트.캡션_보조,
        }}
      >
        숫자 0123456789 · Latin AaBbGg
      </div>
    </AbsoluteFill>
  );
};
