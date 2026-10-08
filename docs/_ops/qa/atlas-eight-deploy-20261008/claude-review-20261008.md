# Claude 최종 검수 — Atlas 8종 보완 배포 후보 (2026-10-08)

> 유호님 10-08 10:2x 「지금 아틀라스엔진 gpt로 업그레이드하고 배포중인데 제대로한건지 검수해주고 별로면 발전시켜줘. 나 자러갈거니까 자율주행으로 마무리 해줘」. GPT가 준비한 세 후보(정본·Talk·공개)를 Claude(Fable 5.1)가 별도 작업본에서 읽고 다시 돌려 검수했다. GPT 쪽 기록은 [README](README.md)·[보완 기록](../atlas-eight-fix-20261008/README.md).

## 1. 결론

**배포를 막는 문제는 없다.** GPT의 8종 점검(F1~F8)과 수정은 방향이 맞고, 실제로 재현된 결함을 고친 뒤 회귀 시험과 사본 검사를 붙였다. 여덟 엔진의 책임을 바꾸거나 새 엔진·자체 하네스를 더하지 않았고, 사용자 0명인 소개팅 쪽 세부 기능이 아니라 공개 게임·계정·맞춤 도구가 실제로 쓰는 사본과 서버 판정기를 맞추는 일이라 10-07 인계문의 「벗어난 방향」과도 반대다. 추가로 고칠 것이 없어 코드는 한 줄도 바꾸지 않았다.

**라이브 반영은 이 세션에서 하지 못했다.** Claude Code 자동 모드의 분류기가 Talk 함수 배포(리허설 `--적용`까지), 운영 프로젝트 배포대조 읽기, `gh run list`를 모두 막았다. 서버(2.4 판정기)보다 공개 번들(2.4)이 먼저 나가면 로그인 사용자의 기록 동기화가 거절되므로 공개 push도 하지 않았다. 실행 순서와 명령은 §4에 있고, 트랙 §1 「유호님 차례」에 걸어 두었다.

## 2. 직접 확인한 것

| 항목 | 결과 |
|---|---|
| 릴리스 커밋 코드 diff 정독 | `atlas/engine.js`(속성 순서 무관 중복 판정 `canonical`, 최신 결과 고른 뒤 제외 적용) · `tools/lib/atlas-copies.js`·`sync-atlas.js --all` · `prism래칫.js` 범위 확장 · `experiences/atlas-lab/interpretation.mjs`(문장 전체 일치·인용 범위·본인 문맥) · `consultation.mjs`(필수 확인 이어 묻기) · CI `npm ci`+`check:atlas:local` · `.gitattributes eol=lf`. 계약 2.4 유지, 동결 평가 문장(`tests/fixtures/*heldout*`) 변경 없음 |
| `npm ci --ignore-scripts` | 통과(잠금 파일과 package.json 일치, esbuild 0.28.1 win32·linux 항목 있음) |
| `npm run check:atlas:local` | 통과 — 학습 번들 10개·파일 사본 7개 |
| `node tools/sync-atlas.js --all --check` (Talk 후보 `1d6daa8` 작업본·website 후보 `bff0f32`를 형제로 지정) | 통과 — Talk 앱/서버 사본·Strata 지도 포함 |
| `node tools/prism래칫.js` | 범위 461 · 참조 0 · 등록 0 |
| GPT가 든 74개 시험 파일 | 내 작업본에 있는 72개 **851/851**(2개는 공용 작업본에만 있는 미커밋 시험). 첫 실행 1건 실패는 `atlas/personalization.js`가 CRLF로 체크아웃된 흔적이었고, 파일을 지우고 다시 받으니 통과 — GPT의 `root-newline-normalization.json`과 같은 현상 |
| Talk 후보 작업본 관련 시험 9파일 | **81/81** |
| Talk 후보 전체 시험 | 3218 중 20 실패 — 모두 이번 변경이 건드리지 않은 파일(`sha256`·`synk-account-restore-export`·`검수큐`·`복습스케줄`·`스폰통로`·`시험학습자표식`·`오디오스트림문지기`·`플래그게이트`). 기존 상태 또는 사본 환경 문제이며 master CI 상태는 분류기가 막아 확인 못 함 |
| 공개 후보(브랜치 `codex/atlas-eight-release-20261008`, 처음 `f0a4218`) 34파일 | 엔진 사본 14개 + 여행 모듈 5개가 내 병합 원본과 LF 기준 바이트 일치. 캐시 참조 20개는 `?v=<해시>` 추가만. 기준 `3b3aacf` = synk.im `origin/main` 현재 머리, 작업본 clean, `diff --check` 통과. ID·ID rehearsal `vendor/atlas-learning.js`가 들어 있어 2.3 번들이 2.4 기록을 거부하던 F1류 사고를 공개 ID 화면에서도 막는다 |
| Talk 후보 범위 | 운영 synk-account v40·synk-learning v36과 비교해 바뀌는 파일은 `synk-atlas.mjs`·`synk-atlas-summary.mjs`뿐(GPT 사전 대조 8/10·8/9 동일). 마이그레이션 없음. 운영 배포 머리 `eb3453f`는 `origin/master`의 조상 |
| 함수 공개 주소 익명 응답(배포 전 기준) | 리허설·운영 모두 OPTIONS 204(함수 자체 CORS)·GET 401 |

