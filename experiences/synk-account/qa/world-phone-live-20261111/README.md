# 웹 플랫폼 「WORLD는 휴대폰에서」 — 공개 후보 (2026-11-11)

synk.im 웹 플랫폼(`https://synk.im/account/platform.html`)에서 WORLD 앱 칸을 빼고 내 홈 선반 아래 휴대폰 칸 하나로 안내하는 판의 공개 후보를 만드는 도구다. 정본은 [플랫폼 설계 「WORLD는 휴대폰에서」](../../../../docs/SYNK_플랫폼_계정과_연결_설계.md#world-phone-only-20261111)이고, 공개는 `tools/공개.js`로만 한다.

공개본 `account/dist/platform.js`는 master 빌드와 구성이 달라([현장 노트](../../../../docs/현장노트/배포_공개.md#공개본-accountdistplatformjs를-master-빌드로-덮으면-남의-미공개-기능이-같이-나간다)) 통째로 덮지 않는다. 11-08 · 11-10처럼 구역을 손으로 고르지 않고, 앞 판 master 빌드와 새 빌드의 차이를 조각(hunk) 단위로 옮긴다.

## `patch-live.mjs`

```bash
git show <바탕 커밋>:experiences/synk-account/dist/platform.js > <앞 판 빌드>
node tools/check-account-bundles.js --build                      # 새 master 빌드
node patch-live.mjs <공개본 account/dist/platform.js> <앞 판 빌드> experiences/synk-account/dist/platform.js <후보 platform.js>
```

- 두 빌드를 `;` `{` `}` 줄바꿈 뒤에서 자른 조각 목록으로 `git diff --no-index -U0`를 떠 고친 조각을 얻는다.
- 뒤에서부터 얹는다. 조각마다 「조각 자체 → 앞 문맥만 · 뒤 문맥만 · 둘 다(1~12조각)」 차례로 공개본에서 **정확히 한 번** 나오는 자리를 찾는다 — 공개본은 지역 이름 몇 곳이 master 빌드와 달라(`(a,b)=>` ↔ `(a2,b2)=>`) 양쪽 문맥을 늘 요구하면 못 찾는다. 한 번이 아니면 멈춘다.
- 단언: ① 모든 조각이 한 자리에만 맞는다 ② 앞에서부터 되돌리면 공개본과 바이트까지 같다(공개본에만 있는 고침을 건드리지 않았다) ③ `new Function`으로 문법이 읽힌다 ④ 새 이름(`worldPhoneSection` · `worldPhoneEscape` · `listedItem` · `UNLISTED_APP_IDS` · `world-qr.svg`)이 후보에 있다.
- 새 모듈(`desktop/renderer/world-phone.mjs`)의 이름은 묶음 안 다른 이름과 겹치지 않게 지었다 — `esc`처럼 겹치면 esbuild가 뒤쪽 모듈의 이름 번호를 통째로 밀어(`esc2`→`esc3`) 차이가 74KB로 번진다.

## 11-11 결과

- 공개본 synk-policy `4a8998c8`(묶음 2,692,661자) · 앞 판 master `fea27092ce` 빌드 → 첫 후보는 조각 13개(2,694,354자), 검수 지적(라이브러리 개수 · WORLD 검색 안내 · 도움말 문장)을 고친 후보-b는 조각 15개(2,694,846자). `platform.css`는 공개본 = master라 새 판 그대로, `assets/world-qr.svg`는 새 파일(https://synk.im/world/, segno로 짓고 OpenCV로 읽어 주소 확인).
- 후보에 넣는 `platform.css` · `world-qr.svg`는 LF로 맞춘다 — 작업본(CRLF 사본)을 그대로 넣으면 LF인 공개본 css가 통째로 바뀐 것으로 남는다(Fable P3, `tr -d '\r'`로 후보-b를 다시 지음).
- 공개본 `account/` 전체에 후보를 얹은 사본으로 홈 · 둘러보기 · `#app/world` · 라이브러리 · 다운로드를 띄워 잡히지 않은 오류 0(404 둘은 사본 밖 사이트 뿌리 파일 `social-conversion.js` · `desktop/releases/preview.json`).
- `공개.js` 미리 보기(기준 `4a8998c`): 바뀔 파일 4(`world-qr.svg` 새 · `dist/platform.js` · `platform.css` · `platform.html` `?v=` 둘), 공개 전 점검 새 오류 · axe 치명 0, import 엇갈림 0.
