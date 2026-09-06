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
import type { 클립, 장면, 꼴 } from "./타입";
import { 지면, 율, 색 } from "../킷/색";
import { 본문스택, 웨이트, 트래킹, 몽골어보정 } from "../킷/폰트";
/* 연출 값·공용 층의 정본은 `연출.tsx` 하나다 — 여기 복제본을 두면 두 지면이 조용히 갈린다
   (카운트다운 릴이 서면서 같은 값을 두 번 적을 뻔했다 · 08-26). */
import {
  연출,
  로고,
  배경음악,
  그늘,
  그레인,
  비네트,
  들임,
  어절드러내기,
  type 경계,
} from "./연출";
/* 마스코트는 «살아 있는» 판 — 4D 깊이층(유호 지시 08-26) */
import { 살아있는마스코트 } from "./살아있는마스코트";
import { 몸짓고르기, 몸짓쉼표, 꼴몸짓, 꼴크기, type 몸짓 } from "./몸짓";

/* ────────────────────────────────────────────────────────────────────────────
 * 꼴별 조판 — 「일곱 컷이 똑같이 생겼다」를 고치는 표 하나.
 *
 * 🔴 진단(유호 08-27 「어렵고 재미가 없어」 · 실물 = `out/clip-01-1_프레임.png` 일곱 컷 띠):
 *   옛 표형은 모든 칸이 «코랄 알약 + 한국어 + 몽골어»로 서서, 프레임을 나란히 뽑으면
 *   글자만 바뀌고 화면은 한 장이다. 그러면 보는 사람이 하는 일은 «읽기»뿐이고 읽기는 어렵다.
 *
 * 🔑 그래서 손잡이를 «셋» 쥔다 — 하나만 바꾸면 여전히 같은 화면으로 읽힌다:
 *   ① **글자 크기** 52 ↔ 124 (대비가 클수록 다음 칸이 커 보인다)
 *   ② **면** — 맨 종이 / 코랄 알약 / 정답면(Meadow) 알약
 *   ③ **바탕** — 코랄 워시가 «표현» 칸에서 확 올라온다(화면 전체가 바뀌는 유일한 신호)
 *   여기에 몸짓(`꼴몸짓`)과 소리(대본읽기 `꼴소리`)가 더해져 다섯 겹이 된다.
 *
 * 🚫 «오답 빨강»을 만들지 않았다 — 킷에 오답 색이 없고(정답_면 Meadow · 안내 Lapis ·
 *   보상 Butter · 기념 Pop), 새 hex 를 여기 적는 것은 색 정본을 가르는 일이다(`킷/색.ts` 머리말).
 *   실수는 **색이 아니라 «상태»로** 낸다 — 회색(Ash Wool) + 취소선 + 몸이 움츠린다.
 * ──────────────────────────────────────────────────────────────────────────── */
type 조판 = {
  /** 알약에 찍히는 말. 빈 문자열이면 알약을 아예 안 그린다(맨 종이 = 「장면」으로 읽힌다). */
  알약: string;
  /** 알약 면 — 코랄(신호) / 미도우(정답). 알약이 없으면 안 본다. */
  알약면: "신호" | "정답";
  /** 한국어 글자 크기의 «상한». 실제 크기는 글자 수에 따라 이 아래로 내려간다. */
  큼: number;
  /** 한국어 색. 실수 칸만 캡션글자(Ash Wool)로 식힌다. */
  글자색: "잉크" | "보조" | "캡션" | "코랄딥";
  /** 취소선 — 실수 칸 하나뿐이다. */
  그음?: true;
  /** 어절별로 드러낼까. 실수는 «한꺼번에» 나와야 «불쑥 뱉은 말»로 읽힌다. */
  어절?: false;
  /** 바탕 코랄 워시가 올라오는 정도(0~1). 표현 칸에서 화면 전체가 바뀐다. */
  워시: number;
};

