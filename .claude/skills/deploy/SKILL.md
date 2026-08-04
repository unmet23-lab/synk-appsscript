---
name: deploy
description: SYNK 배포 파이프라인 — 구문검사(node --check) → 안전 테스트 → 보안 검토 → git 커밋 → git push → clasp push(라이브)를 순서 보장으로 실행한다. Code.js·contents_*.js·appsscript.json 등 Apps Script 코드를 변경한 뒤 라이브에 반영할 때 항상 이 스킬을 쓴다. "배포해줘", "/deploy", "라이브 반영"에 트리거.
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
   "/c/Program Files/nodejs/node.exe" tools/test-ci.js
   ```
   **`fail` 0이 아니면 배포 중단**(`todo`는 미구현 후속 과제 표시라 무시). 정상 리팩터로 마커 문자열이 바뀌어 실패하면 테스트를 함께 갱신하고 재실행한다.
   > `node --test tests/*.test.js`가 아니라 **`tools/test-ci.js`를 쓴다.** 같은 스위트를 **빈 HOME·TZ=UTC**로 돌려 CI를 모사한다 — 로컬 머신에는 CI에 없는 것(로컬 시간대·홈의 메모리 정본·자격증명)이 있어서 **로컬 초록이 CI 초록을 뜻하지 않는다.** 2026-08-04에 두 세션이 각각 이 함정을 밟았고(F036·F039), 한 번은 **빨간 CI 위에서 라이브 배포가 나갔다** — clasp-guard는 로컬 스위트만 보므로 이 층은 게이트가 아니라 여기서 잡아야 한다. 급할 때 평소 러너로 돌렸다면 **보고에 "로컬 기준"이라고 층을 밝힌다.**
3. **appsscript.json 검증**: `node -e "JSON.parse(require('fs').readFileSync('appsscript.json','utf8'))"` — 임시 webapp 설정 등 검증 잔재가 남아있지 않은지 눈으로도 확인.
4. **보안 검토** — **반드시 커밋 전에.** `/security-review`는 *미커밋 변경분*을 읽으므로 커밋한 뒤엔 볼 것이 없다.
   ```bash
   node tools/deploy-security-check.js
   ```
   기계 검사 3종: ①소스에 박힌 고정 인증 토큰 ②`doGet` 안의 파괴적 연산 ③임시 배포 잔존. **exit 1이면 배포 중단.**
   이어서 채팅에 **`/security-review`** — 변경분을 읽어 주입·권한 경계·PII 노출을 판단 층에서 검토한다. **HIGH가 나오면 배포 중단.**
   기계 검사는 아는 패턴만 보고, `/security-review`는 처음 보는 결함을 본다 — 둘은 대체재가 아니다.
   > 2026-08-02 이 단계가 없어서 생긴 일: 임시 doGet 러너가 고정 토큰 하나로 익명 공개 엔드포인트(ANYONE_ANONYMOUS·소유자 권한 실행)를 열고 GET 한 번에 `deleteRow`를 돌렸는데, **구문검사·안전 테스트는 전부 초록이었다.** 재는 층이 달랐다.

5. **버전 채번 → 커밋**
   - Code.js·contents_*.js를 고쳤으면 **번호를 직접 고르지 말고 채번기를 쓴다**:
     ```bash
     node tools/bump-version.js --desc "한 줄 요약"
     ```
     origin/master·로컬 브랜치 전부·예약 태그를 훑어 다음 번호를 정하고, **그 번호를 태그로 origin에 push해 원자적으로 예약**한 뒤 `SYNK_VERSION`에 기입한다. 두 세션이 같은 순간에 돌려도 한쪽만 성공한다(2026-08-01 하루 6회 동시 발번의 근본 대책 — 사람이 고르는 한 충돌은 반복된다). 조회만 하려면 `--dry`.
   - **짜는 동안 헤더에 버전을 박지 않는다 — `[vNEXT]`라고 적는다.** 채번기가 같은 실행에서 엔진 파일 전체의 `[vNEXT]`를 확정 번호로 바꾼다. 진짜 번호를 먼저 박으면 채번까지의 사이에 CI가 빨개지고(safety `[v9.55]`) **그 적색이 남의 배포 게이트까지 막는다**(2026-08-04 하루 두 번). `--desc` 없이는 채번 자체가 거부된다(상수만 오르는 상태가 곧 적색이라).
   - 커밋 직전 **`node tools/bump-version.js --check`** — 상수·엔진 태그 일치와 `[vNEXT]` 잔존 0을 확인한다. exit 1이면 커밋하지 않는다.
   - 그 다음 `git diff --stat`으로 내 작업만 들어있는지 확인하고 커밋. 메시지 형식: `[v9.xx] 제목 — 요약`(채번기가 알려준 번호 그대로) + `Co-Authored-By: Claude <모델명> <noreply@anthropic.com>`.
   - `docs/버전_이력.md` 맨 아래에 같은 번호로 한 줄 추가.
6. **GitHub 백업**: `git push origin master`.
7. **라이브 배포**: `clasp push --force`.
   - ⚠ **push 는 라이브를 바꾸지 않는 프로젝트가 있다.** 웹앱이 **고정 버전 배포**를 서빙하면 push 는 프로젝트 파일만 갱신하고 접수 URL 은 옛 스냅샷을 계속 준다. 2026-08-05 실사고: 브랜드 키트 수리를 push 하고 「라이브 반영」이라 말할 뻔했는데, crewcard `@16` 이 v9.186 시점 카드를 그대로 서빙하고 있었다. (루트 프로젝트는 `@HEAD` 서빙이라 push 가 곧 라이브다 — **프로젝트마다 다르다**.)
   - 그래서 push 뒤 **`node tools/배포판점검.js`** 로 확인한다. 낡았으면 그 도구가 **명령을 통째로** 준다:
     ```bash
     cd <프로젝트> && clasp deploy --deploymentId <기존ID> --description "<설명> #fp:<지문>"
     ```
     **⛔ `--deploymentId` 를 빼면 새 배포가 생겨 접수 주소가 둘로 갈린다**(메모리 `crewcard-fork-handoff` 의 실사고). 실행 후 `clasp deployments` 로 **개수가 그대로**인지 본다.
   - `#fp:` 는 배포된 내용의 지문이다. `clasp` 이 배포 시각을 안 주기 때문에(실측) 설명에 심어 라이브가 스스로 「어느 코드인지」 말하게 한 것 — 지우지 말 것. 잊어도 `deploy-freshness` 훅이 push 직후 알린다.
8. **보고**: 커밋 해시 + "GitHub·라이브 동기화 완료"를 1줄로. 트리거가 코드를 쓰는 시각(07시 morning, 14/22시 calc, 월 07시 weekly)을 감안해 첫 실전 작동 시점을 알려줄 것.

## 금지
- 구문 검사 없이 clasp push 단독 실행 금지.
- 커밋 없이 clasp push 금지 (라이브와 git 이력 어긋남).
- 다른 세션의 미커밋 변경을 내 커밋에 쓸어담기 금지.

## 기계 게이트 (clasp-guard 훅 — 2026-07-20 도입)
Claude Code 세션에서는 위 순서를 어긴 `clasp push`/`clasp deploy`를 `.claude/hooks/clasp-guard.js`(PreToolUse 훅)가 **자동 차단**한다 — 루트 .js 구문·`tests/*.test.js`·배포 파일 미커밋·GitHub 미push·**배포 표면**(4단계 기계 검사와 같은 모듈) 5가지 불변식을 실시간 검사. 차단 사유가 뜨면 우회하려 들지 말고 사유를 해소한 뒤 재시도한다. 훅 수정 시 회귀 점검: `node tests/clasp-guard.check.js` + `node --test tests/배포표면.test.js`.

즉 4단계를 건너뛰어도 `clasp push`에서 다시 막힌다 — **절차를 기억하는 책임이 사람에게 없다.** 4단계는 "일찍 알기 위해" 있는 것이지 유일한 방어선이 아니다.

## 라이브 함수 검증이 필요할 때 (선택)
`clasp run`은 GCP 불일치로 불가. 검증된 우회법(임시 토큰 doGet 러너 → create-deployment → HTTP 호출 → **러너 제거 + delete-deployment + 404 확인**)은 메모리 `synk-tooling-paths` 참조. 러너를 남긴 채 종료 금지. 이 절차의 push는 임시 코드가 미커밋이라 게이트에 걸린다 — 명령 앞에 `CLASP_GUARD_BYPASS=1`을 붙여 의식적으로 우회한다(이 절차 외 우회 금지). 이 우회는 4단계 보안 검토까지 함께 건너뛴다는 뜻이므로, 러너 자체의 안전은 아래 3가지를 손으로 지킨다.

- **토큰을 소스에 박지 않는다.** `PropertiesService.getScriptProperties()`에서 읽는다 — 쿼리스트링 토큰은 Stackdriver 로그·브라우저 히스토리·붙여넣은 채팅에 전부 남고 만료가 없다.
- **파괴적 연산은 `doGet`에 넣지 않는다.** GET은 링크 미리보기 봇·prefetch가 임의로 부른다 — URL을 채팅에 붙여넣는 것만으로 실행된다. 공격자가 필요 없다.
- **코드를 지워도 라이브는 안 닫힌다.** versioned 배포는 그 시점 코드를 영구 고정해 계속 서빙하므로, 원복 push 뒤에도 그 URL은 살아서 러너를 그대로 응답한다. **`clasp undeploy <배포ID>` + URL 404 확인까지 해야 끝난다.** 2026-08-02 실측: 러너 4개(@28~@31)가 이렇게 살아남았다.

정리를 잊어도 다음 `clasp push`에서 배포 표면 검사가 잡는다(설명에 `temp`·`임시`·`runner`가 들어간 배포를 찾는다) — **그러니 임시 배포 이름에 `temp-`를 붙인다.** 이름이 감시의 손잡이다.
