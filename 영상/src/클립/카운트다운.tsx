/**
 * 카운트다운 릴 — 릴 A 포맷을 SYNK 로 옮긴 판 (유호 확정 08-26).
 *
 * 릴 A(`cutoven.ai`)의 구성 = 캐릭터가 말 걸고 → 5부터 카운트다운 → 마지막에 댓글 유도.
 * 그 릴 댓글이 912개, 같이 보신 릴 B 는 7,082개였다 — 그 수를 만든 것이 이 구조다.
 *
 * 🔴 «캐릭터 1인칭 대사»는 안 가져왔다. 몽글의 무언 규칙(synk-brand 「학생과 대화하지 않는다 —
 *   표정·몸짓이 첫 언어」)과 정면으로 부딪히기 때문이다. 유호님 판정:
 *   **「옹알이하는 느낌으로 말하는 느낌만 주고 자막에 힘을 줘」**
 *   ⇒ 뜻은 «자막»이 지고, 캐릭터는 «옹알이 + 몸»으로만 반응한다.
 *   옹알이는 이 저장소의 확정 자산이다 — 낱말 0 · 음소 0 · TTS 0 · 음높이 곡선만
 *   (유호님 귀검수 4회를 지난 v5 판 · `tools/감각층소리합성.js`).
 *
 * 🔑 「자막에 힘」의 집행 셋:
 *   ① 순위 숫자를 «화면에서 제일 큰 것»으로 세운다(240px) — 릴 A 의 리듬을 만드는 것이 이 숫자다.
 *   ② 표현을 커버 급(152/124/104)으로 키운다. 리드크루 클립의 본문 단계(116/84/66)보다 한 단 위다.
 *   ③ 위 띠에 «남은 개수»를 점 다섯으로 세운다 — 「몇 개 남았나」가 보이면 끝까지 본다.
 */
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
import type { 카운트다운 as 카운트다운형, 순위 } from "./타입";
import { 지면, 율, 색 } from "../킷/색";
import { 본문스택, 웨이트, 트래킹, 몽골어보정 } from "../킷/폰트";
import { 연출, 로고, 배경음악, 그늘, 그레인, 비네트, 들임, 어절드러내기, type 경계 } from "./연출";
/* 마스코트는 «살아 있는» 판을 쓴다 — 4D 깊이층(유호 지시 08-26). 옛 `<Img>` 판(`연출.마스코트`)은
   깊이를 못 밀어서 「옆도 보는」 느낌이 원리상 안 난다. */
import { 살아있는마스코트 } from "./살아있는마스코트";
import { 몸짓고르기, 몸짓쉼표 } from "./몸짓";

/** 나감 커브 — 자막·훅·마무리가 같이 쓴다. 세 번째 복붙 직전에 함수로 뺐다. */
const 나감값 = (frame: number, fps: number, durationInFrames: number) => {
  const 나감f = Math.round(fps * 연출.나감초);
  const 범위: [number, number] = [durationInFrames - 나감f, durationInFrames - 2];
  const 옵션 = {
    extrapolateLeft: "clamp" as const,
    extrapolateRight: "clamp" as const,
    easing: Easing.bezier(0.7, 0, 0.84, 0),
  };
  return {
    opacity: interpolate(frame, 범위, [1, 0], 옵션),
    transform: `translateY(${interpolate(frame, 범위, [0, -26], 옵션)}px)`,
  };
};

/** 위 띠의 진행 점 다섯 — 「몇 개 남았나」. 카운트다운에서 이건 장식이 아니라 구조다. */
const 진행점: React.FC<{ 총: number; 현재: number }> = ({ 총, 현재 }) => (
  <div style={{ display: "flex", gap: 율.틈, justifyContent: "center" }}>
    {Array.from({ length: 총 }, (_, i) => (
      <div
        key={i}
        style={{
          width: i <= 현재 ? 율.단 : 율.칸,
          height: i <= 현재 ? 율.단 : 율.칸,
          borderRadius: 999,
          backgroundColor: i <= 현재 ? 지면.신호면 : 지면.실땀,
          opacity: i <= 현재 ? 1 : 0.5,
        }}
      />
    ))}
  </div>
);

