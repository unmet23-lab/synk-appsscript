/**
 * 첫 게시물 티저 — 페이스북 첫 게시물에 «올리는 것» (유호 지시 09-07).
 *
 * ■ 옛 판이 왜 못 쓰나
 *   `docs/홍보물/FB_첫게시물_티저_v3.mp4` 는 젤리·유리 마스코트로 만들어졌고, 그 씨앗은
 *   폴더째 사라졌다(마스코트 정본이 08-19 에 펠트로 확정되면서). 그래서 «다시 굽기»가
 *   성립하지 않는다 — 뼈대만 물려받고 재질은 새로 세운다.
 *
 * ■ 옛 판에서 물려받은 뼈대 (6초 · 1080×1080)
 *   표지 카드를 «층층이 쌓아 올려» 마지막 프레임이 곧 표지가 된다. 그 구조는 좋았다 —
 *   6초를 다 본 사람의 눈에 남는 그림과, 피드에 뜨는 표지가 같은 그림이기 때문이다.
 *   🚫 안 물려받은 것 = «빛 점 아치». 그건 네온 문법이고 펠트에 없다(카드에서도 뺐다).
 *
 * ■ 🔴 움직임 규율 — 이 저장소에만 있는 제약
 *   유호님이 마스코트 «움직임을 더하는» 안을 두 번 멀미로 기각하셨다(08-26 · 09-06 ·
 *   memory `mascot-motion-makes-yuho-sick`). 그래서 몽글은 **놓이기만 하고 움직이지 않는다** —
 *   숨쉬기·떠오름·흔들림 0. 바깥 모션 스킬의 「2초 넘게 있는 것은 숨을 쉰다」는 여기서 안 쓴다.
 *   09-07 확정(릴 첫 2초)도 같은 결이다: 「움직임은 없다」.
 *   ⇒ 이 영상의 결은 «요란한 등장»이 아니라 «천 위에 하나씩 놓이는 손»이다.
 *
 * ■ 자산을 다시 만들려면 (public/티저/ 는 git 밖이다)
 *     node tools/FB카드굽기.js                                   → 카드 + docs/홍보물/카드_자리.json
 *     python tools/펠트글자.py "안녕하세요" --천 펠트_종이바탕.webp --크기 200 --자간 0.05  *            --낼곳 영상/public/티저/인사.png
 *     python tools/펠트글귀.py --조각 "16:펠트_종이바탕.webp" "+:공방_코랄펠트.avif:150" "1:펠트_종이바탕.webp"  *            --크기 220 --낼곳 영상/public/티저/수.png
 *     ffmpeg -y -i docs/Loom_자산/구움/공방_먹색펠트.avif -vf scale=2000:-1 -frames:v 1 -update 1  *            영상/public/티저/천_어두운.png
 *     node 영상/자산모으기.js                                     → 로고(펠트다크)·몽글 본체 + 곡
 *   🔑 곡은 여기 없다 — 09-07 부터 자산모으기가 `docs/홍보물/BGM/` 을 통째로 옮기고 이 파일이
 *      그것을 직접 문다. 옛 판은 깔림을 6.2초로 미리 잘라 `영상/public/티저/배경음.wav` 를
 *      만드는 ffmpeg 한 줄이 여기 적혀 있었는데, 그건 «손으로 켜는 설정»이라 내렸다.
 *
 * ■ 놓임의 문법
 *   opacity + translateY + scale 셋을 함께 움직인다(페이드 하나는 금지). 위에서 살짝 내려와
 *   1.03 배에서 1 로 앉는다 — 손으로 천 조각을 내려놓을 때의 자리다. spring 이라 끝이 부드럽다.
 *   몽글만 이동 0 · 확대 1.02→1 로 더 얕게 든다(위 규율).
 */
import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { 색 } from "../킷/색";
import { 본문스택, 웨이트, 트래킹 } from "../킷/폰트";
import { 그레인, 비네트 } from "./연출";
/* 🔑 자리는 «표지 카드가 쥔다». `tools/FB카드굽기.js` 가 굽고 나서 이 표를 쓰고, 여기가 그걸 문다.
   티저의 마지막 프레임은 카드와 «같은 그림»이어야 뜻이 산다 — 6초를 본 눈에 남는 그림과
   피드에 뜨는 표지가 같아야 하기 때문이다. 두 곳이 자리를 따로 알면 그날 바로 갈린다. */
import 자리표 from "../../../docs/홍보물/카드_자리.json";

/** 정사각 규격 — 페이스북 피드에서 세로로 가장 크게 잡히는 꼴이다. */
export const 정사각 = {
  width: 자리표.캔버스.폭,
  height: 자리표.캔버스.높이,
  fps: 30,
} as const;
export const 티저길이 = 180; // 6초 · 옛 판과 같다

/** 요소가 들어오는 «때»(초). 사슬로 잇지 않고 표로 둔다 — 리듬은 눈으로 고치는 값이다. */
const 때 = {
  로고: 0.5,
  인사: 1.0,
  로마: 1.5,
  몽글: 2.1,
  수: 3.0,
  자리: 3.7,
} as const;

