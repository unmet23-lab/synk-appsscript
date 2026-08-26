/**
 * 두 벌 이상의 클립이 «같이 쓰는» 연출층 — 값과 컴포넌트의 정본이 여기 하나다.
 *
 * 🔴 왜 뺐나: 카운트다운 릴을 새로 만들면서 그레인·비네트·들임·어절드러내기·안전여백을
 *   그대로 복제할 뻔했다. 복제하는 순간 「자막 안전여백을 얼마로 뒀나」의 주인이 둘이 되고,
 *   한쪽만 고치면 두 지면이 조용히 갈린다 — 이 저장소가 마스코트 10벌로 이미 앓은 병이다.
 *
 * 여기 있는 값은 전부 **실물을 보고 정해진 것**이라 주석이 곧 근거다. 고치기 전에 근거를 읽어라.
 */
import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { 가이드, 표정 } from "./타입";

/* ────────────────────────────────────────────────────────────────────────────
 * 연출 값. 🔴 토큰 `감각.가안` 을 **인용하지 않는다** — DESIGN.md §8 이
 * 「가안 · Expo 첫 화면 실물에서 확정 · 확정 전까지 새 산출물이 인용 금지」로 못 박아 뒀다.
 * 그리고 그 블록은 «UI 모션»(눌림·시트·툴팁) 값이라 영상 연출과 축이 다르다.
 *
 * 지키는 것은 킷 «규칙» 쪽이다: transform·opacity 만 움직이고, 그림자·어둠은 순검정이 아니라
 * **Graphite 틴트**로 낸다 — 「순백·순검정 금지」의 그림자판이다.
 * ──────────────────────────────────────────────────────────────────────────── */
export const 연출 = {
  가이드폭비: 0.76,
  /* 🔴 인스타/틱톡은 화면 «하단»을 자기 UI(계정·캡션·버튼)로 덮는다. 마스코트를 바닥에 붙이면
     그 UI 에 다리가 잘린다. 300 = 틱톡·쇼츠 하한(250)을 넘기면서 마스코트를 자막 쪽으로 끌어올리는 값.
     ⚠ 발행 때는 인스타 «실물 앱»으로 다시 잰다 — 서드파티 출처가 420/450/320 으로 서로 다르다. */
  안전여백아래: 300,
  /* 🔴 우측 «액션열»(좋아요·댓글·공유)이 x910 부터 앉는다. 실측에서 자막 우단이 x980 까지
     나가 끝말이 버튼 밑으로 들어갔다(08-26 · f430·f880). 좌우를 같이 비워 가운데 정렬을 지킨다. */
  안전여백좌우: 170,
  /* 자막 블록의 «위» 앵커. justifyContent:center 로 두면 두 줄이 나는 장면에서 블록이
     통째로 34px 위아래로 튄다 — 학습 자막에서 매 컷 시선 재조정은 손해다. 위를 고정하고
     아래로만 자라게 한다. */
  자막앵커위: 470,
  스프링: { damping: 18, stiffness: 110, mass: 0.9 },
  스프링탄: { damping: 13, stiffness: 170, mass: 0.6 },
  어절간격초: 0.1,
  나감초: 0.28,
  /* 나가는 자막과 들어오는 자막이 «겹치는» 길이. 0 이면 컷마다 화면에 글자가 하나도 없는
     구간이 생긴다(실측 — f90 이 통째로 빈 화면이었다). 시작 시각은 안 건드리고 렌더 길이만 늘린다.
     🔴 0.4 초는 «너무 길었다» — f96 에서 훅 자막과 새 자막이 같은 자리(앵커 y470)에 둘 다 진하게
     떠서 «겹쳐 읽혔다»(실측). 빈 화면을 메우는 데 필요한 만큼만 남기고 나감도 같이 당겼다. */
  겹침초: 0.2,
} as const;

/** Graphite 틴트. 순검정을 안 쓰는 대신 이 함수 하나를 지난다(킷 철칙의 그림자판). */
export const 그늘 = (a: number) => `rgba(8, 9, 12, ${a})`;

/* SVG 노이즈 — 파일 자산 0개로 필름 그레인을 만든다. */
const 노이즈결 =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

/** 마스코트가 «지금 어느 장면에 있나»를 절대프레임으로 찾기 위한 표. */
export type 경계 = { 시작: number; 끝: number; 표정: 표정 };