/** 순위 한 칸. 숫자 → 표현 → 뜻 → 몽골어 순으로 «읽는 순서 = 학습 순서». */
const 순위칸: React.FC<{ 칸: 순위 }> = ({ 칸 }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const 나감 = 나감값(frame, fps, durationInFrames);

  /* 표현 크기는 커버와 «같은 단계»를 쓴다 — 이 릴에서 표현은 본문이 아니라 주인공이다.
     `keep-all` 은 어절드러내기 안에 이미 있다(낱말 가운데가 끊기던 자리). */
  const 표현크기 = 칸.표현.length <= 6 ? 152 : 칸.표현.length <= 9 ? 124 : 104;
  const 어절수 = 칸.표현.split(" ").length;
  const 어절간격f = Math.max(2, Math.round(fps * 연출.어절간격초));

  return (
    <div
      style={{
        ...나감,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 율.참,
        paddingLeft: 연출.안전여백좌우,
        paddingRight: 연출.안전여백좌우,
        textAlign: "center",
      }}
    >
      {/* ① 순위 숫자 — 화면에서 제일 큰 것. 릴 A 의 리듬을 만드는 자리다.
          코랄을 «글자»로 쓰므로 반드시 Coral 3(Deep) — Coral 은 Paper 위 대비 2.75 라 킷이 금지한다. */}
      <들임 지연={0} 바닥={0.45}>
        <div
          style={{
            fontFamily: 본문스택,
            fontSize: 240,
            fontWeight: 웨이트.태그라인_한글,
            color: 색("Coral 3"),
            letterSpacing: 트래킹.헤드_태그라인,
            lineHeight: 0.9,
          }}
        >
          {칸.순}
        </div>
      </들임>

      {/* ② 표현 — 어절별로 드러난다(학습 장치) */}
      <어절드러내기
        글={칸.표현}
        지연={Math.round(fps * 0.14)}
        바닥={0.45}
        style={{
          fontFamily: 본문스택,
          fontSize: 표현크기,
          fontWeight: 웨이트.헤드,
          color: 지면.글자,
          letterSpacing: 트래킹.헤드_태그라인,
          lineHeight: 1.16,
          display: "inline-block",
        }}
      />

      {/* ③ 뜻 — 한국어 보조. 표현이 다 드러난 뒤에 온다 */}
      <들임 지연={Math.round(fps * 0.14) + 어절수 * 어절간격f + 2}>
        <div
          style={{
            fontFamily: 본문스택,
            fontSize: 46,
            fontWeight: 웨이트.본문_UI,
            color: 지면.보조글자,
            letterSpacing: 트래킹.본문,
            lineHeight: 1.4,
            wordBreak: "keep-all",
          }}
        >
          {칸.뜻}
        </div>
      </들임>

      {/* ④ 몽골어 — 학습자의 «모국어»가 이해의 앵커다. 뜻 다음에 온다 */}
      {칸.몽골어 ? (
        <들임 지연={Math.round(fps * 0.14) + 어절수 * 어절간격f + Math.round(fps * 0.3)}>
          <div
            style={{
              fontFamily: 본문스택,
              fontSize: Math.round(44 * 몽골어보정),
              fontWeight: 웨이트.본문_UI,
              color: 지면.캡션글자,
              letterSpacing: 트래킹.본문,
              lineHeight: 1.5,
              wordBreak: "keep-all",
            }}
          >
            {칸.몽골어}
          </div>
        </들임>
      ) : null}
    </div>
  );
};

