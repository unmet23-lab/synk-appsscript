# LAB 몽골 M2 「한국 친구와 채팅할 때」 · Remotion 4.0.535

기획 · 몽골어 검수 · 이해 시험은 [../기획.md](../기획.md). E5(처음 쓰는 ㄹ) 프로젝트의 설정을 가져와 세웠다.

- `src/chat/data.ts` 화면 글 정본(몽골어는 세 겹 검수를 거친 글만)
- `src/chat/timeline.ts` 시간표 · 대화
- `src/chat/Film.tsx` 화면(위 띠 · 대화 · 풀이 카드 · 몽글)과 소리
- `public/img/mongle_*.jpg` — `../판/몽글채팅_080129.png`(GPT 이미지 2.5) 두 칸을 자른 것, `public/bgm.wav` — `docs/홍보물/BGM/따뜻_118.wav` 앞 21.5초

다시 만들기(이 폴더에서): `npm ci --prefer-offline` → `npx remotion render src/index.ts chat-mn out/chat_v9.mp4` → 저장소 뿌리에서 `node tools/음량마감.mjs <렌더> <마감>` → CBR 10M 다시 담기(현장 노트 「videoBitrate 12M」) → `../게시/01-ig-fb-mn/video.mp4` → `node 올림판_10MB.mjs ../게시/01-ig-fb-mn/video.mp4`, 표지 `npx remotion still src/index.ts chat-mn ../게시/01-ig-fb-mn/cover.png --frame=0`.
