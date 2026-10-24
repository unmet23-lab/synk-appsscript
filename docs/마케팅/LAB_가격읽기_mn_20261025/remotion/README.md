# LAB 몽골 M5 「가격 읽기」 · Remotion 4.0.535

기획 · 몽골어 검수 · 이해 시험은 [../기획.md](../기획.md). M2(채팅 줄임말) 프로젝트의 설정 · 서체 · 효과음을 가져와 세웠다.

- `src/price/data.ts` 화면 글 정본(몽골어는 세 겹 검수를 거친 글만)
- `src/price/timeline.ts` 시간표
- `src/price/Film.tsx` 화면(위 띠 · 영수증 · 아래 카드 · 몽글)과 소리
- `public/img/mongle_*.jpg` — `../판/몽글계산대_072108.png`(GPT 이미지 2.5) 두 칸을 자른 것, `public/bgm.wav` — `docs/홍보물/BGM/시티팝_147.wav` 앞 20초

다시 만들기(이 폴더에서): `npm ci --prefer-offline` → `npx remotion render src/index.ts price-mn out/price_v3.mp4` → 저장소 뿌리에서 `node tools/음량마감.mjs <렌더> <마감>` → CBR 10M 다시 담기(현장 노트 「videoBitrate 12M」) → `../게시/01-ig-fb-mn/video.mp4` → `node 올림판_10MB.mjs <마감>`(같은 폴더에 upload_10MB.mp4가 생긴다 — 게시 폴더로 옮김), 표지 `npx remotion still src/index.ts price-mn ../게시/01-ig-fb-mn/cover.png --frame=20`.
