import { Config } from "@remotion/cli/config";

/* 세로 릴(1080×1920)이 기본 과녁이다 — 컴포지션마다 다시 정한다. */
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);

/* 이 노트북 실측 여유 메모리가 3GB 안팎이다(08-26 13:57 = 2.94GB/15.41GB).
   동시성을 안 묶으면 크롬이 코어 수만큼 떠서 다른 세션의 굽기와 경합한다.
   숫자를 올리려면 «먼저 재고» 올린다 — 트랙 §0 의 겹침 규율과 같은 축이다. */
Config.setConcurrency(4);