/* 🔴 첫 판 값(78·68·54·124 …)은 **실물이 반려했다** — 구운 프레임 띠에서 아홉 컷의 글자가
   전부 «작고 비슷»했다(짧은 줄이 8자를 넘으면 곧장 0.72배로 내려앉아, 상한을 갈라 뒀는데도
   실제 크기는 39~89px 사이에 몰렸다). 대비는 «상한의 차»가 아니라 «화면에 난 글자의 차»다.
   ⇒ 상한을 통째로 올리고 바닥(반응)만 남겼다. 폭 740 안에서 두 줄까지는 허용한다 — 세 줄이
     되면 `길이배분` 의 읽는-시간 하한이 그만큼 길이를 늘려 주므로 잘리지 않는다. */
const 조판표: Record<꼴, 조판> = {
  상황: { 알약: "", 알약면: "신호", 큼: 100, 글자색: "보조", 워시: 0.2 },
  실수: { 알약: "이렇게 말하면", 알약면: "신호", 큼: 104, 글자색: "캡션", 그음: true, 어절: false, 워시: 0 },
  반응: { 알약: "", 알약면: "신호", 큼: 72, 글자색: "보조", 워시: 0 },
  표현: { 알약: "이렇게!", 알약면: "정답", 큼: 138, 글자색: "잉크", 워시: 1 },
  쓰임: { 알약: "이렇게 써요", 알약면: "신호", 큼: 78, 글자색: "잉크", 워시: 0.5 },
  짧게: { 알약: "급하면", 알약면: "신호", 큼: 116, 글자색: "잉크", 워시: 0.5 },
  따라하기: { 알약: "따라 해요 🎤", 알약면: "신호", 큼: 96, 글자색: "잉크", 워시: 0.35 },
  참여: { 알약: "", 알약면: "신호", 큼: 92, 글자색: "코랄딥", 워시: 0.75 },
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

  /* 꼴이 있으면 그 표가 조판을 쥔다. 없으면 옛 표형 그대로다(43화가 아직 그 꼴이라 건드리면 안 된다). */
  const 조 = 장면.꼴 ? 조판표[장면.꼴] : null;

  /* 🔴 한국어 크기의 «상한»은 옛 판에서 116 이었다 — 실측으로 업계 권장 60~75px 대역 안이고
     6장면 전부 잘림 0건이다. 폭 740 에서 더 키우면 한 줄이 세 줄이 된다.
     🔑 꼴이 있으면 그 상한을 꼴이 정한다(반응 54 … 표현 124). 줄어드는 «비율»은 옛 판 그대로다
        (116→84 = 0.72 · 116→66 = 0.57) — 대비 폭만 넓히고 줄바꿈 규칙은 안 건드린다. */
  const 상한 = 조 ? 조.큼 : 116;
  const 계단크기 =
    장면.한국어.length <= 8
      ? 상한
      : 장면.한국어.length <= 16
        ? Math.round(상한 * 0.72)
        : Math.round(상한 * 0.57);

  /* 🔴 **「표현」 칸만은 «한 줄»로 선다** (09-05 실물로 잡았다).
     증상: 「만나서 반가워요」·「이름이 뭐예요?」가 두 줄이 되자 그 아래 몽골어 줄이 **마스코트에
       통째로 가렸다** — 프레임을 뽑아 보면 첫 글자와 끝 글자만 마스코트 옆으로 삐져나온다.
       01-4 는 둘째 줄 「뭐예요?」 자체가 얼굴에 잘렸다.
     왜 계단이 못 막았나: 계단은 «글자 수»로 재는데 줄바꿈은 «폭»이 정한다. 폭 740 에 124px 이면
       한 줄에 6.2 글자뿐이라, 「8자 이하 = 상한」 칸이 7~8자에서 그대로 두 줄이 된다.
     처방: 표현 칸에서만 폭에 맞춰 크기를 «내린다». 다른 칸은 계단 그대로다 —
       거기는 두 줄이 정상이고(잠시만 기다려/주세요) 크기가 작아 마스코트에 안 닿는다.
     ⚠ 바닥을 계단의 마지막 단(0.57)으로 둔다 — 더 내려가면 「표현이 가장 크다」는 위계가 깨진다.
     🔑 0.96 = 한글 한 글자의 «폭 ÷ 글자크기»(트래킹 −0.04em 반영). 자 = 이 실측 프레임들. */
  const 폭상한 = 1080 - 연출.안전여백좌우 * 2;
  const 한글크기 =
    장면.꼴 === "표현"
      ? Math.max(
          Math.round(상한 * 0.57),
          Math.min(계단크기, Math.floor(폭상한 / Math.max(1, 장면.한국어.length * 0.96))),
        )
      : 계단크기;
  const 글자색 = !조
    ? 지면.글자
    : 조.글자색 === "잉크"
      ? 지면.글자
      : 조.글자색 === "보조"
        ? 지면.보조글자
        : 조.글자색 === "캡션"
          ? 지면.캡션글자
          : 색("Coral 3");
  const 어절수 = 장면.한국어.split(" ").length;
  const 어절간격f = Math.max(2, Math.round(fps * 연출.어절간격초));
  const 한글판 = {
    fontFamily: 본문스택,
    fontSize: 한글크기,
    fontWeight: 웨이트.헤드,
    color: 글자색,
    letterSpacing: 트래킹.헤드_태그라인,
    lineHeight: 1.24,
    display: "inline-block" as const,
    ...(조?.그음 ? { textDecoration: "line-through", textDecorationThickness: 6 } : {}),
  };

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
      {/* 라벨이 먼저 — 코랄은 «면»이다. 면 위 글자는 Ink(종이 위 코랄 «글자»는 대비 2.75 로 금지)
          🔑 꼴이 «상황·반응·참여»면 알약을 아예 안 그린다 — 맨 종이 위 한 줄이라야 「설명」이 아니라
             「장면」으로 읽힌다. 알약이 매 칸에 서는 것이 옛 판을 교재처럼 보이게 한 첫째 원인이다. */}
      {(!조 || 조.알약) && (
        <들임 지연={0}>
          <div
            style={{
              fontFamily: 본문스택,
              fontSize: 44,
              fontWeight: 웨이트.강조_라벨,
              color: 지면.글자,
              backgroundColor: 조?.알약면 === "정답" ? 지면.정답면 : 지면.신호면,
              padding: `${율.틈}px ${율.단}px`,
              borderRadius: 999,
              letterSpacing: 트래킹.본문,
              boxShadow: `0 6px 16px ${그늘(0.12)}`,
            }}
          >
            {조 ? 조.알약 : 장면.라벨}
          </div>
        </들임>
      )}

      {/* 한국어 — 어절별로.
          🔑 「실수」 칸만 «한꺼번에» 낸다: 어절이 하나씩 드러나면 «읽어 주는» 느낌인데, 그 칸은
             불쑥 뱉은 말이라 한 번에 떠야 한다. 취소선도 어절을 가르면 토막 나서 안 읽힌다. */}
      {조?.어절 === false ? (
        <들임 지연={Math.round(fps * 0.1)} 바닥={0.45}>
          <span style={{ ...한글판, wordBreak: "keep-all" }}>{장면.한국어}</span>
        </들임>
      ) : (
        <어절드러내기 글={장면.한국어} 지연={Math.round(fps * 0.18)} 바닥={0.45} style={한글판} />
      )}

      {/* 몽골어는 한국어가 «다 드러난 뒤에» 온다 — 읽는 순서가 학습 순서다.
          🔑 크기를 41→48 로 올렸다: 학습자의 «모국어»인데 화면에서 가장 작았다 — 이해의 앵커다.
          🔑 「표현」 칸에서만 56 으로 한 단 더 올린다 — 그 칸이 유일하게 «외워 갈» 칸이고,
             한국어가 124 라 48 로 두면 모국어가 곁다리처럼 작아 보인다. */}
      <들임
        지연={
          조?.어절 === false
            ? Math.round(fps * 0.1) + 4
            : Math.round(fps * 0.18) + 어절수 * 어절간격f + 2
        }
      >
        <div
          style={{
            fontFamily: 본문스택,
            fontSize: Math.round((장면.꼴 === "표현" ? 56 : 48) * 몽골어보정),
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

/**
 * 로고 띠 — 위 띠에 브랜드 마크. **훅이 끝난 뒤에 들어온다**(유호 확정 09-06).
 *
 * 🔑 왜 «미루기»이지 «빼기»가 아닌가 — 이 로고는 유호님이 화면에서 잡아 주셔서 들어간 것이다
 *   (「30초 브랜드 영상에 브랜드 마크가 0회였다」 · 08-26). 빼면 그 교정이 죽는다.
 *   ⇒ 브랜드 마크는 그대로 나오되 **첫 2초에는 안 나온다.**
 *
 * 🔴 근거를 정직하게 적는다 — 「로고가 광고 신호라 넘긴다」는 자료가 **우리에게 없다**.
 *   가진 자가 말하는 것은 하나뿐이다: 「첫 2초에 «결과»를 보여준 훅이 가장 셌다」
 *   (OpusClip 34,635 클립 · 설계 §1-2 ㉯). 로고는 결과가 아니고, 첫 2초의 맨 위 띠를 먹는다.
 *   그것이 이 변경의 전부다 — 그 이상을 주장하지 않는다.
 */
const 로고띠: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  /* 훅이 끝나자마자 «툭» 나타나면 컷처럼 보인다 — 자막의 들임과 같은 결로 0.5초에 걸쳐 들어온다. */
  const 들임 = interpolate(frame, [0, Math.round(fps * 0.5)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  return (
    <AbsoluteFill
      style={{ justifyContent: "flex-start", alignItems: "center", paddingTop: 236, opacity: 들임 }}
    >
      <Img src={staticFile(로고.파일)} style={{ width: 로고.폭 }} />
    </AbsoluteFill>
  );
};

/** 훅 — 첫 2~3초. 궁금·공감을 여는 자리(synk-content §2). */
const 훅자막: React.FC<{ 글: string; 몽골어?: string }> = ({ 글, 몽골어 }) => {
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

      {/* 훅의 몽골어 병기(유호 지시 08-28 — 그전엔 첫 2.5초가 한국어로만 떴다).
          🔑 장면 칸과 **지연이 다르다.** 거기서는 한국어가 «다 드러난 뒤에» 몽골어가 와야 한다 —
             읽는 순서가 곧 학습 순서라서다. 훅은 배우는 자리가 아니라 «붙잡는» 자리이고, 보는 사람은
             자기 언어 한 줄만 읽는다. 몽골 학생을 2초 기다리게 하면 그 2초가 훅의 전부다.
             ⇒ 거의 같이 띄운다(0.12초 — 두 줄이 «동시에 툭» 나타나 겹쳐 읽히지 않을 만큼만).
          🔑 크기 52 — 한국어 74 보다 작지만 장면 칸의 48 보다 크다. 훅에서는 이것이 누군가에겐
             유일하게 읽히는 줄이라, 곁다리로 보이면 안 된다. */}
      {몽골어 ? (
        <들임 지연={Math.round(fps * 0.12)} 바닥={0.35}>
          <div
            style={{
              fontFamily: 본문스택,
              fontSize: Math.round(52 * 몽골어보정),
              fontWeight: 웨이트.본문_UI,
              color: 지면.보조글자,
              letterSpacing: 트래킹.본문,
              lineHeight: 1.45,
              marginTop: 율.칸,
              wordBreak: "keep-all",
            }}
          >
            {몽골어}
          </div>
        </들임>
      ) : null}
    </AbsoluteFill>
  );
};

export const 리드크루클립: React.FC<{ 클립: 클립 }> = ({ 클립 }) => {
  const { fps, width, durationInFrames } = useVideoConfig();
  /* 🔑 타이밍은 전부 fps 에서 파생한다 — 매직 프레임 번호를 쓰지 않는다(비협상 규칙 ⑧).
     fps 를 24 로 바꿔도 연출이 그대로 따라온다.
     🔴 **훅 길이를 여기 박지 않는다 — 데이터에서 뺀다.** 첫 판은 `fps * 3`(90f) 이 박혀 있었는데
       장면형이 훅을 2.5초(75f)로 줄이면서 **렌더러만 옛 값을 들고 있었다**:
       장면이 전부 15프레임 늦게 시작하고, 마지막 장면이 555f 까지 뻗어 540f 컴포지션에서
       **끝 0.5초가 잘렸다.** 산출물은 났고 종료코드도 0이라 조용히 새는 자리였다 —
       프레임 띠도 «장면 한가운데»를 뽑으니 잘린 꼬리를 못 보여 준다(이종 검수가 잡았다 · 08-27).
     🔑 그래서 «두 벌로 두지 않는다»: 전체에서 장면 합을 빼면 그것이 훅이다. 파서가 합을 정확히
       정규화하므로(길이배분) 이 뺄셈은 언제나 맞고, 형식이 하나 더 늘어도 여기는 안 고친다. */
  const 장면합 = 클립.장면들.reduce((a, s) => a + s.프레임, 0);
  const 훅프레임 = 클립.전체프레임 - 장면합;
  /* 🔑 폭·가이드·곡은 **데이터가 쥔다**(대본읽기의 `가이드결`). 전엔 여기에 몽글이 박혀 있었고
     연출의 기본 폭비를 봤다 — 그러면 「까몽 판」이 원리상 안 난다(유호 지시 08-27). */
  const 가이드폭 = Math.round(width * 클립.폭비);
  /* 곡 — 가이드가 들고 있으면 그것을, 없으면 연출 기본값을. 카운트다운과 같은 규율이다. */
  const 곡 = 클립.배경음악 ?? 배경음악;
  const 겹침 = Math.round(fps * 연출.겹침초);

  /* 장면 경계 표 — 몽글이 «절대프레임»에서 지금 어느 장면인지 찾는 데 쓴다 */
  let ㄱ = 훅프레임;
  /* 자막 한 줄이 곧 몸짓이다 — 「매워요」면 바르르, 「?」면 갸웃(`몸짓.ts`).
     🔑 편 «전체»를 한 번에 고른 뒤 `몸짓쉼표` 를 태운다 — 같은 몸짓이 잇달으면 사이를 쉰다
        (실측: 09편 3화가 여섯 칸 중 다섯이 움츠였다 = 30초 내내 움츠린 채).
     🔑 꼴이 서 있으면 **꼴이 이긴다** — 낱말은 「그 문장이 무슨 낱말을 쓰나」를 보지 「그 칸이
        무슨 일을 하나」를 못 본다. 위 실측(다섯 칸 연속 움츠)이 바로 그 한계였다.
        꼴로 고르면 칸마다 몸이 달라지므로 `몸짓쉼표` 를 태울 일이 없다. */
  const 꼴형 = 클립.장면들.length > 0 && 클립.장면들.every((s) => s.꼴);
  const 몸짓목록: 몸짓[] = 꼴형
    ? 클립.장면들.map((s) => 꼴몸짓[s.꼴 as string])
    : 몸짓쉼표(클립.장면들.map((s) => 몸짓고르기(s.한국어)));
  const 경계표: 경계[] = 클립.장면들.map((s, i) => {
    const b = {
      시작: ㄱ,
      끝: ㄱ + s.프레임,
      표정: s.표정,
      몸짓: 몸짓목록[i],
      /* 옛 표형은 크기배를 안 준다 — 43화의 몸이 흔들리면 안 된다(값이 없으면 1 로 간다) */
      ...(s.꼴 ? { 크기배: 꼴크기[s.꼴] } : {}),
    };
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
        src={staticFile(곡.파일)}
        /* 지은 곡은 30.00초를 통째로 내므로 이음매가 없다. `loop` 는 남겨 둔다 —
           «받아 온» 곡은 길이가 제각각이라, 짧으면 이어 붙고 길면 앞에서 잘린다. */
        loop
        loopVolumeCurveBehavior="extend"
        /* 곡의 어느 지점부터 쓸지 — 받은 곡의 인트로를 건너뛰는 손잡이(가이드결이 쥔다) */
        startFrom={Math.round(fps * 곡.시작초)}
        volume={(f) =>
          interpolate(
            f,
            [0, 20, durationInFrames - 60, durationInFrames],
            [0, 곡.볼륨, 곡.볼륨, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          )
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
        <훅자막 글={클립.훅} 몽골어={클립.훅몽골어} />
      </Sequence>

      {/* ── 본문 6장면 — 자막층만 Sequence 안에 산다 ───────────────── */}
      {클립.장면들.map((장면, i) => {
        const 시작 = 경계표[i].시작;
        /* 🔑 시작 시각은 안 건드리고 «렌더 길이»만 늘려 겹치게 한다 — 소리·리듬이 안 흔들린다.
           마지막 장면만 예외: 전체 길이를 넘으면 잘린다. */
        const 꼬리 = i === 클립.장면들.length - 1 ? 0 : 겹침;
        const 워시 = 장면.꼴 ? 조판표[장면.꼴].워시 : null;
        return (
          <Sequence key={i} from={시작} durationInFrames={장면.프레임 + 꼬리}>
            {/* 바탕 워시 — 칸마다 «화면 전체»가 바뀌는 유일한 신호다.
                🔑 글자만 바뀌면 여전히 한 장으로 읽힌다(옛 판의 병). 실수 칸은 0 으로 식고
                   표현 칸은 1 로 확 올라온다 — 띠를 뽑았을 때 눈에 «먼저» 들어오는 것이 이것이다.
                🔴 첫 판은 신호바닥(Coral Wash #FEF0E9)으로 깔았는데 바탕(Paper #FBF7F0)과 값이
                   거의 같아 **띠에서 구별이 안 됐다**. 여린면(Coral Soft)으로 올렸다.
                🔑 자리를 «위»로 뒀다 — 자막 뒤에 후광이 서고 마스코트는 종이 위에 그대로 남는다.
                   아래로 깔면 코랄 마스코트가 코랄 바탕에 묻힌다(둘 다 코랄 램프다).
                🚫 페이드를 안 건다. 컷에서 바탕이 «탁» 바뀌는 것이 숏폼의 속도감이다
                   (겹침 0.2초 동안만 두 장이 포갠다). */}
            {워시 !== null && 워시 > 0 && (
              <AbsoluteFill
                style={{
                  opacity: 워시 * 0.55,
                  background: `radial-gradient(ellipse 92% 42% at 50% 30%, ${지면.여린면} 0%, transparent 72%)`,
                }}
              />
            )}
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
            {/* 소리는 «public 아래 상대경로»다 — 몽글은 `소리/…`(사운드킷), 까몽은 `옹알이_까몽/…` */}
            <Audio src={staticFile(장면.소리)} volume={0.75} />
          </Sequence>
        ) : null,
      )}

      {/* ── 가이드 — Sequence «밖» 고정층. 30초 내내 한 사람이 옆에 있다 ── */}
      <AbsoluteFill
        style={{
          justifyContent: "flex-end",
          alignItems: "center",
          paddingBottom: 연출.안전여백아래,
        }}
      >
        <살아있는마스코트 가이드={클립.가이드} 경계표={경계표} 폭={가이드폭} />
      </AbsoluteFill>

      {/* ── 로고 — 30초 브랜드 영상에 브랜드 마크가 0회였다 ────────────
          🔴 08-26 까지 이 자리가 «민라이트 150px» 였다. 그건 킷이 「예전 민벡터 표현은 기본에서
             은퇴」로 닫은 판이고, 유호님이 화면에서 잡아 주셨다. 판과 크기의 정본은 `연출.로고`
             하나이고 까닭은 거기 적혀 있다(자리가 먼저고 크기는 거기서 나온다).
          🔑 자리는 실측으로 비어 있는 위 띠다 — 자막 앵커가 y470 부터라 안 겹친다.
          🆕 09-06 — **훅이 끝난 뒤에 들어온다**(유호 「먼저 1번 가자」). 까닭은 `로고띠` 주석에. */}
      <Sequence from={훅프레임}>
        <로고띠 />
      </Sequence>

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
