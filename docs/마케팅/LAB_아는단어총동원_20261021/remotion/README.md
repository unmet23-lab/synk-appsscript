# LAB 「아는 단어 총동원」(10-21) · Remotion 4.0.535

기획·검토·게시 묶음은 [../기획.md](../기획.md)에 있다. 관용구 퀴즈 #4 프로젝트를 복사해 색·만화 글자·판(`src/kids/theme.ts`)과 모션 부품(`src/lib/`)만 남기고 화면은 `src/vocab/`에 새로 짰다.

- `src/vocab/data.ts` 화면 글 정본(영어·몽골어) · `schedule.ts` 줄 길이로 낱말 자리 · `VocabFilm.tsx` 화면 · `vo.generated.ts` 나레이션 길이(손으로 고치지 않음)
- `public/img/vocab/` 오린 펠트 그림(판은 `../판/`), `public/vo/vocab/` 나레이션 줄, `public/bgm_kids_100.wav`·`sfx/` 퀴즈 연재 소리

다시 만들기(이 폴더에서):

1. `node ../../../../tools/나레이션굽기.mjs 나레이션_계획.json --굽기` (같은 요청은 캐시, 새 줄만 Typecast)
2. `node 정지컷.mjs [en mn]` → `out/점검/<판>.png`
3. `node 렌더.mjs [en mn]` → `../게시/<판 폴더>/video.mp4 · cover.png` (마감 −14.3 LUFS 포함)
4. `node 게시묶음.mjs` (글 정본 `../게시/문안.json`)
5. 10MB 상한 길로만 올릴 때 `node 올림판_10MB.mjs ../게시/<판 폴더>/video.mp4`
6. 마감 점검 `node ../../../../tools/정지구간.js ../게시/<판 폴더>/video.mp4`
