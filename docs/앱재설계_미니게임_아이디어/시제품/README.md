# 펠트 놀이터 시제품 — 틀과 자산 묶기

- `펠트놀이터_틀.html` = 지면 틀(자산은 `/*ASSETS_JSON*/{}` 자리에 끼운다 · 서체는 폰 내장 한글 서체). 발행본은 아티팩트 「펠트 놀이터」(727f7640-beee-4594-8e48-49320812e579).
- `시제품_자산.js` = 구운 펠트 그림을 폰 크기 webp 로 줄여 data URI JSON 으로 낸다. 돌리기: `NODE_PATH=../SYNK-talk/node_modules node 시제품_자산.js`(cwd = SYNK-appsscript · OUT 경로는 파일 머리 상수).
- 다시 묶기: JSON 을 읽어 `/*ASSETS_JSON*/{}` 을 `JSON.stringify(A)` 로 바꾸고 `@font-face` 줄을 걷는다(2.3MB · 5MB 판은 클라우드플레어에 막혔다 09-05).
