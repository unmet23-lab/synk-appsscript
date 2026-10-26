# LAB 관용구 퀴즈 #7 몽골판 「물 · 불」 · Remotion 4.0.535

기획 · 검토 · 이해 시험 · 판정(버림)은 [../기획.md](../기획.md)에 있다. 퀴즈 #6 프로젝트를 복사해 내용 · 그림 · 몽골어 글을 바꾸고, 몽골판만의 몽글 말풍선(한국어 진행 소리를 그 박에 몽골어로 · 정답 때 「왜 그 뜻인지」)을 더했다.

- `src/film/` 내용 표(`data.ts`) · 박자표(`timeline.ts`, `REMOTION_TEMPO=100`이면 100 BPM) · 나레이션 시각(`vo.generated.ts`)
- `src/kids/` 화면(`KidsFilm` · `KidsQuestion`의 `HostBubble` · `KidsEnd`), 그림 표(`art.ts`), 몽골어(`i18n.ts` — MN · bubble · qHooks · why), 움직임(`motion.ts`)

다시 만들기(이 폴더에서):

1. `npm ci --prefer-offline`
2. `node 대본_q7.mjs` → `node 나레이션.cjs --판 q7ko` (같은 요청은 캐시, 새 줄만 Typecast)
3. `node 렌더_q7.mjs` → `out/q7_mn.mp4` → `마감.mjs` → `../게시/01-mn/video.mp4` · `cover.png`(영상은 git 밖)