## 3. 메모(P3)

- 공용 작업본(`C:/Users/q1212/Documents/SYNK-appsscript`)에서 `.gitattributes`의 새 `eol=lf` 대상이 CRLF로 남아 있으면 `desktop/tests/renderer-personalization.test.cjs`가 해시 불일치로 실패한다. `git checkout HEAD -- 파일`은 다시 쓰지 않으니 파일을 지운 뒤 `git checkout HEAD -- 파일`로 받는다.
- Talk 전체 시험의 기존 실패 20개는 별도 정리 대상이다(이번 수정과 무관).
- 한글 단계(`experiences/hangul-stage`)는 공개 경로가 없어 이번 공개에 넣지 않았다(F1 수정은 저장소 번들에만).

## 4. 라이브 반영 순서 (유호님 또는 권한이 있는 세션)

도구 사본: `C:/Users/q1212/Documents/SYNK-appsscript/.tmp/atlas-eight-deploy-20261008/` — `talk-tool.cjs`(메인 `.env` 자격증명을 환경변수로만 넘겨 Talk 후보 작업본에서 도구 실행), `probe-functions.cjs`(익명 응답), `verify-public-live.cjs`(공개 34파일 해시 대조).

1. **Talk 리허설** — `node .tmp/atlas-eight-deploy-20261008/talk-tool.cjs tools/원격배포.js supabase/functions/synk-account --적용` 그리고 `… supabase/functions/synk-learning --적용`. 확인: `… tools/배포대조.js synk-account synk-learning`이 두 함수 「같다」, `node .tmp/atlas-eight-deploy-20261008/probe-functions.cjs rehearsal`이 OPTIONS 204.
2. **Talk 운영** — 같은 두 명령에 `--운영`을 더한다. 확인: `$env:SUPABASE_PROJECT_REF='qiwxeddwwnzkwalpsuty'`로 `배포대조` 읽기 「같다」, `probe-functions.cjs production` 204. 도구가 `docs/_ops/배포장부.jsonl`(후보 작업본)에 도장을 남기니 그 줄을 메인 Talk 작업본 장부에도 더한다.
3. **synk.im 공개** — 먼저 `node .tmp/atlas-eight-deploy-20261008/prepare-public-push.cjs`: 후보 브랜치를 지금의 `origin/main` 위로 다시 얹고(겹치는 파일이 있으면 멈춤) 34파일이 기록된 해시와 같은지 확인한 뒤 마지막 줄에 push 명령을 찍는다. 그 명령을 실행한다(11:1x에 main이 `bb7225c`로 움직여 후보는 `17122d771`로 다시 얹어 두었다). Pages 빌드 뒤 `node .tmp/atlas-eight-deploy-20261008/verify-public-live.cjs`가 34/34 same, GitHub Actions 「synk.im 배포 점검」 통과. `/try/entry-check/` 답 저장·새로고침 보존, `/id/` 익명 화면, `/try/travel/` 선호 저장을 공개 주소에서 눌러 본다.

push가 거절되면 `origin/main`이 또 움직인 것이니 `prepare-public-push.cjs`를 다시 돌린다(GPT [재개 기록](../../../../.tmp/atlas-eight-deploy-20261008/PUBLIC-RELEASE-RESUME.md)은 git 밖). 2단계가 끝나기 전에는 3단계를 하지 않는다.

## 5. 이 세션이 저장소에 한 것

- SYNK-appsscript `origin/master`에 GPT 릴리스 `001d225cf`·증거 `0b4b41de2`와 이 기록을 올렸다(기본 가지 병합). 로컬 공용 master에는 다른 세션의 미푸시 커밋을 그대로 두고 병합 커밋으로 얹었다.
- SYNK-talk `origin/master`에 후보 `1d6daa8`을 올렸다(운영 반영은 아직).
- synk-policy는 바꾸지 않았다.
