# 배포 점검 나눠 찍기 · axe 재현 (2026-10-27)

synk.im 배포 점검(synk-policy `.github/site-check/visual.mjs`)이 휴대폰 긴 쪽을 조각으로 찍기 시작한 뒤(`f05a681`) /path/ 휴대폰에만 axe 「심각 scrollable-region-focusable 0→2」가 새로 나온 까닭을 점검과 같은 실행기에서 재현한 기록이다. 경과와 고침은 [현장 노트 · 배포·공개](../../../현장노트/배포_공개.md) 「8,192px부터 쪽 머리」 절에 있다.

## 돌린 법

synk-policy에 이 폴더의 두 파일과 그때의 `visual.mjs`만 든 임시 가지(`diag/site-check-axe-20261027`)를 올려, 그 가지 push로 도는 워크플로(`diag-axe.yml`)를 실행기 ubuntu-24.04 · playwright 1.62.1 · Chromium 151.0.7922.34 · SwiftShader로 돌렸다. 결과를 받은 뒤 가지는 지웠다. 이 PC에서는 `PLAYWRIGHT_MODULE=<playwright 1.62.1 index.mjs> AXE_SOURCE=<axe-core 4.10.2 axe.min.js> node diag-axe.mjs`로 돌린다(`DIAG_FLOWS`로 흐름 글자, `DIAG_ROUTES`로 쪽과 횟수를 고른다). 이 PC에서는 4×4가 드물게만 난다.

- 실행 40371723478 — 흐름 A~J(환경 변수 없이), /path/ 3회 · /en/path/ · /pulse/ 1회
- 실행 40372800434 — 흐름 I · K(지금 `diag-axe.yml`의 환경 변수), /path/ 12회 · /en/path/ 3회

`결과요약.json`은 회차마다 axe 위반 수(`srf`), 4×4 resize가 난 때(`tiny`, ms), 마지막 resize와 axe 때의 가로 칸 상태(`내용 폭/칸 폭/tabindex`)다.

## 결과

| 흐름 | 위반 |
|---|---|
| A 옛: 한 번에 찍기 → axe | 0/5 |
| B 처음 판(f05a681): 나눠 찍기 → 새 쪽 잇기 → axe | 3/5 |
| C 둘째 판(b9313a5): 나눠 찍기 → axe → 새 쪽 잇기 | 1/5 |
| D 나눠 찍기 → 빈 쪽 열고 닫기 → axe | 2/5 |
| E 빈 쪽만 열고 닫기 → axe | 0/5 |
| I 나눠 찍기 → axe → 같은 쪽 잇기 | 2/15(둘째 실행) |
| K 나눠 찍기 → resize 바로잡기 → axe → 같은 쪽 잇기 | 0/15(둘째 실행) |

원인: 실행기 브라우저가 조각을 찍거나 같은 브라우저에 새 쪽을 열 때 가끔 열려 있던 쪽을 4×4로 resize했다가 390×844로 되돌리고, 되돌릴 때 배치가 아직 낡아(가로 칸 내용 폭 390/390, 평소 957/390) 쪽 스크립트가 「안 넘침」으로 보고 `tabindex`를 뗀다. 그 뒤 resize가 오지 않으면 뗀 채로 axe가 돈다. 한 번에 찍기(A)와 빈 쪽만 열기(E)에서는 4×4가 나지 않았다. 고친 판(K, synk-policy 공개본)은 나눠 찍은 쪽에서 axe 앞에 배치가 자리 잡은 뒤 resize를 한 번 더 보내고, 새 쪽을 열지 않고 같은 쪽 안에서 잇는다 — 같은 쪽 잇기와 새 쪽 잇기의 JPEG는 세 쪽 모두 바이트가 같았다.
