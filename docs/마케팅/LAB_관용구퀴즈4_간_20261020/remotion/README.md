# LAB 관용구 퀴즈 #4 「간」 · Remotion 4.0.535

기획·검토·게시 묶음은 [../기획.md](../기획.md)에 있다. 퀴즈 #3 프로젝트를 복사해 키즈판(`src/kids/`)만 남겼다.

- `src/film/` 내용 표(`data.ts`)·박자표(`timeline.ts`, `REMOTION_TEMPO=100`이면 100 BPM)·나레이션 시각(`vo.generated.ts`)
- `src/kids/` 화면(`KidsFilm`·`KidsQuestion`·`KidsEnd`), 그림 표(`art.ts`), 몽골어(`i18n.ts`), 간체·버마어(`locales.ts`), 움직임(`motion.ts`)
- `src/lib/` 서체·모션 부품

다시 만들기(이 폴더에서):

1. `node 대본_q4.mjs` → `node 나레이션.cjs --판 q4en,q4ko` (같은 요청은 캐시, 새 줄만 Typecast)
2. `node 정지컷_q4.mjs [en mn cn mmtt]` → `out/q4_점검/<판>.png`
3. `node 렌더_q4.mjs [en mn cn mmtt]` → `../게시/<판 폴더>/video.mp4 · cover.png` (마감 −14.5 LUFS 포함)
4. `node 게시묶음_q4.mjs` (글 정본 `../게시/문안.json`) · `node 검문파일_q4.mjs` → `../게시/검문/`
5. 10MB 상한 길로만 올릴 때 `node 올림판_10MB.mjs ../게시/<판 폴더>/video.mp4`