/* ── 층: 그레인 · 비네트 ──────────────────────────────────────────────────
 * 「평평한 단색 배경 금지」(모션 스킬 비협상 규칙 ⑤). 다만 이건 **학습 콘텐츠**라
 * 자막 가독성이 언제나 이긴다 — 그래서 값을 라이트 테마 권장 하한보다 더 낮춰 잡았다. */
export const 그레인: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        backgroundImage: 노이즈결,
        backgroundSize: "220px",
        backgroundPosition: `${(frame * 7) % 220}px ${(frame * 13) % 220}px`,
        opacity: 0.035,
        mixBlendMode: "multiply",
      }}
    />
  );
};

/** 비네트 — 시선을 가운데로 모은다. 순검정이 아니라 Graphite 틴트다. */
export const 비네트: React.FC = () => (
  <AbsoluteFill
    style={{
      pointerEvents: "none",
      background: `radial-gradient(ellipse at 50% 42%, transparent 62%, ${그늘(0.1)} 100%)`,
    }}
  />
);

/**
 * 마스코트 — 무언의 선생님. 말하지 않는다. 표정과 몸짓이 첫 언어다(synk-brand).
 *
 * 🔴 **`<Sequence>` 밖 고정층에 산다.** 장면 Sequence 안에 두면 `useCurrentFrame()` 이 컷마다
 *   0 으로 리셋되고, 그러면 ① 부유가 컷마다 0 으로 튀어 «순간이동»하고 ② 깜빡임 조건
 *   (`frame % 주기 < 5`)이 **모든 장면의 첫 5프레임에 반드시** 걸린다. 실측에서 f0 과 f90 이
 *   둘 다 눈감음이었다 — 살아 있는 게 아니라 컷에 물린 메트로놈이었고, 릴 커버(f0)가
 *   「빈 종이 + 눈감은 인형」이 된 원인이기도 하다.
 *   그래서 절대프레임으로 살고, 표정만 장면 경계 표에서 찾아 바꾼다.
 *
 * 🔑 `가이드` 로 몽글·까몽을 가른다 — 폴더 이름이 곧 가이드 이름이다(`public/몽글/`·`public/까몽/`).
 *   컷 세 장(본체·눈감음·눈웃음)은 둘이 «같은 이름»이라 컴포넌트가 하나로 선다.
 *
 * 🔑 `말할때` 는 옹알이가 나는 프레임들이다. 소리가 날 때 몸이 «톡» 하고 반응해야
 *   「말하고 있다」로 읽힌다 — 소리만 나고 몸이 가만있으면 알림음으로 들린다(유호 지시 08-26
 *   「옹알이하는 느낌으로 말하는 느낌만 주고」의 그림 쪽 절반이다).
 */
export const 마스코트: React.FC<{
  가이드: 가이드;
  경계표: 경계[];
  폭: number;
  말할때?: number[];
}> = ({ 가이드, 경계표, 폭, 말할때 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const 현 = 경계표.find((b) => frame >= b.시작 && frame < b.끝);
  const 표정: 표정 = 현?.표정 ?? "본체";

  /* 장면 머리에서 톡 — 「새 이야기가 시작됐다」를 몸으로 말한다. 컷 반응은 살리되 절대프레임으로 잰다 */
  const 등장 = spring({ frame: frame - (현?.시작 ?? 0), fps, config: 연출.스프링탄 });
  const 튐 = interpolate(등장, [0, 1], [0.92, 1]);

  /* 숨 — 화면에 2초 넘게 있는 것은 반드시 숨 쉰다. 컷에서 안 튄다(절대프레임) */
  const 숨 = 1 + Math.sin(frame / 26) * 0.014;
  const 부유 = Math.sin(frame / 44) * 14;

  /* 옹알이 반응 — 소리가 시작된 프레임부터 짧게 부풀었다 꺼진다. 가장 최근에 «지나간» 소리만 본다. */
  const 최근말 = (말할때 || []).filter((f) => frame >= f && frame < f + 14).pop();
  const 말튐 =
    최근말 === undefined
      ? 0
      : Math.sin(((frame - 최근말) / 14) * Math.PI) * 0.055;

  /* 🔑 깜빡임을 «컷에서 떼고» 불규칙하게 만든다. 나머지 연산(`% 주기`)은 주기가 규칙적이라
     메트로놈이 되고, Sequence 안에서는 컷에 물린다. 두 사인의 곱은 주기가 어긋나 사람 눈에
     불규칙하게 보인다. `frame > 8` 은 **첫 프레임을 눈뜸으로 강제** — 릴 커버를 구하는 자리다. */
  const 깜빡 =
    표정 === "본체" && frame > 8 && Math.sin(frame / 37) * Math.sin(frame / 53) > 0.985;
  const 컷 = 깜빡 ? "눈감음" : 표정;

  return (
    <Img
      src={staticFile(`${가이드}/${컷}.png`)}
      style={{
        width: 폭,
        height: 폭,
        transform: `translateY(${부유 - 말튐 * 120}px) scale(${튐 * 숨 * (1 + 말튐)})`,
        /* 바닥에 앉은 느낌 — 순검정 아닌 Graphite 틴트 그림자 */
        filter: `drop-shadow(0 18px 26px ${그늘(0.16)})`,
      }}
    />
  );
};

/**
 * 한 덩어리를 «세 속성 동시»로 들여보낸다 — 단독 페이드는 금지다(비협상 규칙 ②).
 * `바닥` 은 시작 불투명도의 하한이다 — 첫 어절에만 줘서 **f0 에도 글자가 읽히게** 한다.
 * 자동재생 피드에서 먼저 스치는 것은 별도 표지가 아니라 영상 자신의 첫 프레임이다.
 */
export const 들임: React.FC<{
  지연: number;
  바닥?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ 지연, 바닥, children, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - 지연, fps, config: 연출.스프링 });
  const q = 바닥 ? Math.max(p, 바닥) : p;
  return (
    <div
      style={{
        ...style,
        opacity: q,
        transform: `translateY(${interpolate(q, [0, 1], [34, 0])}px) scale(${interpolate(
          q,
          [0, 1],
          [0.94, 1],
        )})`,
      }}
    >
      {children}
    </div>
  );
};

