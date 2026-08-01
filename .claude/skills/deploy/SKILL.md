---
name: deploy
description: SYNK 배포 3종 세트 — 구문검사(node --check) → git 커밋 → git push → clasp push(라이브)를 순서 보장으로 실행한다. Code.js·contents_*.js·appsscript.json 등 Apps Script 코드를 변경한 뒤 라이브에 반영할 때 항상 이 스킬을 쓴다. "배포해줘", "/deploy", "라이브 반영"에 트리거.
---

# /deploy — SYNK 배포 파이프라인

목적: **GitHub(백업)과 Google Apps Script(라이브)가 어긋나는 사고 방지.** 구문 깨진 코드가 라이브에 올라가는 것 차단.

## 도구 경로 (PATH에 없음 — 전체 경로 사용)
- node: `"/c/Program Files/nodejs/node.exe"` (Bash) / `& "C:\Program Files\nodejs\node.exe"` (PowerShell)
- clasp: `"/c/Users/q1212/AppData/Roaming/npm/clasp.cmd"`
- 작업 디렉토리: `C:\Users\q1212\Documents\SYNK-appsscript`

## 절차 (순서 엄수 — 하나라도 실패하면 다음 단계 진행 금지)

1. **오염 확인**: `git status --short` — 내 작업이 아닌 변경(다른 세션 흔적)이 섞여 있으면 멈추고 유호님께 보고. `docs/세션보드.md`에 다른 세션이 같은 파일 '작업중'이면 조율 먼저.
2. **구문 검사**: 저장소 루트의 모든 `.js` 파일에 `node --check` 실행. **하나라도 실패 → 배포 중단**, 원인 수정 먼저.
   ```bash
   for f in *.js; do "/c/Program Files/nodejs/node.exe" --check "$f" || exit 1; done
   ```
   이어서 **안전 불변식 테스트**를 돌린다 — 구문은 멀쩡해도 실데이터를 지키는 불변식(야간작업 순서·브리핑 큐 보존·아카이브 8열·리포트 PNG 첨부 등)을 깨는 변경을 라이브 반영 전에 잡는다.
   ```bash
   "/c/Program Files/nodejs/node.exe" --test tests/*.test.js
   ```
   **`fail` 0이 아니면 배포 중단**(`todo`는 미구현 후속 과제 표시라 무시). 정상 리팩터로 마커 문자열이 바뀌어 실패하면 테스트를 함께 갱신하고 재실행한다.
3. **appsscript.json 검증**: `node -e "JSON.parse(require('fs').readFileSync('appsscript.json','utf8'))"` — 임시 webapp 설정 등 검증 잔재가 남아있지 않은지 눈으로도 확인.
4. **버전 채번 → 커밋**
   - Code.js·contents_*.js를 고쳤으면 **번호를 직접 고르지 말고 채번기를 쓴다**:
     ```bash
     node tools/bump-version.js --desc "한 줄 요약"
     ```
     origin/master·로컬 브랜치 전부·예약 태그를 훑어 다음 번호를 정하고, **그 번호를 태그로 origin에 push해 원자적으로 예약**한 뒤 `SYNK_VERSION`에 기입한다. 두 세션이 같은 순간에 돌려도 한쪽만 성공한다(2026-08-01 하루 6회 동시 발번의 근본 대책 — 사람이 고르는 한 충돌은 반복된다). 조회만 하려면 `--dry`.
   - 그 다음 `git diff --stat`으로 내 작업만 들어있는지 확인하고 커밋. 메시지 형식: `[v9.xx] 제목 — 요약`(채번기가 알려준 번호 그대로) + `Co-Authored-By: Claude <모델명> <noreply@anthropic.com>`.
   - `docs/버전_이력.md` 맨 아래에 같은 번호로 한 줄 추가.
5. **GitHub 백업**: `git push origin master`.
6. **라이브 배포**: `clasp push --force`.
7. **보고**: 커밋 해시 + "GitHub·라이브 동기화 완료"를 1줄로. 트리거가 코드를 쓰는 시각(07시 morning, 14/22시 calc, 월 07시 weekly)을 감안해 첫 실전 작동 시점을 알려줄 것.

## 금지
- 구문 검사 없이 clasp push 단독 실행 금지.
- 커밋 없이 clasp push 금지 (라이브와 git 이력 어긋남).
- 다른 세션의 미커밋 변경을 내 커밋에 쓸어담기 금지.

## 기계 게이트 (clasp-guard 훅 — 2026-07-20 도입)
Claude Code 세션에서는 위 순서를 어긴 `clasp push`/`clasp deploy`를 `.claude/hooks/clasp-guard.js`(PreToolUse 훅)가 **자동 차단**한다 — 루트 .js 구문·`tests/*.test.js`·배포 파일 미커밋·GitHub 미push 4가지 불변식을 실시간 검사. 차단 사유가 뜨면 우회하려 들지 말고 사유를 해소한 뒤 재시도한다. 훅 수정 시 회귀 점검: `node tests/clasp-guard.check.js`.

## 라이브 함수 검증이 필요할 때 (선택)
`clasp run`은 GCP 불일치로 불가. 검증된 우회법(임시 토큰 doGet 러너 → create-deployment → HTTP 호출 → **러너 제거 + delete-deployment + 404 확인**)은 메모리 `synk-tooling-paths` 참조. 러너를 남긴 채 종료 금지. 이 절차의 push는 임시 코드가 미커밋이라 게이트에 걸린다 — 명령 앞에 `CLASP_GUARD_BYPASS=1`을 붙여 의식적으로 우회한다(이 절차 외 우회 금지).
