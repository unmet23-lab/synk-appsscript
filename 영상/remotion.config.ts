import { Config } from "@remotion/cli/config";

/* 세로 릴(1080×1920)이 기본 과녁이다 — 컴포지션마다 다시 정한다. */
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);

/* 이 노트북 실측 여유 메모리가 3GB 안팎이다(08-26 13:57 = 2.94GB/15.41GB).
   동시성을 안 묶으면 크롬이 코어 수만큼 떠서 다른 세션의 굽기와 경합한다.
   숫자를 올리려면 «먼저 재고» 올린다 — 트랙 §0 의 겹침 규율과 같은 축이다. */
Config.setConcurrency(4);

/* 🔴 색을 bt709 로 «태그해서» 굽는다.
   첫 판 실측: pix_fmt=yuvj420p · color_range=pc · color_space=bt470bg — 전대역 + PAL 행렬이다.
   JPEG 중간 포맷(setVideoImageFormat)이 전대역이라 그렇게 찍혔다. 수신측이 limited 로 읽으면
   크림 종이 바탕이 흰색으로 뭉개지고, bt470bg→bt709 오태그 몫까지 얹히면 코랄의 G 채널이 어긋난다.
   🔑 색 판정은 «유호님 눈»이 축인 자리다(결정 08-26) — 판정한 색과 발행되는 색이 달라지면 그 판정이 헛돈다. */
Config.setColorSpace("bt709");