/**
 * 한국어를 «어절별로» 드러낸다.
 * 🔑 이건 멋내기가 아니라 학습 장치다 — 학생이 통째 덩어리가 아니라 마디로 읽게 만든다.
 *   그리고 150프레임짜리 장면 안에서 「새 시각 요소」가 계속 생겨 슬라이드쇼가 안 된다
 *   (비협상 규칙: 90프레임 넘게 새 요소 없이 두지 마라).
 */
export const 어절드러내기: React.FC<{
  글: string;
  지연: number;
  style: React.CSSProperties;
  바닥?: number;
}> = ({ 글, 지연, style, 바닥 }) => {
  const { fps } = useVideoConfig();
  /* 🔑 이모지 하나뿐인 어절은 앞 어절에 «붙인다» — 폭 740 에서 「완료 — 어제의 나 +1」 뒤의
     ✨ 가 혼자 다음 줄로 떨어져 떠 보였다(실측 f880). 글자가 아니라 장식이라 줄을 새로 열 값이 없다. */
  const 어절들 = 글.split(" ").reduce<string[]>((모음, 낱말) => {
    const 글자만없나 = !/[\p{Letter}\p{Number}]/u.test(낱말);
    if (글자만없나 && 모음.length) 모음[모음.length - 1] += ` ${낱말}`;
    else 모음.push(낱말);
    return 모음;
  }, []);
  const 간격 = Math.max(2, Math.round(fps * 연출.어절간격초));

  /* 🔴 어절 사이 간격을 «em» 으로 주면 안 된다 — 이 flex 컨테이너에는 font-size 가 없어
   *   em 이 브라우저 기본 16px 를 기준 삼는다(실측: 0.28em = 4.5px). 84px 자막에서 어절이
   *   「언제어디서나통하는첫인사」로 붙어 **한국어가 안 읽혔다.** 학습 콘텐츠에서 이건 치명이다.
   *   그래서 자막 글자 크기에서 직접 계산한다. */
  const 글자크기 = typeof style.fontSize === "number" ? style.fontSize : 40;
  const 가로틈 = Math.round(글자크기 * 0.26);
  const 세로틈 = Math.round(글자크기 * 0.16);

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: `${세로틈}px ${가로틈}px`,
      }}
    >
      {어절들.map((어절, i) => (
        <들임 key={i} 지연={지연 + i * 간격} 바닥={i === 0 ? 바닥 : undefined}>
          {/* `keep-all` — 어절 하나가 상자보다 넓을 때 CSS 기본값이 한국어를 아무 글자에서나
              끊는다(실물: 「첫인사」가 「첫 / 인사」로 쪼개졌다). 마지막 구멍을 막는다. */}
          <span style={{ ...style, wordBreak: "keep-all" }}>{어절}</span>
        </들임>
      ))}
    </div>
  );
};
