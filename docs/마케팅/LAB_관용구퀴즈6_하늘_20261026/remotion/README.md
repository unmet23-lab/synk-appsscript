# LAB 관용구 퀴즈 #6 「하늘 · 날씨」 · Remotion 4.0.535

기획·검토·게시 묶음은 [../기획.md](../기획.md)에 있다. 퀴즈 #5 프로젝트를 복사해 내용·그림·현지어 글과 10-23 이해 시험의 작은 것(따라 말할 틈 · 전환 · 로마자)만 바꿨다.

- `src/film/` 내용 표(`data.ts`)·박자표(`timeline.ts`, `REMOTION_TEMPO=100`이면 100 BPM)·나레이션 시각(`vo.generated.ts`)
- `src/kids/` 화면(`KidsFilm`·`KidsQuestion`·`KidsEnd`), 그림 표(`art.ts`), 몽골어(`i18n.ts`), 간체·버마어(`locales.ts`), 움직임(`motion.ts`)
- `src/lib/` 서체·모션 부품

다시 만들기(이 폴더에서):

1. `node 대본_q6.mjs` → `node 나레이션.cjs --판 q6en,q6ko` (같은 요청은 캐시, 새 줄만 Typecast)
2. `node 정지컷_q6.mjs [en mn cn mmtt]` → `out/q6_점검/<판>.png`
3. `node 렌더_q6.mjs [en mn cn mmtt]` → `../게시/<판 폴더>/video.mp4 · cover.png` (마감 −14.5 LUFS 포함)
4. `node 게시묶음_q6.mjs` (글 정본 `../게시/문안.json`) · `node 검문파일_q6.mjs` → `../게시/검문/`
5. 10MB 상한 길로만 올릴 때 `node 올림판_10MB.mjs ../게시/<판 폴더>/video.mp4`