/** 훅·마무리 — 한 줄짜리 큰 글. 코랄 글자는 Coral 3 로만 쓴다. */
const 한줄자막: React.FC<{ 글: string; 크기?: number; 몽골어?: string }> = ({
  글,
  크기 = 74,
  몽골어,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const 나감 = 나감값(frame, fps, durationInFrames);
  return (
    <AbsoluteFill
      style={{
        ...나감,
        justifyContent: "flex-start",
        alignItems: "center",
        paddingTop: 연출.자막앵커위,
        paddingLeft: 연출.안전여백좌우,
        paddingRight: 연출.안전여백좌우,
      }}
    >
      <어절드러내기
        글={글}
        지연={0}
        바닥={0.45}
        style={{
          fontFamily: 본문스택,
          fontSize: 크기,
          fontWeight: 웨이트.태그라인_한글,
          color: 색("Coral 3"),
          letterSpacing: 트래킹.헤드_태그라인,
          lineHeight: 1.3,
          display: "inline-block",
        }}
      />

      {/* 훅·마무리의 몽골어 병기(유호 지시 08-28 — 그전엔 릴이 «몽골어로 열려 한국어로 닫혔다»).
          🔑 순위 칸과 **지연이 다르다.** 거기서는 뜻이 다 드러난 뒤 0.3초를 더 기다렸다가 몽골어가
             온다 — 읽는 순서가 곧 학습 순서라서다. 훅과 마무리는 배우는 자리가 아니라 «붙잡고·
             부르는» 자리이고, 보는 사람은 자기 언어 한 줄만 읽는다. ⇒ 0.12초로 거의 같이 띄운다.
          🔑 크기는 한국어의 0.7 배다(74→52 · 64→45). 둘째 언어로 보이되 곁다리로는 안 보이는 선. */}
      {몽골어 ? (
        <들임 지연={Math.round(fps * 0.12)} 바닥={0.35}>
          <div
            style={{
              fontFamily: 본문스택,
              fontSize: Math.round(크기 * 0.7 * 몽골어보정),
              fontWeight: 웨이트.본문_UI,
              color: 지면.보조글자,
              letterSpacing: 트래킹.본문,
              lineHeight: 1.45,
              marginTop: 율.칸,
              textAlign: "center",
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

export const 카운트다운: React.FC<{ 클립: 카운트다운형 }> = ({ 클립 }) => {
  const { fps, width, durationInFrames } = useVideoConfig();
  /* 🔴 훅 길이를 `fps * 3` 으로 박아 두지 않는다. 몽골어가 붙으면 파서가 훅을 늘리는데, 여기가
     90f 로 굳어 있으면 **모든 순위 칸이 밀린 자리에서 시작하고 마지막 칸이 화면 밖으로 넘친다.**
     리드크루에서 실제로 났던 사고다(08-28 · 프레임 띠는 칸 «가운데»를 뽑아서 안 보였다).
     ⇒ 파서와 같은 식으로 되찾는다: 전체 − 순위 합 − 마무리. */
  const 순위합 = 클립.순위들.reduce((a, r) => a + r.프레임, 0);
  const 훅프레임 = 클립.전체프레임 - 순위합 - 클립.마무리프레임;
  const 가이드폭 = Math.round(width * 클립.폭비);
  const 겹침 = Math.round(fps * 연출.겹침초);

  /* 경계표 — 마스코트가 «절대프레임»에서 지금 어느 칸인지 찾는 데 쓴다(Sequence 밖에 살기 때문) */
  let ㄱ = 훅프레임;
  /* 몸짓은 «표현 + 뜻» 둘을 같이 본다 — 「매워요! 근데 맛있어요」는 표현에, 「맵기를 내 마음대로」는 뜻에 있다.
     훅·순위·마무리를 «한 줄»로 이어 고른 뒤 쉼표를 태운다 — 같은 몸짓이 잇달으면 사이를 쉰다. */
  const 몸짓줄 = 몸짓쉼표([
    몸짓고르기(클립.훅),
    ...클립.순위들.map((r) => 몸짓고르기(`${r.표현} ${r.뜻}`)),
    몸짓고르기(클립.마무리),
  ]);
  const 칸경계 = 클립.순위들.map((r, i) => {
    const b = { 시작: ㄱ, 끝: ㄱ + r.프레임, 표정: r.표정, 몸짓: 몸짓줄[i + 1] };
    ㄱ += r.프레임;
    return b;
  });
  const 마무리시작 = ㄱ;
  const 경계표: 경계[] = [
    { 시작: 0, 끝: 훅프레임, 표정: "본체" as const, 몸짓: 몸짓줄[0] },
    ...칸경계,
    { 시작: 마무리시작, 끝: durationInFrames, 표정: 클립.마무리표정, 몸짓: 몸짓줄[몸짓줄.length - 1] },
  ];

  /* ── 옹알이 배치 ────────────────────────────────────────────────────────
     🔑 «박»(칸 하나 = 4.3~5.5초)마다 얹는다. 어절마다는 못 얹는다 — 어절 간격 0.1초에
        가장 짧은 옹알이가 0.41초이고 형제 저장소 정본이 겹침막기를 700ms 로 못 박았다.
     🔑 한 박 안에서 둘을 «사이를 두고» 낸다(머리 + 중간). 한 발이면 알림음으로 들리고,
        둘이면 말로 들린다. 까몽은 정본이 「거의 안 함」이라 한 발만 온다(대본읽기가 이미 잘라 준다). */
  const 옹알이들: { 프레임: number; 파일: string }[] = [];
  /* 🔴 08-26 유호님: 「몽글이 반응 소리가 너무 자주 나온다 · **문장이 바뀔 때마다** 옹알이를 내주고
     그 외에 중간에는 안 나와도 될 것 같다」. 첫 판은 둘째 발을 박의 55% 자리(=문장 한가운데)에 뒀고,
     그게 «중간에 나는 소리»였다. 이제 둘 다 **문장 머리**에 모은다 — 둘째 발은 0.8초 뒤다.
     🔑 0.8초인 까닭: 형제 저장소 정본이 겹침막기를 700ms 로 못 박았다. 그보다 좁히면 두 소리가
        겹쳐 «한 덩어리»로 뭉개진다. 0.8 은 그 선 바로 밖이라 «두 마디»로 들린다.
     🔑 몽글 2발 · 까몽 1발 — 가이드 정본 §2 「말 빈도: 자주·짧게 ↔ 거의 안 함」(대본읽기가 잘라 준다). */
  /* 곡 — 가이드가 들고 있으면 그것을, 없으면 연출 기본값을. 「어느 릴에 어느 곡」이 데이터에 산다. */
  const 곡 = 클립.배경음악 ?? 배경음악;

  const 벌림 = Math.round(fps * 0.8);
  const 얹기 = (시작: number, _길이: number, 목록: string[]) => {
    목록.forEach((이름, i) => {
      옹알이들.push({ 프레임: 시작 + 6 + i * 벌림, 파일: `옹알이_${클립.가이드}/${이름}.wav` });
    });
  };
  얹기(0, 훅프레임, 클립.훅옹알이);
  클립.순위들.forEach((r, i) => 얹기(칸경계[i].시작, r.프레임, r.옹알이));
  얹기(마무리시작, 클립.마무리프레임, 클립.마무리옹알이);

  return (
    <AbsoluteFill style={{ backgroundColor: 지면.바탕 }}>
      {/* 깔림 — `loop` + `loopVolumeCurveBehavior="extend"` 가 없으면 끝 페이드가 «영원히 안 온다»
          (볼륨 함수의 f 가 루프마다 0 으로 되감긴다 · 08-26 실측). */}
      <Audio
        src={staticFile(곡.파일)}
        /* 지은 곡은 30.00초를 통째로 내므로 이음매가 없다. `loop` 는 남겨 둔다 —
           «받아 온» 곡은 길이가 제각각이라, 짧으면 이어 붙고 길면 앞에서 잘린다. */
        loop
        loopVolumeCurveBehavior="extend"
        /* 곡의 어느 지점부터 쓸지 — 받은 곡의 인트로를 건너뛰는 손잡이(연출.배경음악.시작초) */
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

      {/* 바닥 결 — 유채 실은 «주연 1(코랄)» 하나로 끝낸다 */}
      <AbsoluteFill
        style={{ background: `linear-gradient(180deg, ${지면.바탕} 34%, ${지면.신호바닥} 86%)` }}
      />

      {/* ── 훅 (0~3초) ─────────────────────────────────────────────── */}
      <Sequence durationInFrames={훅프레임 + 겹침}>
        <한줄자막 글={클립.훅} 몽골어={클립.훅몽골어} />
      </Sequence>

      {/* ── 순위 다섯 ──────────────────────────────────────────────── */}
      {클립.순위들.map((r, i) => (
        <Sequence key={r.순} from={칸경계[i].시작} durationInFrames={r.프레임 + 겹침}>
          <AbsoluteFill
            style={{ justifyContent: "flex-start", alignItems: "center", paddingTop: 연출.자막앵커위 - 150 }}
          >
            <순위칸 칸={r} />
          </AbsoluteFill>
        </Sequence>
      ))}

      {/* ── 마무리 = 댓글 유도. 릴 A 가 댓글 912개를 만든 자리다 ────── */}
      <Sequence from={마무리시작} durationInFrames={durationInFrames - 마무리시작}>
        <한줄자막 글={클립.마무리} 크기={64} 몽골어={클립.마무리몽골어} />
      </Sequence>

      {/* ── 옹알이 — 그림보다 3프레임 «먼저» 오면 붙어 들린다 ────────── */}
      {옹알이들.map((o, i) => (
        <Sequence key={`m${i}`} from={Math.max(0, o.프레임 - 3)} durationInFrames={45}>
          <Audio src={staticFile(o.파일)} volume={0.8} />
        </Sequence>
      ))}

      {/* ── 진행 점 — 위 띠(실측으로 비어 있던 자리). 「몇 개 남았나」가 보이면 끝까지 본다 ── */}
      <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center", paddingTop: 268 }}>
        <진행점표 칸경계={칸경계} 총={클립.순위들.length} 마무리시작={마무리시작} />
      </AbsoluteFill>

      {/* ── 가이드 — Sequence «밖» 고정층. 30초 내내 한 사람이 옆에 있다 ── */}
      <AbsoluteFill
        style={{
          justifyContent: "flex-end",
          alignItems: "center",
          paddingBottom: 연출.안전여백아래,
        }}
      >
        <살아있는마스코트
          가이드={클립.가이드}
          경계표={경계표}
          폭={가이드폭}
          말할때={옹알이들.map((o) => o.프레임)}
        />
      </AbsoluteFill>

      {/* 로고 — 판과 크기의 정본은 `연출.로고` 하나다. 여기서 이름을 손으로 적지 않는다. */}
      <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center", paddingTop: 96 }}>
        <Img src={staticFile(로고.파일)} style={{ width: 로고.폭 }} />
      </AbsoluteFill>

      <AbsoluteFill style={{ justifyContent: "flex-end" }}>
        <div style={{ height: 율.실 * 3, backgroundColor: 지면.실땀 }} />
      </AbsoluteFill>

      <그레인 />
      <비네트 />
    </AbsoluteFill>
  );
};

/** 진행 점을 «절대프레임»으로 읽는 껍데기 — Sequence 밖이라 컷에서 안 튄다. */
const 진행점표: React.FC<{ 칸경계: { 시작: number; 끝: number }[]; 총: number; 마무리시작: number }> = ({
  칸경계,
  총,
  마무리시작,
}) => {
  const frame = useCurrentFrame();
  if (frame < 칸경계[0].시작) return null; /* 훅 동안은 안 띄운다 — 훅은 훅만 읽게 */
  const 현재 = frame >= 마무리시작 ? 총 - 1 : 칸경계.findIndex((b) => frame >= b.시작 && frame < b.끝);
  return <진행점 총={총} 현재={현재 === -1 ? 총 - 1 : 현재} />;
};
