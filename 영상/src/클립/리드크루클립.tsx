import React from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  Sequence,
  interpolate,
  spring,
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
 *
 * 지키는 것은 킷 «규칙» 쪽이다: transform·opacity 만 움직이고, 그림자·어둠은 순검정이 아니라
 * **Graphite 틴트**로 낸다 — 「순백·순검정 금지」의 그림자판이다.
 * ──────────────────────────────────────────────────────────────────────────── */
const 연출 = {
  몽글폭비: 0.76,
  /* 🔴 인스타/틱톡은 화면 «하단»을 자기 UI(계정·캡션·버튼)로 덮는다. 몽글을 바닥에 붙이면
     그 UI 에 다리가 잘린다. 300 = 틱톡·쇼츠 하한(250)을 넘기면서 몽글을 자막 쪽으로 끌어올리는 값.
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
const 그늘 = (a: number) => `rgba(8, 9, 12, ${a})`;

/* SVG 노이즈 — 파일 자산 0개로 필름 그레인을 만든다. */
const 노이즈결 =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

type 경계 = { 시작: number; 끝: number; 표정: 장면["표정"] };

/* ── 층: 그레인 · 비네트 ──────────────────────────────────────────────────
 * 「평평한 단색 배경 금지」(모션 스킬 비협상 규칙 ⑤). 다만 이건 **학습 콘텐츠**라
 * 자막 가독성이 언제나 이긴다 — 그래서 값을 라이트 테마 권장 하한보다 더 낮춰 잡았다. */
const 그레인: React.FC = () => {
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
const 비네트: React.FC = () => (
  <AbsoluteFill
    style={{
      pointerEvents: "none",
      background: `radial-gradient(ellipse at 50% 42%, transparent 62%, ${그늘(0.1)} 100%)`,
    }}
  />
);

/**
 * 몽글 — 무언의 선생님. 말하지 않는다. 표정과 몸짓이 첫 언어다(synk-brand).
 *
 * 🔴 **`<Sequence>` 밖 고정층에 산다.** 장면 Sequence 안에 두면 `useCurrentFrame()` 이 컷마다
 *   0 으로 리셋되고, 그러면 ① 부유가 컷마다 0 으로 튀어 «순간이동»하고 ② 깜빡임 조건
 *   (`frame % 주기 < 5`)이 **모든 장면의 첫 5프레임에 반드시** 걸린다. 실측에서 f0 과 f90 이
 *   둘 다 눈감음이었다 — 살아 있는 게 아니라 컷에 물린 메트로놈이었고, 릴 커버(f0)가
 *   「빈 종이 + 눈감은 인형」이 된 원인이기도 하다.
 *   그래서 절대프레임으로 살고, 표정만 장면 경계 표에서 찾아 바꾼다.
 */
const 몽글: React.FC<{ 경계표: 경계[]; 폭: number }> = ({ 경계표, 폭 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const 현 = 경계표.find((b) => frame >= b.시작 && frame < b.끝);
  const 표정: 장면["표정"] = 현?.표정 ?? "본체";

  /* 장면 머리에서 톡 — 「새 이야기가 시작됐다」를 몸으로 말한다. 컷 반응은 살리되 절대프레임으로 잰다 */
  const 등장 = spring({ frame: frame - (현?.시작 ?? 0), fps, config: 연출.스프링탄 });
  const 튐 = interpolate(등장, [0, 1], [0.92, 1]);

  /* 숨 — 화면에 2초 넘게 있는 것은 반드시 숨 쉰다. 컷에서 안 튄다(절대프레임) */
  const 숨 = 1 + Math.sin(frame / 26) * 0.014;
  const 부유 = Math.sin(frame / 44) * 14;

  /* 🔑 깜빡임을 «컷에서 떼고» 불규칙하게 만든다. 나머지 연산(`% 주기`)은 주기가 규칙적이라
     메트로놈이 되고, Sequence 안에서는 컷에 물린다. 두 사인의 곱은 주기가 어긋나 사람 눈에
     불규칙하게 보인다. `frame > 8` 은 **첫 프레임을 눈뜸으로 강제** — 릴 커버를 구하는 자리다. */
  const 깜빡 =
    표정 === "본체" && frame > 8 && Math.sin(frame / 37) * Math.sin(frame / 53) > 0.985;
  const 컷 = 깜빡 ? "눈감음" : 표정;

  return (
    <Img
      src={staticFile(`몽글/${컷}.png`)}
      style={{
        width: 폭,
        height: 폭,
        transform: `translateY(${부유}px) scale(${튐 * 숨})`,
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
const 들임: React.FC<{
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
const 어절드러내기: React.FC<{
  글: string;
  지연: number;
  style: React.CSSProperties;
  바닥?: number;
}> = ({ 글, 지연, style, 바닥 }) => {
  const { fps } = useVideoConfig();
  /* 🔑 이모지 하나뿐인 어절은 앞 어절에 «붙인다» — 폭 740 에서 「완료 — 어제의 나 +1」 뒤의
     ✨ 가 혼자 다음 줄로 떨어져 떠 보였다(실측 f880). 글자가 아니라 장식이라 줄을 새로 열 값이 없다. */
  const 어절들 = 글
    .split(" ")
    .reduce<string[]>((모음, 낱말) => {
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

/** 자막 한 장면. 한국어를 크게, 몽골어를 병기로 — 제작가이드가 정한 규격이다. */
const 자막: React.FC<{ 장면: 장면 }> = ({ 장면 }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  /* 나가는 것은 들어오는 것보다 «빠르다» — 안 그러면 장면이 질질 끌린다.
     durationInFrames 는 «겹침»만큼 늘어난 길이라, 나감이 그 꼬리에 자동으로 걸린다. */
  const 나감f = Math.round(fps * 연출.나감초);
  const 나감 = interpolate(frame, [durationInFrames - 나감f, durationInFrames - 2], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.7, 0, 0.84, 0),
  });
  const 나감위 = interpolate(frame, [durationInFrames - 나감f, durationInFrames - 2], [0, -26], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.7, 0, 0.84, 0),
  });

  /* 🔴 한국어 크기는 «건드리지 않는다» — 실측으로 업계 권장 60~75px 대역 안이고 6장면 전부
     잘림 0건이다. 폭을 740 으로 좁힌 이 판에서 더 키우면 한 줄이 세 줄이 된다. */
  const 한글크기 = 장면.한국어.length <= 8 ? 116 : 장면.한국어.length <= 16 ? 84 : 66;
  const 어절수 = 장면.한국어.split(" ").length;
  const 어절간격f = Math.max(2, Math.round(fps * 연출.어절간격초));

  return (
    <div
      style={{
        opacity: 나감,
        transform: `translateY(${나감위}px)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 율.단,
        paddingLeft: 연출.안전여백좌우,
        paddingRight: 연출.안전여백좌우,
        textAlign: "center",
      }}
    >
      {/* 라벨이 먼저 — 코랄은 «면»이다. 면 위 글자는 Ink(종이 위 코랄 «글자»는 대비 2.75 로 금지) */}
      <들임 지연={0}>
        <div
          style={{
            fontFamily: 본문스택,
            fontSize: 44,
            fontWeight: 웨이트.강조_라벨,
            color: 지면.글자,
            backgroundColor: 지면.신호면,
            padding: `${율.틈}px ${율.단}px`,
            borderRadius: 999,
            letterSpacing: 트래킹.본문,
            boxShadow: `0 6px 16px ${그늘(0.12)}`,
          }}
        >
          {장면.라벨}
        </div>
      </들임>

      {/* 한국어 — 어절별로 */}
      <어절드러내기
        글={장면.한국어}
        지연={Math.round(fps * 0.18)}
        바닥={0.45}
        style={{
          fontFamily: 본문스택,
          fontSize: 한글크기,
          fontWeight: 웨이트.헤드,
          color: 지면.글자,
          letterSpacing: 트래킹.헤드_태그라인,
          lineHeight: 1.24,
          display: "inline-block",
        }}
      />

      {/* 몽골어는 한국어가 «다 드러난 뒤에» 온다 — 읽는 순서가 학습 순서다.
          🔑 크기를 41→48 로 올렸다: 학습자의 «모국어»인데 화면에서 가장 작았다 — 이해의 앵커다. */}
      <들임 지연={Math.round(fps * 0.18) + 어절수 * 어절간격f + 2}>
        <div
          style={{
            fontFamily: 본문스택,
            fontSize: Math.round(48 * 몽골어보정),
            fontWeight: 웨이트.본문_UI,
            color: 지면.보조글자,
            letterSpacing: 트래킹.본문,
            lineHeight: 1.5,
            wordBreak: "keep-all",
          }}
        >
          {장면.몽골어}
        </div>
      </들임>
    </div>
  );
};

/** 훅 — 첫 2~3초. 궁금·공감을 여는 자리(synk-content §2). */
const 훅자막: React.FC<{ 글: string }> = ({ 글 }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  /* 🔴 훅에도 «나감»이 있어야 한다 — 없으면 3초에서 자막이 뚝 끊겨 컷처럼 보인다(실측). */
  const 나감f = Math.round(fps * 연출.나감초);
  const 나감 = interpolate(frame, [durationInFrames - 나감f, durationInFrames - 2], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.7, 0, 0.84, 0),
  });
  const 나감위 = interpolate(frame, [durationInFrames - 나감f, durationInFrames - 2], [0, -26], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.7, 0, 0.84, 0),
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-start",
        alignItems: "center",
        paddingTop: 연출.자막앵커위,
        paddingLeft: 연출.안전여백좌우,
        paddingRight: 연출.안전여백좌우,
        opacity: 나감,
        transform: `translateY(${나감위}px)`,
      }}
    >
      <어절드러내기
        글={글}
        지연={0}
        바닥={0.45}
        style={{
          fontFamily: 본문스택,
          fontSize: 74,
          fontWeight: 웨이트.태그라인_한글,
          color: 색("Coral 3"),
          letterSpacing: 트래킹.헤드_태그라인,
          lineHeight: 1.3,
          display: "inline-block",
        }}
      />
    </AbsoluteFill>
  );
};

export const 리드크루클립: React.FC<{ 클립: 클립 }> = ({ 클립 }) => {
  const { fps, width, durationInFrames } = useVideoConfig();
  /* 🔑 타이밍은 전부 fps 에서 파생한다 — 매직 프레임 번호를 쓰지 않는다(비협상 규칙 ⑧).
     fps 를 24 로 바꿔도 연출이 그대로 따라온다. */
  const 훅프레임 = Math.round(fps * 3);
  const 몽글폭 = Math.round(width * 연출.몽글폭비);
  const 겹침 = Math.round(fps * 연출.겹침초);

  /* 장면 경계 표 — 몽글이 «절대프레임»에서 지금 어느 장면인지 찾는 데 쓴다 */
  let ㄱ = 훅프레임;
  const 경계표: 경계[] = 클립.장면들.map((s) => {
    const b = { 시작: ㄱ, 끝: ㄱ + s.프레임, 표정: s.표정 };
    ㄱ += s.프레임;
    return b;
  });

  return (
    <AbsoluteFill style={{ backgroundColor: 지면.바탕 }}>
      {/* 🔴 깔림을 «끝까지» 깐다. 첫 판은 26.67초짜리 wav 를 loop 없이 한 번 틀어
          마지막 3.35초가 완전 무음이었다(silencedetect 실측) — 「영상이 고장났다」로 읽히는 자리다.
          🔑 `loopVolumeCurveBehavior="extend"` 가 없으면 볼륨 함수의 f 가 루프마다 0 으로 되감겨
             끝 페이드아웃이 «영원히 안 온다». 산출물은 나고 종료코드도 0 이라 조용히 새는 자리다. */}
      <Audio
        src={staticFile("소리/BGM_깔림.wav")}
        loop
        loopVolumeCurveBehavior="extend"
        volume={(f) =>
          interpolate(f, [0, 20, durationInFrames - 60, durationInFrames], [0, 0.55, 0.55, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
        }
      />

      {/* 바닥 결 — 코랄이 앉는 여린 면. 유채 실은 «주연 1(코랄)» 하나로 끝낸다 */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, ${지면.바탕} 34%, ${지면.신호바닥} 86%)`,
        }}
      />

      {/* ── 훅 (0~3초) ─────────────────────────────────────────────── */}
      <Sequence durationInFrames={훅프레임 + 겹침}>
        <훅자막 글={클립.훅} />
      </Sequence>

      {/* ── 본문 6장면 — 자막층만 Sequence 안에 산다 ───────────────── */}
      {클립.장면들.map((장면, i) => {
        const 시작 = 경계표[i].시작;
        /* 🔑 시작 시각은 안 건드리고 «렌더 길이»만 늘려 겹치게 한다 — 소리·리듬이 안 흔들린다.
           마지막 장면만 예외: 전체 길이를 넘으면 잘린다. */
        const 꼬리 = i === 클립.장면들.length - 1 ? 0 : 겹침;
        return (
          <Sequence key={i} from={시작} durationInFrames={장면.프레임 + 꼬리}>
            <AbsoluteFill
              style={{
                justifyContent: "flex-start",
                alignItems: "center",
                paddingTop: 연출.자막앵커위,
              }}
            >
              <자막 장면={장면} />
            </AbsoluteFill>
          </Sequence>
        );
      })}

      {/* ── 효과음 — 그림보다 3프레임 «먼저» 온다. 그래야 붙어 들린다 ── */}
      {클립.장면들.map((장면, i) =>
        장면.소리 ? (
          <Sequence key={`s${i}`} from={Math.max(0, 경계표[i].시작 - 3)} durationInFrames={30}>
            <Audio src={staticFile(`소리/${장면.소리}`)} volume={0.75} />
          </Sequence>
        ) : null,
      )}

      {/* ── 몽글 — Sequence «밖» 고정층. 30초 내내 한 사람이 옆에 있다 ── */}
      <AbsoluteFill
        style={{
          justifyContent: "flex-end",
          alignItems: "center",
          paddingBottom: 연출.안전여백아래,
        }}
      >
        <몽글 경계표={경계표} 폭={몽글폭} />
      </AbsoluteFill>

      {/* ── 로고 — 30초 브랜드 영상에 브랜드 마크가 0회였다 ────────────
          🔑 반드시 «민라이트»다. DESIGN.md §4「크기가 표현을 정한다 — 문턱 180px,
             그 아래는 민판(필터 0)」. 150px 에서 펠트판은 규율 위반이고, 펠트 예산
             (한 지면 1~2점)은 몽글이 이미 쓰고 있다.
          🔑 자리는 실측으로 비어 있는 위 띠다 — 자막 앵커가 y470 부터라 안 겹친다. */}
      <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center", paddingTop: 300 }}>
        <Img src={staticFile("로고/민라이트.svg")} style={{ width: 150 }} />
      </AbsoluteFill>

      {/* 실땀 — 모든 펠트 오브젝트의 테두리. 지면 아래를 한 줄로 여민다 */}
      <AbsoluteFill style={{ justifyContent: "flex-end" }}>
        <div style={{ height: 율.실 * 3, backgroundColor: 지면.실땀 }} />
      </AbsoluteFill>

      {/* 층 순서 — 콘텐츠 → 그레인 → 비네트. 이 둘은 언제나 맨 위다 */}
      <그레인 />
      <비네트 />
    </AbsoluteFill>
  );
};
