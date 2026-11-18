# 드라마 「오늘」 움직임 시안 셋 (2026-11-18 밤)

유호님의 「이 기능에 더 어울리는 프론트 디자인이 있는지 디자인사이트 참고해서 다시 만들어」로 지은 시안이다. 컨셉, 강조 순위, 참고 작품, 순간마다의 소리는 [설계.md](설계.md)에 있다. 경과와 맹검 결과는 [현황 13절](../현황.md#13-11월-18일-밤--움직임-시안-셋)에 있다.

- [a.html](a.html) 오늘 회차 예고: 태오가 화면 가득 말을 걸고, 끝나면 어제 한 말 「한참 헤맸어요」가 제목으로 찍힌다.
- [b.html](b.html) 테이프 세 개: 장면마다 테이프 한 개가 있고, 1번 테이프가 텔레비전에 꽂히며 태오가 말한다.
- [c.html](c.html) 태오의 영상 메시지: 태오가 동그란 영상 메시지를 보내고, 어제 내가 한 말을 인용해 오늘 할 장면을 보낸다.

## 여는 법

그림, 영상, 글꼴, 소리는 저장소에 다시 올리지 않고 아래 원본을 같은 폴더의 `a/`, `f/`, `s/`에 복사해 쓴다.

| 시안 폴더의 파일 | 원본 |
|---|---|
| `a/taeo-talk.mp4` | `experiences/drama/pilot/media/today-taeo-6yo.mp4` |
| `a/taeo-listen.mp4`, `a/taeo-still.webp` | `experiences/drama/pilot/media/` 같은 이름 |
| `a/taeo-poster.jpg` | `taeo-listen.mp4`의 첫 장(`ffmpeg -i a/taeo-listen.mp4 -frames:v 1 a/taeo-poster.jpg`) |
| `a/cafe.webp`, `a/transfer.webp`, `a/gate.webp` | `experiences/drama/pilot/media/today-scene-cafe.webp`, `today-scene-transfer.webp`, `today-venue-library.webp` |
| `f/SUIT-Variable.woff2` | `experiences/drama/pilot/media/SUIT-Variable.woff2` |
| `s/*` | `docs/디자인/synk.im_LAB무대_20261117/장면1/sound/` |

공용 작업본의 `.tmp/today-redo-1118/v2/`에 이렇게 차린 사본이 있다. 띄우기는 `node tools/pulse-hall-faces/serve.cjs <시안 폴더> 4963`이고, 녹화는 `node 찍기.cjs <a|b|c> <390x844|1440x900> <초> [--찍을 초,…] [--누를 "초:선택자"]`다. 녹화는 쪽이 남긴 소리 기록으로 효과음과 태오 목소리를 입혀 `녹화/`에 mp4를 만든다.
