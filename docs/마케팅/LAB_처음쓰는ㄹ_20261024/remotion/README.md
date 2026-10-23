# LAB E5 「처음 쓰는 ㄹ」 · Remotion 4.0.535

기획·이해 시험·관문은 [../기획.md](../기획.md). 관용구 퀴즈 #5 프로젝트의 설정(package.json · remotion.config.ts · tsconfig · 서체)을 가져와 세웠다.

- `src/film/geo.ts` 손으로 그은 획(떨림 · 꺾임, 같은 seed면 같은 모양)
- `src/film/Film.tsx` 화면(공책 · 칸 · 연필 · 이름표 · 쪽 넘김 · 세 획 · 분해 · 별점)과 소리
- `src/film/timeline.ts` 시간표 — 나레이션 시각은 `public/vo/*.json`의 낱말 시각
- `public/` 공책 · 연필(`../판/`에서 구운 원본을 손봄), 목소리(`../음성/계획.json`), 효과음(Fairlight 연필 · 쪽 넘김, 퀴즈 #5의 pop · tok · sparkle), 배경음(`docs/홍보물/BGM/밝은_052.wav` 앞 18초)

다시 만들기(이 폴더에서):

1. `npm ci --prefer-offline`
2. `npx remotion render src/index.ts rieul-en out/rieul_v6.mp4`
3. 저장소 뿌리에서 `node tools/음량마감.mjs <렌더> <마감>` → CBR 10M 다시 담기(현장 노트 「videoBitrate 12M」) → `../게시/01-youtube-en/video.mp4`
4. `node 올림판_10MB.mjs ../게시/01-youtube-en/video.mp4`, 표지 `npx remotion still src/index.ts rieul-en out/cover.png --frame=196`
