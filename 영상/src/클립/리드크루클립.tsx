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
import type { 클립, 장면 } from "./타입";
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
import { 몸짓고르기, 몸짓쉼표 } from "./몸짓";

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
  const 몽글폭 = Math.round(width * 연출.가이드폭비);
  const 겹침 = Math.round(fps * 연출.겹침초);

  /* 장면 경계 표 — 몽글이 «절대프레임»에서 지금 어느 장면인지 찾는 데 쓴다 */
  let ㄱ = 훅프레임;
  /* 자막 한 줄이 곧 몸짓이다 — 「매워요」면 바르르, 「?」면 갸웃(`몸짓.ts`).
     🔑 편 «전체»를 한 번에 고른 뒤 `몸짓쉼표` 를 태운다 — 같은 몸짓이 잇달으면 사이를 쉰다
        (실측: 09편 3화가 여섯 칸 중 다섯이 움츠였다 = 30초 내내 움츠린 채). */
  const 몸짓목록 = 몸짓쉼표(클립.장면들.map((s) => 몸짓고르기(s.한국어)));
  const 경계표: 경계[] = 클립.장면들.map((s, i) => {
    const b = { 시작: ㄱ, 끝: ㄱ + s.프레임, 표정: s.표정, 몸짓: 몸짓목록[i] };
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
        src={staticFile(배경음악.파일)}
        /* 지은 곡은 30.00초를 통째로 내므로 이음매가 없다. `loop` 는 남겨 둔다 —
           «받아 온» 곡은 길이가 제각각이라, 짧으면 이어 붙고 길면 앞에서 잘린다. */
        loop
        loopVolumeCurveBehavior="extend"
        /* 곡의 어느 지점부터 쓸지 — 받은 곡의 인트로를 건너뛰는 손잡이(연출.배경음악.시작초) */
        startFrom={Math.round(fps * 배경음악.시작초)}
        volume={(f) =>
          interpolate(
            f,
            [0, 20, durationInFrames - 60, durationInFrames],
            [0, 배경음악.볼륨, 배경음악.볼륨, 0],
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
        <살아있는마스코트 가이드="몽글" 경계표={경계표} 폭={몽글폭} />
      </AbsoluteFill>

      {/* ── 로고 — 30초 브랜드 영상에 브랜드 마크가 0회였다 ────────────
          🔴 08-26 까지 이 자리가 «민라이트 150px» 였다. 그건 킷이 「예전 민벡터 표현은 기본에서
             은퇴」로 닫은 판이고, 유호님이 화면에서 잡아 주셨다. 판과 크기의 정본은 `연출.로고`
             하나이고 까닭은 거기 적혀 있다(자리가 먼저고 크기는 거기서 나온다).
          🔑 자리는 실측으로 비어 있는 위 띠다 — 자막 앵커가 y470 부터라 안 겹친다. */}
      <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center", paddingTop: 236 }}>
        <Img src={staticFile(로고.파일)} style={{ width: 로고.폭 }} />
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