/** 놓임 — 위에서 살짝 내려와 앉는다. `얕게` 면 이동 없이 아주 조금만 든다(마스코트용). */
const 놓임 = (
  frame: number,
  fps: number,
  시작초: number,
  얕게 = false,
): React.CSSProperties => {
  const s = spring({
    frame: frame - Math.round(fps * 시작초),
    fps,
    config: { damping: 200, mass: 0.9, stiffness: 110 },
    durationInFrames: Math.round(fps * (얕게 ? 0.9 : 0.7)),
  });
  const 내림 = 얕게 ? 0 : interpolate(s, [0, 1], [-18, 0]);
  const 확대 = interpolate(s, [0, 1], [얕게 ? 1.02 : 1.03, 1]);
  return {
    opacity: s,
    transform: `translateY(${내림.toFixed(2)}px) scale(${확대.toFixed(4)})`,
  };
};

export const 첫게시물티저: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  /* 천은 아주 느리게 커진다 — 6초 동안 1 → 1.045. 「살아 있는 자리」이지 움직임이 아니다.
     마스코트에는 이 손잡이를 안 준다(위 규율). */
  const 천확대 = interpolate(frame, [0, durationInFrames], [1, 1.045], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const 잔글씨 = (크기: number): React.CSSProperties => ({
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
    fontFamily: 본문스택,
    fontWeight: 웨이트.본문_UI,
    fontSize: 크기,
    color: 색("Ash Wool"),
  });

  return (
    <AbsoluteFill style={{ backgroundColor: 색("Ink Deep") }}>
      {/* ① 바탕 — 구운 먹색 펠트 천 */}
      <AbsoluteFill style={{ overflow: "hidden" }}>
        <Img
          src={staticFile("티저/천_어두운.png")}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: `scale(${천확대.toFixed(4)})`,
            filter: "brightness(.62) saturate(.9)",
          }}
        />
      </AbsoluteFill>

      {/* ② 그늘 — 가운데를 남기고 가장자리를 눌러 글자가 읽히게 한다 */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(118% 88% at 50% 50%, transparent 0%, ${색("Ink Deep")} 88%)`,
          opacity: 0.86,
        }}
      />

      {/* ③ 놓이는 것들 */}
      <Img
        src={staticFile("로고/펠트다크.svg")}
        style={{
          position: "absolute",
          top: 자리표.로고.위,
          left: "50%",
          marginLeft: -자리표.로고.폭 / 2,
          width: 자리표.로고.폭,
          ...놓임(frame, fps, 때.로고),
        }}
      />

      <Img
        src={staticFile("티저/인사.png")}
        style={{
          position: "absolute",
          top: 자리표.인사.위,
          left: "50%",
          marginLeft: -자리표.인사.폭 / 2,
          width: 자리표.인사.폭,
          ...놓임(frame, fps, 때.인사),
        }}
      />

      <div
        style={{
          ...잔글씨(자리표.로마.크기),
          top: 자리표.로마.위,
          lineHeight: `${자리표.로마.높이}px`,
          letterSpacing: 트래킹.모노_라벨_최대,
          ...놓임(frame, fps, 때.로마),
        }}
      >
        annyeonghaseyo
      </div>

      {/* 🔴 몽글은 놓이기만 한다 — 이동 0 · 확대 1.02→1(멀미 규율) */}
      <Img
        src={staticFile("몽글/본체.png")}
        style={{
          position: "absolute",
          top: 자리표.몽글.가운데 - 자리표.몽글.폭 / 2,
          left: "50%",
          marginLeft: -자리표.몽글.폭 / 2,
          width: 자리표.몽글.폭,
          ...놓임(frame, fps, 때.몽글, true),
        }}
      />

      <Img
        src={staticFile("티저/수.png")}
        style={{
          position: "absolute",
          top: 자리표.수.위,
          left: "50%",
          marginLeft: -자리표.수.폭 / 2,
          width: 자리표.수.폭,
          ...놓임(frame, fps, 때.수),
        }}
      />

      <div
        style={{
          ...잔글씨(자리표.자리때.크기),
          top: 자리표.자리때.위,
          ...놓임(frame, fps, 때.자리),
        }}
      >
        Улаанбаатар · 2027.02
      </div>

      {/* ④ 위층 — 필름 결과 비네트는 늘 맨 위다 */}
      <그레인 />
      <비네트 />

      {/* 🔴 곡 — 09-07 에 Suno 판 시티팝으로 갈았다(유호 확정 「bgm들도 앞으로 수노로」).
          옛 판은 `티저/배경음.wav` 였다. 그건 08-24 자 «깔림»(패드)을 ffmpeg 로 미리 6.2초만
          잘라 둔 파일이고, 그 자르는 명령이 이 파일 머리 주석에만 살아 있었다 = 손으로 켜는 설정.
          여기서 곡을 직접 물면 그 파생 파일이 필요 없어진다(릴이 이미 그렇게 문다).

          🔑 볼륨 0.54 — 시티팝의 이 6초는 −13.7 LUFS 이고 옛 깔림은 −19.1 LUFS 라 5.4dB 크다.
             0.54 를 곱하면 «옛 판과 같은 크기»가 된다. 곡만 갈리게 해서 유호님 귀가
             「곡」을 고르시게 하려는 값이다 — 「소리를 더 앞에 내세울지」는 그다음 물음이다.
          🔑 시작 86.1초 — 이 곡의 «가장 꽉 찬 6초»다(자 = `python tools/곡재기.py --창 6`).
             앞 1분 반이 도입부라 처음부터 쓰면 6초가 통째로 밋밋해진다. */}
      <Audio
        src={staticFile("소리/받은BGM/시티팝_147.wav")}
        startFrom={Math.round(30 * 86.1)}
        volume={(f) =>
          interpolate(f, [0, 15, 티저길이 - 30, 티저길이], [0, 0.54, 0.54, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
        }
      />
    </AbsoluteFill>
  );
};
